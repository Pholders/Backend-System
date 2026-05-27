/**
 * Notification Triggers
 *
 * Three triggers (per sprint):
 *   1. Medication trigger  — scheduled (cron)
 *   2. Appointment trigger — scheduled (cron, reminders for tomorrow's appts)
 *                          + event-driven (notifyAppointmentConfirmed/Updated)
 *   3. Doctor message trigger — event-driven (notifyDoctorMessage / notifyPrescriptionUpdate)
 *
 * The medication-schedule table and appointments / messages tables belong to
 * other sprints and may not yet exist. The cron jobs detect missing tables
 * and no-op gracefully so this module never crashes the server.
 *
 * Install once: `npm install node-cron`
 */

const { pool } = require('../config/db');
const notificationService = require('../services/notificationService');

let cron = null;
try {
  // eslint-disable-next-line global-require
  cron = require('node-cron');
} catch (_) {
  console.warn('⚠️  node-cron not installed — scheduled triggers will be skipped. Run `npm install node-cron`.');
}

// ---------- helpers ----------

async function tableExists(tableName) {
  const result = await pool.query(
    `SELECT to_regclass($1) AS reg`,
    [tableName]
  );
  return Boolean(result.rows[0].reg);
}

// ---------- 1. Medication trigger (scheduled) ----------

/**
 * Runs daily at MEDICATION_REMINDER_CRON (default 08:00 every day).
 * For each patient with a medication scheduled today, send a reminder.
 *
 * Expects a `medication_schedules` table with at least:
 *   patient_id, medication_name, scheduled_time (TIME or TIMESTAMP)
 * If the table doesn't exist, this no-ops.
 */
async function runMedicationReminders() {
  if (!(await tableExists('medication_schedules'))) {
    return { skipped: true, reason: 'medication_schedules table not present' };
  }

  let rows = [];
  try {
    const res = await pool.query(`
      SELECT ms.patient_id, ms.medication_name, ms.scheduled_time
      FROM medication_schedules ms
      JOIN notification_preferences np ON np.patient_id = ms.patient_id
      WHERE
        ms.scheduled_time::time BETWEEN
          (CURRENT_TIME)
          AND ((CURRENT_TIME + (np.reminder_time_window || ' minutes')::interval)::time)
    `);
    rows = res.rows;
  } catch (e) {
    return { skipped: true, reason: `query failed: ${e.message}` };
  }

  let sent = 0;
  for (const r of rows) {
    const result = await notificationService.sendToPatient({
      patientId: r.patient_id,
      type: 'medication',
      title: 'Medication Reminder',
      body: `Take your ${r.medication_name} dose`,
      data: { medicationName: r.medication_name },
    }).catch((err) => ({ delivered: false, reason: err.message }));
    if (result.delivered) sent += 1;
  }
  return { sent, total: rows.length };
}

// ---------- 2. Appointment trigger ----------

/**
 * Event-driven: call when an appointment is confirmed / updated.
 */
async function notifyAppointmentConfirmed({ patientId, appointmentTime, doctorName }) {
  const when = appointmentTime ? new Date(appointmentTime).toLocaleString() : '';
  return notificationService.sendToPatient({
    patientId,
    type: 'appointment',
    title: 'Appointment Confirmed',
    body: doctorName
      ? `Your consultation with Dr. ${doctorName} is confirmed for ${when}.`
      : `Your consultation is confirmed for ${when}.`,
    data: { appointmentTime, doctorName },
  });
}

async function notifyAppointmentUpdated({ patientId, appointmentTime, doctorName }) {
  const when = appointmentTime ? new Date(appointmentTime).toLocaleString() : '';
  return notificationService.sendToPatient({
    patientId,
    type: 'appointment',
    title: 'Appointment Updated',
    body: `Your consultation has been updated to ${when}.`,
    data: { appointmentTime, doctorName },
  });
}

/**
 * Scheduled: each morning, send a reminder for any appointment happening tomorrow.
 * Expects an `appointments` table with: patient_id, scheduled_at TIMESTAMP, doctor_name (optional).
 * No-ops if the table is missing.
 */
async function runAppointmentReminders() {
  if (!(await tableExists('appointments'))) {
    return { skipped: true, reason: 'appointments table not present' };
  }

  let rows = [];
  try {
    const res = await pool.query(`
      SELECT id, patient_id, scheduled_at,
             COALESCE(doctor_name, '') AS doctor_name
      FROM appointments
      WHERE scheduled_at::date = (CURRENT_DATE + INTERVAL '1 day')
    `);
    rows = res.rows;
  } catch (e) {
    return { skipped: true, reason: `query failed: ${e.message}` };
  }

  let sent = 0;
  for (const r of rows) {
    const t = new Date(r.scheduled_at);
    const time = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const result = await notificationService.sendToPatient({
      patientId: r.patient_id,
      type: 'appointment',
      title: 'Appointment Reminder',
      body: `Consultation tomorrow at ${time}${r.doctor_name ? ` with Dr. ${r.doctor_name}` : ''}.`,
      data: { appointmentId: r.id, scheduledAt: r.scheduled_at },
    }).catch((err) => ({ delivered: false, reason: err.message }));
    if (result.delivered) sent += 1;
  }
  return { sent, total: rows.length };
}

// ---------- 3. Doctor message / prescription triggers (event-driven) ----------

async function notifyDoctorMessage({ patientId, doctorName, preview }) {
  return notificationService.sendToPatient({
    patientId,
    type: 'message',
    title: doctorName ? `Message from Dr. ${doctorName}` : 'New message from your doctor',
    body: preview || 'You have a new message.',
    data: { doctorName },
  });
}

async function notifyPrescriptionUpdate({ patientId, summary, prescriptionId }) {
  return notificationService.sendToPatient({
    patientId,
    type: 'prescription',
    title: 'Prescription Update',
    body: summary || 'Your prescription has been updated.',
    data: { prescriptionId },
  });
}

// ---------- scheduler bootstrap ----------

function start() {
  if (!cron) return;

  const medCron = process.env.MEDICATION_REMINDER_CRON || '*/15 * * * *'; // every 15 min
  const apptCron = process.env.APPOINTMENT_REMINDER_CRON || '0 8 * * *';  // daily 08:00

  if (cron.validate(medCron)) {
    cron.schedule(medCron, () => {
      runMedicationReminders()
        .then((r) => console.log('[medication-reminders]', r))
        .catch((e) => console.error('[medication-reminders] error', e.message));
    });
    console.log(`🕗 Medication reminders scheduled: ${medCron}`);
  }

  if (cron.validate(apptCron)) {
    cron.schedule(apptCron, () => {
      runAppointmentReminders()
        .then((r) => console.log('[appointment-reminders]', r))
        .catch((e) => console.error('[appointment-reminders] error', e.message));
    });
    console.log(`🕗 Appointment reminders scheduled: ${apptCron}`);
  }
}

module.exports = {
  start,
  runMedicationReminders,
  runAppointmentReminders,
  notifyAppointmentConfirmed,
  notifyAppointmentUpdated,
  notifyDoctorMessage,
  notifyPrescriptionUpdate,
};
