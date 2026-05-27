/**
 * Migration: create notifications, notification_preferences, device_tokens
 * and add device_token / device_platform columns to patients.
 *
 * Run with: node config/createNotificationsTables.js
 */
const Notification = require('../models/Notification');
const NotificationPreferences = require('../models/NotificationPreferences');
const DeviceToken = require('../models/DeviceToken');
const { pool } = require('./db');

async function run() {
  console.log('🔄 Creating notification tables...');
  await Notification.createTable();
  await NotificationPreferences.createTable();
  await DeviceToken.createTable();
  await DeviceToken.addDeviceTokenColumns();

  // Backfill: ensure every existing patient has a preferences row.
  console.log('🔄 Backfilling notification_preferences for existing patients...');
  await pool.query(`
    INSERT INTO notification_preferences (patient_id)
    SELECT id FROM patients
    ON CONFLICT (patient_id) DO NOTHING
  `);

  console.log('✅ Notifications migration complete');
}

if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}

module.exports = run;
