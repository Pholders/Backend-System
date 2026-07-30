const { query } = require('../config/db');
const crypto = require('crypto');

/**
 * Action Token Model
 * Generic single-use tokens for confirming sensitive actions via email link
 * (e.g. email change, account unfreeze, 2FA enable).
 *
 * Purposes:
 *   - 'email_change'    : payload = { new_email }
 *   - 'account_unfreeze': payload = {}
 *   - 'twofa_enable'    : payload = { method, secret? }
 */

class ActionToken {
  /**
   * Create the action_tokens table
   */
  static async createTable() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS action_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        purpose VARCHAR(50) NOT NULL,
        token VARCHAR(255) UNIQUE NOT NULL,
        payload JSONB,
        expires_at TIMESTAMP NOT NULL,
        consumed BOOLEAN DEFAULT FALSE,
        consumed_at TIMESTAMP,
        ip_address VARCHAR(50),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_action_tokens_user_id ON action_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_action_tokens_token ON action_tokens(token);
      CREATE INDEX IF NOT EXISTS idx_action_tokens_purpose ON action_tokens(purpose);
      CREATE INDEX IF NOT EXISTS idx_action_tokens_consumed ON action_tokens(consumed);
    `;

    try {
      await query(createTableQuery);
      console.log('✅ Action tokens table created successfully');
    } catch (error) {
      console.error('❌ Error creating action_tokens table:', error);
      throw error;
    }
  }

  /**
   * Create a new action token.
   * @param {object} opts
   * @param {number} opts.userId
   * @param {string} opts.purpose
   * @param {object} [opts.payload]
   * @param {number} [opts.expiresInMinutes=60]
   * @param {string} [opts.ipAddress]
   * @param {string} [opts.userAgent]
   */
  static async create({ userId, purpose, payload = {}, expiresInMinutes = 60, ipAddress = null, userAgent = null }) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    const insertQuery = `
      INSERT INTO action_tokens (user_id, purpose, token, payload, expires_at, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const result = await query(insertQuery, [
      userId,
      purpose,
      token,
      JSON.stringify(payload || {}),
      expiresAt,
      ipAddress,
      userAgent
    ]);

    return { token, record: result.rows[0] };
  }

  /**
   * Find an unconsumed, unexpired token by raw token string + purpose.
   */
  static async findValid(token, purpose) {
    const selectQuery = `
      SELECT * FROM action_tokens
      WHERE token = $1
        AND purpose = $2
        AND consumed = FALSE
        AND expires_at > CURRENT_TIMESTAMP
      LIMIT 1
    `;
    const result = await query(selectQuery, [token, purpose]);
    return result.rows[0] || null;
  }

  /**
   * Mark a token as consumed.
   */
  static async consume(id) {
    const updateQuery = `
      UPDATE action_tokens
      SET consumed = TRUE, consumed_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    const result = await query(updateQuery, [id]);
    return result.rows[0];
  }

  /**
   * Invalidate all outstanding tokens of a given purpose for a user.
   * Useful when issuing a new one (e.g. user requests another email change).
   */
  static async invalidateExisting(userId, purpose) {
    const updateQuery = `
      UPDATE action_tokens
      SET consumed = TRUE, consumed_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND purpose = $2 AND consumed = FALSE
      RETURNING id
    `;
    const result = await query(updateQuery, [userId, purpose]);
    return result.rows.length;
  }

  /**
   * Cleanup expired + consumed tokens older than 30 days.
   */
  static async cleanup() {
    const deleteQuery = `
      DELETE FROM action_tokens
      WHERE (expires_at < CURRENT_TIMESTAMP - INTERVAL '30 days')
         OR (consumed = TRUE AND consumed_at < CURRENT_TIMESTAMP - INTERVAL '30 days')
    `;
    await query(deleteQuery);
  }
}

module.exports = ActionToken;
