// Changing a medication's times (PATCH /api/medications/:id/schedule) against
// a real database: which doses are kept, deleted and created, reminders,
// adherence, the prescribed count, and the refusals.
//
// Everything runs inside one transaction that is rolled back, so the
// database is left exactly as it was. Needs one patient and one doctor row.
// Refuses to run in production. Uses times up to 3.5 hours either side of
// now, so run it away from local midnight.
//
// Run with: node tests/medicationSchedule.db.test.js
const assert = require('assert');
const crypto = require('crypto');
const { pool } = require('../config/db');
const doses = require('../services/medicationDoseService');
const { createForDispensedPrescription } = require('../services/prescriptionMedicationService');
const { fetchMedications } = require('../controllers/medicationController');

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
const clock = (offsetMinutes) => doses.localTime(new Date(Date.now() + offsetMinutes * MINUTE));
const today = doses.localDate();

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to run against production');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const patient = (await client.query('SELECT id FROM patients ORDER BY id LIMIT 1')).rows[0];
    const doctor = (await client.query('SELECT id FROM doctors ORDER BY id LIMIT 1')).rows[0];
    assert.ok(patient && doctor, 'needs a patient and a doctor row');
    const patientId = patient.id;

    const addMedication = async (id, schedule, { status = 'active', endOffset = 5 } = {}) => {
      await client.query(
        `INSERT INTO medications (
           id, patient_id, name, type, dosage, schedule, start_date, end_date, status,
           prescribed_by, issued_date, indication, refills_remaining, supply_unit, dose_tracking_from
         ) VALUES (
           $1, $2, $3, 'Tablet', '1 tablet', $4::jsonb, CURRENT_DATE - 3, CURRENT_DATE + $6::int, $5,
           'Test', CURRENT_DATE - 3, 'Test', 0, 'tablets', now() - interval '4 hours'
         )`,
        [id, patientId, `Test ${id}`, JSON.stringify(schedule), status, endOffset]
      );
    };
    const dosesOf = async (id) =>
      (await client.query(
        'SELECT * FROM medication_doses WHERE medication_id = $1 ORDER BY scheduled_at', [id]
      )).rows;
    const at = (rows, time, day = today) =>
      rows.filter((r) => doses.localTime(r.scheduled_at) === time && doses.localDate(r.scheduled_at) === day);
    const change = (medicationId, schedule, who = patientId) =>
      doses.changeSchedule(client, { patientId: who, medicationId, schedule });
    const tomorrow = doses.localDate(new Date(Date.now() + 24 * 60 * MINUTE));

    // Doses 2.5 hours ago (taken), in 20 minutes (reminder sent) and in 2.5 hours.
    const T = { past: clock(-150), soon: clock(20), later: clock(150), newPast: clock(-60), newLater: clock(200) };
    await addMedication('med_sched_a', [T.past, T.soon, T.later]);
    await doses.generateDoses(client, { patientId });
    const before = await dosesOf('med_sched_a');
    const takenDose = at(before, T.past)[0];
    await doses.recordDose(client, { patientId, doseId: takenDose.id, status: 'taken' });
    const soonDose = at(before, T.soon)[0];
    await client.query('UPDATE medication_doses SET reminded_at = now() WHERE id = $1', [soonDose.id]);
    const adherenceBefore = (await fetchMedications(client, patientId, 'med_sched_a'))[0];

    // Keep the 20-minute time, move the 2.5-hour one to 3h20, add one an hour ago.
    const result = await change('med_sched_a', [T.newLater, T.soon, T.newPast]);
    const after = await dosesOf('med_sched_a');

    await it('the new times are saved, sorted', async () => {
      assert.deepStrictEqual(result.schedule, [T.newPast, T.soon, T.newLater].sort());
      const row = (await client.query('SELECT schedule FROM medications WHERE id = $1', ['med_sched_a'])).rows[0];
      assert.deepStrictEqual(row.schedule, result.schedule);
    });

    await it('a logged dose is not touched', async () => {
      const kept = after.find((r) => r.id === takenDose.id);
      assert.ok(kept, 'still there');
      assert.strictEqual(kept.status, 'taken');
    });

    await it('a pending dose at a time that stays is kept, with its reminder', async () => {
      const kept = after.find((r) => r.id === soonDose.id);
      assert.ok(kept, 'same row');
      assert.ok(kept.reminded_at, 'reminder not sent again');
    });

    await it('pending doses at a dropped time are deleted from now on', async () => {
      assert.strictEqual(at(after, T.later).length, 0, 'today');
      assert.strictEqual(at(after, T.later, tomorrow).length, 0, 'tomorrow');
    });

    await it('a new time later today gets a dose today', async () => {
      const rows = at(after, T.newLater);
      assert.strictEqual(rows.length, 1);
      assert.strictEqual(rows[0].status, 'pending');
      assert.strictEqual(rows[0].reminded_at, null);
    });

    await it('a new time already past today starts tomorrow, not as a missed dose', async () => {
      assert.strictEqual(at(after, T.newPast).length, 0, 'not today');
      assert.strictEqual(at(after, T.newPast, tomorrow).length, 1, 'tomorrow');
      await doses.markMissedDoses(client, { patientId });
      const missed = (await dosesOf('med_sched_a')).filter((r) => r.status === 'missed');
      assert.strictEqual(missed.length, 0);
    });

    await it('adherence is unchanged', async () => {
      const now = (await fetchMedications(client, patientId, 'med_sched_a'))[0];
      assert.strictEqual(now.adherence_percent, adherenceBefore.adherence_percent);
      assert.strictEqual(now.adherence_doses_counted, adherenceBefore.adherence_doses_counted);
    });

    await it('the job adds nothing more for the old times', async () => {
      await doses.generateDoses(client, { patientId });
      const rows = await dosesOf('med_sched_a');
      assert.strictEqual(at(rows, T.later).length + at(rows, T.later, tomorrow).length, 0);
    });

    await it('the response has the list shape, editable, and no fixed count', async () => {
      const [med] = await fetchMedications(client, patientId, 'med_sched_a');
      assert.deepStrictEqual(med.schedule, result.schedule);
      assert.strictEqual(med.schedule_editable, true);
      assert.strictEqual(med.doses_per_day, null);
      assert.ok(Array.isArray(med.attachments));
      assert.ok(!('prescribed_frequency' in med));
    });

    await it('a patient-added medication can change how many times a day', async () => {
      const r = await change('med_sched_a', [T.soon]);
      assert.deepStrictEqual(r.schedule, [T.soon]);
    });

    const rejects = (promise, status, code) =>
      assert.rejects(promise, (e) => e.status === status && (!code || e.code === code));

    await it('bad times are refused with 400', async () => {
      await rejects(change('med_sched_a', ['7:30']), 400, 'VALIDATION_ERROR');
      await rejects(change('med_sched_a', ['24:00']), 400);
      await rejects(change('med_sched_a', []), 400);
      await rejects(change('med_sched_a', 'not a list'), 400);
      await rejects(change('med_sched_a', ['08:00', '08:00']), 400);
    });

    await it("someone else's medication is 403, an unknown one 404", async () => {
      await rejects(change('med_sched_a', ['08:00'], -1), 403, 'FORBIDDEN');
      await rejects(change('med_does_not_exist', ['08:00']), 404, 'NOT_FOUND');
    });

    await it('a past or finished medication is 409', async () => {
      await addMedication('med_sched_past', ['08:00'], { status: 'past' });
      await addMedication('med_sched_ended', ['08:00'], { endOffset: -1 });
      await rejects(change('med_sched_past', ['09:00']), 409, 'MEDICATION_NOT_ACTIVE');
      await rejects(change('med_sched_ended', ['09:00']), 409, 'MEDICATION_NOT_ACTIVE');
      const [ended] = await fetchMedications(client, patientId, 'med_sched_ended');
      assert.strictEqual(ended.schedule_editable, false);
    });

    // A medication from a prescription "twice daily": the count is fixed at 2.
    const appointmentId = (await client.query(
      `INSERT INTO appointments
         (doctor_id, patient_id, appointment_date, time_period, time_slot, consultation_fee, status)
       VALUES ($1, $2, CURRENT_DATE, 'morning', '09:00', 100, 'completed') RETURNING id`,
      [doctor.id, patientId]
    )).rows[0].id;
    const rxId = (await client.query(
      `INSERT INTO prescriptions
         (appointment_id, doctor_id, patient_id, prescription_number, prescriber_name,
          prescriber_hpcsa, patient_name, diagnosis, signature_status)
       VALUES ($1, $2, $3, $4, 'Dr Test', 'MP000000', 'Test Patient', 'Test', 'signed') RETURNING id`,
      [appointmentId, doctor.id, patientId, `RX-TEST-${crypto.randomBytes(6).toString('hex')}`]
    )).rows[0].id;
    await client.query(
      `INSERT INTO prescription_items
         (prescription_id, medicine_name, dosage, dosage_form, quantity, frequency, route_of_administration, duration)
       VALUES ($1, 'Amoxicillin', '500mg', 'capsule', 14, 'twice daily', 'oral', '7 days')`,
      [rxId]
    );
    const [prescribed] = await createForDispensedPrescription(client, rxId);

    await it('a prescribed medication reports its doses per day', async () => {
      const [med] = await fetchMedications(client, patientId, prescribed.id);
      assert.strictEqual(med.doses_per_day, 2);
      assert.strictEqual(med.schedule_editable, true);
    });

    await it('a prescribed medication keeps its count: other counts are 422', async () => {
      await rejects(change(prescribed.id, ['09:00']), 422, 'DOSES_PER_DAY_MISMATCH');
      await rejects(change(prescribed.id, ['07:00', '13:00', '19:00']), 422);
      const r = await change(prescribed.id, ['19:30', '07:30']);
      assert.deepStrictEqual(r.schedule, ['07:30', '19:30']);
    });
  } finally {
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
  }

  for (const f of failures) console.error(`✗ ${f.label}\n    ${f.message}`);
  console.log(`${passed} passed, ${failures.length} failed`);
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
