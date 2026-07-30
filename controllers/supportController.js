const fs = require('fs');
const path = require('path');
const { query } = require('../config/db');
const User = require('../models/User');
const Session = require('../models/Session');
const AuditLog = require('../models/AuditLog');
const AccountDeletionToken = require('../models/AccountDeletionToken');
const emailService = require('../services/emailService');

const FAQ_PATH = path.join(__dirname, '..', 'content', 'support', 'faq.json');

const ALLOWED_CATEGORIES = ['general', 'billing', 'medical', 'technical', 'account', 'contact'];

async function createTicket({ req, patientId, email, firstName, lastName, category, subject, message, priority }) {
  const ip = req.ip;
  const ua = req.headers['user-agent'];

  const result = await query(
    `INSERT INTO support_tickets
       (patient_id, email, first_name, last_name, category, subject, message, priority, ip_address, user_agent)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING id, category, subject, status, priority, created_at`,
    [
      patientId || null,
      email,
      firstName || null,
      lastName || null,
      category,
      subject,
      message,
      priority || 'normal',
      ip,
      ua
    ]
  );
  return result.rows[0];
}

/**
 * POST /api/support/tickets 
 * If authenticated, ties ticket to patient_id; otherwise treats as anonymous (email required).
 */
async function submitTicket(req, res) {
  try {
    const { category = 'general', subject, message, priority } = req.body;
    let { email, first_name, last_name } = req.body;
    const patientId = req.user?.id || null;

    if (patientId) {
      const patient = await User.findById(patientId);
      if (patient) {
        email = patient.email;
        first_name = first_name || patient.first_name;
        last_name = last_name || patient.last_name;
      }
    }

    if (!email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'email, subject and message are required'
      });
    }
    if (!ALLOWED_CATEGORIES.includes(String(category).toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `category must be one of: ${ALLOWED_CATEGORIES.join(', ')}`
      });
    }

    const ticket = await createTicket({
      req,
      patientId,
      email,
      firstName: first_name,
      lastName: last_name,
      category: String(category).toLowerCase(),
      subject: String(subject).trim(),
      message: String(message).trim(),
      priority
    });

    // Email the ticket to support
    try {
      await emailService.sendSupportTicket(
        { ...ticket, email, message, subject },
        { id: patientId, email, first_name, last_name }
      );
    } catch (e) {
      console.warn('Support ticket email failed (continuing):', e.message);
    }

    if (patientId) {
      try {
        await AuditLog.logSecurityEvent(req, patientId, 'patient', email, 'support_ticket_submitted', 'success', `ticket=${ticket.id}`);
      } catch (_) { /* ignore */ }
    }

    res.status(201).json({
      success: true,
      message: 'Support ticket submitted. Our team will respond by email.',
      ticket
    });
  } catch (error) {
    console.error('submitTicket error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit support ticket' });
  }
}

/** GET /api/support/tickets — authenticated patient's own tickets */
async function listMyTickets(req, res) {
  try {
    const patientId = req.user.id;
    const result = await query(
      `SELECT id, category, subject, status, priority, created_at, updated_at, resolved_at
         FROM support_tickets
        WHERE patient_id = $1
        ORDER BY created_at DESC LIMIT 100`,
      [patientId]
    );
    res.json({ success: true, tickets: result.rows, total: result.rows.length });
  } catch (error) {
    console.error('listMyTickets error:', error);
    res.status(500).json({ success: false, message: 'Failed to list tickets' });
  }
}

/** GET /api/support/faq  */
async function getFAQ(req, res) {
  try {
    const raw = fs.readFileSync(FAQ_PATH, 'utf8');
    res.json({ success: true, faq: JSON.parse(raw) });
  } catch (error) {
    console.error('getFAQ error:', error);
    res.status(500).json({ success: false, message: 'Failed to load FAQ' });
  }
}

/** POST /api/support/contact  — same shape as submitTicket but forced category=contact */
async function contactUs(req, res) {
  req.body.category = 'contact';
  return submitTicket(req, res);
}

// PERMANENT ACCOUNT DELETION  

/** POST /api/profile/account/delete-request
 *  Sends a 24h confirmation link via the existing AccountDeletionToken flow.
 *  Body: { current_password, reason? }
 */
async function requestAccountDeletion(req, res) {
  try {
    const patientId = req.user.id;
    const patientEmail = req.user.email;
    const { current_password } = req.body;

    if (!current_password) {
      return res.status(400).json({ success: false, message: 'current_password is required' });
    }

    const bcrypt = require('bcrypt');
    const user = await User.findById(patientId);
    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid) {
      await AuditLog.logSecurityEvent(req, patientId, 'patient', patientEmail, 'account_deletion_requested', 'failed', 'Invalid password');
      return res.status(401).json({ success: false, message: 'Invalid password' });
    }

    const tokenResult = await AccountDeletionToken.create(patientId, patientEmail, req.ip, req.headers['user-agent']);
    const base = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
    const confirmLink = `${base}/api/profile/account/delete-confirm?token=${tokenResult.token}`;

    // Reuse account-freeze email template visually — same single-use link shape.
    // If the team adds a dedicated deletion email, swap here.
    try {
      await emailService.sendAccountFreezeConfirmation(patientEmail, user.first_name, confirmLink);
    } catch (e) {
      console.warn('Deletion email failed (continuing):', e.message);
    }

    await AuditLog.logSecurityEvent(req, patientId, 'patient', patientEmail, 'account_deletion_requested', 'success');

    res.json({
      success: true,
      message: 'A confirmation link has been emailed to you. It expires in 24 hours.'
    });
  } catch (error) {
    console.error('requestAccountDeletion error:', error);
    res.status(500).json({ success: false, message: 'Failed to request account deletion' });
  }
}

/** GET /api/profile/account/delete-confirm?token=... — final delete (no auth) */
async function confirmAccountDeletion(req, res) {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ success: false, message: 'token is required' });

    const record = await AccountDeletionToken.findByToken(token);
    if (!record) {
      return res.status(400).json({ success: false, message: 'Invalid or expired token' });
    }

    const userId = record.user_id;
    const email = record.email;

    // Revoke sessions first so any concurrent requests fail fast
    try { await Session.invalidateUserSessions(userId, 'Account deleted'); } catch (_) {}

    // Hard delete — FK cascades drop sessions, action tokens, connections, claims, etc.
    await query('DELETE FROM patients WHERE id = $1', [userId]);

    await AccountDeletionToken.markAsConfirmed(record.id);
    await AuditLog.logSecurityEvent(req, null, 'patient', email, 'account_deleted', 'success', `user_id=${userId}`);

    res.json({ success: true, message: 'Your account has been permanently deleted.' });
  } catch (error) {
    console.error('confirmAccountDeletion error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete account' });
  }
}

module.exports = {
  submitTicket,
  listMyTickets,
  getFAQ,
  contactUs,
  requestAccountDeletion,
  confirmAccountDeletion
};
