const { query } = require('../config/db');

class Admin {
  static async createTable() {
    // Check if table already exists
    const checkTableQuery = `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'admins');`;
    const result = await query(checkTableQuery);
    if (result.rows[0].exists) {
      return; // Table exists, skip creation and logging
    }

    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);
      CREATE INDEX IF NOT EXISTS idx_admins_status ON admins(status);
    `;

    try {
      await query(createTableQuery);
      console.log('✅ Admins table created successfully');
    } catch (error) {
      console.error('❌ Error creating admins table:', error);
      throw error;
    }
  }

  static async create(adminData) {
    const { first_name, last_name, email, password_hash, phone } = adminData;

    const result = await query(
      `INSERT INTO admins (first_name, last_name, email, password_hash, phone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [first_name, last_name, email, password_hash, phone]
    );
    return result.rows[0];
  }

  static async findByEmail(email) {
    const result = await query('SELECT * FROM admins WHERE email = $1', [email]);
    return result.rows[0];
  }

  static async findById(id) {
    const result = await query('SELECT * FROM admins WHERE id = $1', [id]);
    return result.rows[0];
  }

  static async update(id, adminData) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(adminData).forEach((key) => {
      if (adminData[key] !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(adminData[key]);
        paramCount++;
      }
    });

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await query(
      `UPDATE admins SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );
    return result.rows[0];
  }
}

module.exports = Admin;
