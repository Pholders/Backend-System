const AdminRecords = require('../models/AdminRecords');
const AuditLog = require('../models/AuditLog');
const Session = require('../models/Session');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Pharmacy = require('../models/Pharmacy');
const Admin = require('../models/Admin');
const emailService = require('../services/emailService');

/**
 * Admin access to platform records beyond the account directories:
 * orders, payments, appointments, prescriptions, support tickets, doctor
 * reviews and security alerts. Queries and the list of what is (and isn't)
 * returned live on AdminRecords.
 */

/** A bad query or body value. Turned into a 400 by `handle`. */
class BadRequest extends Error {}

const ID_RE = /^[1-9]\d{0,9}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const parse = {
  /** Optional positive integer. */
  id(raw, name) {
    if (raw === undefined || raw === '') return undefined;
    if (!ID_RE.test(String(raw))) throw new BadRequest(`${name} must be a positive integer`);
    return Number(raw);
  },

  /** Optional value from a fixed list. */
  oneOf(raw, list, name) {
    if (raw === undefined || raw === '') return undefined;
    if (!list.includes(raw)) throw new BadRequest(`${name} must be one of: ${list.join(', ')}`);
    return raw;
  },

  /** Optional YYYY-MM-DD that is a real calendar date. */
  date(raw, name) {
    if (raw === undefined || raw === '') return undefined;
    const d = new Date(`${raw}T00:00:00Z`);
    if (!DATE_RE.test(raw) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== raw) {
      throw new BadRequest(`${name} must be a date in YYYY-MM-DD form`);
    }
    return raw;
  },

  /** Optional 'true' / 'false'. */
  bool(raw, name) {
    if (raw === undefined || raw === '') return undefined;
    if (raw === true || raw === 'true') return true;
    if (raw === false || raw === 'false') return false;
    throw new BadRequest(`${name} must be true or false`);
  },

  /** Integer clamped to [min, max], `fallback` when missing. */
  int(raw, { min, max, fallback, name }) {
    if (raw === undefined || raw === '') return fallback;
    const n = Number(raw);
    if (!Number.isInteger(n)) throw new BadRequest(`${name} must be a whole number`);
    return Math.min(Math.max(n, min), max);
  },

  /** limit/offset, as on the other admin directories. */
  paging(q) {
    return {
      limit: parse.int(q.limit, { min: 1, max: 200, fallback: 50, name: 'limit' }),
      offset: parse.int(q.offset, { min: 0, max: Number.MAX_SAFE_INTEGER, fallback: 0, name: 'offset' })
    };
  },

  /** from/to as SA calendar days; from may not be after to. */
  range(q) {
    const from = parse.date(q.from, 'from');
    const to = parse.date(q.to, 'to');
    if (from && to && from > to) throw new BadRequest('from must not be after to');
    return { from, to };
  },

  /** Required route id. */
  param(raw, label) {
    if (!ID_RE.test(String(raw))) throw new BadRequest(`Invalid ${label} id`);
    return Number(raw);
  }
};

/**
 * Wraps a handler: BadRequest becomes 400, anything else a logged 500.
 */
const handle = (what, fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    if (error instanceof BadRequest) {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error(`Admin ${what} error:`, error);
    res.status(500).json({ success: false, message: `Error processing ${what}`, error: error.message });
  }
};

/**
 * Audit an admin action that has already happened. A failed audit write
 * must not turn the response into a 500 — the admin would retry something
 * that is already done — so it is logged loudly instead.
 */
async function audit(req, eventType, message) {
  try {
    await AuditLog.logSecurityEvent(req, req.user.id, 'admin', req.user.email, eventType, 'success', message);
  } catch (auditError) {
    console.error(`Audit write failed (${eventType}: ${message}):`, auditError.message);
  }
}

const notFound = (res, label) => res.status(404).json({ success: false, message: `${label} not found` });
const ok = (res, message, data) => res.status(200).json({ success: true, message, data });

/** The model that owns accounts of each user_type, for alert follow-up. */
const ACCOUNT_MODELS = { patient: User, doctor: Doctor, pharmacy: Pharmacy, admin: Admin };

/**
 * A threat confirmed on an alert: sign the account out everywhere and tell
 * its owner. Best effort per account; one failure doesn't stop the others.
 * Returns the number of sessions revoked.
 */
async function respondToThreat(alerts) {
  const seen = new Set();
  let revoked = 0;
  for (const alert of alerts) {
    const key = `${alert.user_type}:${alert.user_id}`;
    if (!alert.user_id || seen.has(key)) continue;
    seen.add(key);
    try {
      const sessions = await Session.invalidateUserSessions(alert.user_id, alert.user_type, 'Threat verified by admin');
      revoked += sessions.length;

      const model = ACCOUNT_MODELS[alert.user_type];
      const account = model ? await model.findById(alert.user_id) : null;
      const email = account?.email || alert.email;
      if (email) await emailService.sendThreatNotification(email, account?.first_name || '', alert);
    } catch (error) {
      console.error(`Threat response failed for ${key}:`, error.message);
    }
  }
  return revoked;
}

class AdminRecordsController {
  /* ---------------------------------------------------------------- orders */

  static listOrders = handle('orders', async (req, res) => {
    const q = req.query;
    const opts = {
      ...parse.paging(q),
      ...parse.range(q),
      status: parse.oneOf(q.status, AdminRecords.ORDER_STATUSES, 'status'),
      payment_type: parse.oneOf(q.payment_type, ['cash', 'medical_aid'], 'payment_type'),
      pharmacy_id: parse.id(q.pharmacy_id, 'pharmacy_id'),
      patient_id: parse.id(q.patient_id, 'patient_id')
    };
    const { total, orders } = await AdminRecords.listOrders(opts);
    ok(res, 'Orders retrieved', { total, limit: opts.limit, offset: opts.offset, orders });
  });

  static getOrder = handle('order', async (req, res) => {
    const order = await AdminRecords.getOrder(parse.param(req.params.orderId, 'order'));
    if (!order) return notFound(res, 'Order');
    ok(res, 'Order retrieved', order);
  });

  /* -------------------------------------------------------------- payments */

  static listPayments = handle('payments', async (req, res) => {
    const q = req.query;
    const opts = {
      ...parse.paging(q),
      ...parse.range(q),
      status: parse.oneOf(q.status, AdminRecords.PAYMENT_STATUSES, 'status'),
      method: parse.oneOf(q.method, AdminRecords.PAYMENT_METHODS, 'method'),
      patient_id: parse.id(q.patient_id, 'patient_id'),
      doctor_id: parse.id(q.doctor_id, 'doctor_id')
    };
    const { total, totals, payments } = await AdminRecords.listPayments(opts);
    ok(res, 'Payments retrieved', { total, limit: opts.limit, offset: opts.offset, totals, payments });
  });

  static getPayment = handle('payment', async (req, res) => {
    const payment = await AdminRecords.getPayment(parse.param(req.params.paymentId, 'payment'));
    if (!payment) return notFound(res, 'Payment');
    ok(res, 'Payment retrieved', payment);
  });

  /* ---------------------------------------------------------- appointments */

  static listAppointments = handle('appointments', async (req, res) => {
    const q = req.query;
    const opts = {
      ...parse.paging(q),
      ...parse.range(q),
      status: parse.oneOf(q.status, AdminRecords.APPOINTMENT_STATUSES, 'status'),
      payment_status: parse.oneOf(q.payment_status, AdminRecords.PAYMENT_STATUSES, 'payment_status'),
      doctor_id: parse.id(q.doctor_id, 'doctor_id'),
      patient_id: parse.id(q.patient_id, 'patient_id')
    };
    const { total, appointments } = await AdminRecords.listAppointments(opts);
    ok(res, 'Appointments retrieved', { total, limit: opts.limit, offset: opts.offset, appointments });
  });

  static getAppointment = handle('appointment', async (req, res) => {
    const appointment = await AdminRecords.getAppointment(parse.param(req.params.appointmentId, 'appointment'));
    if (!appointment) return notFound(res, 'Appointment');
    ok(res, 'Appointment retrieved', appointment);
  });

  /* --------------------------------------------------------- prescriptions */

  static listPrescriptions = handle('prescriptions', async (req, res) => {
    const q = req.query;
    const opts = {
      ...parse.paging(q),
      ...parse.range(q),
      state: parse.oneOf(q.state, AdminRecords.PRESCRIPTION_STATES, 'state'),
      doctor_id: parse.id(q.doctor_id, 'doctor_id'),
      patient_id: parse.id(q.patient_id, 'patient_id')
    };
    const { total, prescriptions } = await AdminRecords.listPrescriptions(opts);
    ok(res, 'Prescriptions retrieved', { total, limit: opts.limit, offset: opts.offset, prescriptions });
  });

  /**
   * Like a patient View, every prescription View is audit-logged: it names
   * a patient against a prescriber even though no clinical text is returned.
   */
  static getPrescription = handle('prescription', async (req, res) => {
    const id = parse.param(req.params.prescriptionId, 'prescription');
    const prescription = await AdminRecords.getPrescription(id);
    if (!prescription) return notFound(res, 'Prescription');
    await AuditLog.logSecurityEvent(
      req, req.user.id, 'admin', req.user.email,
      'prescription_record_viewed', 'success', `Viewed prescription ${id}`
    );
    ok(res, 'Prescription retrieved', prescription);
  });

  /* ------------------------------------------------------- support tickets */

  static listTickets = handle('support tickets', async (req, res) => {
    const q = req.query;
    const search = typeof q.search === 'string' ? q.search.trim().slice(0, 100) : '';
    const opts = {
      ...parse.paging(q),
      status: parse.oneOf(q.status, AdminRecords.TICKET_STATUSES, 'status'),
      priority: parse.oneOf(q.priority, AdminRecords.TICKET_PRIORITIES, 'priority'),
      category: parse.oneOf(q.category, AdminRecords.TICKET_CATEGORIES, 'category'),
      search: search || undefined
    };
    const { total, tickets } = await AdminRecords.listTickets(opts);
    ok(res, 'Support tickets retrieved', { total, limit: opts.limit, offset: opts.offset, tickets });
  });

  static getTicket = handle('support ticket', async (req, res) => {
    const ticket = await AdminRecords.getTicket(parse.param(req.params.ticketId, 'ticket'));
    if (!ticket) return notFound(res, 'Ticket');
    ok(res, 'Support ticket retrieved', ticket);
  });

  /** Change status and/or priority. */
  static updateTicket = handle('support ticket', async (req, res) => {
    const id = parse.param(req.params.ticketId, 'ticket');
    const body = req.body || {};
    const status = parse.oneOf(body.status, AdminRecords.TICKET_STATUSES, 'status');
    const priority = parse.oneOf(body.priority, AdminRecords.TICKET_PRIORITIES, 'priority');
    if (!status && !priority) throw new BadRequest('Send status, priority or both');

    const before = await AdminRecords.getTicket(id);
    if (!before) return notFound(res, 'Ticket');

    await AdminRecords.updateTicket(id, { status, priority });
    const changes = [
      status && `status ${before.status} -> ${status}`,
      priority && `priority ${before.priority} -> ${priority}`
    ].filter(Boolean).join(', ');
    await audit(req, 'support_ticket_updated', `Ticket ${id}: ${changes}`);

    ok(res, 'Support ticket updated', await AdminRecords.getTicket(id));
  });

  /**
   * Reply to whoever raised the ticket. The reply is saved first and then
   * emailed; if the email fails the reply stays on the ticket with
   * email_sent false, and the response says so.
   */
  static replyToTicket = handle('support ticket', async (req, res) => {
    const id = parse.param(req.params.ticketId, 'ticket');
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (!message) throw new BadRequest('message is required');
    if (message.length > 5000) throw new BadRequest('message must be 5000 characters or fewer');

    const ticket = await AdminRecords.getTicket(id);
    if (!ticket) return notFound(res, 'Ticket');
    if (ticket.status === 'closed') {
      return res.status(409).json({ success: false, message: 'Ticket is closed. Reopen it before replying.' });
    }

    const replyId = await AdminRecords.addTicketReply(id, req.user.id, message);
    const sent = await emailService.sendSupportReply(ticket, message);
    if (sent.success) await AdminRecords.markReplyEmailed(replyId);
    await audit(req, 'support_ticket_replied', `Ticket ${id}: reply ${replyId}${sent.success ? '' : ' (email failed)'}`);

    res.status(201).json({
      success: true,
      message: sent.success ? 'Reply sent' : 'Reply saved, but the email could not be sent',
      data: { email_sent: sent.success, ticket: await AdminRecords.getTicket(id) }
    });
  });

  /* --------------------------------------------------------------- reviews */

  static listReviews = handle('reviews', async (req, res) => {
    const q = req.query;
    const opts = {
      ...parse.paging(q),
      doctor_id: parse.id(q.doctor_id, 'doctor_id'),
      patient_id: parse.id(q.patient_id, 'patient_id'),
      rating: parse.oneOf(q.rating, ['1', '2', '3', '4', '5'], 'rating'),
      hidden: parse.bool(q.hidden, 'hidden')
    };
    if (opts.rating) opts.rating = Number(opts.rating);
    const { total, reviews } = await AdminRecords.listReviews(opts);
    ok(res, 'Reviews retrieved', { total, limit: opts.limit, offset: opts.offset, reviews });
  });

  /**
   * Hide or show a review. Hidden reviews leave the doctor's public list
   * and rating figures but stay in the patient's own list.
   */
  static setReviewVisibility = handle('review', async (req, res) => {
    const id = parse.param(req.params.reviewId, 'review');
    const hidden = parse.bool(req.body?.hidden, 'hidden');
    if (hidden === undefined) throw new BadRequest('hidden is required (true or false)');
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 500) : '';
    if (hidden && !reason) throw new BadRequest('reason is required when hiding a review');

    if (!(await AdminRecords.setReviewHidden(id, hidden, req.user.id, reason || null))) {
      return notFound(res, 'Review');
    }
    await audit(
      req, hidden ? 'review_hidden' : 'review_unhidden',
      hidden ? `Review ${id} hidden: ${reason}` : `Review ${id} shown again`
    );
    ok(res, hidden ? 'Review hidden' : 'Review visible', await AdminRecords.getReview(id));
  });

  /** Remove a review for good. Hiding is the reversible option. */
  static deleteReview = handle('review', async (req, res) => {
    const id = parse.param(req.params.reviewId, 'review');
    const review = await AdminRecords.getReview(id);
    if (!review) return notFound(res, 'Review');

    await AdminRecords.deleteReview(id);
    await audit(
      req, 'review_removed_by_admin',
      `Review ${id} (doctor ${review.doctor_id}, patient ${review.patient_id}, ${review.rating}*) deleted`
    );
    ok(res, 'Review deleted', { id });
  });

  /* ------------------------------------------------------- security alerts */

  static getAlertStats = handle('security alert stats', async (req, res) => {
    ok(res, 'Security alert stats retrieved', await AdminRecords.alertStats());
  });

  static listAlerts = handle('security alerts', async (req, res) => {
    const q = req.query;
    const opts = {
      ...parse.paging(q),
      status: parse.oneOf(q.status, AdminRecords.ALERT_STATUSES, 'status'),
      severity: parse.oneOf(q.severity, AdminRecords.ALERT_SEVERITIES, 'severity'),
      alert_type: typeof q.alert_type === 'string' && q.alert_type ? q.alert_type : undefined,
      user_type: parse.oneOf(q.user_type, AdminRecords.USER_TYPES, 'user_type'),
      user_id: parse.id(q.user_id, 'user_id'),
      hours: q.hours === undefined || q.hours === ''
        ? undefined
        : parse.int(q.hours, { min: 1, max: 24 * 365, name: 'hours' })
    };
    if (opts.user_id && !opts.user_type) {
      throw new BadRequest('user_type is required with user_id (ids are only unique per account type)');
    }
    const { total, alerts } = await AdminRecords.listAlerts(opts);
    ok(res, 'Security alerts retrieved', { total, limit: opts.limit, offset: opts.offset, alerts });
  });

  static getAlert = handle('security alert', async (req, res) => {
    const alert = await AdminRecords.getAlert(parse.param(req.params.alertId, 'alert'));
    if (!alert) return notFound(res, 'Alert');
    ok(res, 'Security alert retrieved', alert);
  });

  /**
   * Shared body of single and bulk review. verified_threat signs every
   * affected account out and emails its owner.
   */
  static async applyAlertReview(req, ids, { status, adminNotes, actionTaken }) {
    const updated = await AdminRecords.reviewAlerts(ids, { status, adminNotes, actionTaken });
    const sessionsRevoked = status === 'verified_threat' ? await respondToThreat(updated) : 0;
    for (const alert of updated) {
      await audit(
        req, 'security_alert_reviewed',
        `Alert ${alert.id} (${alert.user_type} ${alert.user_id}) -> ${status}`
      );
    }
    return { updated, sessionsRevoked };
  }

  static reviewAlert = handle('security alert', async (req, res) => {
    const id = parse.param(req.params.alertId, 'alert');
    const body = req.body || {};
    const status = parse.oneOf(body.status, AdminRecords.ALERT_REVIEW_STATUSES, 'status');
    if (!status) throw new BadRequest(`status must be one of: ${AdminRecords.ALERT_REVIEW_STATUSES.join(', ')}`);

    const { updated, sessionsRevoked } = await AdminRecordsController.applyAlertReview(req, [id], {
      status,
      adminNotes: typeof body.adminNotes === 'string' ? body.adminNotes.slice(0, 2000) : null,
      actionTaken: typeof body.actionTaken === 'string' ? body.actionTaken.slice(0, 255) : null
    });
    if (!updated.length) return notFound(res, 'Alert');

    ok(res, `Alert marked ${status}`, { ...(await AdminRecords.getAlert(id)), sessions_revoked: sessionsRevoked });
  });

  static bulkReviewAlerts = handle('security alerts', async (req, res) => {
    const body = req.body || {};
    if (!Array.isArray(body.alertIds) || body.alertIds.length === 0) {
      throw new BadRequest('alertIds must be a non-empty array');
    }
    if (body.alertIds.length > 200) throw new BadRequest('At most 200 alerts per request');
    const ids = [...new Set(body.alertIds.map((raw) => parse.param(raw, 'alert')))];
    const status = parse.oneOf(body.status, AdminRecords.ALERT_REVIEW_STATUSES, 'status');
    if (!status) throw new BadRequest(`status must be one of: ${AdminRecords.ALERT_REVIEW_STATUSES.join(', ')}`);

    const { updated, sessionsRevoked } = await AdminRecordsController.applyAlertReview(req, ids, {
      status,
      adminNotes: typeof body.actionReason === 'string' ? body.actionReason.slice(0, 2000) : null,
      actionTaken: null
    });

    const found = new Set(updated.map((a) => a.id));
    ok(res, `Updated ${updated.length} alerts to ${status}`, {
      updated_count: updated.length,
      not_found: ids.filter((id) => !found.has(id)),
      sessions_revoked: sessionsRevoked
    });
  });

  static getSuspiciousUsers = handle('suspicious users', async (req, res) => {
    const hours = parse.int(req.query.hours, { min: 1, max: 24 * 365, fallback: 24, name: 'hours' });
    const threshold = parse.int(req.query.threshold, { min: 1, max: 1000, fallback: 3, name: 'threshold' });
    const users = await AdminRecords.suspiciousUsers({ hours, threshold });
    ok(res, 'Suspicious users retrieved', { hours, threshold, count: users.length, users });
  });

  /** Defaults to the last 30 SA days. */
  static getAlertReport = handle('security report', async (req, res) => {
    let { from, to } = parse.range(req.query);
    const today = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 10); // SA is UTC+2, no DST
    to = to || today;
    from = from || new Date(Date.parse(`${to}T00:00:00Z`) - 29 * 86400000).toISOString().slice(0, 10);
    if (from > to) throw new BadRequest('from must not be after to');
    const report = await AdminRecords.alertReport({ from, to });
    ok(res, 'Security report generated', { period: { from, to }, report });
  });
}

module.exports = AdminRecordsController;
module.exports.parse = parse;
module.exports.BadRequest = BadRequest;
