// Prescription status for the patient, against a real database: current vs
// history, an order pickup dispensing the prescription, and a dispensed
// prescription's QR code no longer working.
//
// Everything runs inside one transaction that is rolled back, so the
// database is left exactly as it was. Needs one patient, doctor and
// pharmacy row. Refuses to run in production.
//
// Run with: node tests/prescriptionStatus.db.test.js
const assert = require('assert');
const crypto = require('crypto');
const { pool } = require('../config/db');
const Prescription = require('../models/Prescription');

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

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to run against production');

  const client = await pool.connect();
  const db = { query: (...args) => client.query(...args) };
  try {
    await client.query('BEGIN');

    const patient = (await client.query('SELECT id FROM patients ORDER BY id LIMIT 1')).rows[0];
    const doctor = (await client.query('SELECT id FROM doctors ORDER BY id LIMIT 1')).rows[0];
    const pharmacy = (await client.query('SELECT id, pharmacy_name FROM pharmacies ORDER BY id LIMIT 1')).rows[0];
    assert.ok(patient && doctor && pharmacy, 'needs a patient, a doctor and a pharmacy row');

    const appointmentId = (await client.query(
      `INSERT INTO appointments
         (doctor_id, patient_id, appointment_date, time_period, time_slot, consultation_fee, status)
       VALUES ($1, $2, CURRENT_DATE, 'morning', '09:00', 100, 'completed') RETURNING id`,
      [doctor.id, patient.id]
    )).rows[0].id;

    const rx = async ({ signed = true, claimed = false, expired = false } = {}) => {
      const id = (await client.query(
        `INSERT INTO prescriptions
           (appointment_id, doctor_id, patient_id, prescription_number, prescriber_name,
            prescriber_hpcsa, patient_name, diagnosis, signature_status, claimed, claim_expires_at)
         VALUES ($1, $2, $3, $4, 'Dr Test', 'MP000000', 'Test Patient', 'Test', $5, $6,
                 CURRENT_TIMESTAMP + ($7 || ' days')::interval)
         RETURNING id`,
        [appointmentId, doctor.id, patient.id, `RX-TEST-${crypto.randomBytes(6).toString('hex')}`,
          signed ? 'signed' : 'pending', claimed, expired ? '-1' : '30']
      )).rows[0].id;
      await client.query(
        `INSERT INTO prescription_items (prescription_id, medicine_name, dosage, dosage_form, quantity, frequency, route_of_administration, duration)
         VALUES ($1, 'Amoxicillin', '500mg', 'capsule', 21, 'three times daily', 'oral', '7 days')`,
        [id]
      );
      return id;
    };
    const order = async (prescriptionId, status) =>
      (await client.query(
        `INSERT INTO orders (prescription_id, patient_id, pharmacy_id, payment_type, status)
         VALUES ($1, $2, $3, 'cash', $4) RETURNING *`,
        [prescriptionId, patient.id, pharmacy.id, status]
      )).rows[0];
    const statusOf = async (id) => (await Prescription.getStatus(id, db)).status;

    const pending = await rx({ signed: false });
    const active = await rx();
    const claimed = await rx({ claimed: true });
    const expired = await rx({ expired: true });
    const withOpenOrder = await rx();
    await order(withOpenOrder, 'preparing');

    await it('each prescription gets its status', async () => {
      assert.strictEqual(await statusOf(pending), 'pending_signature');
      assert.strictEqual(await statusOf(active), 'active');
      assert.strictEqual(await statusOf(claimed), 'in_progress');
      assert.strictEqual(await statusOf(withOpenOrder), 'in_progress');
      assert.strictEqual(await statusOf(expired), 'expired');
    });

    // Picked up through an order, the way the pharmacy app does it.
    const pickedUp = await rx();
    const pickedUpOrder = await order(pickedUp, 'ready');
    const result = await Prescription.markDispensedByOrder(
      { ...pickedUpOrder, status: 'picked_up' }, client
    );

    await it('picking up an order dispenses the prescription', async () => {
      assert.strictEqual(result.dispensed, true);
      assert.strictEqual(result.pharmacyName, pharmacy.pharmacy_name);
      const row = (await client.query(
        'SELECT is_dispensed, dispensed_by_pharmacy_id, dispensed_at FROM prescriptions WHERE id = $1', [pickedUp]
      )).rows[0];
      assert.strictEqual(row.is_dispensed, true);
      assert.strictEqual(row.dispensed_by_pharmacy_id, String(pharmacy.id));
      assert.ok(row.dispensed_at);
      assert.strictEqual(await statusOf(pickedUp), 'dispensed');
      const audit = await client.query('SELECT 1 FROM prescription_dispensing WHERE prescription_id = $1', [pickedUp]);
      assert.strictEqual(audit.rows.length, 1);
    });

    await it("the patient's medications are activated, once", async () => {
      assert.strictEqual(result.medications.length, 1);
      const again = await Prescription.markDispensedByOrder({ ...pickedUpOrder, status: 'picked_up' }, client);
      assert.strictEqual(again.dispensed, false);
      assert.strictEqual(again.medications.length, 0);
      const audit = await client.query('SELECT 1 FROM prescription_dispensing WHERE prescription_id = $1', [pickedUp]);
      assert.strictEqual(audit.rows.length, 1, 'no second audit row');
    });

    await it('a picked-up order counts as dispensed even if the prescription was never marked', async () => {
      const legacy = await rx({ claimed: true });
      await order(legacy, 'picked_up');
      assert.strictEqual(await statusOf(legacy), 'dispensed');
    });

    await it('the list splits current and history', async () => {
      const current = (await Prescription.getByPatientId(patient.id, 500, 0, Prescription.CURRENT_STATUSES, db))
        .map((p) => p.id);
      const history = (await Prescription.getByPatientId(patient.id, 500, 0, Prescription.HISTORY_STATUSES, db))
        .map((p) => p.id);
      for (const id of [pending, active, claimed, withOpenOrder]) assert.ok(current.includes(id), `${id} current`);
      for (const id of [pickedUp, expired]) assert.ok(history.includes(id), `${id} history`);
      assert.ok(!current.includes(pickedUp));
      const item = (await Prescription.getByPatientId(patient.id, 500, 0, ['dispensed'], db))
        .find((p) => p.id === pickedUp);
      assert.strictEqual(item.dispensed_pharmacy, pharmacy.pharmacy_name);
      assert.ok(item.dispensed_at);
      const all = await Prescription.getByPatientId(patient.id, 500, 0, null, db);
      assert.ok(all.length >= current.length + history.length);
    });

    await it('the counts add up per status', async () => {
      const counts = await Prescription.countByStatusForPatient(patient.id, db);
      assert.ok(counts.dispensed >= 2);
      assert.ok(counts.expired >= 1);
      assert.ok(counts.in_progress >= 2);
      for (const s of [...Prescription.CURRENT_STATUSES, ...Prescription.HISTORY_STATUSES]) {
        assert.strictEqual(typeof counts[s], 'number', s);
      }
    });

    await it('dispensing turns off QR codes made before it', async () => {
      const id = await rx({ claimed: true });
      const tokenA = crypto.randomBytes(32).toString('hex');
      const tokenB = crypto.randomBytes(32).toString('hex');
      for (const t of [tokenA, tokenB]) {
        await client.query(
          `INSERT INTO prescription_qr_access (prescription_id, qr_token, expires_at, max_access_count, is_active)
           VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '90 days', 1, TRUE)`,
          [id, t]
        );
      }
      const o = await order(id, 'ready');
      await Prescription.markDispensedByOrder({ ...o, status: 'picked_up' }, client);
      const rows = (await client.query(
        'SELECT is_active FROM prescription_qr_access WHERE prescription_id = $1', [id]
      )).rows;
      assert.strictEqual(rows.length, 2);
      assert.ok(rows.every((r) => r.is_active === false));
    });

    await it('deactivating QR codes only touches that prescription', async () => {
      const token = crypto.randomBytes(32).toString('hex');
      await client.query(
        `INSERT INTO prescription_qr_access (prescription_id, qr_token, expires_at, max_access_count, is_active)
         VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '90 days', 1, TRUE)`,
        [active, token]
      );
      await Prescription.deactivateQRCodes(client, pickedUp);
      const row = (await client.query('SELECT is_active FROM prescription_qr_access WHERE qr_token = $1', [token])).rows[0];
      assert.strictEqual(row.is_active, true);
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

main().catch(async (error) => {
  console.error(error);
  process.exitCode = 1;
});
