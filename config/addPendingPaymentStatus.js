/**
 * Migration: Add pending_payment status to appointments
 * Purpose: Track appointments that are booked but awaiting payment confirmation
 */

const { query } = require('./db');

async function addPendingPaymentStatus() {
  try {
    console.log('🔄 Adding pending_payment status to appointments table...');

    // Drop the existing CHECK constraint and recreate with new status
    await query(`
      ALTER TABLE appointments 
      DROP CONSTRAINT IF EXISTS appointments_status_check;
    `);

    // Add new CHECK constraint with pending_payment status
    await query(`
      ALTER TABLE appointments 
      ADD CONSTRAINT appointments_status_check 
      CHECK (status IN ('pending_payment', 'scheduled', 'completed', 'cancelled', 'no-show', 'rescheduled'));
    `);

    console.log('✅ pending_payment status added successfully');
    return true;
  } catch (error) {
    console.error('❌ Error adding pending_payment status:', error.message);
    throw error;
  }
}

module.exports = { addPendingPaymentStatus };
