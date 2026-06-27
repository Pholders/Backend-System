const { query } = require('../config/db');

/**
 * Notification Model
 * Handles the `notifications` table (patient inbox + push history).
 */

const VALID_TYPES = ['medication', 'prescription', 'appointment', 'message', 'order'];

class Notification {
  static get VALID_TYPES() {
    return VALID_TYPES;
  }

  /**
   * Create the notifications table.
   */
  static async createTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        type VARCHAR(32) NOT NULL CHECK (type IN ('medication', 'prescription', 'appointment', 'message', 'order')),
        title VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        data JSONB,
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        read_at TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_notifications_patient_created
        ON notifications(patient_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notifications_patient_type_created
        ON notifications(patient_id, type, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notifications_patient_unread
        ON notifications(patient_id) WHERE is_read = FALSE;
    `;
    await query(sql);
    console.log('✅ notifications table ready');
  }

  /**
   * Insert a new notification row.
   */
  static async create({ patient_id, type, title, body, data = null }) {
    if (!VALID_TYPES.includes(type)) {
      throw new Error(`Invalid notification type: ${type}`);
    }
    const sql = `
      INSERT INTO notifications (patient_id, type, title, body, data)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const result = await query(sql, [patient_id, type, title, body, data]);
    return result.rows[0];
  }

  /**
   * List notifications for a patient.
   * @param {object} opts { type, limit, offset }
   */
  static async listForPatient(patient_id, { type = null, limit = 50, offset = 0 } = {}) {
    const params = [patient_id];
    let where = 'patient_id = $1';
    if (type) {
      params.push(type);
      where += ` AND type = $${params.length}`;
    }
    params.push(limit);
    params.push(offset);
    const sql = `
      SELECT * FROM notifications
      WHERE ${where}
      ORDER BY created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;
    const result = await query(sql, params);
    return result.rows;
  }

  /**
   * Count unread notifications for a patient.
   */
  static async unreadCount(patient_id) {
    const sql = `SELECT COUNT(*)::int AS count FROM notifications WHERE patient_id = $1 AND is_read = FALSE`;
    const result = await query(sql, [patient_id]);
    return result.rows[0].count;
  }

  /**
   * Mark a notification as read. Only if it belongs to the patient.
   */
  static async markRead(id, patient_id) {
    const sql = `
      UPDATE notifications
      SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND patient_id = $2
      RETURNING *
    `;
    const result = await query(sql, [id, patient_id]);
    return result.rows[0] || null;
  }

  /**
   * Mark all notifications for a patient as read.
   */
  static async markAllRead(patient_id) {
    const sql = `
      UPDATE notifications
      SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
      WHERE patient_id = $1 AND is_read = FALSE
    `;
    const result = await query(sql, [patient_id]);
    return result.rowCount;
  }
}

module.exports = Notification;
