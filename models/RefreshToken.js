const { query } = require('../config/db');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

class RefreshToken {
  // Create refresh token
  static async create(userId, userType, deviceInfo = null) {
    // Generate secure random token
    const token = crypto.randomBytes(64).toString('hex');
    const tokenHash = await bcrypt.hash(token, 10);
    
    // Set expiration (30 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    
    const insertQuery = `
      INSERT INTO refresh_tokens (user_id, user_type, token_hash, expires_at, device_info)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, expires_at, created_at
    `;
    
    const result = await query(insertQuery, [userId, userType, tokenHash, expiresAt, deviceInfo]);
    
    return {
      id: result.rows[0].id,
      token, // Return plain token (only time we return it)
      expires_at: result.rows[0].expires_at
    };
  }
  
  // Verify and find refresh token
  static async findValidToken(token) {
    // Get all non-expired, non-revoked tokens
    const selectQuery = `
      SELECT rt.*, p.email, p.first_name, p.last_name, 'patient' as table_type
      FROM refresh_tokens rt
      JOIN patients p ON rt.user_id = p.id
      WHERE rt.expires_at > NOW() AND rt.is_revoked = FALSE AND rt.user_type = 'patient'
      
      UNION ALL
      
      SELECT rt.*, d.email, d.first_name, d.last_name, 'doctor' as table_type
      FROM refresh_tokens rt
      JOIN doctors d ON rt.user_id = d.id
      WHERE rt.expires_at > NOW() AND rt.is_revoked = FALSE AND rt.user_type = 'doctor'
      
      UNION ALL
      
      SELECT rt.*, ph.email, ph.pharmacy_name as first_name, '' as last_name, 'pharmacy' as table_type
      FROM refresh_tokens rt
      JOIN pharmacies ph ON rt.user_id = ph.id
      WHERE rt.expires_at > NOW() AND rt.is_revoked = FALSE AND rt.user_type = 'pharmacy'
      
      UNION ALL
      
      SELECT rt.*, a.email, a.first_name, a.last_name, 'admin' as table_type
      FROM refresh_tokens rt
      JOIN admins a ON rt.user_id = a.id
      WHERE rt.expires_at > NOW() AND rt.is_revoked = FALSE AND rt.user_type = 'admin'
    `;
    
    const result = await query(selectQuery);
    
    // Check each token hash against provided token
    for (const row of result.rows) {
      const isMatch = await bcrypt.compare(token, row.token_hash);
      if (isMatch) {
        return row;
      }
    }
    
    return null;
  }
  
  // Revoke token
  static async revoke(tokenId) {
    const updateQuery = `
      UPDATE refresh_tokens 
      SET is_revoked = TRUE, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;
    await query(updateQuery, [tokenId]);
  }
  
  // Clean expired tokens
  static async cleanExpired() {
    const deleteQuery = `
      DELETE FROM refresh_tokens 
      WHERE expires_at <= NOW() OR is_revoked = TRUE
    `;
    await query(deleteQuery);
  }
}

module.exports = RefreshToken;