const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt'); // not needed here; kept import-free below
const { query } = require('../config/db');
const cache = require('../services/cacheService');
const User = require('../models/User');
const ActionToken = require('../models/ActionToken');
const AuditLog = require('../models/AuditLog');
const emailService = require('../services/emailService');
const { encrypt, decryptAndMask } = require('../utils/encryption');

/**
 * Profile Controller
 * Sprint 1 — Personal profile (tasks 1–4)
 *
 *   GET  /api/profile             — home screen summary
 *   PUT  /api/profile/personal    — name / phone / email (email triggers re-verify)
 *   PUT  /api/profile/account     — name / id_number (encrypted) / dob
 *   PUT  /api/profile/avatar      — upload + store URL
 *   GET  /api/profile/email/verify?token=...  — confirm email change
 */

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

const AVATARS_DIR = path.join(__dirname, '..', 'uploads', 'avatars');
if (!fs.existsSync(AVATARS_DIR)) {
  fs.mkdirSync(AVATARS_DIR, { recursive: true });
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9\s\-()]{7,20}$/;

async function invalidateUserCache(userId, email) {
  try {
    await cache.del(`user:id:${userId}`);
    if (email) await cache.del(`user:email:${email}`);
    await cache.del(`patient_profile_complete_${userId}`);
  } catch (_) {
    // cache is optional
  }
}

function buildAvatarUrl(req, filename) {
  // Served by static route mounted in server.js
  return `${req.protocol}://${req.get('host')}/uploads/avatars/${filename}`;
}

class ProfileController {
  /**
   * Task 1: GET /api/profile
   * Returns the profile home screen data — avatar, full name, email, suburb, city.
   */
  static async getProfile(req, res) {
    try {
      const userId = req.user.id;
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      return res.status(200).json({
        success: true,
        data: {
          id: user.id,
          avatar_url: user.avatar_url || user.oauth_profile_picture || null,
          first_name: user.first_name,
          last_name: user.last_name,
          full_name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
          email: user.email,
          suburb: user.suburb || null,
          city: user.city || null
        }
      });
    } catch (error) {
      console.error('Get profile error:', error);
      return res.status(500).json({ success: false, message: 'Error fetching profile', error: error.message });
    }
  }

  /**
   * Task 2: PUT /api/profile/personal
   * Updates first_name, last_name, phone, email.
   * If email changes: send verification to NEW address, keep old email until confirmed.
   */
  static async updatePersonal(req, res) {
    try {
      const userId = req.user.id;
      const { first_name, last_name, phone, email } = req.body;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Validate
      if (email && !EMAIL_REGEX.test(email)) {
        return res.status(400).json({ success: false, message: 'Invalid email format' });
      }
      if (phone && !PHONE_REGEX.test(phone)) {
        return res.status(400).json({ success: false, message: 'Invalid phone format' });
      }

      // Build update set for the non-email fields (committed immediately)
      const sets = [];
      const values = [];
      let i = 1;
      if (first_name !== undefined) { sets.push(`first_name = $${i++}`); values.push(first_name); }
      if (last_name !== undefined)  { sets.push(`last_name = $${i++}`);  values.push(last_name); }
      if (phone !== undefined)      { sets.push(`phone = $${i++}`);      values.push(phone); }

      let updated = user;
      if (sets.length > 0) {
        sets.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(userId);
        const result = await query(
          `UPDATE patients SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
          values
        );
        updated = result.rows[0];
        await invalidateUserCache(userId, updated.email);
      }

      // Email change: issue verification token, send link to NEW address, do NOT update email yet
      let emailChangePending = false;
      if (email && email !== user.email) {
        // Ensure new email isn't already taken
        const existing = await User.findByEmail(email);
        if (existing) {
          return res.status(409).json({ success: false, message: 'Email already in use' });
        }

        await ActionToken.invalidateExisting(userId, 'email_change');
        const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
        const { token } = await ActionToken.create({
          userId,
          purpose: 'email_change',
          payload: { new_email: email },
          expiresInMinutes: 60,
          ipAddress,
          userAgent: req.headers['user-agent']
        });

        const verifyLink = `${BACKEND_URL}/api/profile/email/verify?token=${token}`;
        try {
          await emailService.sendEmailChangeVerification(email, updated.first_name, verifyLink);
        } catch (e) {
          console.error('Failed to send email-change verification:', e.message);
        }
        emailChangePending = true;
      }

      await AuditLog.logSecurityEvent(req, userId, 'patient', updated.email, 'profile_updated', 'success');

      delete updated.password_hash;
      delete updated.id_number_encrypted;
      delete updated.two_fa_secret;

      return res.status(200).json({
        success: true,
        message: emailChangePending
          ? 'Profile updated. Please check your new email address to confirm the change.'
          : 'Profile updated successfully',
        email_change_pending: emailChangePending,
        data: updated
      });
    } catch (error) {
      console.error('Update personal error:', error);
      return res.status(500).json({ success: false, message: 'Error updating profile', error: error.message });
    }
  }

  /**
   * GET /api/profile/email/verify?token=...
   * Completes the email-change flow.
   */
  static async verifyEmailChange(req, res) {
    try {
      const { token } = req.query;
      if (!token) {
        return res.status(400).json({ success: false, message: 'Missing token' });
      }

      const record = await ActionToken.findValid(token, 'email_change');
      if (!record) {
        return res.status(400).json({ success: false, message: 'Invalid or expired token' });
      }

      const newEmail = record.payload?.new_email;
      if (!newEmail) {
        return res.status(400).json({ success: false, message: 'Token payload missing new email' });
      }

      // Final uniqueness check
      const existing = await User.findByEmail(newEmail);
      if (existing && existing.id !== record.user_id) {
        return res.status(409).json({ success: false, message: 'Email already in use' });
      }

      const oldUser = await User.findById(record.user_id);
      await query(
        `UPDATE patients SET email = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [newEmail, record.user_id]
      );
      await ActionToken.consume(record.id);
      await invalidateUserCache(record.user_id, oldUser?.email);
      await invalidateUserCache(record.user_id, newEmail);

      await AuditLog.logSecurityEvent(req, record.user_id, 'patient', newEmail, 'email_changed', 'success');

      return res.status(200).json({ success: true, message: 'Email address updated successfully' });
    } catch (error) {
      console.error('Verify email change error:', error);
      return res.status(500).json({ success: false, message: 'Error confirming email change', error: error.message });
    }
  }

  /**
   * Task 3: PUT /api/profile/account
   * Updates first_name, last_name, id_number (encrypted), date_of_birth.
   * Returns the ID number masked to last 4 only.
   */
  static async updateAccount(req, res) {
    try {
      const userId = req.user.id;
      const { first_name, last_name, id_number, date_of_birth } = req.body;

      // Validate DOB if provided
      if (date_of_birth !== undefined && date_of_birth !== null && date_of_birth !== '') {
        const d = new Date(date_of_birth);
        if (isNaN(d.getTime())) {
          return res.status(400).json({ success: false, message: 'Invalid date_of_birth format (use ISO YYYY-MM-DD)' });
        }
      }

      const sets = [];
      const values = [];
      let i = 1;
      if (first_name !== undefined)    { sets.push(`first_name = $${i++}`);    values.push(first_name); }
      if (last_name !== undefined)     { sets.push(`last_name = $${i++}`);     values.push(last_name); }
      if (date_of_birth !== undefined) { sets.push(`date_of_birth = $${i++}`); values.push(date_of_birth || null); }
      if (id_number !== undefined) {
        const ciphertext = encrypt(id_number);
        sets.push(`id_number_encrypted = $${i++}`);
        values.push(ciphertext);
      }

      if (sets.length === 0) {
        return res.status(400).json({ success: false, message: 'No fields to update' });
      }

      sets.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(userId);
      const result = await query(
        `UPDATE patients SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
        values
      );
      const updated = result.rows[0];
      if (!updated) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      await invalidateUserCache(userId, updated.email);

      await AuditLog.logSecurityEvent(req, userId, 'patient', updated.email, 'account_updated', 'success');

      // Mask id_number on response
      const masked = decryptAndMask(updated.id_number_encrypted);

      delete updated.password_hash;
      delete updated.id_number_encrypted;
      delete updated.two_fa_secret;

      return res.status(200).json({
        success: true,
        message: 'Account updated successfully',
        data: {
          ...updated,
          id_number: masked
        }
      });
    } catch (error) {
      console.error('Update account error:', error);
      return res.status(500).json({ success: false, message: 'Error updating account', error: error.message });
    }
  }

  /**
   * Task 4: PUT /api/profile/avatar
   * Accepts an image upload, stores it, saves URL to patient record, returns the URL.
   * Multer is configured in routes/profileRoutes.js (memory storage, image MIME only).
   */
  static async updateAvatar(req, res) {
    try {
      const userId = req.user.id;
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No image file provided (field: avatar)' });
      }

      const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg';
      const filename = `patient_${userId}_${Date.now()}${ext}`;
      const fullPath = path.join(AVATARS_DIR, filename);

      await fs.promises.writeFile(fullPath, req.file.buffer);

      const url = buildAvatarUrl(req, filename);

      const result = await query(
        `UPDATE patients SET avatar_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING email, avatar_url`,
        [url, userId]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      await invalidateUserCache(userId, result.rows[0].email);

      await AuditLog.logSecurityEvent(req, userId, 'patient', result.rows[0].email, 'avatar_updated', 'success');

      return res.status(200).json({
        success: true,
        message: 'Avatar updated successfully',
        data: { avatar_url: url }
      });
    } catch (error) {
      console.error('Update avatar error:', error);
      return res.status(500).json({ success: false, message: 'Error updating avatar', error: error.message });
    }
  }
}

module.exports = ProfileController;
