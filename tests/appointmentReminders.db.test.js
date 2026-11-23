// Day-before appointment reminders against a real database: who is reminded,
// that each reminder goes out once, that a failed send is retried, that a
// rescheduled appointment is reminded again, and the reminder hour.
//
// Everything, including the migration, runs inside one transaction that is
// rolled back, so the database is left exactly as it was. Sends go to a fake,
// so no patient is notified. Needs one patient and one doctor row. Refuses to
// run in production.
//
// Run with: node tests/appointmentReminders.db.test.js
const assert = require('assert');
const { pool } = require('../config/db');
const { runMigration } = require('../config/addAppointmentDayBeforeReminder');
const {
  runAppointmentReminders,
  appointmentReminderMessage,
} = require('../jobs/notificationTriggers');

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

function recorder() {
  const sent = [];
  const send = async (message) => { sent.push(message); return { delivered: true }; };
  return { sent, send };
}

const ANY_HOUR = { fromHour: 0 };

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to run against production');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await runMigration(client);

    const patient = (await client.query('SELECT id FROM patients ORDER BY id LIMIT 1')).rows[0];
    const doctor = (await client.query('SELECT id, first_name, last_name FROM doctors ORDER BY id LIMIT 1')).rows[0];
    assert.ok(patient && doctor, 'needs a patient and a doctor row');

    // Only our appointments count: real ones due tomorrow are claimed too, but
    // their sends go to the fake and everything is rolled back.
    const add = async (status, daysAhead, timeSlot = '13:00') =>
      (await client.query(
        `INSERT INTO appointments
           (doctor_id, patient_id, appointment_date, time_period, time_slot, consultation_fee, status)
         VALUES ($1, $2, (now() AT TIME ZONE 'Africa/Johannesburg')::date + $3::int, 'afternoon', $4, 100, $5)
         RETURNING id`,
        [doctor.id, patient.id, daysAhead, timeSlot, status]
      )).rows[0].id;

    const tomorrow = await add('scheduled', 1);
    const rescheduled = await add('rescheduled', 1, '09:30');
    const cancelled = await add('cancelled', 1);
    const today = await add('scheduled', 0);
    const nextWeek = await add('scheduled', 7);
    const ours = new Set([tomorrow, rescheduled, cancelled, today, nextWeek]);
    const ourIds = (sent) => sent.map((m) => m.data.appointmentId).filter((id) => ours.has(id)).sort();

    await it('nothing goes out before the reminder hour', async () => {
      const { sent, send } = recorder();
      await runAppointmentReminders(client, send, { fromHour: 24 });
      assert.deepStrictEqual(ourIds(sent), []);
    });

    await it("tomorrow's scheduled and rescheduled appointments are reminded; others are not", async () => {
      const { sent, send } = recorder();
      await runAppointmentReminders(client, send, ANY_HOUR);
      assert.deepStrictEqual(ourIds(sent), [tomorrow, rescheduled].sort());
      const message = sent.find((m) => m.data.appointmentId === tomorrow);
      assert.strictEqual(message.type, 'appointment');
      assert.strictEqual(message.patientId, patient.id);
      assert.strictEqual(
        message.body,
        `You have a consultation tomorrow at 13:00 with Dr. ${doctor.first_name} ${doctor.last_name}.`
      );
    });

    await it('running again sends nothing new', async () => {
      const { sent, send } = recorder();
      await runAppointmentReminders(client, send, ANY_HOUR);
      assert.deepStrictEqual(ourIds(sent), []);
    });

    await it('a failed send is released and retried on the next run', async () => {
      await client.query('UPDATE appointments SET day_before_reminder_for = NULL WHERE id = $1', [tomorrow]);
      const silence = console.error;
      console.error = () => {};
      const failedRun = await runAppointmentReminders(client, async () => { throw new Error('push down'); }, ANY_HOUR);
      console.error = silence;
      assert.ok(failedRun.failed >= 1);

      const { sent, send } = recorder();
      await runAppointmentReminders(client, send, ANY_HOUR);
      assert.deepStrictEqual(ourIds(sent), [tomorrow]);
    });

    await it('an appointment moved to tomorrow is reminded for its new date', async () => {
      await client.query(
        `UPDATE appointments
         SET day_before_reminder_for = appointment_date,
             appointment_date = (now() AT TIME ZONE 'Africa/Johannesburg')::date + 1,
             status = 'rescheduled'
         WHERE id = $1`,
        [nextWeek]
      );
      const { sent, send } = recorder();
      await runAppointmentReminders(client, send, ANY_HOUR);
      assert.deepStrictEqual(ourIds(sent), [nextWeek]);
    });

    await it('the message copes with a missing time or doctor', async () => {
      assert.strictEqual(
        appointmentReminderMessage({ time_slot: null, doctor_name: null }).body,
        'You have a consultation tomorrow.'
      );
      assert.strictEqual(
        appointmentReminderMessage({ time_slot: '09:30:00', doctor_name: 'A B' }).body,
        'You have a consultation tomorrow at 09:30 with Dr. A B.'
      );
    });
  } finally {
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
