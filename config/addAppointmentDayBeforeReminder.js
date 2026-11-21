const { pool } = require('./db');

// The appointment date a day-before reminder was last sent for (see
// runAppointmentReminders in jobs/notificationTriggers.js). Storing the date
// rather than a flag means a rescheduled appointment is reminded again for
// its new date.
async function runMigration(db = pool) {
  await db.query(`
    ALTER TABLE appointments
      ADD COLUMN IF NOT EXISTS day_before_reminder_for DATE;
  `);
}

if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('appointments.day_before_reminder_for is ready');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed to add appointments.day_before_reminder_for:', error);
      process.exit(1);
    });
}

module.exports = { runMigration };
