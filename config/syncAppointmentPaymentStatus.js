const { query } = require('./db');

/**
 * Migration: keep appointments.payment_status / payment_method in step with
 * the payments table.
 *
 * Appointments carry their own copy of the payment status and method, but
 * nothing ever wrote it: every appointment said payment_status 'pending' and
 * payment_method null, even a completed cash-on-arrival visit whose payment
 * row was 'completed'. The admin appointments list, its payment_status filter
 * and every `SELECT a.*` handed that stale copy to the apps.
 *
 * The payments table stays the source of truth. A trigger copies it onto the
 * appointment whenever a payment is inserted or its status, method or
 * appointment changes, so every code path is covered, raw SQL included.
 * The appointment shows its completed payment if it has one, otherwise its
 * latest attempt (a cancelled card attempt doesn't hide a later cash booking).
 *
 * Existing rows are backfilled. Idempotent: the function is replaced every
 * boot (no table lock), the trigger is only created when missing (creating
 * it locks payments, so it isn't redone each boot), and the backfill only
 * touches rows that differ.
 */
const LATEST_PAYMENT = (appointmentIdSql) => `
  SELECT p.payment_status, p.payment_method
    FROM payments p
   WHERE p.appointment_id = ${appointmentIdSql}
   ORDER BY (p.payment_status = 'completed') DESC, p.created_at DESC, p.id DESC
   LIMIT 1`;

const runMigration = async () => {
  console.log('🔄 Syncing appointment payment status from payments...');
  try {
    await query(`
      CREATE OR REPLACE FUNCTION sync_appointment_payment_status(appt_id INTEGER)
      RETURNS void AS $$
      DECLARE
        new_status VARCHAR;
        new_method VARCHAR;
      BEGIN
        IF appt_id IS NULL THEN
          RETURN;
        END IF;
        SELECT lp.payment_status, lp.payment_method
          INTO new_status, new_method
          FROM (${LATEST_PAYMENT('appt_id')}) lp;
        new_status := COALESCE(new_status, 'pending');  -- no payment left
        UPDATE appointments
           SET payment_status = new_status, payment_method = new_method
         WHERE id = appt_id
           AND (payment_status IS DISTINCT FROM new_status
                OR payment_method IS DISTINCT FROM new_method);
      END;
      $$ LANGUAGE plpgsql;

      CREATE OR REPLACE FUNCTION payments_sync_appointment()
      RETURNS trigger AS $$
      BEGIN
        IF TG_OP IN ('UPDATE', 'DELETE') THEN
          PERFORM sync_appointment_payment_status(OLD.appointment_id);
        END IF;
        IF TG_OP IN ('INSERT', 'UPDATE')
           AND (TG_OP = 'INSERT' OR NEW.appointment_id IS DISTINCT FROM OLD.appointment_id
                OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
                OR NEW.payment_method IS DISTINCT FROM OLD.payment_method) THEN
          PERFORM sync_appointment_payment_status(NEW.appointment_id);
        END IF;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `);

    const exists = await query(
      `SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_payments_sync_appointment'
          AND tgrelid = 'payments'::regclass`
    );
    if (!exists.rows[0]) {
      await query(`
        CREATE TRIGGER trg_payments_sync_appointment
        AFTER INSERT OR UPDATE OR DELETE ON payments
        FOR EACH ROW EXECUTE FUNCTION payments_sync_appointment();
      `);
      console.log('✅ payments -> appointments sync trigger created');
    }

    const backfill = await query(`
      UPDATE appointments a
         SET payment_status = COALESCE(lp.payment_status, 'pending'),
             payment_method = lp.payment_method
        FROM appointments a2
        LEFT JOIN LATERAL (${LATEST_PAYMENT('a2.id')}) lp ON true
       WHERE a2.id = a.id
         AND (a.payment_status IS DISTINCT FROM COALESCE(lp.payment_status, 'pending')
              OR a.payment_method IS DISTINCT FROM lp.payment_method)
    `);
    console.log(`✅ Appointment payment status in sync (${backfill.rowCount} backfilled)`);
    return true;
  } catch (error) {
    console.error('❌ Appointment payment status sync failed:', error);
    throw error;
  }
};

if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { runMigration };
