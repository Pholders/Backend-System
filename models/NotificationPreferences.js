const { query } = require('../config/db');

/**
 * NotificationPreferences Model
 * One row per patient. Backend MUST check this before sending any notification.
 */

const TYPE_TO_PREF_COLUMN = {
  medication: 'medication_reminders',
  prescription: 'prescription_updates',
  appointment: 'appointment_notifications',
  message: 'messages',
  order: 'order_updates',
};

// Optional sub-types map to specific columns (e.g. refill notifications).
const SUBTYPE_TO_PREF_COLUMN = {
  refill: 'refill_reminders',
  health_alert: 'health_monitoring_alerts',
};

const DEFAULTS = {
  medication_reminders: true,
  refill_reminders: true,
  prescription_updates: true,
  appointment_notifications: true,
  messages: true,
  health_monitoring_alerts: true,
  order_updates: true,
  reminder_time_window: 30,
};

class NotificationPreferences {
  static get TYPE_TO_PREF_COLUMN() {
    return TYPE_TO_PREF_COLUMN;
  }

  static get SUBTYPE_TO_PREF_COLUMN() {
    return SUBTYPE_TO_PREF_COLUMN;
  }

  static get DEFAULTS() {
    return { ...DEFAULTS };
  }

  /**
   * Create the notification_preferences table.
   */
  static async createTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS notification_preferences (
        patient_id INTEGER PRIMARY KEY REFERENCES patients(id) ON DELETE CASCADE,
        medication_reminders BOOLEAN NOT NULL DEFAULT TRUE,
        refill_reminders BOOLEAN NOT NULL DEFAULT TRUE,
        prescription_updates BOOLEAN NOT NULL DEFAULT TRUE,
        appointment_notifications BOOLEAN NOT NULL DEFAULT TRUE,
        messages BOOLEAN NOT NULL DEFAULT TRUE,
        health_monitoring_alerts BOOLEAN NOT NULL DEFAULT TRUE,
        order_updates BOOLEAN NOT NULL DEFAULT TRUE,
        reminder_time_window INTEGER NOT NULL DEFAULT 30 CHECK (reminder_time_window >= 0),
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await query(sql);
    console.log('✅ notification_preferences table ready');
  }

  /**
   * Ensure a preferences row exists for the patient. Idempotent.
   * Call this from patient signup so the first notification check never fails.
   */
  static async ensureForPatient(patient_id) {
    const sql = `
      INSERT INTO notification_preferences (patient_id)
      VALUES ($1)
      ON CONFLICT (patient_id) DO NOTHING
      RETURNING *
    `;
    const result = await query(sql, [patient_id]);
    if (result.rows[0]) return result.rows[0];
    return this.get(patient_id);
  }

  /**
   * Get the preferences row, auto-creating defaults if missing.
   */
  static async get(patient_id) {
    const result = await query(
      'SELECT * FROM notification_preferences WHERE patient_id = $1',
      [patient_id]
    );
    if (result.rows[0]) return result.rows[0];
    return this.ensureForPatient(patient_id);
  }

  /**
   * Update preferences. Only known columns are persisted; unknown keys are ignored.
   */
  static async update(patient_id, prefs = {}) {
    await this.ensureForPatient(patient_id);

    const allowedBool = [
      'medication_reminders',
      'refill_reminders',
      'prescription_updates',
      'appointment_notifications',
      'messages',
      'health_monitoring_alerts',
      'order_updates',
    ];
    const sets = [];
    const values = [patient_id];

    for (const col of allowedBool) {
      if (prefs[col] !== undefined) {
        values.push(Boolean(prefs[col]));
        sets.push(`${col} = $${values.length}`);
      }
    }

    if (prefs.reminder_time_window !== undefined) {
      const n = parseInt(prefs.reminder_time_window, 10);
      if (Number.isNaN(n) || n < 0) {
        throw new Error('reminder_time_window must be a non-negative integer (minutes)');
      }
      values.push(n);
      sets.push(`reminder_time_window = $${values.length}`);
    }

    if (sets.length === 0) {
      return this.get(patient_id);
    }

    sets.push('updated_at = CURRENT_TIMESTAMP');

    const sql = `
      UPDATE notification_preferences
      SET ${sets.join(', ')}
      WHERE patient_id = $1
      RETURNING *
    `;
    const result = await query(sql, values);
    return result.rows[0];
  }

  /**
   * Resolve the column to check for a given notification type (and optional subType).
   * Returns null if the type/subType is unknown.
   */
  static resolvePrefColumn(type, subType = null) {
    if (subType && SUBTYPE_TO_PREF_COLUMN[subType]) {
      return SUBTYPE_TO_PREF_COLUMN[subType];
    }
    return TYPE_TO_PREF_COLUMN[type] || null;
  }

  /**
   * Check whether this notification type is enabled for the patient.
   * This is THE single query that gates every notification.
   */
  static async isEnabled(patient_id, type, subType = null) {
    const column = this.resolvePrefColumn(type, subType);
    if (!column) return false;
    const prefs = await this.get(patient_id);
    return Boolean(prefs[column]);
  }
}

module.exports = NotificationPreferences;
