const { query } = require('./db');

/**
 * Migration: Orders v1
 *
 *   - Creates `orders` table
 *   - Creates `order_status_history` table
 *   - Adds `order_id` to existing `medical_aid_claims` so each order can own a claim row
 *   - Adds 'order' to the notifications type CHECK constraint
 *   - Adds `order_updates` boolean column to `notification_preferences` (default TRUE)
 *
 * Idempotent — safe to run multiple times.
 */

const Order = require('../models/Order');
const OrderStatusHistory = require('../models/OrderStatusHistory');

const runMigration = async () => {
  console.log('🔄 Running Orders v1 migration...');

  try {
    // 1. Create the two new tables.
    await Order.createTable();
    await OrderStatusHistory.createTable();

    // 2. Link medical_aid_claims to orders. Nullable so existing claim rows
    //    (not tied to any order) continue to work.
    await query(`
      ALTER TABLE medical_aid_claims
        ADD COLUMN IF NOT EXISTS order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL;
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_medical_aid_claims_order
        ON medical_aid_claims(order_id);
    `);
    console.log('✅ medical_aid_claims.order_id column ready');

    // 3. Extend the notifications.type CHECK constraint to include 'order'.
    //    Drop then re-add — Postgres has no "add value to existing CHECK" syntax.
    await query(`ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;`);
    await query(`
      ALTER TABLE notifications
        ADD CONSTRAINT notifications_type_check
        CHECK (type IN ('medication', 'prescription', 'appointment', 'message', 'order'));
    `);
    console.log('✅ notifications.type CHECK extended to include "order"');

    // 4. Add `order_updates` preference column. Default TRUE so existing patients
    //    start receiving order notifications by default (they can mute via PUT /settings).
    await query(`
      ALTER TABLE notification_preferences
        ADD COLUMN IF NOT EXISTS order_updates BOOLEAN NOT NULL DEFAULT TRUE;
    `);
    console.log('✅ notification_preferences.order_updates column ready');

    console.log('✅ Orders v1 migration completed');
    return true;
  } catch (error) {
    console.error('❌ Orders v1 migration failed:', error);
    throw error;
  }
};

if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { runMigration };
