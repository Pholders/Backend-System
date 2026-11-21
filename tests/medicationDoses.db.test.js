// Medication doses end to end against a real database: creating doses from a
// schedule, reminders (sent once, inside the window, retried after a failed
// send), missed doses, logging doses, and the adherence figure.
//
// Everything, including the migration, runs inside one transaction that is
// rolled back, so the database is left exactly as it was. Needs one existing
// patient row. Refuses to run in production.
//
// Run with: node tests/medicationDoses.db.test.js
const assert = require('assert');
const { pool } = require('../config/db');
const { runMigration } = require('../config/createMedicationDosesTable');
const doses = require('../services/medicationDoseService');

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

const MINUTE = 60 * 1000;
// HH:mm in South African time, `offsetMinutes` from now
const clock = (offsetMinutes) => doses.localTime(new Date(Date.now() + offsetMinutes * MINUTE));

async function addMedication(client, patientId, { id, schedule, status = 'active', trackingFrom }) {
  await client.query(
    `INSERT INTO medications (
       id, patient_id, name, type, dosage, schedule, start_date, end_date, status,
       prescribed_by, issued_date, indication, refills_remaining, supply_unit, dose_tracking_from
     ) VALUES (
       $1, $2, $3, 'Tablet', '1 tablet', $4::jsonb, CURRENT_DATE - 3, CURRENT_DATE + 5, $5,
       'Test', CURRENT_DATE - 3, 'Test', 0, 'tablets', $6
     )`,
    [id, patientId, `Test ${id}`, JSON.stringify(schedule), status, trackingFrom]
  );
}

const dosesOf = async (client, medicationId) =>
  (await client.query(
    'SELECT * FROM medication_doses WHERE medication_id = $1 ORDER BY scheduled_at',
    [medicationId]
  )).rows;

const nearest = (rows, offsetMinutes) => {
  const target = Date.now() + offsetMinutes * MINUTE;
  return rows.find((r) => Math.abs(new Date(r.scheduled_at).getTime() - target) < 2 * MINUTE);
};

const adherence = async (client, medicationId) =>
  (await client.query('SELECT adherence_percent FROM medications WHERE id = $1', [medicationId]))
    .rows[0].adherence_percent;

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to run against production');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await runMigration(client);

    const patient = (await client.query('SELECT id FROM patients ORDER BY id LIMIT 1')).rows[0];
    assert.ok(patient, 'needs at least one patient row');
    const patientId = patient.id;
    await client.query(
      `INSERT INTO notification_preferences (patient_id, medication_reminders, reminder_time_window)
       VALUES ($1, true, 30)
       ON CONFLICT (patient_id) DO UPDATE SET medication_reminders = true, reminder_time_window = 30`,
      [patientId]
    );

    // Doses 3 hours ago, in 20 minutes and in 3 hours; tracking began 4 hours ago.
    // The times are fixed once so a minute ticking over mid-run changes nothing.
    const T = { past: clock(-180), soon: clock(20), later: clock(180) };
    const fourHoursAgo = new Date(Date.now() - 240 * MINUTE);
    await addMedication(client, patientId, {
      id: 'med_test_a',
      schedule: [T.past, T.soon, T.later],
      trackingFrom: fourHoursAgo,
    });
    await addMedication(client, patientId, {
      id: 'med_test_past',
      schedule: [T.soon],
      status: 'past',
      trackingFrom: fourHoursAgo,
    });

    await it('existing medications are not back-filled with doses from before tracking began', async () => {
      await doses.generateDoses(client);
      const early = await client.query(
        `SELECT COUNT(*)::int AS n FROM medication_doses d
         JOIN medications m ON m.id = d.medication_id
         WHERE d.scheduled_at < m.dose_tracking_from`
      );
      assert.strictEqual(early.rows[0].n, 0);
    });

    await it('doses are created for each scheduled time, from tracking start to tomorrow', async () => {
      const rows = await dosesOf(client, 'med_test_a');
      assert.ok(nearest(rows, -180), 'dose 3 hours ago');
      assert.ok(nearest(rows, 20), 'dose in 20 minutes');
      assert.ok(nearest(rows, 180), 'dose in 3 hours');
      assert.ok(rows.every((r) => new Date(r.scheduled_at) >= fourHoursAgo), 'nothing before tracking start');
      assert.ok(rows.every((r) => r.status === 'pending'));
    });

    await it('a schedule time is South African time, two hours ahead of UTC', async () => {
      const rows = await dosesOf(client, 'med_test_a');
      const dose = nearest(rows, 20);
      assert.strictEqual(doses.localTime(dose.scheduled_at), T.soon);
    });

    await it('creating doses again adds nothing', async () => {
      const before = (await dosesOf(client, 'med_test_a')).length;
      await doses.generateDoses(client, { patientId });
      assert.strictEqual((await dosesOf(client, 'med_test_a')).length, before);
    });

    await it('a past medication gets no doses', async () => {
      assert.strictEqual((await dosesOf(client, 'med_test_past')).length, 0);
    });

    await it('a dose not logged within 2 hours is missed, and adherence counts it', async () => {
      await doses.markMissedDoses(client, { patientId });
      const rows = await dosesOf(client, 'med_test_a');
      assert.strictEqual(nearest(rows, -180).status, 'missed');
      assert.strictEqual(nearest(rows, 20).status, 'pending');
      assert.strictEqual(await adherence(client, 'med_test_a'), 0);
    });

    await it('only the dose inside the reminder window is reminded, and only once', async () => {
      const first = (await doses.claimDueReminders(client)).filter((d) => d.medication_id === 'med_test_a');
      assert.strictEqual(first.length, 1);
      assert.strictEqual(doses.localTime(first[0].scheduled_at), T.soon);
      const second = (await doses.claimDueReminders(client)).filter((d) => d.medication_id === 'med_test_a');
      assert.strictEqual(second.length, 0);
    });

    await it('a reminder whose send fails is released and sent on the next run', async () => {
      const dose = nearest(await dosesOf(client, 'med_test_a'), 20);
      await client.query('UPDATE medication_doses SET reminded_at = NULL WHERE id = $1', [dose.id]);

      const failing = async () => { throw new Error('push service down'); };
      const silence = console.error;
      console.error = () => {};
      const failed = await doses.sendDueReminders(client, failing);
      console.error = silence;
      assert.ok(failed.failed >= 1);

      const sent = [];
      await doses.sendDueReminders(client, async (message) => { sent.push(message); return { delivered: true }; });
      const ours = sent.find((m) => m.data.doseId === dose.id);
      assert.ok(ours, 'retried');
      assert.strictEqual(ours.type, 'medication');
      assert.strictEqual(ours.body, `Your ${T.soon} dose of Test med_test_a (1 tablet) is due.`);
    });

    await it('a shorter reminder window holds the reminder back', async () => {
      const dose = nearest(await dosesOf(client, 'med_test_a'), 20);
      await client.query('UPDATE medication_doses SET reminded_at = NULL WHERE id = $1', [dose.id]);
      await client.query('UPDATE notification_preferences SET reminder_time_window = 10 WHERE patient_id = $1', [patientId]);
      const claimed = (await doses.claimDueReminders(client)).filter((d) => d.id === dose.id);
      assert.strictEqual(claimed.length, 0);
      await client.query('UPDATE notification_preferences SET reminder_time_window = 30 WHERE patient_id = $1', [patientId]);
    });

    await it('logging a missed dose as taken late raises adherence', async () => {
      const dose = nearest(await dosesOf(client, 'med_test_a'), -180);
      const logged = await doses.recordDose(client, { patientId, doseId: dose.id, status: 'taken' });
      assert.strictEqual(logged.status, 'taken');
      assert.ok(logged.taken_at);
      assert.strictEqual(logged.adherence_percent, 100);
    });

    await it('a skipped dose counts against adherence', async () => {
      const dose = nearest(await dosesOf(client, 'med_test_a'), 20);
      const logged = await doses.recordDose(client, { patientId, doseId: dose.id, status: 'skipped' });
      assert.strictEqual(logged.status, 'skipped');
      assert.strictEqual(logged.taken_at, null);
      assert.strictEqual(logged.adherence_percent, 50);
    });

    await it('a dose more than an hour away cannot be logged yet', async () => {
      const dose = nearest(await dosesOf(client, 'med_test_a'), 180);
      await assert.rejects(
        doses.recordDose(client, { patientId, doseId: dose.id, status: 'taken' }),
        (error) => error.code === 'DOSE_NOT_DUE' && error.status === 409
      );
    });

    await it("another patient's dose is refused", async () => {
      const dose = nearest(await dosesOf(client, 'med_test_a'), 20);
      await assert.rejects(
        doses.recordDose(client, { patientId: -1, doseId: dose.id, status: 'taken' }),
        (error) => error.status === 403
      );
    });

    await it('taken_at cannot be in the future', async () => {
      const dose = nearest(await dosesOf(client, 'med_test_a'), 20);
      await assert.rejects(
        doses.recordDose(client, {
          patientId, doseId: dose.id, status: 'taken',
          takenAt: new Date(Date.now() + 30 * MINUTE).toISOString(),
        }),
        (error) => error.status === 400
      );
    });

    await it("the day's list shows the doses in order with the medication name", async () => {
      const today = doses.localDate();
      const rows = (await doses.listDosesForDay(client, patientId, today))
        .filter((r) => r.medication_id === 'med_test_a');
      assert.ok(rows.length >= 1);
      assert.ok(rows.every((r) => doses.localDate(r.scheduled_at) === today));
      assert.strictEqual(rows[0].medication_name, 'Test med_test_a');
      const times = rows.map((r) => new Date(r.scheduled_at).getTime());
      assert.deepStrictEqual(times, [...times].sort((a, b) => a - b));
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
