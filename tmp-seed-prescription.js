/**
 * Seeds one appointment + one signed prescription so we can test Orders.
 * Change PATIENT_ID / DOCTOR_ID at the top if needed.
 */
const { query } = require('./config/db');

const PATIENT_ID = 1;   // kameellesedi@gmail.com
const DOCTOR_ID  = 1;   // Sam Smith

(async () => {
  try {
    // 1. Insert appointment
    const apptRes = await query(
      `INSERT INTO appointments
         (doctor_id, patient_id, appointment_date, time_period, time_slot, consultation_fee, reason_for_visit, status, payment_status, payment_method)
       VALUES ($1, $2, CURRENT_DATE, 'morning', '09:00', 350.00, 'Routine checkup', 'completed', 'completed', 'cash_on_arrival')
       RETURNING id`,
      [DOCTOR_ID, PATIENT_ID]
    );
    const appointmentId = apptRes.rows[0].id;
    console.log('✅ appointment id:', appointmentId);

    // 2. Lookup patient + doctor name for the prescription record
    const pat = (await query('SELECT first_name, last_name, email FROM patients WHERE id=$1', [PATIENT_ID])).rows[0];
    const doc = (await query('SELECT first_name, last_name FROM doctors WHERE id=$1', [DOCTOR_ID])).rows[0];

    // 3. Insert prescription (marked signed + not dispensed)
    const rxNumber = `RX-${Date.now()}`;
    const rxRes = await query(
      `INSERT INTO prescriptions
         (appointment_id, doctor_id, patient_id, prescription_number, prescriber_name, prescriber_hpcsa,
          patient_name, patient_email, diagnosis, signature_status, is_signed, is_dispensed, is_revoked)
       VALUES ($1, $2, $3, $4, $5, 'MP-TEST-001', $6, $7, 'Routine prescription for testing', 'signed', TRUE, FALSE, FALSE)
       RETURNING id, prescription_number, signature_status, is_dispensed`,
      [
        appointmentId,
        DOCTOR_ID,
        PATIENT_ID,
        rxNumber,
        `Dr ${doc.first_name} ${doc.last_name}`,
        `${pat.first_name} ${pat.last_name}`,
        pat.email,
      ]
    );
    console.log('✅ prescription:', rxRes.rows[0]);

    console.log(`\n📋 Use prescription_id = ${rxRes.rows[0].id} in your Postman Order body.`);
    process.exit();
  } catch (e) {
    console.error('❌ seed failed:', e.message);
    process.exit(1);
  }
})();
