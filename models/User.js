const { query } = require('../config/db');
const cache = require('../services/cacheService');

/**
 * User (Patient) Model
 * Handles all database operations for patients/users
 */

class User {
  /**
   * Create the users table
   */
  static async createTable() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS patients (
        id SERIAL PRIMARY KEY,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        id_passport_number VARCHAR(50) UNIQUE NOT NULL,
        nationality VARCHAR(20) NOT NULL CHECK (nationality IN ('South African', 'Other')),
        date_of_birth DATE,
        gender VARCHAR(20),
        address TEXT,
        city VARCHAR(100),
        state VARCHAR(100),
        zip_code VARCHAR(20),
        blood_type VARCHAR(5),
        allergies TEXT,
        medical_history TEXT,
        emergency_contact_name VARCHAR(200),
        emergency_contact_phone VARCHAR(20),
        status VARCHAR(20) DEFAULT 'active',
        role VARCHAR(20) DEFAULT 'patient' CHECK (role IN ('patient')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_patients_email ON patients(email);
      CREATE INDEX IF NOT EXISTS idx_patients_id_passport ON patients(id_passport_number);
      CREATE INDEX IF NOT EXISTS idx_patients_status ON patients(status);
    `;
    
    try {
      await query(createTableQuery);
      console.log('✅ Users table created successfully');
    } catch (error) {
      console.error('❌ Error creating users table:', error);
      throw error;
    }
  }

  /**
   * Create a new user
   */
  static async create(userData) {
    const {
      first_name,
      last_name,
      email,
      password_hash,
      phone,
      id_passport_number,
      nationality,
      date_of_birth,
      gender,
      address,
      city,
      state,
      zip_code,
      blood_type,
      allergies,
      medical_history,
      emergency_contact_name,
      emergency_contact_phone
    } = userData;

    const insertQuery = `
      INSERT INTO patients (
        first_name, last_name, email, password_hash, phone, id_passport_number, nationality,
        date_of_birth, gender, address, city, state, zip_code,
        blood_type, allergies, medical_history, 
        emergency_contact_name, emergency_contact_phone
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *
    `;

    const values = [
      first_name, last_name, email, password_hash, phone, id_passport_number, nationality,
      date_of_birth, gender, address, city, state, zip_code,
      blood_type, allergies, medical_history,
      emergency_contact_name, emergency_contact_phone
    ];

    const result = await query(insertQuery, values);
    return result.rows[0];
  }

  /**
   * Find user by email
   */
  static async findByEmail(email) {
    const cacheKey = `user:email:${email}`;
    
    // Check cache first
    let user = await cache.get(cacheKey);
    if (user) {
      return user;
    }

    // Query database
    const result = await query('SELECT * FROM patients WHERE email = $1', [email]);
    user = result.rows[0];

    // Cache the result (30 minutes)
    if (user) {
      await cache.set(cacheKey, user, 1800);
    }

    return user;
  }

  /**
   * Find user by ID
   */
  static async findById(id) {
    const cacheKey = `user:id:${id}`;
    
    // Check cache first
    let user = await cache.get(cacheKey);
    if (user) {
      return user;
    }

    // Query database
    const result = await query('SELECT * FROM patients WHERE id = $1', [id]);
    user = result.rows[0];

    // Cache the result (30 minutes)
    if (user) {
      await cache.set(cacheKey, user, 1800);
    }

    return user;
  }

  /**
   * Find user by ID/Passport number
   */
  static async findByIdPassport(id_passport_number) {
    const result = await query('SELECT * FROM patients WHERE id_passport_number = $1', [id_passport_number]);
    return result.rows[0];
  }

  /**
   * Find user by OAuth provider
   */
  static async findByOAuthProvider(provider, providerId) {
    const result = await query(
      'SELECT * FROM patients WHERE oauth_provider = $1 AND oauth_provider_id = $2',
      [provider, providerId]
    );
    return result.rows[0];
  }

  /**
   * Create a new OAuth user
   * OAuth users may not have all required fields initially
   */
  static async createOAuthUser(userData) {
    const {
      first_name,
      last_name,
      email,
      oauth_provider,
      oauth_provider_id,
      oauth_profile_picture,
      phone,
      id_passport_number,
      nationality,
      date_of_birth,
      gender,
      address,
      city,
      state,
      zip_code,
      blood_type,
      allergies,
      medical_history,
      emergency_contact_name,
      emergency_contact_phone
    } = userData;

    const insertQuery = `
      INSERT INTO patients (
        first_name, last_name, email, phone, id_passport_number, nationality,
        date_of_birth, gender, address, city, state, zip_code,
        blood_type, allergies, medical_history, 
        emergency_contact_name, emergency_contact_phone,
        oauth_provider, oauth_provider_id, oauth_profile_picture,
        status, role, email_verified, email_verified_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, 'active', 'patient', true, CURRENT_TIMESTAMP)
      RETURNING *
    `;

    const values = [
      first_name, last_name, email, phone, id_passport_number, nationality,
      date_of_birth, gender, address, city, state, zip_code,
      blood_type, allergies, medical_history,
      emergency_contact_name, emergency_contact_phone,
      oauth_provider, oauth_provider_id, oauth_profile_picture
    ];

    const result = await query(insertQuery, values);
    return result.rows[0];
  }

  /**
   * Update user
   */
  static async update(id, userData) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(userData).forEach((key) => {
      if (userData[key] !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(userData[key]);
        paramCount++;
      }
    });

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const updateQuery = `
      UPDATE patients 
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await query(updateQuery, values);
    const updatedUser = result.rows[0];

    // Invalidate cache
    if (updatedUser) {
      await cache.del(`user:id:${id}`);
      await cache.del(`user:email:${updatedUser.email}`);
    }

    return updatedUser;
  }

  /**
   * Get all users
   */
  static async findAll(limit = 100, offset = 0) {
    const result = await query(
      'SELECT * FROM patients ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    return result.rows;
  }

  /**
   * Mark a patient's email as verified.
   * Sets email_verified = true and stamps email_verified_at = NOW().
   * Invalidates the user cache so subsequent reads see the updated flag.
   */
  static async markEmailVerified(id) {
    const result = await query(
      `UPDATE patients
       SET email_verified = true,
           email_verified_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    const updatedUser = result.rows[0];

    if (updatedUser) {
      await cache.del(`user:id:${id}`);
      await cache.del(`user:email:${updatedUser.email}`);
    }

    return updatedUser;
  }

  /**
   * Delete user (soft delete by updating status)
   */
  static async delete(id) {
    const result = await query(
      'UPDATE patients SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      ['inactive', id]
    );
    return result.rows[0];
  }
}

module.exports = User;
