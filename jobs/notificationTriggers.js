/**
 * Notification Triggers
 *
 *   1. Medication trigger  — lives in jobs/medicationReminders.js
 *   2. Appointment trigger — scheduled: a reminder the day before each appointment
 *                          + event-driven (notifyAppointmentConfirmed/Updated)
 *   3. Doctor message trigger — event-driven (notifyDoctorMessage / notifyPrescriptionUpdate)
 *
 * The scheduled trigger runs on a plain interval (no node-cron). It is safe to
 * run often: each appointment records the date it was reminded for, so a
 * reminder is sent once, a run after downtime catches up, and a rescheduled
 * appointment is reminded again for its new date.
 */

const { pool } = require('../config/db');
const notificationService = require('../services/notificationService');

const ZONE = 'Africa/Johannesburg';
const APPOINTMENT_CHECK_MINUTES = 15;
// Day-before reminders go out from this local hour, so nobody is woken at midnight.
const APPOINTMENT_REMINDER_HOUR = Number.parseInt(process.env.APPOINTMENT_REMINDER_HOUR || '8', 10);
const REMINDABLE_STATUSES = ['scheduled', 'rescheduled'];

// ---------- 1. Medication trigger ----------
// Medication reminders live in jobs/medicationReminders.js, which works from
// the medication_doses table and also tracks adherence.

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

function appointmentReminderMessage({ time_slot: timeSlot, doctor_name: doctorName }) {
  const time = /^\d{2}:\d{2}/.test(timeSlot || '') ? timeSlot.slice(0, 5) : null;
  return {
    title: 'Appointment Reminder',
    body: `You have a consultation tomorrow${time ? ` at ${time}` : ''}` +
      `${doctorName ? ` with Dr. ${doctorName}` : ''}.`,
  };
}

/**
 * Scheduled: remind patients the day before each scheduled appointment, from
 * APPOINTMENT_REMINDER_HOUR (South African time), unless the patient set
 * their own reminders for it. Claiming an appointment and
 * stamping day_before_reminder_for happen in one statement, so overlapping
 * runs or server instances never send the same reminder twice. A failed send
 * is released and retried on the next run. `send` is
 * notificationService.sendToPatient, which honours the patient's
 * appointment_notifications preference.
 */
async function runAppointmentReminders(
  db = pool,
  send = notificationService.sendToPatient,
  { fromHour = APPOINTMENT_REMINDER_HOUR } = {}
) {
  const claimed = await db.query(
    `WITH due AS (
       SELECT a.id
       FROM appointments a
       WHERE a.status = ANY($2::text[])
         AND EXTRACT(HOUR FROM now() AT TIME ZONE $1) >= $3
         AND a.appointment_date = (now() AT TIME ZONE $1)::date + 1
         AND a.day_before_reminder_for IS DISTINCT FROM a.appointment_date
         -- A patient who set their own reminders for this appointment gets
         -- those instead (services/reminderNotificationService.js).
         AND NOT EXISTS (
           SELECT 1 FROM appointment_reminders ar
           WHERE ar.appointment_id = a.id AND ar.is_enabled = true
         )
       FOR UPDATE OF a SKIP LOCKED
     )
     UPDATE appointments a
     SET day_before_reminder_for = a.appointment_date
     FROM due
     WHERE a.id = due.id
     RETURNING a.id, a.patient_id, a.appointment_date, a.time_slot,
       (SELECT NULLIF(TRIM(CONCAT_WS(' ', d.first_name, d.last_name)), '')
        FROM doctors d WHERE d.id = a.doctor_id) AS doctor_name`,
    [ZONE, REMINDABLE_STATUSES, fromHour]
  );

  let sent = 0;
  let failed = 0;
  for (const appointment of claimed.rows) {
    try {
      const result = await send({
        patientId: appointment.patient_id,
        type: 'appointment',
        ...appointmentReminderMessage(appointment),
        data: { action: 'view_appointment', appointmentId: appointment.id },
      });
      if (result && result.delivered) sent += 1;
    } catch (error) {
      failed += 1;
      console.error(`Appointment reminder for appointment ${appointment.id} failed:`, error.message);
      await db.query(
        'UPDATE appointments SET day_before_reminder_for = NULL WHERE id = $1',
        [appointment.id]
      ).catch(() => {});
    }
  }
  return { claimed: claimed.rows.length, sent, failed };
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

let appointmentInterval = null;
let appointmentRunning = false;

async function runAppointmentRemindersOnce() {
  if (appointmentRunning) return null; // a slow run must not overlap the next
  appointmentRunning = true;
  try {
    const result = await runAppointmentReminders();
    if (result.claimed) {
      console.log(`📅 Appointment reminders: ${result.sent}/${result.claimed} sent, ${result.failed} failed`);
    }
    return result;
  } catch (error) {
    console.error('Appointment reminders job failed:', error.message);
    return null;
  } finally {
    appointmentRunning = false;
  }
}

function start() {
  if (appointmentInterval) return;
  runAppointmentRemindersOnce();
  appointmentInterval = setInterval(runAppointmentRemindersOnce, APPOINTMENT_CHECK_MINUTES * 60 * 1000);
  console.log(
    `✅ Appointment reminders job started (every ${APPOINTMENT_CHECK_MINUTES} minutes, ` +
    `day-before reminders from ${String(APPOINTMENT_REMINDER_HOUR).padStart(2, '0')}:00)`
  );
}

function stop() {
  if (appointmentInterval) {
    clearInterval(appointmentInterval);
    appointmentInterval = null;
  }
}

module.exports = {
  start,
  stop,
  appointmentReminderMessage,
  runAppointmentReminders,
  notifyAppointmentConfirmed,
  notifyAppointmentUpdated,
  notifyDoctorMessage,
  notifyPrescriptionUpdate,
};
