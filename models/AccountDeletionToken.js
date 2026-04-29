const { query } = require('../config/db');
const crypto = require('crypto');

/**
 * Account Deletion Token Model
 * Manages account deletion confirmation tokens
 * Requires user to type confirmation and click email link
 */

class AccountDeletionToken {
  /**
   * Create account deletion table
   */
  static async createTable() {
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS account_deletion_tokens (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES patients(id),
          email VARCHAR(255) NOT NULL,
          deletion_token VARCHAR(255) UNIQUE NOT NULL,
          deletion_token_expires_at TIMESTAMP NOT NULL,
          ip_address VARCHAR(45),
          user_agent TEXT,
          confirmed BOOLEAN DEFAULT FALSE,
          confirmed_at TIMESTAMP,
          cancelled BOOLEAN DEFAULT FALSE,
          cancelled_at TIMESTAMP,
          reason_cancelled TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          
          INDEX idx_user_id (user_id),
          INDEX idx_email (email),
          INDEX idx_deletion_token (deletion_token),
          INDEX idx_confirmed (confirmed)
        );
      `);
      console.log('✅ Account deletion tokens table created');
    } catch (error) {
      if (error.code !== '42P07') { // Table already exists error
        console.error('❌ Error creating account deletion tokens table:', error);
        throw error;
      }
    }
  }

  /**
   * Create a deletion token
   */
  static async create(userId, email, ipAddress, userAgent) {
    try {
      // Generate unique deletion token
      const deletionToken = crypto.randomBytes(32).toString('hex');
      
      // Token expires in 24 hours
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const insertQuery = `
        INSERT INTO account_deletion_tokens (
          user_id, email, deletion_token, deletion_token_expires_at, ip_address, user_agent
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;

      const result = await query(insertQuery, [
        userId,
        email,
        deletionToken,
        expiresAt,
        ipAddress,
        userAgent
      ]);

      return {
        success: true,
        token: deletionToken,
        data: result.rows[0]
      };
    } catch (error) {
      console.error('Error creating account deletion token:', error);
      throw error;
    }
  }

  /**
   * Find token by deletion token
   */
  static async findByToken(deletionToken) {
    try {
      const selectQuery = `
        SELECT * FROM account_deletion_tokens 
        WHERE deletion_token = $1 
        AND confirmed = FALSE
        AND cancelled = FALSE
        AND deletion_token_expires_at > CURRENT_TIMESTAMP
      `;

      const result = await query(selectQuery, [deletionToken]);
      return result.rows[0];
    } catch (error) {
      console.error('Error finding account deletion token:', error);
      throw error;
    }
  }

  /**
   * Mark token as confirmed (deletion confirmed via email)
   */
  static async markAsConfirmed(tokenId) {
    try {
      const updateQuery = `
        UPDATE account_deletion_tokens 
        SET confirmed = TRUE, confirmed_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `;

      const result = await query(updateQuery, [tokenId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error marking token as confirmed:', error);
      throw error;
    }
  }

  /**
   * Cancel a deletion token
   */
  static async cancel(tokenId, reason = 'User cancelled') {
    try {
      const updateQuery = `
        UPDATE account_deletion_tokens 
        SET cancelled = TRUE, cancelled_at = CURRENT_TIMESTAMP, reason_cancelled = $2
        WHERE id = $1
        RETURNING *
      `;

      const result = await query(updateQuery, [tokenId, reason]);
      return result.rows[0];
    } catch (error) {
      console.error('Error cancelling deletion token:', error);
      throw error;
    }
  }

  /**
   * Get active deletion request for user
   */
  static async getActiveDeletionRequest(userId) {
    try {
      const selectQuery = `
        SELECT * FROM account_deletion_tokens 
        WHERE user_id = $1
        AND confirmed = FALSE
        AND cancelled = FALSE
        AND deletion_token_expires_at > CURRENT_TIMESTAMP
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const result = await query(selectQuery, [userId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error getting active deletion request:', error);
      throw error;
    }
  }

  /**
   * Invalidate all unused tokens for a user
   */
  static async invalidateAllUserTokens(userId, reason = 'Account deleted') {
    try {
      const updateQuery = `
        UPDATE account_deletion_tokens 
        SET cancelled = TRUE, cancelled_at = CURRENT_TIMESTAMP, reason_cancelled = $2
        WHERE user_id = $1 AND confirmed = FALSE AND cancelled = FALSE
        RETURNING id
      `;

      const result = await query(updateQuery, [userId, reason]);
      return result.rows.length;
    } catch (error) {
      console.error('Error invalidating user tokens:', error);
      throw error;
    }
  }

  /**
   * Clean up expired tokens
   */
  static async cleanupExpiredTokens() {
    try {
      const deleteQuery = `
        DELETE FROM account_deletion_tokens 
        WHERE deletion_token_expires_at < CURRENT_TIMESTAMP 
        AND confirmed = FALSE
        AND cancelled = FALSE
      `;

      await query(deleteQuery);
      console.log('✅ Cleaned up expired account deletion tokens');
    } catch (error) {
      console.error('Error cleaning up expired tokens:', error);
      throw error;
    }
  }

  /**
   * Get deletion history for audit purposes
   */
  static async getUserDeletionHistory(userId, limit = 10) {
    try {
      const selectQuery = `
        SELECT 
          id, 
          email, 
          deletion_token_expires_at, 
          confirmed, 
          confirmed_at, 
          cancelled,
          cancelled_at,
          reason_cancelled,
          ip_address, 
          created_at
        FROM account_deletion_tokens 
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      `;

      const result = await query(selectQuery, [userId, limit]);
      return result.rows;
    } catch (error) {
      console.error('Error getting deletion history:', error);
      throw error;
    }
  }
}

module.exports = AccountDeletionToken;
