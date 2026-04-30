const SecurityAlert = require('../models/SecurityAlert');
const AuditLog = require('../models/AuditLog');
const Session = require('../models/Session');
const User = require('../models/User');
const emailService = require('../services/emailService');

/**
 * Security Admin Controller
 * Manages security alerts, user verification, and threat responses
 */

class SecurityAdminController {
  /**
   * Get dashboard stats
   */
  static async getDashboardStats(req, res) {
    try {
      const stats24h = await SecurityAlert.getStats(24);
      const stats7d = await SecurityAlert.getStats(168);
      const criticalAlerts = await SecurityAlert.getCriticalAlerts(24);

      res.status(200).json({
        success: true,
        data: {
          last24Hours: stats24h,
          last7Days: stats7d,
          criticalAlerts: {
            count: criticalAlerts.length,
            alerts: criticalAlerts.slice(0, 10) // Top 10
          }
        }
      });
    } catch (error) {
      console.error('Dashboard stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching dashboard stats',
        error: error.message
      });
    }
  }

  /**
   * Get all unreviewed critical alerts
   */
  static async getCriticalAlerts(req, res) {
    try {
      const hours = req.query.hours || 24;
      const alerts = await SecurityAlert.getCriticalAlerts(parseInt(hours));

      res.status(200).json({
        success: true,
        data: {
          count: alerts.length,
          alerts
        }
      });
    } catch (error) {
      console.error('Get critical alerts error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching critical alerts',
        error: error.message
      });
    }
  }

  /**
   * Get user's security alert history
   */
  static async getUserAlertHistory(req, res) {
    try {
      const userId = req.params.userId;
      const limit = req.query.limit || 50;

      const alerts = await SecurityAlert.getUserAlertHistory(userId, parseInt(limit));

      res.status(200).json({
        success: true,
        data: {
          userId,
          count: alerts.length,
          alerts
        }
      });
    } catch (error) {
      console.error('Get user alert history error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching user alert history',
        error: error.message
      });
    }
  }

  /**
   * Review and update alert status
   */
  static async reviewAlert(req, res) {
    try {
      const { alertId } = req.params;
      const { status, adminNotes, actionTaken } = req.body;

      const validStatuses = ['verified_legit', 'verified_threat', 'dismissed'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status. Must be: verified_legit, verified_threat, or dismissed'
        });
      }

      const alert = await SecurityAlert.getById(alertId);
      if (!alert) {
        return res.status(404).json({
          success: false,
          message: 'Alert not found'
        });
      }

      // Update alert
      let updateQuery = `
        UPDATE security_alerts
        SET status = $1, admin_notes = $2, action_taken = $3, admin_action_at = NOW(), updated_at = NOW()
        WHERE id = $4
        RETURNING *
      `;

      const { query } = require('../config/db');
      const result = await query(updateQuery, [status, adminNotes, actionTaken, alertId]);
      const updatedAlert = result.rows[0];

      // Log admin action
      await AuditLog.log({
        userId: req.user?.id,
        userType: 'admin',
        email: req.user?.email,
        eventType: 'security_alert_reviewed',
        status: 'success',
        ipAddress: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        additionalData: {
          alertId,
          reviewStatus: status,
          targetUserId: alert.user_id
        }
      });

      // If threat detected, take action
      if (status === 'verified_threat') {
        try {
          // Invalidate all user sessions
          await Session.invalidateUserSessions(alert.user_id);

          // Force password reset
          console.log(`🔒 Security Action: User ${alert.user_id} sessions invalidated - threat verified`);

          // Send threat notification email
          const user = await User.findById(alert.user_id);
          if (user) {
            await emailService.sendThreatNotification(
              user.email,
              user.first_name,
              alert
            );
          }
        } catch (actionError) {
          console.error('Error executing threat response:', actionError);
        }
      }

      res.status(200).json({
        success: true,
        message: `Alert status updated to ${status}`,
        data: updatedAlert
      });
    } catch (error) {
      console.error('Review alert error:', error);
      res.status(500).json({
        success: false,
        message: 'Error reviewing alert',
        error: error.message
      });
    }
  }

  /**
   * Get suspicious users (high-risk pattern)
   */
  static async getSuspiciousUsers(req, res) {
    try {
      const hours = req.query.hours || 24;
      const threshold = req.query.threshold || 3; // 3 critical alerts in timeframe

      const query_text = `
        SELECT 
          user_id,
          email,
          COUNT(*) as alert_count,
          COUNT(CASE WHEN severity = 'CRITICAL' THEN 1 END) as critical_count,
          AVG(risk_score) as avg_risk_score,
          MAX(created_at) as latest_alert,
          ARRAY_AGG(DISTINCT alert_type) as alert_types
        FROM security_alerts
        WHERE created_at > NOW() - INTERVAL '${parseInt(hours)} hours'
          AND status = 'unreviewed'
        GROUP BY user_id, email
        HAVING COUNT(CASE WHEN severity = 'CRITICAL' THEN 1 END) >= $1
        ORDER BY critical_count DESC, alert_count DESC
      `;

      const { query } = require('../config/db');
      const result = await query(query_text, [parseInt(threshold)]);

      res.status(200).json({
        success: true,
        data: {
          count: result.rows.length,
          users: result.rows
        }
      });
    } catch (error) {
      console.error('Get suspicious users error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching suspicious users',
        error: error.message
      });
    }
  }

  /**
   * Bulk action on alerts
   */
  static async bulkUpdateAlerts(req, res) {
    try {
      const { alertIds, status, actionReason } = req.body;

      if (!Array.isArray(alertIds) || alertIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'alertIds must be a non-empty array'
        });
      }

      const validStatuses = ['verified_legit', 'verified_threat', 'dismissed'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status'
        });
      }

      const { query } = require('../config/db');
      const placeholders = alertIds.map((_, i) => `$${i + 1}`).join(',');
      
      const updateQuery = `
        UPDATE security_alerts
        SET status = '${status}', admin_notes = $${alertIds.length + 1}, admin_action_at = NOW(), updated_at = NOW()
        WHERE id IN (${placeholders})
        RETURNING id
      `;

      const result = await query(updateQuery, [...alertIds, actionReason]);

      // Log bulk action
      await AuditLog.log({
        userId: req.user?.id,
        userType: 'admin',
        email: req.user?.email,
        eventType: 'security_alerts_bulk_updated',
        status: 'success',
        additionalData: {
          count: result.rows.length,
          newStatus: status
        }
      });

      res.status(200).json({
        success: true,
        message: `Updated ${result.rows.length} alerts to ${status}`,
        data: {
          updatedCount: result.rows.length
        }
      });
    } catch (error) {
      console.error('Bulk update alerts error:', error);
      res.status(500).json({
        success: false,
        message: 'Error performing bulk update',
        error: error.message
      });
    }
  }

  /**
   * Generate security report
   */
  static async generateSecurityReport(req, res) {
    try {
      const fromDate = req.query.from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const toDate = req.query.to || new Date().toISOString();

      const { query } = require('../config/db');
      
      const reportQuery = `
        SELECT 
          DATE(created_at) as date,
          alert_type,
          severity,
          COUNT(*) as count,
          COUNT(CASE WHEN status = 'verified_threat' THEN 1 END) as confirmed_threats,
          AVG(risk_score) as avg_risk_score
        FROM security_alerts
        WHERE created_at >= $1 AND created_at <= $2
        GROUP BY DATE(created_at), alert_type, severity
        ORDER BY date DESC, severity DESC
      `;

      const result = await query(reportQuery, [fromDate, toDate]);

      res.status(200).json({
        success: true,
        data: {
          period: { from: fromDate, to: toDate },
          report: result.rows
        }
      });
    } catch (error) {
      console.error('Generate report error:', error);
      res.status(500).json({
        success: false,
        message: 'Error generating security report',
        error: error.message
      });
    }
  }
}

module.exports = SecurityAdminController;
