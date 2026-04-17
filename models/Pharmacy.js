const { query } = require('../config/db');

/**
 * Pharmacy Model
 * Handles all database operations for pharmacies
 */

class Pharmacy {
  /**
   * Create the pharmacies table
   */
  static async createTable() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS pharmacies (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        license_number VARCHAR(100) UNIQUE NOT NULL,
        owner_name VARCHAR(200),
        registration_number VARCHAR(100),
        address TEXT NOT NULL,
        city VARCHAR(100) NOT NULL,
        state VARCHAR(100) NOT NULL,
        zip_code VARCHAR(20),
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        operating_hours JSONB,
        services TEXT[],
        delivery_available BOOLEAN DEFAULT false,
        delivery_radius DECIMAL(10, 2),
        website VARCHAR(500),
        description TEXT,
        profile_image VARCHAR(500),
        is_24_hours BOOLEAN DEFAULT false,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_pharmacies_email ON pharmacies(email);
      CREATE INDEX IF NOT EXISTS idx_pharmacies_license ON pharmacies(license_number);
      CREATE INDEX IF NOT EXISTS idx_pharmacies_city ON pharmacies(city);
      CREATE INDEX IF NOT EXISTS idx_pharmacies_status ON pharmacies(status);
      CREATE INDEX IF NOT EXISTS idx_pharmacies_location ON pharmacies(latitude, longitude);
    `;
    
    try {
      await query(createTableQuery);
      console.log('✅ Pharmacies table created successfully');
    } catch (error) {
      console.error('❌ Error creating pharmacies table:', error);
      throw error;
    }
  }

  /**
   * Create a new pharmacy
   */
  static async create(pharmacyData) {
    const {
      name,
      email,
      password_hash,
      phone,
      license_number,
      owner_name,
      registration_number,
      address,
      city,
      state,
      zip_code,
      latitude,
      longitude,
      operating_hours,
      services,
      delivery_available,
      delivery_radius,
      website,
      description,
      profile_image,
      is_24_hours
    } = pharmacyData;

    const insertQuery = `
      INSERT INTO pharmacies (
        name, email, password_hash, phone, license_number,
        owner_name, registration_number, address, city, state, zip_code,
        latitude, longitude, operating_hours, services,
        delivery_available, delivery_radius, website, description,
        profile_image, is_24_hours
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      RETURNING *
    `;

    const values = [
      name, email, password_hash, phone, license_number,
      owner_name, registration_number, address, city, state, zip_code,
      latitude, longitude, JSON.stringify(operating_hours), services,
      delivery_available, delivery_radius, website, description,
      profile_image, is_24_hours
    ];

    const result = await query(insertQuery, values);
    return result.rows[0];
  }

  /**
   * Find pharmacy by email
   */
  static async findByEmail(email) {
    const result = await query('SELECT * FROM pharmacies WHERE email = $1', [email]);
    return result.rows[0];
  }

  /**
   * Find pharmacy by license number
   */
  static async findByLicense(license_number) {
    const result = await query('SELECT * FROM pharmacies WHERE license_number = $1', [license_number]);
    return result.rows[0];
  }

  /**
   * Find pharmacy by ID
   */
  static async findById(id) {
    const result = await query('SELECT * FROM pharmacies WHERE id = $1', [id]);
    return result.rows[0];
  }

  /**
   * Update pharmacy
   */
  static async update(id, pharmacyData) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(pharmacyData).forEach((key) => {
      if (pharmacyData[key] !== undefined) {
        if (key === 'operating_hours') {
          fields.push(`${key} = $${paramCount}`);
          values.push(JSON.stringify(pharmacyData[key]));
        } else {
          fields.push(`${key} = $${paramCount}`);
          values.push(pharmacyData[key]);
        }
        paramCount++;
      }
    });

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const updateQuery = `
      UPDATE pharmacies 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await query(updateQuery, values);
    return result.rows[0];
  }

  /**
   * Get all pharmacies
   */
  static async findAll(limit = 100, offset = 0) {
    const result = await query(
      'SELECT * FROM pharmacies ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    return result.rows;
  }

  /**
   * Find pharmacies by city
   */
  static async findByCity(city) {
    const result = await query(
      'SELECT * FROM pharmacies WHERE city = $1 AND status = $2 ORDER BY name',
      [city, 'active']
    );
    return result.rows;
  }

  /**
   * Find nearby pharmacies using coordinates
   */
  static async findNearby(latitude, longitude, radiusKm = 10) {
    const searchQuery = `
      SELECT *,
        (
          6371 * acos(
            cos(radians($1)) * cos(radians(latitude)) *
            cos(radians(longitude) - radians($2)) +
            sin(radians($1)) * sin(radians(latitude))
          )
        ) AS distance
      FROM pharmacies
      WHERE status = 'active'
        AND latitude IS NOT NULL
        AND longitude IS NOT NULL
      HAVING distance < $3
      ORDER BY distance
    `;

    const result = await query(searchQuery, [latitude, longitude, radiusKm]);
    return result.rows;
  }

  /**
   * Find pharmacies with delivery service
   */
  static async findWithDelivery() {
    const result = await query(
      'SELECT * FROM pharmacies WHERE delivery_available = true AND status = $1 ORDER BY name',
      ['active']
    );
    return result.rows;
  }

  /**
   * Delete pharmacy (soft delete by updating status)
   */
  static async delete(id) {
    const result = await query(
      'UPDATE pharmacies SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      ['inactive', id]
    );
    return result.rows[0];
  }
}

module.exports = Pharmacy;
