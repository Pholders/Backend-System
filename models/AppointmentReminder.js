const { query } = require('../config/db');

/**
 * AppointmentReminder Model
 * Handles appointment reminders and notification preferences
 */

class AppointmentReminder {
  /**
   * Create the appointment_reminders table
   */
  static async createTable() {
    // Check if table already exists
    const checkTableQuery = `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'appointment_reminders');`;
    const result = await query(checkTableQuery);
    if (result.rows[0].exists) {
      return; // Table exists, skip creation
    }

    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS appointment_reminders (
        id SERIAL PRIMARY KEY,
        appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        reminder_times INTEGER[] NOT NULL DEFAULT '{1440, 60}',
        reminder_methods VARCHAR(20)[] NOT NULL DEFAULT '{email}' CHECK (reminder_methods <@ ARRAY['email', 'sms', 'push', 'in-app']::VARCHAR[]),
        is_enabled BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_appointment_reminders_appointment_id ON appointment_reminders(appointment_id);
      CREATE INDEX IF NOT EXISTS idx_appointment_reminders_patient_id ON appointment_reminders(patient_id);
      CREATE INDEX IF NOT EXISTS idx_appointment_reminders_enabled ON appointment_reminders(is_enabled);
    `;

    try {
      await query(createTableQuery);
      console.log('✅ Appointment reminders table created successfully');
    } catch (error) {
      console.error('❌ Error creating appointment reminders table:', error);
      throw error;
    }
  }

  /**
   * Create reminder notification history table for tracking sent reminders
   */
  static async createNotificationHistoryTable() {
    const checkTableQuery = `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'reminder_notification_history');`;
    const result = await query(checkTableQuery);
    if (result.rows[0].exists) {
      return;
    }

    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS reminder_notification_history (
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

      CREATE INDEX IF NOT EXISTS idx_reminder_history_appointment_id ON reminder_notification_history(appointment_id);
      CREATE INDEX IF NOT EXISTS idx_reminder_history_patient_id ON reminder_notification_history(patient_id);
      CREATE INDEX IF NOT EXISTS idx_reminder_history_sent_at ON reminder_notification_history(sent_at);
      CREATE INDEX IF NOT EXISTS idx_reminder_history_status ON reminder_notification_history(status);
    `;

    try {
      await query(createTableQuery);
      console.log('✅ Reminder notification history table created successfully');
    } catch (error) {
      console.error('❌ Error creating reminder notification history table:', error);
      throw error;
    }
  }

  /**
   * Set or update reminders for an appointment
   */
  static async setReminder(appointment_id, patient_id, reminder_times, reminder_methods) {
    try {
      // Validate input
      if (!appointment_id || !patient_id) {
        throw new Error('Missing required parameters: appointment_id, patient_id');
      }

      // Validate reminder_times is an array of positive integers (minutes)
      if (!Array.isArray(reminder_times) || reminder_times.length === 0) {
        throw new Error('reminder_times must be a non-empty array of minutes');
      }

      if (!reminder_times.every(time => Number.isInteger(time) && time > 0)) {
        throw new Error('All reminder times must be positive integers (minutes)');
      }

      // Validate reminder_methods
      const validMethods = ['email', 'sms', 'push', 'in-app'];
      if (!Array.isArray(reminder_methods) || reminder_methods.length === 0) {
        throw new Error('reminder_methods must be a non-empty array');
      }

      if (!reminder_methods.every(method => validMethods.includes(method))) {
        throw new Error(`reminder_methods must be one of: ${validMethods.join(', ')}`);
      }

      // Check if reminder already exists
      const existingReminder = await query(
        `SELECT id FROM appointment_reminders WHERE appointment_id = $1`,
        [appointment_id]
      );

      let result;
      if (existingReminder.rows.length > 0) {
        // Update existing reminder
        result = await query(
          `UPDATE appointment_reminders 
           SET reminder_times = $2, reminder_methods = $3, updated_at = CURRENT_TIMESTAMP
           WHERE appointment_id = $1
           RETURNING *`,
          [appointment_id, reminder_times, reminder_methods]
        );
      } else {
        // Create new reminder
        result = await query(
          `INSERT INTO appointment_reminders (appointment_id, patient_id, reminder_times, reminder_methods)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [appointment_id, patient_id, reminder_times, reminder_methods]
        );
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error setting appointment reminder:', error);
      throw error;
    }
  }

  /**
   * Get reminder for a specific appointment
   */
  static async getReminder(appointment_id) {
    try {
      const result = await query(
        `SELECT * FROM appointment_reminders WHERE appointment_id = $1`,
        [appointment_id]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error fetching appointment reminder:', error);
      throw error;
    }
  }

  /**
   * Get all reminders for a patient
   */
  static async getRemindersByPatient(patient_id) {
    try {
      const result = await query(
        `SELECT ar.*, a.appointment_date, a.time_slot, d.first_name as doctor_first_name, d.last_name as doctor_last_name
         FROM appointment_reminders ar
         JOIN appointments a ON ar.appointment_id = a.id
         LEFT JOIN doctors d ON a.doctor_id = d.id
         WHERE ar.patient_id = $1
         ORDER BY a.appointment_date DESC`,
        [patient_id]
      );
      return result.rows;
    } catch (error) {
      console.error('Error fetching patient reminders:', error);
      throw error;
    }
  }

  /**
   * Update reminder settings for an appointment
   */
  static async updateReminder(appointment_id, reminder_times, reminder_methods) {
    try {
      // Validate reminder_times
      if (reminder_times && (!Array.isArray(reminder_times) || reminder_times.length === 0)) {
        throw new Error('reminder_times must be a non-empty array of minutes');
      }

      if (reminder_times && !reminder_times.every(time => Number.isInteger(time) && time > 0)) {
        throw new Error('All reminder times must be positive integers (minutes)');
      }

      // Validate reminder_methods
      const validMethods = ['email', 'sms', 'push', 'in-app'];
      if (reminder_methods && (!Array.isArray(reminder_methods) || reminder_methods.length === 0)) {
        throw new Error('reminder_methods must be a non-empty array');
      }

      if (reminder_methods && !reminder_methods.every(method => validMethods.includes(method))) {
        throw new Error(`reminder_methods must be one of: ${validMethods.join(', ')}`);
      }

      const updateFields = [];
      const updateValues = [];
      let paramCount = 1;

      if (reminder_times) {
        updateFields.push(`reminder_times = $${paramCount++}`);
        updateValues.push(reminder_times);
      }

      if (reminder_methods) {
        updateFields.push(`reminder_methods = $${paramCount++}`);
        updateValues.push(reminder_methods);
      }

      if (updateFields.length === 0) {
        throw new Error('At least one field must be updated');
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

      const result = await query(
        `UPDATE appointment_reminders 
         SET ${updateFields.join(', ')}
         WHERE appointment_id = $${paramCount}
         RETURNING *`,
        [...updateValues, appointment_id]
      );

      return result.rows[0] || null;
    } catch (error) {
      console.error('Error updating appointment reminder:', error);
      throw error;
    }
  }

  /**
   * Enable/Disable reminders for an appointment
   */
  static async toggleReminder(appointment_id, is_enabled) {
    try {
      const result = await query(
        `UPDATE appointment_reminders 
         SET is_enabled = $2, updated_at = CURRENT_TIMESTAMP
         WHERE appointment_id = $1
         RETURNING *`,
        [appointment_id, is_enabled]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error toggling appointment reminder:', error);
      throw error;
    }
  }

  /**
   * Delete reminder for an appointment
   */
  static async deleteReminder(appointment_id) {
    try {
      const result = await query(
        `DELETE FROM appointment_reminders WHERE appointment_id = $1 RETURNING *`,
        [appointment_id]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error deleting appointment reminder:', error);
      throw error;
    }
  }

  /**
   * Get reminders that are due to be sent
   * Returns reminders where the appointment is within the reminder window
   */
  static async getRemindersToSend() {
    try {
      const result = await query(
        `SELECT 
           ar.id as reminder_id,
           ar.appointment_id,
           ar.patient_id,
           ar.reminder_times,
           ar.reminder_methods,
           a.appointment_date,
           a.time_slot,
           a.doctor_id,
           u.email as patient_email,
           u.phone as patient_phone,
           u.first_name as patient_first_name,
           u.last_name as patient_last_name,
           d.first_name as doctor_first_name,
           d.last_name as doctor_last_name
         FROM appointment_reminders ar
         JOIN appointments a ON ar.appointment_id = a.id
         JOIN patients u ON ar.patient_id = u.id
         LEFT JOIN doctors d ON a.doctor_id = d.id
         WHERE ar.is_enabled = true
         AND a.status IN ('scheduled', 'rescheduled')
         AND a.appointment_date = CURRENT_DATE
         ORDER BY a.appointment_date, a.time_slot`
      );

      return result.rows;
    } catch (error) {
      console.error('Error fetching reminders to send:', error);
      throw error;
    }
  }

  /**
   * Record a sent notification in history
   */
  static async recordNotificationHistory(reminder_id, appointment_id, patient_id, reminder_method, minutes_before, status = 'sent', error_message = null) {
    try {
      const result = await query(
        `INSERT INTO reminder_notification_history (reminder_id, appointment_id, patient_id, reminder_method, minutes_before, status, error_message)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [reminder_id, appointment_id, patient_id, reminder_method, minutes_before, status, error_message]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error recording notification history:', error);
      throw error;
    }
  }

  /**
   * Get notification history for an appointment
   */
  static async getNotificationHistory(appointment_id) {
    try {
      const result = await query(
        `SELECT * FROM reminder_notification_history 
         WHERE appointment_id = $1
         ORDER BY sent_at DESC`,
        [appointment_id]
      );
      return result.rows;
    } catch (error) {
      console.error('Error fetching notification history:', error);
      throw error;
    }
  }

  /**
   * Get patient's default reminder preferences
   */
  static async getPatientPreferences(patient_id) {
    try {
      // For now, we'll return default preferences
      // In the future, this could be stored in a patient_preferences table
      const defaultPreferences = {
        patient_id,
        reminder_times: [1440, 60], // 1 day and 1 hour before
        reminder_methods: ['email'],
        is_enabled: true
      };
      return defaultPreferences;
    } catch (error) {
      console.error('Error fetching patient preferences:', error);
      throw error;
    }
  }

  /**
   * Get upcoming reminders for a patient (within next 24 hours)
   */
  static async getUpcomingReminders(patient_id) {
    try {
      const result = await query(
        `SELECT 
           ar.id as reminder_id,
           ar.appointment_id,
           ar.reminder_times,
           ar.reminder_methods,
           a.appointment_date,
           a.time_slot,
           a.consultation_fee,
           d.first_name as doctor_first_name,
           d.last_name as doctor_last_name,
           d.specialization,
           d.clinic_name,
           a.status
         FROM appointment_reminders ar
         JOIN appointments a ON ar.appointment_id = a.id
         LEFT JOIN doctors d ON a.doctor_id = d.id
         WHERE ar.patient_id = $1
         AND ar.is_enabled = true
         AND a.status IN ('scheduled', 'rescheduled')
         AND a.appointment_date >= CURRENT_DATE
         AND a.appointment_date <= CURRENT_DATE + INTERVAL '24 hours'
         ORDER BY a.appointment_date, a.time_slot`,
        [patient_id]
      );
      return result.rows;
    } catch (error) {
      console.error('Error fetching upcoming reminders:', error);
      throw error;
    }
  }

  /**
   * Bulk delete reminders when appointments are cancelled
   */
  static async deleteRemindersByAppointmentIds(appointment_ids) {
    try {
      if (!Array.isArray(appointment_ids) || appointment_ids.length === 0) {
        return 0;
      }

      const result = await query(
        `DELETE FROM appointment_reminders WHERE appointment_id = ANY($1)`,
        [appointment_ids]
      );
      return result.rowCount;
    } catch (error) {
      console.error('Error bulk deleting reminders:', error);
      throw error;
    }
  }
}

module.exports = AppointmentReminder;
