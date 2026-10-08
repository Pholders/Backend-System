const { query } = require('./db');

/**
 * Migration: in_app_notifications
 *
 * reminderNotificationService writes an in-app reminder beside the email one,
 * but no migration ever created the table. The insert is wrapped in a
 * try/catch that logs and continues, so email reminders kept working and the
 * in-app branch silently did nothing — phase 1 asks that a patient can
 * "set/receive reminders on appointments", and this is the receive half.
 *
 * Columns match the insert at reminderNotificationService.js:260.
 * Additive and idempotent.
 */
const runMigration = async () => {
  try {
    console.log('🔄 Creating in_app_notifications...');

    await query(`
      CREATE TABLE IF NOT EXISTS in_app_notifications (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        appointment_id INTEGER REFERENCES appointments(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        notification_type VARCHAR(64) NOT NULL,
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        read_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- The patient's own list, unread first, newest first.
      CREATE INDEX IF NOT EXISTS idx_in_app_notifications_patient
        ON in_app_notifications(patient_id, is_read, created_at DESC);

      -- Used when an appointment is cancelled and its reminders go with it.
      CREATE INDEX IF NOT EXISTS idx_in_app_notifications_appointment
        ON in_app_notifications(appointment_id);
    `);

    console.log('✅ in_app_notifications ready');
    return true;
  } catch (error) {
    console.error('❌ in_app_notifications migration failed:', error);
    throw error;
  }
};

if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { runMigration };
