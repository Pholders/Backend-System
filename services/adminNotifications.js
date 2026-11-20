/**
 * Admin Notifications
 *
 * What the admins are told, and when. Every function is fire-and-forget and
 * never throws: a failed notification must not undo a support ticket, a
 * sign-up, a review or an order change.
 *
 * Each event carries a dedupe_key, so announcing the same thing twice (the
 * overdue job runs every 15 minutes; a pharmacy can verify by OTP and by
 * email) stores and pushes it once.
 *
 * New notifications are pushed live to the 'admins' Socket.IO room as
 * 'admin:notification'.
 */

const { query } = require('../config/db');
const AdminNotification = require('../models/AdminNotification');
const realtimeService = require('./realtimeService');

const clip = (text, max) => {
  const t = String(text || '').trim().replace(/\s+/g, ' ');
  return t.length > max ? `${t.slice(0, max - 3)}...` : t;
};

async function send(notification) {
  try {
    const created = await AdminNotification.create(notification);
    if (created) {
      try {
        realtimeService.emitToAdmins('admin:notification', created);
      } catch (emitError) {
        console.error('Admin notification push failed (non-blocking):', emitError.message);
      }
    }
    return created;
  } catch (error) {
    console.error('Admin notification error (non-blocking):', error.message);
    return null;
  }
}

/* ----------------------------------------------------------------- support */

/** A ticket or contact form came in. High and urgent tickets are high priority. */
function supportTicket(ticket, senderEmail) {
  if (!ticket?.id) return Promise.resolve(null);
  const urgent = ['high', 'urgent'].includes(ticket.priority);
  return send({
    type: 'support_ticket',
    priority: urgent ? 'high' : 'normal',
    title: urgent ? `Urgent support ticket #${ticket.id}` : `New support ticket #${ticket.id}`,
    body: `"${clip(ticket.subject, 120)}" from ${senderEmail || 'a visitor'} (${ticket.category}).`,
    data: { ticketId: ticket.id, category: ticket.category, priority: ticket.priority || 'normal' },
    dedupe_key: `support_ticket:${ticket.id}`,
  });
}

/* ---------------------------------------------------------------- security */

const ALERT_SEVERITIES = ['CRITICAL', 'HIGH'];

/** Only CRITICAL and HIGH alerts; the rest stay on the alerts screen. */
function securityAlert(alert) {
  if (!alert?.id || !ALERT_SEVERITIES.includes(alert.severity)) return Promise.resolve(null);
  const who = alert.email ? `${alert.user_type || 'user'} ${alert.email}` : `a ${alert.user_type || 'user'} account`;
  return send({
    type: 'security_alert',
    priority: 'high',
    title: `${alert.severity === 'CRITICAL' ? 'Critical' : 'High'} security alert`,
    body: `${clip(alert.alert_message || alert.alert_type, 160)} (${who}).`,
    data: {
      alertId: alert.id,
      alertType: alert.alert_type,
      severity: alert.severity,
      userType: alert.user_type || null,
      userId: alert.user_id || null,
    },
    dedupe_key: `security_alert:${alert.id}`,
  });
}

/* ------------------------------------------------------------------ orders */

const WAITING_ON_LABEL = {
  pharmacy: 'the pharmacy',
  medical_aid: 'the medical aid',
  patient: 'the patient',
};

/**
 * Called by the overdue job with a row from AdminRecords.overdueOrders().
 * One notification per spell in a status: the same order going overdue again
 * in a later status is a new one.
 */
function orderOverdue(row) {
  if (!row?.id) return Promise.resolve(null);
  const at = row.pharmacy_name ? ` at ${row.pharmacy_name}` : '';
  return send({
    type: 'order_overdue',
    priority: 'normal',
    title: `Order #${row.id} is overdue`,
    body: `It has been "${row.status}"${at} for ${Math.round(row.hours_in_status)}h ` +
      `(allowed ${row.overdue_after_hours}h), waiting on ${WAITING_ON_LABEL[row.waiting_on] || row.waiting_on}.`,
    data: {
      orderId: row.id,
      status: row.status,
      pharmacyId: row.pharmacy_id,
      waitingOn: row.waiting_on,
      hoursInStatus: row.hours_in_status,
    },
    dedupe_key: `order_overdue:${row.id}:${row.status}:${row.status_since_ms}`,
  });
}

/** A pharmacy declined an order. */
async function orderRejected(order, reason) {
  if (!order?.id) return null;
  let pharmacyName = null;
  try {
    const result = await query(
      `SELECT COALESCE(NULLIF(TRIM(pharmacy_name), ''), TRIM(CONCAT_WS(' ', first_name, last_name))) AS name
         FROM pharmacies WHERE id = $1`,
      [order.pharmacy_id]
    );
    pharmacyName = result.rows[0]?.name || null;
  } catch (error) {
    console.error('Admin notification lookup failed (non-blocking):', error.message);
  }
  const why = clip(reason || order.rejection_reason, 160);
  return send({
    type: 'order_rejected',
    priority: 'normal',
    title: `Order #${order.id} rejected`,
    body: `${pharmacyName || 'The pharmacy'} rejected the order${why ? `: ${why}` : '.'}`,
    data: { orderId: order.id, pharmacyId: order.pharmacy_id },
    dedupe_key: `order_rejected:${order.id}`,
  });
}

/* --------------------------------------------------------------- providers */

/** A doctor signed up, or a pharmacy verified its email. */
function providerJoined(userType, provider) {
  if (!provider?.id || !['doctor', 'pharmacy'].includes(userType)) return Promise.resolve(null);
  const person = [provider.first_name, provider.last_name].filter(Boolean).join(' ').trim();
  const name = userType === 'pharmacy'
    ? (String(provider.pharmacy_name || '').trim() || person || 'A pharmacy')
    : (person ? `Dr ${person}` : 'A doctor');
  const place = [provider.city, provider.province].filter(Boolean).join(', ');
  const detail = userType === 'doctor'
    ? [provider.specialization, provider.hpcsa_number && `HPCSA ${provider.hpcsa_number}`]
    : [provider.license_number && `licence ${provider.license_number}`];
  const extras = [...detail, place].filter(Boolean).join(' · ');
  return send({
    type: 'provider_joined',
    priority: 'normal',
    title: userType === 'pharmacy' ? 'New pharmacy joined' : 'New doctor joined',
    body: `${name}${extras ? ` (${extras})` : ''} has joined.`,
    data: { userType, userId: provider.id },
    dedupe_key: `provider_joined:${userType}:${provider.id}`,
  });
}

/* ----------------------------------------------------------------- reviews */

const LOW_RATING = 2;

/**
 * A review at or below LOW_RATING stars, when it is written or edited down.
 * One notification per review and rating, so re-saving it unchanged is quiet.
 */
async function reviewLowRating(review) {
  const stars = Number(review?.rating);
  if (!review?.id || !(stars <= LOW_RATING)) return null;
  let doctorName = null;
  try {
    const result = await query(
      `SELECT TRIM(CONCAT_WS(' ', first_name, last_name)) AS name FROM doctors WHERE id = $1`,
      [review.doctor_id]
    );
    doctorName = result.rows[0]?.name || null;
  } catch (error) {
    console.error('Admin notification lookup failed (non-blocking):', error.message);
  }
  const text = clip(review.review_text, 120);
  return send({
    type: 'review_low_rating',
    priority: 'normal',
    title: `${stars}-star review`,
    body: `${doctorName ? `Dr ${doctorName}` : 'A doctor'} was rated ${stars} out of 5` +
      `${text ? `: "${text}"` : '.'}`,
    data: { reviewId: review.id, doctorId: review.doctor_id, rating: stars },
    dedupe_key: `review_low_rating:${review.id}:${stars}`,
  });
}

module.exports = {
  supportTicket,
  securityAlert,
  orderOverdue,
  orderRejected,
  providerJoined,
  reviewLowRating,
  LOW_RATING,
};
