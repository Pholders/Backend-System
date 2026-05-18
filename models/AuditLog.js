const { query } = require('../config/db');
const GeolocationService = require('../services/geolocationService');

/**
 * Audit Log Model
 * Tracks all authentication and security-related events
 */

class AuditLog {
  /**
   * Create audit log table
   */
  static async createTable() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        user_type VARCHAR(50),
        email VARCHAR(255),
        event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
          'signup', 'login', 'logout', 'login_failed', 'password_change', 
          'password_reset', 'otp_generated', 'otp_verified', 'otp_failed',
          'session_created', 'session_revoked', 'profile_updated', 
          'unauthorized_access', 'account_locked', 'account_unlocked',
          'email_verification_sent', 'email_verification', 'email_verification_resend'
        )),
        status VARCHAR(50) NOT NULL CHECK (status IN ('success', 'failed', 'warning')),
        ip_address VARCHAR(50),
        user_agent TEXT,
        device_info JSONB,
        geolocation JSONB,
        impossible_travel_detected BOOLEAN DEFAULT FALSE,
        error_message TEXT,
        additional_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_email ON audit_logs(email);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON audit_logs(status);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_address ON audit_logs(ip_address);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_impossible_travel ON audit_logs(impossible_travel_detected);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_event ON audit_logs(user_id, event_type, created_at);
    `;

    try {
      await query(createTableQuery);
      console.log('✅ Audit logs table created successfully');
    } catch (error) {
      console.error('❌ Error creating audit logs table:', error);
      throw error;
    }
  }

  /**
   * Log an event
   */
  static async log({
    userId = null,
    userType = null,
    email = null,
    eventType,
    status,
    ipAddress = null,
    userAgent = null,
    deviceInfo = null,
    geolocation = null,
    impossibleTravelDetected = false,
    errorMessage = null,
    additionalData = null
  }) {
    const insertQuery = `
      INSERT INTO audit_logs (
        user_id, user_type, email, event_type, status, 
        ip_address, user_agent, device_info, geolocation, 
        impossible_travel_detected, error_message, additional_data
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const values = [
      userId,
      userType,
      email,
      eventType,
      status,
      ipAddress,
      userAgent,
      deviceInfo ? JSON.stringify(deviceInfo) : null,
      geolocation ? JSON.stringify(geolocation) : null,
      impossibleTravelDetected,
      errorMessage,
      additionalData ? JSON.stringify(additionalData) : null
    ];

    try {
      const result = await query(insertQuery, values);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error logging audit event:', error);
      throw error;
    }
  }

  /**
   * Get user's recent activity
   */
  static async getUserActivity(userId, limit = 50) {
    const selectQuery = `
      SELECT id, event_type, status, ip_address, created_at, error_message
      FROM audit_logs 
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;

    const result = await query(selectQuery, [userId, limit]);
    return result.rows;
  }

  /**
   * Get failed login attempts for user (last 24 hours)
   */
  static async getFailedLoginAttempts(email, hours = 24) {
    const selectQuery = `
      SELECT COUNT(*) as attempt_count
      FROM audit_logs 
      WHERE email = $1 
        AND event_type IN ('login_failed', 'otp_failed')
        AND status = 'failed'
        AND created_at > NOW() - INTERVAL '${hours} hours'
    `;

    const result = await query(selectQuery, [email]);
    return parseInt(result.rows[0].attempt_count) || 0;
  }

  /**
   * Get suspicious activity (multiple failed attempts)
   */
  static async getSuspiciousActivity(threshold = 5, hours = 1) {
    const selectQuery = `
      SELECT 
        email, 
        ip_address,
        COUNT(*) as attempt_count,
        MAX(created_at) as last_attempt,
        ARRAY_AGG(DISTINCT event_type) as event_types
      FROM audit_logs 
      WHERE status = 'failed'
        AND created_at > NOW() - INTERVAL '${hours} hours'
      GROUP BY email, ip_address
      HAVING COUNT(*) >= $1
      ORDER BY attempt_count DESC
    `;

    const result = await query(selectQuery, [threshold]);
    return result.rows;
  }

  /**
   * Log security event with IP and user agent
   */
  static async logSecurityEvent(req, userId, userType, email, eventType, status, errorMessage = null) {
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const deviceInfo = {
      platform: req.headers['user-agent'],
      timestamp: new Date().toISOString()
    };

    // Get geolocation data
    let geolocation = null;
    let impossibleTravelDetected = false;
    
    try {
      geolocation = await GeolocationService.getLocationFromIP(ipAddress);

      // Check for impossible travel if this is a login event and we have a user
      if (userId && eventType === 'login' && status === 'success' && geolocation && geolocation.latitude) {
        const previousLogin = await AuditLog.getLastLoginLocation(userId);
        
        if (previousLogin && previousLogin.geolocation && previousLogin.geolocation.latitude) {
          const timeDiffMinutes = (Date.now() - new Date(previousLogin.created_at)) / (1000 * 60);
          const travelAnalysis = GeolocationService.checkImpossibleTravel(
            previousLogin.geolocation,
            geolocation,
            timeDiffMinutes
          );

          if (travelAnalysis.isImpossible) {
            impossibleTravelDetected = true;
            console.warn(`⚠️  IMPOSSIBLE TRAVEL DETECTED for ${email}: ${travelAnalysis.reason}`);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching geolocation:', error);
      // Continue without geolocation on error
    }

    return AuditLog.log({
      userId,
      userType,
      email,
      eventType,
      status,
      ipAddress,
      userAgent,
      deviceInfo,
      geolocation,
      impossibleTravelDetected,
      errorMessage
    });
  }

  /**
   * Get last login location for a user
   */
  static async getLastLoginLocation(userId) {
    const selectQuery = `
      SELECT geolocation, created_at
      FROM audit_logs 
      WHERE user_id = $1 
        AND event_type = 'login'
        AND status = 'success'
      ORDER BY created_at DESC
      LIMIT 1
    `;

    try {
      const result = await query(selectQuery, [userId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error getting last login location:', error);
      return null;
    }
  }

  /**
   * Get impossible travel detections (last 24 hours)
   */
  static async getImpossibleTravelAlerts(hours = 24) {
    const selectQuery = `
      SELECT 
        user_id, 
        email, 
        user_type,
        geolocation,
        ip_address,
        created_at,
        (geolocation->>'country') as country,
        (geolocation->>'city') as city
      FROM audit_logs 
      WHERE impossible_travel_detected = true
        AND created_at > NOW() - INTERVAL '${hours} hours'
      ORDER BY created_at DESC
    `;

    try {
      const result = await query(selectQuery);
      return result.rows;
    } catch (error) {
      console.error('Error getting impossible travel alerts:', error);
      return [];
    }
  }

  /**
   * Get logins by location for a user
   */
  static async getLoginsByLocation(userId, days = 30) {
    const selectQuery = `
      SELECT 
        (geolocation->>'country') as country,
        (geolocation->>'city') as city,
        (geolocation->>'timezone') as timezone,
        ip_address,
        COUNT(*) as login_count,
        MAX(created_at) as last_login,
        MIN(created_at) as first_login
      FROM audit_logs 
      WHERE user_id = $1 
        AND event_type = 'login'
        AND status = 'success'
        AND created_at > NOW() - INTERVAL '${days} days'
      GROUP BY country, city, timezone, ip_address
      ORDER BY login_count DESC
    `;

    try {
      const result = await query(selectQuery, [userId]);
      return result.rows;
    } catch (error) {
      console.error('Error getting logins by location:', error);
      return [];
    }
  }

  /**
   * Get suspicious locations (unusual login locations)
   */
  static async getSuspiciousLocations(minFailedAttempts = 3, hours = 24) {
    const selectQuery = `
      SELECT 
        (geolocation->>'country') as country,
        (geolocation->>'city') as city,
        (geolocation->>'isp') as isp,
        ip_address,
        COUNT(*) as attempt_count,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_attempts,
        ARRAY_AGG(DISTINCT email) as emails,
        MAX(created_at) as last_attempt
      FROM audit_logs 
      WHERE event_type IN ('login_failed', 'otp_failed')
        AND created_at > NOW() - INTERVAL '${hours} hours'
      GROUP BY country, city, isp, ip_address
      HAVING COUNT(CASE WHEN status = 'failed' THEN 1 END) >= $1
      ORDER BY failed_attempts DESC
    `;

    try {
      const result = await query(selectQuery, [minFailedAttempts]);
      return result.rows;
    } catch (error) {
      console.error('Error getting suspicious locations:', error);
      return [];
    }
  }

  /**
   * Get security dashboard summary
   */
  static async getSecurityDashboard(hours = 24) {
    const queries = {
      total_logins: `
        SELECT COUNT(*) as count FROM audit_logs 
        WHERE event_type = 'login' AND status = 'success'
        AND created_at > NOW() - INTERVAL '${hours} hours'
      `,
      failed_attempts: `
        SELECT COUNT(*) as count FROM audit_logs 
        WHERE event_type IN ('login_failed', 'otp_failed')
        AND created_at > NOW() - INTERVAL '${hours} hours'
      `,
      impossible_travels: `
        SELECT COUNT(*) as count FROM audit_logs 
        WHERE impossible_travel_detected = true
        AND created_at > NOW() - INTERVAL '${hours} hours'
      `,
      unique_locations: `
        SELECT COUNT(DISTINCT (geolocation->>'country')) as count FROM audit_logs 
        WHERE event_type = 'login' AND status = 'success'
        AND created_at > NOW() - INTERVAL '${hours} hours'
      `,
      unique_ips: `
        SELECT COUNT(DISTINCT ip_address) as count FROM audit_logs 
        WHERE event_type = 'login' AND status = 'success'
        AND created_at > NOW() - INTERVAL '${hours} hours'
      `
    };

    try {
      const results = {};
      for (const [key, sql] of Object.entries(queries)) {
        const result = await query(sql);
        results[key] = parseInt(result.rows[0].count) || 0;
      }
      return results;
    } catch (error) {
      console.error('Error getting security dashboard:', error);
      return {};
    }
  }
}

module.exports = AuditLog;
