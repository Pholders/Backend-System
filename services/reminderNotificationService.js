const { pool } = require('../config/db');
const EmailService = require('./emailService');
const notificationService = require('./notificationService');

/**
 * Patient-set appointment reminders ("remind me 1 day and 1 hour before, by
 * email and push"). ReminderSchedulerService calls processDueReminders every
 * 5 minutes.
 *
 * Each (reminder, minutes before, method) is sent once per appointment time:
 * it is claimed by writing a 'pending' row to reminder_notification_history,
 * which a unique index lets through only once, then marked
 *   sent     delivered,
 *   skipped  deliberately not sent (no SMS provider yet, no email address,
 *            the patient turned appointment notifications off); not retried,
 *   failed   the send threw; offered again on the next run while still due.
 * Which reminders are due is decided in AppointmentReminder.getRemindersToSend.
 */

const ZONE = 'Africa/Johannesburg';
const dayFormat = new Intl.DateTimeFormat('en-ZA', {
  timeZone: ZONE, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});
const timeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const joinName = (first, last) => [first, last].filter(Boolean).join(' ').trim();

/** "tomorrow", "in 1 hour", "in 3 days" ... for a reminder sent `minutesBefore` ahead. */
function formatReminderTime(minutesBefore) {
  if (minutesBefore === 1440) return 'tomorrow';
  if (minutesBefore >= 2880 && minutesBefore % 1440 === 0) return `in ${minutesBefore / 1440} days`;
  if (minutesBefore < 60) return `in ${minutesBefore} minute${minutesBefore === 1 ? '' : 's'}`;
  const hours = Math.floor(minutesBefore / 60);
  return `in ${hours} hour${hours > 1 ? 's' : ''}`;
}

/** Everything a reminder says, worked out once for every method. */
function describe(reminder) {
  const at = new Date(reminder.appointment_at);
  const doctor = joinName(reminder.doctor_first_name, reminder.doctor_last_name);
  return {
    when: formatReminderTime(reminder.minutes_before),
    day: dayFormat.format(at),
    time: timeFormat.format(at),
    doctor: doctor ? `Dr. ${doctor}` : 'your doctor',
    patient: joinName(reminder.patient_first_name, reminder.patient_last_name) || 'there',
    specialization: reminder.specialization || null,
    clinic: reminder.clinic_name || null,
  };
}

function shortMessage(reminder) {
  const d = describe(reminder);
  return `Your appointment with ${d.doctor} is ${d.when}: ${d.day} at ${d.time}.`;
}

function emailContent(reminder) {
  const d = describe(reminder);
  const rows = [
    ['Doctor', d.doctor],
    ['Specialisation', d.specialization],
    ['Clinic', d.clinic],
    ['Date and time', `${d.day} at ${d.time}`],
  ].filter(([, value]) => value);

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #1e40af; color: white; padding: 20px; text-align: center;">
        <h1>Appointment Reminder</h1>
      </div>
      <div style="padding: 20px; background-color: #f9fafb; border: 1px solid #e5e7eb;">
        <p>Hi ${escapeHtml(d.patient)},</p>
        <p style="margin-top: 20px;">You have an appointment <strong>${escapeHtml(d.when)}</strong>:</p>
        <div style="background-color: white; padding: 15px; border-left: 4px solid #1e40af; margin: 20px 0;">
          ${rows.map(([label, value]) => `<p><strong>${label}:</strong> ${escapeHtml(value)}</p>`).join('\n          ')}
        </div>
        <p style="margin-top: 20px; color: #666;">Please arrive on time. If you need to reschedule or cancel, log into your account.</p>
        <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #999; font-size: 12px;">
          This is an automated reminder. Please do not reply to this email.
        </p>
      </div>
    </div>`;

  const text = [
    'Appointment Reminder',
    '',
    `Hi ${d.patient},`,
    '',
    `You have an appointment ${d.when}:`,
    '',
    ...rows.map(([label, value]) => `${label}: ${value}`),
    '',
    'Please arrive on time.',
  ].join('\n');

  return { subject: 'Appointment Reminder', html, text };
}

/**
 * One sender per method. Each resolves to { status: 'sent' | 'skipped', error? }
 * and throws when the send fails.
 */
const defaultSenders = {
  async email(reminder) {
    if (!reminder.patient_email) return { status: 'skipped', error: 'Patient has no email address' };
    await EmailService.sendEmail({ to: reminder.patient_email, ...emailContent(reminder) });
    return { status: 'sent' };
  },

  async push(reminder) {
    const result = await notificationService.sendToPatient({
      patientId: reminder.patient_id,
      type: 'appointment',
      title: 'Appointment Reminder',
      body: shortMessage(reminder),
      data: { action: 'view_appointment', appointmentId: reminder.appointment_id },
    });
    return result.delivered
      ? { status: 'sent' }
      : { status: 'skipped', error: result.reason || 'Not delivered' };
  },

  async 'in-app'(reminder, db) {
    await db.query(
      `INSERT INTO in_app_notifications (patient_id, appointment_id, title, message, notification_type, is_read)
       VALUES ($1, $2, $3, $4, $5, FALSE)`,
      [reminder.patient_id, reminder.appointment_id, 'Appointment Reminder', shortMessage(reminder), 'appointment_reminder']
    );
    return { status: 'sent' };
  },

  // No SMS provider is integrated yet. Recorded honestly rather than as sent.
  async sms() {
    return { status: 'skipped', error: 'SMS reminders are not configured' };
  },
};

class ReminderNotificationService {
  static formatReminderTime(minutesBefore) {
    return formatReminderTime(minutesBefore);
  }

  static shortMessage(reminder) {
    return shortMessage(reminder);
  }

  static emailContent(reminder) {
    return emailContent(reminder);
  }

  /** Send one reminder by one method, without recording history. */
  static async sendReminder(reminder, method, db = pool, senders = defaultSenders) {
    const sender = senders[method];
    if (!sender) throw new Error(`Unknown reminder method: ${method}`);
    return sender(reminder, db);
  }

  /**
   * Send every reminder that is due. Called by the scheduler every 5 minutes.
   * `db` and `senders` can be swapped in tests.
   */
  static async processDueReminders(db = pool, senders = defaultSenders) {
    const AppointmentReminder = require('../models/AppointmentReminder');
    const due = await AppointmentReminder.getRemindersToSend(db);

    let sentCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const reminder of due) {
      const historyId = await AppointmentReminder.claimSend(db, reminder);
      if (!historyId) continue; // another run got there first

      try {
        const result = await this.sendReminder(reminder, reminder.reminder_method, db, senders);
        await AppointmentReminder.finishSend(db, historyId, result.status, result.error || null);
        if (result.status === 'sent') sentCount++;
        else skippedCount++;
      } catch (error) {
        failedCount++;
        console.error(`❌ ${reminder.reminder_method} reminder for appointment ${reminder.appointment_id} failed:`, error.message);
        await AppointmentReminder.finishSend(db, historyId, 'failed', error.message).catch(() => {});
      }
    }

    if (sentCount || skippedCount || failedCount) {
      console.log(`📨 Appointment reminders: ${sentCount} sent, ${skippedCount} skipped, ${failedCount} failed`);
    }
    return { sentCount, skippedCount, failedCount };
  }

  /** Reminders due right now (debug/admin). */
  static async getPendingReminders(db = pool) {
    const AppointmentReminder = require('../models/AppointmentReminder');
    const reminders = await AppointmentReminder.getRemindersToSend(db);
    return reminders.map((r) => ({
      reminderId: r.reminder_id,
      appointmentId: r.appointment_id,
      patientName: joinName(r.patient_first_name, r.patient_last_name),
      doctorName: joinName(r.doctor_first_name, r.doctor_last_name),
      appointmentAt: r.appointment_at,
      minutesBefore: r.minutes_before,
      method: r.reminder_method,
    }));
  }

  /** Send a sample reminder by one method, e.g. to check email delivery. Nothing is recorded. */
  static async testReminder(method, testEmail = null) {
    const inOneHour = new Date(Date.now() + 60 * 60 * 1000);
    return this.sendReminder({
      reminder_id: 0,
      appointment_id: null,
      patient_id: null,
      patient_email: testEmail || process.env.TEST_EMAIL,
      patient_first_name: 'Test',
      patient_last_name: 'Patient',
      doctor_first_name: 'Sam',
      doctor_last_name: 'Smith',
      specialization: 'General Practitioner',
      clinic_name: 'Test Clinic',
      appointment_at: inOneHour,
      minutes_before: 60,
    }, method);
  }
}

ReminderNotificationService.defaultSenders = defaultSenders;

module.exports = ReminderNotificationService;
