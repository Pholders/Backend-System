const { query } = require('./db');

/**
 * Migration: Add Appointment Reminders Tables
 * Adds support for appointment reminders and notification history tracking
 */

async function addAppointmentReminders() {
  try {
    console.log('\n📋 Initializing appointment reminders support...');

    // Create appointment_reminders table
    const checkRemindersTable = `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'appointment_reminders');`;
    const remindersResult = await query(checkRemindersTable);

    if (!remindersResult.rows[0].exists) {
      console.log('   Creating appointment_reminders table...');
      await query(`
        CREATE TABLE appointment_reminders (
          id SERIAL PRIMARY KEY,
          appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
          patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          reminder_times INTEGER[] NOT NULL DEFAULT '{1440, 60}',
          reminder_methods VARCHAR(20)[] NOT NULL DEFAULT '{email}' CHECK (reminder_methods <@ ARRAY['email', 'sms', 'push', 'in-app']::VARCHAR[]),
          is_enabled BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX idx_appointment_reminders_appointment_id ON appointment_reminders(appointment_id);
        CREATE INDEX idx_appointment_reminders_patient_id ON appointment_reminders(patient_id);
        CREATE INDEX idx_appointment_reminders_enabled ON appointment_reminders(is_enabled);
      `);
      console.log('   ✅ appointment_reminders table created');
    }

    // Create reminder_notification_history table
    const checkHistoryTable = `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'reminder_notification_history');`;
    const historyResult = await query(checkHistoryTable);

    if (!historyResult.rows[0].exists) {
      console.log('   Creating reminder_notification_history table...');
      await query(`
        CREATE TABLE reminder_notification_history (
          id SERIAL PRIMARY KEY,
          reminder_id INTEGER NOT NULL REFERENCES appointment_reminders(id) ON DELETE CASCADE,
          appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
          patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          reminder_method VARCHAR(20) NOT NULL,
          minutes_before INTEGER NOT NULL,
          status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'pending')),
          error_message TEXT,
          sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX idx_reminder_history_appointment_id ON reminder_notification_history(appointment_id);
        CREATE INDEX idx_reminder_history_patient_id ON reminder_notification_history(patient_id);
        CREATE INDEX idx_reminder_history_sent_at ON reminder_notification_history(sent_at);
        CREATE INDEX idx_reminder_history_status ON reminder_notification_history(status);
      `);
      console.log('   ✅ reminder_notification_history table created');
    }

    console.log('✅ Appointment reminders initialized successfully\n');
    return true;

  } catch (error) {
    console.error('❌ Error initializing appointment reminders:', error);
    throw error;
  }
}

module.exports = addAppointmentReminders;
