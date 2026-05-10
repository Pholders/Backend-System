const { query } = require('../config/db');
const crypto = require('crypto');

/**
 * Password Reset Token Model
 * Manages password reset tokens for forgotten passwords
 */

class PasswordResetToken {
  /**
   * Create a password reset token
   */
  static async create(userId, email, ipAddress, userAgent) {
    try {
      // Generate unique reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      
      // Token expires in 24 hours
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const insertQuery = `
        INSERT INTO password_reset_tokens (
          user_id, email, reset_token, reset_token_expires_at, ip_address, user_agent
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;

      const result = await query(insertQuery, [
        userId,
        email,
        resetToken,
        expiresAt,
        ipAddress,
        userAgent
      ]);

      return {
        success: true,
        token: resetToken,
        data: result.rows[0]
      };
    } catch (error) {
      console.error('Error creating password reset token:', error);
      throw error;
    }
  }

  /**
   * Find token by reset token
   */
  static async findByToken(resetToken) {
    try {
      const selectQuery = `
        SELECT * FROM password_reset_tokens 
        WHERE reset_token = $1 
        AND used = FALSE 
        AND reset_token_expires_at > CURRENT_TIMESTAMP
      `;

      const result = await query(selectQuery, [resetToken]);
      return result.rows[0];
    } catch (error) {
      console.error('Error finding password reset token:', error);
      throw error;
    }
  }

  /**
   * Mark token as used
   */
  static async markAsUsed(tokenId) {
    try {
      const updateQuery = `
        UPDATE password_reset_tokens 
        SET used = TRUE, used_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `;

      const result = await query(updateQuery, [tokenId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error marking token as used:', error);
      throw error;
    }
  }

  /**
   * Invalidate all unused tokens for a user
   */
  static async invalidateAllUserTokens(userId) {
    try {
      const updateQuery = `
        UPDATE password_reset_tokens 
        SET used = TRUE, used_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND used = FALSE
        RETURNING id
      `;

      const result = await query(updateQuery, [userId]);
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
        DELETE FROM password_reset_tokens 
        WHERE reset_token_expires_at < CURRENT_TIMESTAMP 
        AND used = FALSE
      `;

      await query(deleteQuery);
      console.log('✅ Cleaned up expired password reset tokens');
    } catch (error) {
      console.error('Error cleaning up expired tokens:', error);
      throw error;
    }
  }

  /**
   * Get token history for audit purposes
   */
  static async getUserTokenHistory(userId, limit = 10) {
    try {
      const selectQuery = `
        SELECT id, email, reset_token_expires_at, used, used_at, ip_address, created_at
        FROM password_reset_tokens 
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      `;

      const result = await query(selectQuery, [userId, limit]);
      return result.rows;
    } catch (error) {
      console.error('Error getting token history:', error);
      throw error;
    }
  }
}

module.exports = PasswordResetToken;
