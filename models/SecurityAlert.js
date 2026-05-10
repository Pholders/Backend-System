const { query } = require('../config/db');

/**
 * Security Alert Model
 * Manages suspicious activity alerts and user verification responses
 */

class SecurityAlert {
  /**
   * Create security alerts table
   */
  static async createTable() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS security_alerts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        user_type VARCHAR(50) NOT NULL,
        email VARCHAR(255) NOT NULL,
        alert_type VARCHAR(100) NOT NULL CHECK (alert_type IN (
          'IMPOSSIBLE_TRAVEL', 'NEW_LOCATION', 'NEW_DEVICE', 'PATTERN_ANOMALY',
          'UNUSUAL_COUNTRY_PATTERN', 'TIMEZONE_ANOMALY', 'PASSWORD_CHANGED',
          'MULTIPLE_FAILURES', 'ACCOUNT_LOCKOUT'
        )),
        severity VARCHAR(20) NOT NULL CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
        risk_score INTEGER DEFAULT 0,
        alert_message TEXT,
        location_data JSONB,
        device_data JSONB,
        ip_address VARCHAR(50),
        status VARCHAR(50) DEFAULT 'unreviewed' CHECK (status IN ('unreviewed', 'verified_legit', 'verified_threat', 'dismissed')),
        user_response TEXT,
        user_response_at TIMESTAMP,
        admin_notes TEXT,
        admin_action_at TIMESTAMP,
        action_taken VARCHAR(255),
        email_sent BOOLEAN DEFAULT false,
        email_sent_at TIMESTAMP,
        requires_user_verification BOOLEAN DEFAULT false,
        verification_token VARCHAR(255) UNIQUE,
        verification_token_expires_at TIMESTAMP,
        verified_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_security_alerts_user_id ON security_alerts(user_id);
      CREATE INDEX IF NOT EXISTS idx_security_alerts_email ON security_alerts(email);
      CREATE INDEX IF NOT EXISTS idx_security_alerts_status ON security_alerts(status);
      CREATE INDEX IF NOT EXISTS idx_security_alerts_severity ON security_alerts(severity);
      CREATE INDEX IF NOT EXISTS idx_security_alerts_alert_type ON security_alerts(alert_type);
      CREATE INDEX IF NOT EXISTS idx_security_alerts_created_at ON security_alerts(created_at);
      CREATE INDEX IF NOT EXISTS idx_security_alerts_verification_token ON security_alerts(verification_token);
      CREATE INDEX IF NOT EXISTS idx_security_alerts_user_status ON security_alerts(user_id, status);
      CREATE INDEX IF NOT EXISTS idx_security_alerts_unreviewed ON security_alerts(status, severity, created_at) WHERE status = 'unreviewed';
    `;

    try {
      await query(createTableQuery);
      console.log('✅ Security alerts table created successfully');
    } catch (error) {
      console.error('❌ Error creating security alerts table:', error);
      throw error;
    }
  }

  /**
   * Create a security alert
   */
  static async create({
    userId,
    userType,
    email,
    alertType,
    severity,
    riskScore,
    alertMessage,
    locationData,
    deviceData,
    ipAddress,
    requiresUserVerification = false,
    verificationToken = null
  }) {
    const insertQuery = `
      INSERT INTO security_alerts (
        user_id, user_type, email, alert_type, severity, risk_score,
        alert_message, location_data, device_data, ip_address,
        requires_user_verification, verification_token, verification_token_expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 
        CASE WHEN $12 IS NOT NULL THEN NOW() + INTERVAL '24 hours' ELSE NULL END)
      RETURNING *
    `;

    const values = [
      userId,
      userType,
      email,
      alertType,
      severity,
      riskScore,
      alertMessage,
      locationData ? JSON.stringify(locationData) : null,
      deviceData ? JSON.stringify(deviceData) : null,
      ipAddress,
      requiresUserVerification,
      verificationToken
    ];

    try {
      const result = await query(insertQuery, values);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error creating security alert:', error);
      throw error;
    }
  }

  /**
   * Get unreviewed alerts for user
   */
  static async getUnreviewedAlerts(userId) {
    const selectQuery = `
      SELECT * FROM security_alerts
      WHERE user_id = $1 AND status = 'unreviewed'
      ORDER BY severity DESC, created_at DESC
      LIMIT 20
    `;

    const result = await query(selectQuery, [userId]);
    return result.rows;
  }

  /**
   * Get alert by ID
   */
  static async getById(alertId) {
    const selectQuery = `SELECT * FROM security_alerts WHERE id = $1`;
    const result = await query(selectQuery, [alertId]);
    return result.rows[0] || null;
  }

  /**
   * Get alert by verification token
   */
  static async getByVerificationToken(token) {
    const selectQuery = `
      SELECT * FROM security_alerts
      WHERE verification_token = $1 
        AND verification_token_expires_at > NOW()
        AND status = 'unreviewed'
    `;

    const result = await query(selectQuery, [token]);
    return result.rows[0] || null;
  }

  /**
   * Mark alert as verified legitimate
   */
  static async markAsLegitimate(alertId, userResponse = null) {
    const updateQuery = `
      UPDATE security_alerts
      SET status = 'verified_legit', user_response = $2, user_response_at = NOW(), updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await query(updateQuery, [alertId, userResponse]);
    return result.rows[0];
  }

  /**
   * Mark alert as threat
   */
  static async markAsThreat(alertId, userResponse = null) {
    const updateQuery = `
      UPDATE security_alerts
      SET status = 'verified_threat', user_response = $2, user_response_at = NOW(), updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await query(updateQuery, [alertId, userResponse]);
    return result.rows[0];
  }

  /**
   * Mark alert as email sent
   */
  static async markEmailSent(alertId) {
    const updateQuery = `
      UPDATE security_alerts
      SET email_sent = true, email_sent_at = NOW(), updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await query(updateQuery, [alertId]);
    return result.rows[0];
  }

  /**
   * Get critical alerts (last 24 hours)
   */
  static async getCriticalAlerts(hours = 24) {
    const selectQuery = `
      SELECT * FROM security_alerts
      WHERE severity IN ('CRITICAL', 'HIGH')
        AND created_at > NOW() - INTERVAL '${hours} hours'
        AND status = 'unreviewed'
      ORDER BY severity DESC, created_at DESC
    `;

    const result = await query(selectQuery);
    return result.rows;
  }

  /**
   * Get user's alert history
   */
  static async getUserAlertHistory(userId, limit = 50) {
    const selectQuery = `
      SELECT * FROM security_alerts
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;

    const result = await query(selectQuery, [userId, limit]);
    return result.rows;
  }

  /**
   * Get stats for dashboard
   */
  static async getStats(timeframeHours = 24) {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_alerts,
        COUNT(CASE WHEN status = 'unreviewed' THEN 1 END) as unreviewed,
        COUNT(CASE WHEN severity = 'CRITICAL' THEN 1 END) as critical,
        COUNT(CASE WHEN severity = 'HIGH' THEN 1 END) as high,
        COUNT(DISTINCT user_id) as affected_users
      FROM security_alerts
      WHERE created_at > NOW() - INTERVAL '${timeframeHours} hours'
    `;

    const result = await query(statsQuery);
    return result.rows[0];
  }
}

module.exports = SecurityAlert;
