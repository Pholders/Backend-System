const { query } = require('../config/db');
const { v4: uuidv4 } = require('uuid');

/**
 * Session Model
 * Manages user session tracking
 */

class Session {
  /**
   * Create sessions table
   */
  static async createTable() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id INTEGER NOT NULL,
        user_type VARCHAR(50) NOT NULL CHECK (user_type IN ('patient', 'doctor', 'pharmacy', 'admin')),
        token_hash VARCHAR(255) NOT NULL,
        ip_address VARCHAR(50),
        user_agent TEXT,
        device_info JSONB,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        revoked_at TIMESTAMP,
        revocation_reason VARCHAR(255)
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
      CREATE INDEX IF NOT EXISTS idx_sessions_user_type ON sessions(user_type);
      CREATE INDEX IF NOT EXISTS idx_sessions_is_active ON sessions(is_active);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
    `;

    try {
      await query(createTableQuery);
      console.log('✅ Sessions table created successfully');
    } catch (error) {
      console.error('❌ Error creating sessions table:', error);
      throw error;
    }
  }

  /**
   * Create a new session
   */
  static async create(userId, userType, tokenHash, ipAddress, userAgent, deviceInfo) {
    const insertQuery = `
      INSERT INTO sessions (user_id, user_type, token_hash, ip_address, user_agent, device_info, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '7 days')
      RETURNING *
    `;

    const values = [
      userId,
      userType,
      tokenHash,
      ipAddress,
      userAgent,
      deviceInfo ? JSON.stringify(deviceInfo) : null
    ];

    const result = await query(insertQuery, values);
    return result.rows[0];
  }

  /**
   * Find active session by token hash
   */
  static async findByTokenHash(tokenHash) {
    const selectQuery = `
      SELECT * FROM sessions 
      WHERE token_hash = $1 AND is_active = true AND expires_at > NOW()
    `;

    const result = await query(selectQuery, [tokenHash]);
    return result.rows[0] || null;
  }

  /**
   * Update last activity
   */
  static async updateLastActivity(sessionId) {
    const updateQuery = `
      UPDATE sessions 
      SET last_activity_at = NOW() 
      WHERE id = $1
      RETURNING *
    `;

    const result = await query(updateQuery, [sessionId]);
    return result.rows[0];
  }

  /**
   * Revoke session (logout)
   */
  static async revoke(sessionId, reason = 'User logout') {
    const updateQuery = `
      UPDATE sessions 
      SET is_active = false, revoked_at = NOW(), revocation_reason = $2
      WHERE id = $1
      RETURNING *
    `;

    const result = await query(updateQuery, [sessionId, reason]);
    return result.rows[0];
  }

  /**
   * Get all active sessions for a user
   */
  static async getUserActiveSessions(userId) {
    const selectQuery = `
      SELECT id, user_type, ip_address, device_info, created_at, last_activity_at, expires_at
      FROM sessions 
      WHERE user_id = $1 AND is_active = true AND expires_at > NOW()
      ORDER BY last_activity_at DESC
    `;

    const result = await query(selectQuery, [userId]);
    return result.rows;
  }

  /**
   * Revoke all user sessions except current
   */
  static async revokeAllExcept(userId, currentSessionId, reason = 'New device login') {
    const updateQuery = `
      UPDATE sessions 
      SET is_active = false, revoked_at = NOW(), revocation_reason = $3
      WHERE user_id = $1 AND id != $2 AND is_active = true
      RETURNING *
    `;

    const result = await query(updateQuery, [userId, currentSessionId, reason]);
    return result.rows;
  }

  /**
   * Invalidate all user sessions (revoke all sessions for a user)
   */
  static async invalidateUserSessions(userId, reason = 'Password reset') {
    const updateQuery = `
      UPDATE sessions 
      SET is_active = false, revoked_at = NOW(), revocation_reason = $2
      WHERE user_id = $1 AND is_active = true
      RETURNING *
    `;

    const result = await query(updateQuery, [userId, reason]);
    console.log(`✅ Invalidated ${result.rows.length} sessions for user ${userId}`);
    return result.rows;
  }

  /**
   * Clean up expired sessions
   */
  static async cleanupExpired() {
    const deleteQuery = `
      DELETE FROM sessions 
      WHERE expires_at < NOW() OR (revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '30 days')
    `;

    await query(deleteQuery);
    console.log('✅ Expired sessions cleaned up');
  }
}

module.exports = Session;
