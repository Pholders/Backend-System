const { query } = require('../config/db');

/**
 * Login Location Model
 * Tracks user login locations for anomaly detection
 */

class LoginLocation {
  /**
   * Create login locations table
   */
  static async createTable() {
    // Check if table already exists
    const checkTableQuery = `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'login_locations');`;
    const result = await query(checkTableQuery);
    if (result.rows[0].exists) {
      return; // Table exists, skip creation and logging
    }

    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS login_locations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        user_type VARCHAR(50) NOT NULL,
        ip_address VARCHAR(50) NOT NULL,
        country VARCHAR(100),
        region VARCHAR(100),
        city VARCHAR(100),
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        device_fingerprint VARCHAR(255),
        device_name VARCHAR(255),
        browser VARCHAR(100),
        os VARCHAR(100),
        is_known BOOLEAN DEFAULT false,
        is_suspicious BOOLEAN DEFAULT false,
        risk_score INTEGER DEFAULT 0,
        last_login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        login_count INTEGER DEFAULT 1,
        user_verified BOOLEAN DEFAULT false,
        verified_at TIMESTAMP,
        flagged_at TIMESTAMP,
        flag_reason VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_login_locations_user_id ON login_locations(user_id);
      CREATE INDEX IF NOT EXISTS idx_login_locations_ip ON login_locations(ip_address);
      CREATE INDEX IF NOT EXISTS idx_login_locations_country ON login_locations(country);
      CREATE INDEX IF NOT EXISTS idx_login_locations_is_suspicious ON login_locations(is_suspicious);
      CREATE INDEX IF NOT EXISTS idx_login_locations_user_type ON login_locations(user_type);
      CREATE INDEX IF NOT EXISTS idx_login_locations_created_at ON login_locations(created_at);
    `;

    try {
      await query(createTableQuery);
      console.log('✅ Login locations table created successfully');
    } catch (error) {
      console.error('❌ Error creating login locations table:', error);
      throw error;
    }
  }

  /**
   * Record a login location
   */
  static async recordLogin({
    userId,
    userType,
    ipAddress,
    country,
    region,
    city,
    latitude,
    longitude,
    deviceFingerprint,
    deviceName,
    browser,
    os
  }) {
    const insertQuery = `
      INSERT INTO login_locations (
        user_id, user_type, ip_address, country, region, city,
        latitude, longitude, device_fingerprint, device_name,
        browser, os, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
      RETURNING *
    `;

    const values = [
      userId,
      userType,
      ipAddress,
      country,
      region,
      city,
      latitude,
      longitude,
      deviceFingerprint,
      deviceName,
      browser,
      os
    ];

    try {
      const result = await query(insertQuery, values);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error recording login location:', error);
      throw error;
    }
  }

  /**
   * Find similar location (IP/Device)
   */
  static async findSimilarLocation(userId, ipAddress, deviceFingerprint) {
    const selectQuery = `
      SELECT * FROM login_locations
      WHERE user_id = $1 
        AND (ip_address = $2 OR device_fingerprint = $3)
        AND created_at > NOW() - INTERVAL '90 days'
      ORDER BY last_login_at DESC
      LIMIT 1
    `;

    const result = await query(selectQuery, [userId, ipAddress, deviceFingerprint]);
    return result.rows[0] || null;
  }

  /**
   * Get user's login history
   */
  static async getUserLoginHistory(userId, limit = 20) {
    const selectQuery = `
      SELECT * FROM login_locations
      WHERE user_id = $1
      ORDER BY last_login_at DESC
      LIMIT $2
    `;

    const result = await query(selectQuery, [userId, limit]);
    return result.rows;
  }

  /**
   * Get recent logins (last N hours)
   */
  static async getRecentLogins(userId, hours = 24) {
    const selectQuery = `
      SELECT * FROM login_locations
      WHERE user_id = $1
        AND last_login_at > NOW() - INTERVAL '${hours} hours'
      ORDER BY last_login_at DESC
    `;

    const result = await query(selectQuery, [userId]);
    return result.rows;
  }

  /**
   * Mark location as known/verified
   */
  static async markAsKnown(locationId) {
    const updateQuery = `
      UPDATE login_locations
      SET is_known = true, user_verified = true, verified_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await query(updateQuery, [locationId]);
    return result.rows[0];
  }

  /**
   * Mark location as suspicious
   */
  static async markAsSuspicious(locationId, riskScore, flagReason) {
    const updateQuery = `
      UPDATE login_locations
      SET is_suspicious = true, risk_score = $2, flag_reason = $3, flagged_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await query(updateQuery, [locationId, riskScore, flagReason]);
    return result.rows[0];
  }

  /**
   * Get suspicious locations count (last 24 hours)
   */
  static async getSuspiciousLocationsCount(userId, hours = 24) {
    const selectQuery = `
      SELECT COUNT(*) as count
      FROM login_locations
      WHERE user_id = $1
        AND is_suspicious = true
        AND created_at > NOW() - INTERVAL '${hours} hours'
    `;

    const result = await query(selectQuery, [userId]);
    return parseInt(result.rows[0].count) || 0;
  }

  /**
   * Get distinct countries for user (last 30 days)
   */
  static async getRecentCountries(userId, days = 30) {
    const selectQuery = `
      SELECT DISTINCT country, city, COUNT(*) as login_count
      FROM login_locations
      WHERE user_id = $1
        AND created_at > NOW() - INTERVAL '${days} days'
      GROUP BY country, city
      ORDER BY login_count DESC
    `;

    const result = await query(selectQuery, [userId]);
    return result.rows;
  }
}

module.exports = LoginLocation;
