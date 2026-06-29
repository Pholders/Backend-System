const bcrypt = require('bcrypt');
const { authenticator } = require('otplib');
const { query } = require('../config/db');
const User = require('../models/User');
const Session = require('../models/Session');
const LoginLocation = require('../models/LoginLocation');
const AuditLog = require('../models/AuditLog');
const OTP = require('../models/OTP');
const ActionToken = require('../models/ActionToken');
const PasswordValidator = require('../utils/passwordValidator');
const emailService = require('../services/emailService');
const cache = require('../services/cacheService');

const TOTP_ISSUER = process.env.TOTP_ISSUER || 'Backend-System';

// Allow small clock drift for authenticator codes
authenticator.options = { window: 1 };

/**
 * Best-effort cache invalidation for a patient.
 */
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
 * GET /api/profile/security
 * Task 5 — Return security settings summary
 */
async function getSecurity(req, res) {
  try {
    const userId = req.user.id;
    const result = await query(
      `SELECT password_changed_at, password_strength,
              face_id_enabled, fingerprint_enabled,
              two_fa_enabled, two_fa_method
         FROM patients WHERE id = $1`,
      [userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const row = result.rows[0];
    res.json({
      success: true,
      security: {
        password_changed_at: row.password_changed_at,
        password_strength: row.password_strength,
        face_id_enabled: !!row.face_id_enabled,
        fingerprint_enabled: !!row.fingerprint_enabled,
        two_fa_enabled: !!row.two_fa_enabled,
        two_fa_method: row.two_fa_method
      }
    });
  } catch (error) {
    console.error('getSecurity error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch security settings' });
  }
}

/**
 * PUT /api/profile/security/biometrics
 * Task 6 — Toggle face_id / fingerprint flags
 */
async function updateBiometrics(req, res) {
  try {
    const userId = req.user.id;
    const { face_id_enabled, fingerprint_enabled } = req.body;

    if (face_id_enabled === undefined && fingerprint_enabled === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Provide face_id_enabled and/or fingerprint_enabled'
      });
    }

    const fields = [];
    const values = [];
    let i = 1;
    if (typeof face_id_enabled === 'boolean') {
      fields.push(`face_id_enabled = $${i++}`);
      values.push(face_id_enabled);
    }
    if (typeof fingerprint_enabled === 'boolean') {
      fields.push(`fingerprint_enabled = $${i++}`);
      values.push(fingerprint_enabled);
    }
    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId);

    const result = await query(
      `UPDATE patients SET ${fields.join(', ')} WHERE id = $${i}
       RETURNING id, email, face_id_enabled, fingerprint_enabled`,
      values
    );

    await invalidateUserCache(userId, result.rows[0]?.email);
    await AuditLog.logSecurityEvent(req, userId, 'patient', result.rows[0]?.email, 'biometrics_updated', 'success');

    res.json({
      success: true,
      message: 'Biometrics settings updated',
      biometrics: {
        face_id_enabled: !!result.rows[0].face_id_enabled,
        fingerprint_enabled: !!result.rows[0].fingerprint_enabled
      }
    });
  } catch (error) {
    console.error('updateBiometrics error:', error);
    res.status(500).json({ success: false, message: 'Failed to update biometrics' });
  }
}

/**
 * PUT /api/profile/security/2fa
 * Task 7 — Begin enable/disable flow for 2FA
 * Body: { enabled: boolean, method: 'email' | 'authenticator' }
 *
 * Enable: creates an ActionToken (purpose: twofa_enable) with payload {method, secret?}.
 *  - For 'email', emails an OTP via existing OTP system.
 *  - For 'authenticator', returns an otpauth URL the client renders as a QR.
 *  Caller must POST /security/2fa/verify with the 6-digit code to actually enable it.
 *
 * Disable: requires password confirmation.
 */
async function updateTwoFA(req, res) {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;
    const { enabled, method, current_password } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ success: false, message: 'enabled (boolean) is required' });
    }

    // --- DISABLE PATH ---
    if (!enabled) {
      if (!current_password) {
        return res.status(400).json({
          success: false,
          message: 'current_password is required to disable 2FA'
        });
      }
      const user = await User.findById(userId);
      const ok = await bcrypt.compare(current_password, user.password_hash);
      if (!ok) {
        await AuditLog.logSecurityEvent(req, userId, 'patient', userEmail, 'twofa_disable', 'failed', 'Invalid password');
        return res.status(401).json({ success: false, message: 'Invalid password' });
      }

      await query(
        `UPDATE patients
            SET two_fa_enabled = false, two_fa_method = NULL, two_fa_secret = NULL,
                updated_at = CURRENT_TIMESTAMP
          WHERE id = $1`,
        [userId]
      );
      await invalidateUserCache(userId, userEmail);
      await AuditLog.logSecurityEvent(req, userId, 'patient', userEmail, 'twofa_disabled', 'success');

      return res.json({ success: true, message: '2FA disabled' });
    }

    // --- ENABLE PATH ---
    if (!['email', 'authenticator'].includes(method)) {
      return res.status(400).json({
        success: false,
        message: "method must be 'email' or 'authenticator'"
      });
    }

    // Drop any existing pending enable tokens
    await ActionToken.invalidateExisting(userId, 'twofa_enable');

    const ip = req.ip;
    const ua = req.headers['user-agent'];

    if (method === 'email') {
      // Reuse existing OTP system
      const otp = await OTP.create(userId, 'login', 'patient');
      try {
        await emailService.sendOTP(userEmail, otp.otp_code, req.user.first_name);
      } catch (e) {
        console.warn('Email OTP send failed (continuing):', e.message);
      }
      // Token carries the method only; actual code is validated against OTP table
      await ActionToken.create({
        userId,
        purpose: 'twofa_enable',
        payload: { method: 'email' },
        expiresInMinutes: 10,
        ipAddress: ip,
        userAgent: ua
      });

      await AuditLog.logSecurityEvent(req, userId, 'patient', userEmail, 'twofa_enable_started', 'success', 'method=email');

      return res.json({
        success: true,
        message: 'Verification code sent to your email. POST /api/profile/security/2fa/verify with the code to enable.',
        method: 'email'
      });
    }

    // method === 'authenticator'
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(userEmail, TOTP_ISSUER, secret);

    const { token } = await ActionToken.create({
      userId,
      purpose: 'twofa_enable',
      payload: { method: 'authenticator', secret },
      expiresInMinutes: 10,
      ipAddress: ip,
      userAgent: ua
    });

    await AuditLog.logSecurityEvent(req, userId, 'patient', userEmail, 'twofa_enable_started', 'success', 'method=authenticator');

    return res.json({
      success: true,
      message: 'Scan the QR code with your authenticator app, then POST /api/profile/security/2fa/verify with the 6-digit code.',
      method: 'authenticator',
      setup_token: token,
      secret,
      otpauth_url: otpauthUrl
    });
  } catch (error) {
    console.error('updateTwoFA error:', error);
    res.status(500).json({ success: false, message: 'Failed to update 2FA' });
  }
}

/**
 * POST /api/profile/security/2fa/verify
 * Body: { code: '123456', setup_token?: '<token from authenticator enable>' }
 */
async function verifyTwoFAEnable(req, res) {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;
    const { code, setup_token } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, message: 'code is required' });
    }

    // Find the most recent pending token for this user
    let actionToken = null;
    if (setup_token) {
      actionToken = await ActionToken.findValid(setup_token, 'twofa_enable');
      if (actionToken && actionToken.user_id !== userId) actionToken = null;
    } else {
      const result = await query(
        `SELECT * FROM action_tokens
          WHERE user_id = $1 AND purpose = 'twofa_enable'
            AND consumed = false AND expires_at > NOW()
          ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );
      actionToken = result.rows[0] || null;
    }

    if (!actionToken) {
      return res.status(400).json({
        success: false,
        message: 'No pending 2FA setup. Start enable flow first.'
      });
    }

    const payload = actionToken.payload || {};
    const method = payload.method;

    let valid = false;
    if (method === 'authenticator') {
      valid = authenticator.verify({ token: String(code), secret: payload.secret });
    } else if (method === 'email') {
      const verifyResult = await OTP.verify(userId, code, 'login', 'patient');
      valid = !!verifyResult?.valid;
    }

    if (!valid) {
      await AuditLog.logSecurityEvent(req, userId, 'patient', userEmail, 'twofa_enable_verify', 'failed', `method=${method}`);
      return res.status(401).json({ success: false, message: 'Invalid verification code' });
    }

    // Persist 2FA settings on patient
    if (method === 'authenticator') {
      await query(
        `UPDATE patients
            SET two_fa_enabled = true, two_fa_method = 'authenticator',
                two_fa_secret = $1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2`,
        [payload.secret, userId]
      );
    } else {
      await query(
        `UPDATE patients
            SET two_fa_enabled = true, two_fa_method = 'email',
                two_fa_secret = NULL, updated_at = CURRENT_TIMESTAMP
          WHERE id = $1`,
        [userId]
      );
    }

    await ActionToken.consume(actionToken.id);
    await invalidateUserCache(userId, userEmail);
    await AuditLog.logSecurityEvent(req, userId, 'patient', userEmail, 'twofa_enabled', 'success', `method=${method}`);

    res.json({
      success: true,
      message: '2FA enabled',
      two_fa_method: method
    });
  } catch (error) {
    console.error('verifyTwoFAEnable error:', error);
    res.status(500).json({ success: false, message: 'Failed to verify 2FA' });
  }
}

/**
 * PUT /api/profile/security/password
 * Task 8 — Change password
 * Body: { current_password, new_password, confirm_password }
 */
async function updatePassword(req, res) {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;
    const { current_password, new_password, confirm_password } = req.body;

    if (!current_password || !new_password || !confirm_password) {
      return res.status(400).json({
        success: false,
        message: 'current_password, new_password and confirm_password are required'
      });
    }

    if (new_password !== confirm_password) {
      return res.status(400).json({
        success: false,
        message: 'new_password and confirm_password do not match'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const currentValid = await bcrypt.compare(current_password, user.password_hash);
    if (!currentValid) {
      await AuditLog.logSecurityEvent(req, userId, 'patient', userEmail, 'password_change', 'failed', 'Invalid current password');
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    const validation = PasswordValidator.validate(new_password);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'New password does not meet requirements',
        errors: validation.errors
      });
    }

    // Prevent reusing the same password
    const sameAsCurrent = await bcrypt.compare(new_password, user.password_hash);
    if (sameAsCurrent) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from current password'
      });
    }

    const strengthScore = PasswordValidator.getStrength(new_password);
    const strengthLabel = PasswordValidator.getStrengthDescription(strengthScore);
    const hash = await bcrypt.hash(new_password, 10);

    await query(
      `UPDATE patients
          SET password_hash = $1,
              password_changed_at = CURRENT_TIMESTAMP,
              password_strength = $2,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $3`,
      [hash, strengthLabel, userId]
    );

    // Revoke all other sessions
    const currentSessionId = req.authSession?.id || null;
    if (currentSessionId) {
      await Session.revokeAllExcept(userId, currentSessionId, 'Password changed');
    } else {
      await Session.invalidateUserSessions(userId, 'Password changed');
    }

    await invalidateUserCache(userId, userEmail);
    await AuditLog.logSecurityEvent(req, userId, 'patient', userEmail, 'password_changed', 'success', `strength=${strengthLabel}`);

    res.json({
      success: true,
      message: 'Password updated successfully',
      password_strength: strengthLabel,
      password_strength_score: strengthScore
    });
  } catch (error) {
    console.error('updatePassword error:', error);
    res.status(500).json({ success: false, message: 'Failed to update password' });
  }
}

/**
 * GET /api/profile/devices
 * Task 10 — List active sessions/devices
 */
async function listDevices(req, res) {
  try {
    const userId = req.user.id;
    const currentSessionId = req.authSession?.id || null;
    const sessions = await Session.getUserActiveSessions(userId);

    const devices = sessions.map((s) => ({
      id: s.id,
      is_current: currentSessionId && s.id === currentSessionId,
      ip_address: s.ip_address,
      device_info: s.device_info,
      created_at: s.created_at,
      last_activity_at: s.last_activity_at,
      expires_at: s.expires_at
    }));

    res.json({ success: true, devices, total: devices.length });
  } catch (error) {
    console.error('listDevices error:', error);
    res.status(500).json({ success: false, message: 'Failed to list devices' });
  }
}

/**
 * DELETE /api/profile/devices/:sessionId
 * Task 11 — Revoke a session by id (signs that device out)
 */
async function revokeDevice(req, res) {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;
    const { sessionId } = req.params;
    const currentSessionId = req.authSession?.id || null;

    if (sessionId === currentSessionId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot revoke current session via this endpoint. Use logout.'
      });
    }

    // Ensure the session belongs to this user
    const owned = await query(
      `SELECT id FROM sessions WHERE id = $1 AND user_id = $2`,
      [sessionId, userId]
    );
    if (!owned.rows.length) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    await Session.revoke(sessionId, 'Revoked by user from device list');
    await AuditLog.logSecurityEvent(req, userId, 'patient', userEmail, 'session_revoked', 'success', `session=${sessionId}`);

    res.json({ success: true, message: 'Session revoked' });
  } catch (error) {
    console.error('revokeDevice error:', error);
    res.status(500).json({ success: false, message: 'Failed to revoke session' });
  }
}

/**
 * POST /api/profile/devices/revoke-others
 * Convenience — revoke all sessions except the current one.
 */
async function revokeOtherDevices(req, res) {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;
    const currentSessionId = req.authSession?.id || null;

    if (!currentSessionId) {
      return res.status(400).json({ success: false, message: 'No active session detected' });
    }

    const revoked = await Session.revokeAllExcept(userId, currentSessionId, 'Revoked by user');
    await AuditLog.logSecurityEvent(req, userId, 'patient', userEmail, 'sessions_revoked_others', 'success', `count=${revoked.length}`);

    res.json({ success: true, message: 'Other sessions revoked', count: revoked.length });
  } catch (error) {
    console.error('revokeOtherDevices error:', error);
    res.status(500).json({ success: false, message: 'Failed to revoke other sessions' });
  }
}

/**
 * GET /api/profile/login-activity
 * Task 12 — Recent login attempts (successful logins from login_locations + failed
 * attempts from audit_logs).
 */
async function getLoginActivity(req, res) {
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);

    const successful = await LoginLocation.getUserLoginHistory(userId, limit);

    // Pull failed login attempts from audit_logs (Task 13 data source)
    const failed = await query(
      `SELECT id, event_type, status, ip_address, user_agent, error_message, created_at
         FROM audit_logs
        WHERE user_id = $1 AND user_type = 'patient'
          AND event_type IN ('login', 'login_failed')
          AND status = 'failed'
        ORDER BY created_at DESC LIMIT $2`,
      [userId, limit]
    );

    res.json({
      success: true,
      activity: {
        successful_logins: successful.map((l) => ({
          id: l.id,
          ip_address: l.ip_address,
          country: l.country,
          region: l.region,
          city: l.city,
          device_name: l.device_name,
          browser: l.browser,
          os: l.os,
          is_suspicious: !!l.is_suspicious,
          risk_score: l.risk_score,
          last_login_at: l.last_login_at,
          login_count: l.login_count
        })),
        failed_attempts: failed.rows.map((r) => ({
          id: r.id,
          ip_address: r.ip_address,
          user_agent: r.user_agent,
          reason: r.error_message,
          at: r.created_at
        }))
      }
    });
  } catch (error) {
    console.error('getLoginActivity error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch login activity' });
  }
}

module.exports = {
  getSecurity,
  updateBiometrics,
  updateTwoFA,
  verifyTwoFAEnable,
  updatePassword,
  listDevices,
  revokeDevice,
  revokeOtherDevices,
  getLoginActivity
};
