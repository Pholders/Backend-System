const { query } = require('../config/db');

/**
 * OTP Model
 * Handles OTP generation, storage, and verification
 */

class OTP {
  /**
   * Create the otps table
   */
  static async createTable() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS otps (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        otp_code VARCHAR(6) NOT NULL,
        purpose VARCHAR(50) NOT NULL DEFAULT 'login',
        expires_at TIMESTAMP NOT NULL,
        is_used BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_otps_user_id ON otps(user_id);
      CREATE INDEX IF NOT EXISTS idx_otps_code ON otps(otp_code);
      CREATE INDEX IF NOT EXISTS idx_otps_expires ON otps(expires_at);
    `;
    
    try {
      await query(createTableQuery);
      console.log('✅ OTPs table created successfully');
    } catch (error) {
      console.error('❌ Error creating otps table:', error);
      throw error;
    }
  }

  /**
   * Generate random 6-digit OTP
   */
  static generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Create new OTP
   * @param {number} userId - ID of the user/doctor/pharmacy
   * @param {string} purpose - Purpose of the OTP (e.g. 'login')
   * @param {string} userType - Type of entity: 'patient', 'doctor', or 'pharmacy'
   * @param {number} expiryMinutes - OTP validity in minutes
   */
  static async create(userId, purpose = 'login', userType = 'patient', expiryMinutes = 10) {
    const otpCode = this.generateCode();
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    // Invalidate previous unused OTPs for this entity and purpose
    await query(
      'UPDATE otps SET is_used = true WHERE user_id = $1 AND purpose = $2 AND user_type = $3 AND is_used = false',
      [userId, purpose, userType]
    );

    const insertQuery = `
      INSERT INTO otps (user_id, otp_code, purpose, expires_at, user_type)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const result = await query(insertQuery, [userId, otpCode, purpose, expiresAt, userType]);
    return result.rows[0];
  }

  /**
   * Verify OTP
   * @param {number} userId - ID of the user/doctor/pharmacy
   * @param {string} otpCode - The OTP code to verify
   * @param {string} purpose - Purpose of the OTP
   * @param {string} userType - Type of entity: 'patient', 'doctor', or 'pharmacy'
   */
  static async verify(userId, otpCode, purpose = 'login', userType = 'patient') {
    const selectQuery = `
      SELECT * FROM otps 
      WHERE user_id = $1 
        AND otp_code = $2 
        AND purpose = $3
        AND user_type = $4
        AND is_used = false 
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const result = await query(selectQuery, [userId, otpCode, purpose, userType]);

    if (result.rows.length === 0) {
      return { valid: false, message: 'Invalid or expired OTP' };
    }

    // Mark OTP as used
    await query(
      'UPDATE otps SET is_used = true WHERE id = $1',
      [result.rows[0].id]
    );

    return { valid: true, otp: result.rows[0] };
  }

  /**
   * Delete expired OTPs (cleanup)
   */
  static async deleteExpired() {
    await query('DELETE FROM otps WHERE expires_at < NOW() OR is_used = true');
  }

  /**
   * Get OTP by user and purpose
   */
  static async getLatest(userId, purpose = 'login', userType = 'patient') {
    const result = await query(
      `SELECT * FROM otps 
       WHERE user_id = $1 AND purpose = $2 AND user_type = $3 AND is_used = false 
       ORDER BY created_at DESC LIMIT 1`,
      [userId, purpose, userType]
    );
    return result.rows[0];
  }
}

module.exports = OTP;
