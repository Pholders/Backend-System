const { query } = require('../config/db');

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
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
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
      INSERT INTO users (
        first_name, last_name, email, password_hash, phone, 
        date_of_birth, gender, address, city, state, zip_code,
        blood_type, allergies, medical_history, 
        emergency_contact_name, emergency_contact_phone
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `;

    const values = [
      first_name, last_name, email, password_hash, phone,
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
    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0];
  }

  /**
   * Find user by ID
   */
  static async findById(id) {
    const result = await query('SELECT * FROM users WHERE id = $1', [id]);
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
      UPDATE users 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await query(updateQuery, values);
    return result.rows[0];
  }

  /**
   * Get all users
   */
  static async findAll(limit = 100, offset = 0) {
    const result = await query(
      'SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    return result.rows;
  }

  /**
   * Delete user (soft delete by updating status)
   */
  static async delete(id) {
    const result = await query(
      'UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      ['inactive', id]
    );
    return result.rows[0];
  }
}

module.exports = User;
