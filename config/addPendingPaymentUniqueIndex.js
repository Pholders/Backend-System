/**
 * Migration: One pending payment per appointment
 * Purpose: Stop two quick taps on "Confirm payment" from creating two pending
 * payments (and two Stripe PaymentIntents) for the same appointment.
 */

const { query } = require('./db');

async function addPendingPaymentUniqueIndex() {
  try {
    console.log('🔄 Adding unique pending-payment index to payments table...');

    // Older rows can already hold duplicates. Keep the newest pending payment per
    // appointment and cancel the rest, otherwise the unique index can't be built.
    const duplicates = await query(`
      UPDATE payments p
      SET payment_status = 'cancelled', updated_at = CURRENT_TIMESTAMP
      WHERE p.payment_status = 'pending'
      AND EXISTS (
        SELECT 1 FROM payments newer
        WHERE newer.appointment_id = p.appointment_id
        AND newer.payment_status = 'pending'
        AND (newer.created_at, newer.id) > (p.created_at, p.id)
      )
      RETURNING p.id;
    `);

    if (duplicates.rowCount > 0) {
      console.log(`ℹ️ Cancelled ${duplicates.rowCount} duplicate pending payments`);
    }

    await query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_one_pending_per_appointment
      ON payments (appointment_id)
      WHERE payment_status = 'pending';
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent_id
      ON payments (stripe_payment_intent_id);
    `);

    console.log('✅ Unique pending-payment index added successfully');
    return true;
  } catch (error) {
    console.error('❌ Error adding unique pending-payment index:', error.message);
    throw error;
  }
}

module.exports = { addPendingPaymentUniqueIndex };
