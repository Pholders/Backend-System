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
        license_number VARCHAR(100) UNIQUE NOT NULL,
        specialization VARCHAR(100) NOT NULL,
        qualification VARCHAR(255),
        experience_years INTEGER,
        hospital_affiliation VARCHAR(255),
        address TEXT,
        city VARCHAR(100),
        state VARCHAR(100),
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
      CREATE INDEX IF NOT EXISTS idx_doctors_license ON doctors(license_number);
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
      license_number,
      specialization,
      qualification,
      experience_years,
      hospital_affiliation,
      address,
      city,
      state,
      zip_code,
      consultation_fee,
      bio,
      profile_image,
      availability
    } = doctorData;

    const insertQuery = `
      INSERT INTO doctors (
        first_name, last_name, email, password_hash, phone,
        license_number, specialization, qualification, experience_years,
        hospital_affiliation, address, city, state, zip_code,
        consultation_fee, bio, profile_image, availability
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *
    `;

    const values = [
      first_name, last_name, email, password_hash, phone,
      license_number, specialization, qualification, experience_years,
      hospital_affiliation, address, city, state, zip_code,
      consultation_fee, bio, profile_image, JSON.stringify(availability)
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
   * Find doctor by license number
   */
  static async findByLicense(license_number) {
    const result = await query('SELECT * FROM doctors WHERE license_number = $1', [license_number]);
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
}

module.exports = Doctor;
