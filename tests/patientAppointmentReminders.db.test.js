// Patient-set appointment reminders against a real database: which reminders
// are due (in South African time), each sent once per method, SMS recorded as
// skipped, a failed send retried, a rescheduled appointment reminded again,
// and the day-before reminder standing aside for patients with their own.
//
// Everything, including the migrations, runs inside one transaction that is
// rolled back, so the database is left exactly as it was. Email and push go
// to fakes, so no patient is contacted. Needs one patient and one doctor row.
// Refuses to run in production.
//
// Run with: node tests/patientAppointmentReminders.db.test.js
const assert = require('assert');
const { pool } = require('../config/db');
const { runMigration: fixHistory } = require('../config/fixAppointmentReminderHistory');
const { runMigration: addDayBefore } = require('../config/addAppointmentDayBeforeReminder');
const Reminders = require('../services/reminderNotificationService');
const { runAppointmentReminders } = require('../jobs/notificationTriggers');

const failures = [];
let passed = 0;

async function it(label, fn) {
  try {
    await fn();
    passed++;
  } catch (error) {
    failures.push({ label, message: error.message });
  }
}

const ZONE = 'Africa/Johannesburg';
const MINUTE = 60 * 1000;
const localDay = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: ZONE }).format(date);
const localClock = (date) => new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
}).format(date);

// Fake email and push that record what they were asked to send; SMS and
// in-app are the real senders (SMS skips; in-app writes inside the transaction).
function senders({ failEmail = false } = {}) {
  const sent = [];
  return {
    sent,
    senders: {
      ...Reminders.defaultSenders,
      async email(reminder) {
        if (failEmail) throw new Error('mail server down');
        sent.push({ method: 'email', reminder, content: Reminders.emailContent(reminder) });
        return { status: 'sent' };
      },
      async push(reminder) {
        sent.push({ method: 'push', reminder, body: Reminders.shortMessage(reminder) });
        return { status: 'sent' };
      },
    },
  };
}

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to run against production');

  const client = await pool.connect();
  const silence = console.log;
  try {
    await client.query('BEGIN');
    await fixHistory(client);
    await addDayBefore(client);

    const patient = (await client.query('SELECT id FROM patients ORDER BY id LIMIT 1')).rows[0];
    const doctor = (await client.query(
      'SELECT id, first_name, last_name, clinic_name FROM doctors ORDER BY id LIMIT 1'
    )).rows[0];
    assert.ok(patient && doctor, 'needs a patient and a doctor row');

    // An appointment `minutesAhead` from now, at that moment's local date and HH:mm.
    const appointment = async (minutesAhead, status = 'scheduled') => {
      const at = new Date(Date.now() + minutesAhead * MINUTE);
      return (await client.query(
        `INSERT INTO appointments
           (doctor_id, patient_id, appointment_date, time_period, time_slot, consultation_fee, status)
         VALUES ($1, $2, $3, 'morning', $4, 100, $5) RETURNING id`,
        [doctor.id, patient.id, localDay(at), localClock(at), status]
      )).rows[0].id;
    };
    const reminder = async (appointmentId, times, methods, enabled = true) =>
      (await client.query(
        `INSERT INTO appointment_reminders (appointment_id, patient_id, reminder_times, reminder_methods, is_enabled)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [appointmentId, patient.id, times, methods, enabled]
      )).rows[0].id;
    const history = async (reminderId) =>
      (await client.query(
        `SELECT reminder_method, minutes_before, status, error_message FROM reminder_notification_history
         WHERE reminder_id = $1 ORDER BY id`,
        [reminderId]
      )).rows;

    // Due now: the 1-hour reminder of an appointment in 58 minutes ...
    const inAnHour = await appointment(58);
    const inAnHourReminder = await reminder(inAnHour, [60, 1440], ['email', 'push', 'sms', 'in-app']);
    // ... and the 1-day reminder of one 2 minutes short of a day away.
    const tomorrow = await appointment(1438);
    const tomorrowReminder = await reminder(tomorrow, [1440, 60], ['email']);
    // Not due: cancelled, disabled, too late (the 1-hour moment passed 40 minutes ago), too early.
    const cancelled = await reminder(await appointment(58, 'cancelled'), [60], ['email']);
    const disabled = await reminder(await appointment(58), [60], ['email'], false);
    const tooLate = await reminder(await appointment(20), [60], ['email']);
    const tooEarly = await reminder(await appointment(180), [60], ['email']);
    const ours = new Set([inAnHourReminder, tomorrowReminder, cancelled, disabled, tooLate, tooEarly]);

    console.log = () => {};
    const first = senders();
    await Reminders.processDueReminders(client, first.senders);
    console.log = silence;
    const firstOurs = first.sent.filter((s) => ours.has(s.reminder.reminder_id));

    await it('the reminders due now go out by each chosen method', async () => {
      const got = firstOurs.map((s) => `${s.reminder.reminder_id}:${s.reminder.minutes_before}:${s.method}`).sort();
      assert.deepStrictEqual(got, [
        `${inAnHourReminder}:60:email`,
        `${inAnHourReminder}:60:push`,
        `${tomorrowReminder}:1440:email`,
      ].sort());
    });

    await it('SMS is recorded as skipped, not as sent; in-app is left to push', async () => {
      const rows = await history(inAnHourReminder);
      const by = Object.fromEntries(rows.map((r) => [r.reminder_method, r]));
      assert.strictEqual(by.email.status, 'sent');
      assert.strictEqual(by.push.status, 'sent');
      assert.strictEqual(by.sms.status, 'skipped');
      assert.match(by.sms.error_message, /not configured/);
      assert.strictEqual(by['in-app'], undefined, 'push already puts it in the inbox');
    });

    await it('in-app on its own puts the reminder in the notification inbox', async () => {
      const appt = await appointment(58);
      const id = await reminder(appt, [60], ['in-app']);
      ours.add(id);
      console.log = () => {};
      await Reminders.processDueReminders(client, senders().senders);
      console.log = silence;
      assert.deepStrictEqual((await history(id)).map((r) => r.status), ['sent']);
      const inbox = await client.query(
        `SELECT type, title, body, data FROM notifications
         WHERE patient_id = $1 AND (data->>'appointmentId')::int = $2`,
        [patient.id, appt]
      );
      assert.strictEqual(inbox.rows.length, 1);
      assert.strictEqual(inbox.rows[0].type, 'appointment');
      assert.strictEqual(inbox.rows[0].data.action, 'view_appointment');
      assert.ok(inbox.rows[0].body.includes('is in 1 hour'), inbox.rows[0].body);
    });

    await it('cancelled, disabled, too-late and too-early reminders are not sent', async () => {
      for (const id of [cancelled, disabled, tooLate, tooEarly]) {
        assert.deepStrictEqual(await history(id), [], `reminder ${id}`);
      }
    });

    await it('the message gives the local time and how long until the appointment', async () => {
      const push = firstOurs.find((s) => s.method === 'push');
      const at = new Date(Date.now() + 58 * MINUTE);
      assert.ok(push.body.includes('is in 1 hour'), push.body);
      assert.ok(push.body.includes(`at ${localClock(at)}.`), push.body);
      assert.ok(push.body.includes(`Dr. ${doctor.first_name} ${doctor.last_name}`), push.body);

      const email = firstOurs.find((s) => s.reminder.reminder_id === tomorrowReminder).content;
      assert.ok(email.text.includes('You have an appointment tomorrow'), email.text);
      assert.ok(!/undefined|null/.test(email.text), email.text);
      assert.ok(!/undefined|null/.test(email.html));
    });

    await it('running again sends nothing new', async () => {
      const again = senders();
      await Reminders.processDueReminders(client, again.senders);
      assert.deepStrictEqual(again.sent.filter((s) => ours.has(s.reminder.reminder_id)), []);
    });

    await it('a failed send is recorded and retried on the next run', async () => {
      const appt = await appointment(58);
      const id = await reminder(appt, [60], ['email']);
      ours.add(id);
      const quiet = console.error;
      console.error = () => {};
      await Reminders.processDueReminders(client, senders({ failEmail: true }).senders);
      console.error = quiet;
      assert.deepStrictEqual((await history(id)).map((r) => r.status), ['failed']);

      const retry = senders();
      console.log = () => {};
      await Reminders.processDueReminders(client, retry.senders);
      console.log = silence;
      assert.strictEqual(retry.sent.filter((s) => s.reminder.reminder_id === id).length, 1);
      assert.deepStrictEqual((await history(id)).map((r) => r.status), ['failed', 'sent']);
    });

    await it('a rescheduled appointment is reminded again for its new time', async () => {
      const at = new Date(Date.now() + 59 * MINUTE);
      await client.query(
        `UPDATE appointments SET appointment_date = $2, time_slot = $3, status = 'rescheduled' WHERE id = $1`,
        [inAnHour, localDay(at), localClock(at)]
      );
      const after = senders();
      console.log = () => {};
      await Reminders.processDueReminders(client, after.senders);
      console.log = silence;
      const got = after.sent.filter((s) => s.reminder.reminder_id === inAnHourReminder).map((s) => s.method).sort();
      assert.deepStrictEqual(got, ['email', 'push']);
    });

    await it('the day-before reminder skips appointments with their own reminders', async () => {
      const plain = await appointment(1438); // tomorrow, no reminders of its own
      const sent = [];
      await runAppointmentReminders(client, async (m) => { sent.push(m.data.appointmentId); return { delivered: true }; }, { fromHour: 0 });
      assert.ok(!sent.includes(tomorrow), 'has its own reminder');
      // The day-before reminder goes by local date, so this only holds when
      // 1438 minutes from now is still tomorrow's date.
      if (localDay(new Date(Date.now() + 1438 * MINUTE)) === localDay(new Date(Date.now() + 1440 * MINUTE))) {
        assert.ok(sent.includes(plain), 'no reminder of its own');
      }
    });

    await it('reminder wording for other offsets', async () => {
      assert.strictEqual(Reminders.formatReminderTime(15), 'in 15 minutes');
      assert.strictEqual(Reminders.formatReminderTime(60), 'in 1 hour');
      assert.strictEqual(Reminders.formatReminderTime(180), 'in 3 hours');
      assert.strictEqual(Reminders.formatReminderTime(1440), 'tomorrow');
      assert.strictEqual(Reminders.formatReminderTime(4320), 'in 3 days');
    });
  } finally {
    console.log = silence;
    await client.query('ROLLBACK').catch(() => {});
    client.release();
    await pool.end();
  }

  console.log(`${passed} passed, ${failures.length} failed`);
  for (const failure of failures) console.log(`  ✗ ${failure.label}\n    ${failure.message}`);
  process.exit(failures.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
