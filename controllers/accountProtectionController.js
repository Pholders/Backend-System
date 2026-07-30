const { query } = require('../config/db');
const User = require('../models/User');
const Session = require('../models/Session');
const AuditLog = require('../models/AuditLog');
const ActionToken = require('../models/ActionToken');
const emailService = require('../services/emailService');
const cache = require('../services/cacheService');

async function invalidateUserCache(userId, email) {
  try {
    if (userId) await cache.del(`user:id:${userId}`);
    if (email) await cache.del(`user:email:${email}`);
    if (userId) await cache.del(`patient_profile_complete_${userId}`);
  } catch (err) {
    console.warn('Cache invalidation skipped:', err.message);
  }
}

/**
 * Escape a single value for CSV output.
 */
function csvCell(value) {
  if (value === null || value === undefined) return '';
  let s = typeof value === 'string' ? value : JSON.stringify(value);
  if (/[",\n\r]/.test(s)) {
    s = `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * POST /api/profile/security/report-suspicious
 * Task 14 — User reports activity they didn't perform.
 * Body: { description, related_event_id?, related_session_id?, ip_address?, occurred_at? }
 */
async function reportSuspicious(req, res) {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;
    const { description, related_event_id, related_session_id, ip_address, occurred_at } = req.body;

    if (!description || description.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: 'description is required (min 5 characters)'
      });
    }

    const patient = await User.findById(userId);

    const report = {
      reported_by: userEmail,
      patient_id: userId,
      patient_name: `${patient.first_name} ${patient.last_name}`.trim(),
      description: description.trim(),
      related_event_id: related_event_id || null,
      related_session_id: related_session_id || null,
      ip_address: ip_address || req.ip,
      user_agent: req.headers['user-agent'],
      occurred_at: occurred_at || null,
      reported_at: new Date().toISOString()
    };

    try {
      await emailService.sendSuspiciousActivityReport(report, patient);
    } catch (e) {
      console.warn('Suspicious activity email failed (continuing):', e.message);
    }

    await AuditLog.logSecurityEvent(
      req, userId, 'patient', userEmail,
      'suspicious_activity_reported', 'success',
      description.slice(0, 250)
    );

    res.json({
      success: true,
      message: 'Report received. Our security team will review it shortly.',
      report: {
        reported_at: report.reported_at,
        description: report.description
      }
    });
  } catch (error) {
    console.error('reportSuspicious error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit report' });
  }
}

/**
 * POST /api/profile/security/freeze
 * Task 15 (freeze) — Lock the account immediately.
 *  - Sets patients.account_frozen = true
 *  - Revokes all sessions
 *  - Emails a 7-day single-use unfreeze link
 */
async function freezeAccount(req, res) {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;
    const patient = await User.findById(userId);

    if (!patient) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (patient.account_frozen) {
      return res.status(400).json({
        success: false,
        message: 'Account is already frozen. Use the unfreeze link sent to your email.'
      });
    }

    await query(
      `UPDATE patients
          SET account_frozen = true, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
      [userId]
    );

    // Drop any older unfreeze tokens
    await ActionToken.invalidateExisting(userId, 'account_unfreeze');

    // Create new unfreeze token (7 days)
    const { token } = await ActionToken.create({
      userId,
      purpose: 'account_unfreeze',
      payload: { email: userEmail },
      expiresInMinutes: 60 * 24 * 7,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    const base = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
    const unfreezeLink = `${base}/api/profile/security/unfreeze?token=${token}`;

    try {
      await emailService.sendAccountFreezeConfirmation(userEmail, patient.first_name, unfreezeLink);
    } catch (e) {
      console.warn('Freeze email failed (continuing):', e.message);
    }

    // Sign out everything
    await Session.invalidateUserSessions(userId, 'Account frozen by user');

    await invalidateUserCache(userId, userEmail);
    await AuditLog.logSecurityEvent(req, userId, 'patient', userEmail, 'account_frozen', 'success');

    res.json({
      success: true,
      message: 'Account frozen. All sessions have been signed out. Check your email for the unfreeze link (valid 7 days).'
    });
  } catch (error) {
    console.error('freezeAccount error:', error);
    res.status(500).json({ success: false, message: 'Failed to freeze account' });
  }
}

/**
 * GET /api/profile/security/unfreeze?token=<token>
 * Task 15 (unfreeze) — Consume the link and unfreeze the account.
 *  NO auth required (account is frozen so the user cannot log in).
 */
async function unfreezeAccount(req, res) {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ success: false, message: 'token is required' });
    }

    const actionToken = await ActionToken.findValid(token, 'account_unfreeze');
    if (!actionToken) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired unfreeze token'
      });
    }

    const userId = actionToken.user_id;
    const patient = await User.findById(userId);

    if (!patient) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await query(
      `UPDATE patients
          SET account_frozen = false, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
      [userId]
    );

    await ActionToken.consume(actionToken.id);
    await invalidateUserCache(userId, patient.email);
    await AuditLog.logSecurityEvent(req, userId, 'patient', patient.email, 'account_unfrozen', 'success');

    res.json({
      success: true,
      message: 'Account unfrozen. You can now log in again.'
    });
  } catch (error) {
    console.error('unfreezeAccount error:', error);
    res.status(500).json({ success: false, message: 'Failed to unfreeze account' });
  }
}

/**
 * GET /api/profile/security/audit-log/export?delivery=download|email&days=90
 * Task 16 — Export the patient's audit log as CSV.
 *  delivery=download (default) → text/csv stream
 *  delivery=email              → CSV attached to an email
 */
async function exportAuditLog(req, res) {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;
    const delivery = (req.query.delivery || 'download').toLowerCase();
    const days = Math.min(parseInt(req.query.days, 10) || 90, 365);

    const result = await query(
      `SELECT id, event_type, status, ip_address, user_agent, error_message,
              additional_data, created_at
         FROM audit_logs
        WHERE user_id = $1 AND user_type = 'patient'
          AND created_at > NOW() - ($2 || ' days')::interval
        ORDER BY created_at DESC`,
      [userId, String(days)]
    );

    const header = ['id', 'created_at', 'event_type', 'status', 'ip_address', 'user_agent', 'error_message', 'additional_data'];
    const rows = result.rows.map((r) => [
      r.id,
      r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
      r.event_type,
      r.status,
      r.ip_address,
      r.user_agent,
      r.error_message,
      r.additional_data
    ]);
    const csv = [header.join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\r\n');

    await AuditLog.logSecurityEvent(
      req, userId, 'patient', userEmail,
      'audit_log_exported', 'success',
      `delivery=${delivery} days=${days} rows=${rows.length}`
    );

    if (delivery === 'email') {
      const patient = await User.findById(userId);
      try {
        await emailService.sendSecurityAuditLog(userEmail, patient.first_name, csv);
      } catch (e) {
        console.error('Audit log email failed:', e.message);
        return res.status(500).json({ success: false, message: 'Failed to email audit log' });
      }
      return res.json({
        success: true,
        message: `Audit log (${rows.length} rows over ${days} days) emailed to ${userEmail}`
      });
    }

    const filename = `audit-log-${userId}-${Date.now()}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(csv);
  } catch (error) {
    console.error('exportAuditLog error:', error);
    res.status(500).json({ success: false, message: 'Failed to export audit log' });
  }
}

module.exports = {
  reportSuspicious,
  freezeAccount,
  unfreezeAccount,
  exportAuditLog
};
