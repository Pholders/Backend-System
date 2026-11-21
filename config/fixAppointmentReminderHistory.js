const { pool } = require('./db');

// Makes reminder_notification_history the record of what was sent, so each
// patient-set reminder goes out once (see services/reminderNotificationService.js).
//
//   appointment_at  the appointment time the reminder was for. Part of the
//                   once-only key, so a rescheduled appointment is reminded
//                   again for its new time.
//   'skipped'       a reminder that was deliberately not sent (SMS has no
//                   provider yet; the patient turned the notification off).
//                   Unlike 'failed', it is not retried.
//
// The partial unique index is the once-only guarantee: a reminder is claimed
// by inserting its 'pending' row, and a second claim for the same reminder,
// method, offset and appointment time is refused. Failed rows are left out of
// it so the reminder can be retried.
async function runMigration(db = pool) {
  await db.query(`
    ALTER TABLE reminder_notification_history
      ADD COLUMN IF NOT EXISTS appointment_at TIMESTAMPTZ;

    ALTER TABLE reminder_notification_history
      DROP CONSTRAINT IF EXISTS reminder_notification_history_status_check;
    ALTER TABLE reminder_notification_history
      ADD CONSTRAINT reminder_notification_history_status_check
      CHECK (status IN ('sent', 'failed', 'pending', 'skipped'));

    CREATE UNIQUE INDEX IF NOT EXISTS idx_reminder_history_once
      ON reminder_notification_history (reminder_id, reminder_method, minutes_before, appointment_at)
      WHERE status <> 'failed' AND appointment_at IS NOT NULL;
  `);
}

if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('reminder_notification_history is ready');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed to update reminder_notification_history:', error);
      process.exit(1);
    });
}

module.exports = { runMigration };
