const { query } = require('../config/db');

/**
 * Doctor Model
 * Handles all database operations for doctors
 */

class Doctor {
  /**
   * Create the doctors table
   */
  static async createTable() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS doctors (
        id SERIAL PRIMARY KEY,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        hpcsa_number VARCHAR(100) UNIQUE NOT NULL,
        specialization VARCHAR(100) NOT NULL,
        experience INTEGER,
        clinic_name VARCHAR(255),
        city VARCHAR(100),
        province VARCHAR(100),
        qualification VARCHAR(255),
        address TEXT,
        zip_code VARCHAR(20),
        consultation_fee DECIMAL(10, 2),
        bio TEXT,
        profile_image VARCHAR(500),
        availability JSONB,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_doctors_email ON doctors(email);
      CREATE INDEX IF NOT EXISTS idx_doctors_hpcsa ON doctors(hpcsa_number);
      CREATE INDEX IF NOT EXISTS idx_doctors_specialization ON doctors(specialization);
      CREATE INDEX IF NOT EXISTS idx_doctors_status ON doctors(status);
    `;
    
    try {
      await query(createTableQuery);
      console.log('✅ Doctors table created successfully');
    } catch (error) {
      console.error('❌ Error creating doctors table:', error);
      throw error;
    }
  }

  /**
   * Create a new doctor
   */
  static async create(doctorData) {
    const {
      first_name,
      last_name,
      email,
      password_hash,
      phone,
      hpcsa_number,
      specialization,
      experience,
      clinic_name,
      city,
      province,
      latitude,
      longitude,
      clinic_address
    } = doctorData;

    const insertQuery = `
      INSERT INTO doctors (
        first_name, last_name, email, password_hash, phone,
        hpcsa_number, specialization, experience,
        clinic_name, city, province, latitude, longitude, clinic_address
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;

    const values = [
      first_name, last_name, email, password_hash, phone,
      hpcsa_number, specialization, experience,
      clinic_name, city, province, latitude, longitude, clinic_address
    ];

    const result = await query(insertQuery, values);
    return result.rows[0];
  }

  /**
   * Find doctor by email
   */
  static async findByEmail(email) {
    const result = await query('SELECT * FROM doctors WHERE email = $1', [email]);
    return result.rows[0];
  }

  /**
   * Find doctor by HPCSA number
   */
  static async findByHpcsaNumber(hpcsa_number) {
    const result = await query('SELECT * FROM doctors WHERE hpcsa_number = $1', [hpcsa_number]);
    return result.rows[0];
  }

  /**
   * Find doctor by ID
   */
  static async findById(id) {
    const result = await query('SELECT * FROM doctors WHERE id = $1', [id]);
    return result.rows[0];
  }

  /**
   * Update doctor
   */
  static async update(id, doctorData) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(doctorData).forEach((key) => {
      if (doctorData[key] !== undefined) {
        if (key === 'availability') {
          fields.push(`${key} = $${paramCount}`);
          values.push(JSON.stringify(doctorData[key]));
        } else {
          fields.push(`${key} = $${paramCount}`);
          values.push(doctorData[key]);
        }
        paramCount++;
      }
    });

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const updateQuery = `
      UPDATE doctors 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await query(updateQuery, values);
    return result.rows[0];
  }

  /**
   * Get all doctors
   */
  static async findAll(limit = 100, offset = 0) {
    const result = await query(
      'SELECT * FROM doctors ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    return result.rows;
  }

  /**
   * Find doctors by specialization
   */
  static async findBySpecialization(specialization) {
    const result = await query(
      'SELECT * FROM doctors WHERE specialization = $1 AND status = $2 ORDER BY created_at DESC',
      [specialization, 'active']
    );
    return result.rows;
  }

  /**
   * Delete doctor (soft delete by updating status)
   */
  static async delete(id) {
    const result = await query(
      'UPDATE doctors SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      ['inactive', id]
    );
    return result.rows[0];
  }

  /**
   * Find doctors with location data (for nearby searches)
   */
  static async findDocsWithLocation() {
    const result = await query(
      `SELECT * FROM doctors 
       WHERE status = $1 AND latitude IS NOT NULL AND longitude IS NOT NULL 
       ORDER BY created_at DESC`,
      ['active']
    );
    return result.rows;
  }

  /**
   * Find nearby doctors by coordinates
   */
  static async findNearby(latitude, longitude, radiusKm = 15) {
    // Uses PostGIS-style distance calculation
    // Distance formula: sqrt((lat2-lat1)^2 + (lon2-lon1)^2) * 111 km per degree
    const result = await query(
      `SELECT *, 
        (
          6371 * acos(
            cos(radians($1)) * cos(radians(latitude)) * 
            cos(radians(longitude) - radians($2)) + 
            sin(radians($1)) * sin(radians(latitude))
          )
        ) as distance_km
       FROM doctors
       WHERE status = $3 AND latitude IS NOT NULL AND longitude IS NOT NULL
       HAVING (
         6371 * acos(
           cos(radians($1)) * cos(radians(latitude)) * 
           cos(radians(longitude) - radians($2)) + 
           sin(radians($1)) * sin(radians(latitude))
         )
       ) <= $4
       ORDER BY distance_km ASC`,
      [latitude, longitude, 'active', radiusKm]
    );
    return result.rows;
  }
}

module.exports = Doctor;
