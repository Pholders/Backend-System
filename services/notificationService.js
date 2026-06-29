/**
 * NotificationService
 *
 * The single entry point for creating any patient notification.
 * Anything in the backend that wants to notify a patient MUST go through
 * `sendToPatient(...)`. Nothing outside this service should touch the
 * notifications table directly.
 *
 * Flow (in order):
 *   1. Check the patient's preferences for this notification type.
 *      If disabled, stop — do not insert, do not push.
 *   2. Insert the notification row (inbox record).
 *   3. Fan-out push to every registered device token for the patient.
 *      Invalid tokens reported by FCM are pruned.
 */

const Notification = require('../models/Notification');
const NotificationPreferences = require('../models/NotificationPreferences');
const DeviceToken = require('../models/DeviceToken');
const pushService = require('./pushService');

/**
 * @param {object} args
 * @param {number} args.patientId
 * @param {'medication'|'prescription'|'appointment'|'message'} args.type
 * @param {string} args.title
 * @param {string} args.body
 * @param {string} [args.subType]  e.g. 'refill' to gate against refill_reminders
 * @param {object} [args.data]     optional structured data attached to the push
 * @returns {Promise<{ delivered: boolean, reason?: string, notification?: object, push?: object[] }>}
 */
async function sendToPatient({ patientId, type, title, body, subType = null, data = null }) {
  if (!patientId) throw new Error('patientId required');
  if (!Notification.VALID_TYPES.includes(type)) {
    throw new Error(`Invalid notification type: ${type}`);
  }
  if (!title || !body) throw new Error('title and body are required');

  // 1. Preferences gate.
  const enabled = await NotificationPreferences.isEnabled(patientId, type, subType);
  if (!enabled) {
    return { delivered: false, reason: 'preference_disabled' };
  }

  // 2. Persist inbox record.
  const notification = await Notification.create({
    patient_id: patientId,
    type,
    title,
    body,
    data,
  });

  // 3. Push to devices (best-effort).
  const tokens = await DeviceToken.listForPatient(patientId);
  let pushResults = [];
  if (tokens.length > 0) {
    pushResults = await pushService.sendToTokens(
      tokens.map((t) => t.token),
      {
        title,
        body,
        data: { notificationId: notification.id, type, ...(data || {}) },
      }
    );

    // Prune invalid tokens.
    await Promise.all(
      pushResults
        .filter((r) => r.invalidToken)
        .map((r) => DeviceToken.remove(r.token).catch(() => {}))
    );
  }

  return { delivered: true, notification, push: pushResults };
}

module.exports = {
  sendToPatient,
};
