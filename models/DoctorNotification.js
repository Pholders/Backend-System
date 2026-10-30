const { query } = require('../config/db');

/**
 * DoctorNotification Model
 * The doctor's inbox. Kept apart from `notifications`, whose rows each belong
 * to a patient (patient_id NOT NULL), so neither inbox can leak into the other.
 */

const VALID_TYPES = ['appointment', 'payment', 'prescription', 'review'];

class DoctorNotification {
  static get VALID_TYPES() {
    return VALID_TYPES;
  }

  static async createTable() {
    await query(`
      CREATE TABLE IF NOT EXISTS doctor_notifications (
        id SERIAL PRIMARY KEY,
        doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
        type VARCHAR(32) NOT NULL CHECK (type IN ('appointment', 'payment', 'prescription', 'review')),
        title VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        data JSONB,
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        read_at TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_doctor_notifications_doctor_created
        ON doctor_notifications(doctor_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_doctor_notifications_doctor_unread
        ON doctor_notifications(doctor_id) WHERE is_read = FALSE;
    `);
    console.log('✅ doctor_notifications table ready');
  }

  static async create({ doctor_id, type, title, body, data = null }) {
    if (!VALID_TYPES.includes(type)) {
      throw new Error(`Invalid doctor notification type: ${type}`);
    }
    const result = await query(
      `INSERT INTO doctor_notifications (doctor_id, type, title, body, data)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [doctor_id, type, title, body, data]
    );
    return result.rows[0];
  }

  /**
   * Rewrites the doctor's notification about one review, when there is one:
   * a patient has a single review per doctor, so an edit replaces what the
   * doctor was told rather than adding to it. The newest row is updated,
   * marked unread and moved to the top; any older duplicates are deleted.
   * Returns null when the doctor has no notification for that review yet.
   */
  static async replaceForReview(doctor_id, reviewId, { title, body, data }) {
    const result = await query(
      `WITH matching AS (
         SELECT id FROM doctor_notifications
         WHERE doctor_id = $1 AND type = 'review' AND data->>'reviewId' = $2::text
       ),
       keep AS (
         SELECT id FROM doctor_notifications
         WHERE id IN (SELECT id FROM matching)
         ORDER BY created_at DESC, id DESC
         LIMIT 1
       ),
       gone AS (
         DELETE FROM doctor_notifications
         WHERE id IN (SELECT id FROM matching) AND id NOT IN (SELECT id FROM keep)
       )
       UPDATE doctor_notifications
       SET title = $3, body = $4, data = $5, is_read = FALSE, read_at = NULL,
           created_at = CURRENT_TIMESTAMP
       WHERE id IN (SELECT id FROM keep)
       RETURNING *`,
      [doctor_id, String(reviewId), title, body, data]
    );
    return result.rows[0] || null;
  }

  /** Newest first. */
  static async listForDoctor(doctor_id, { limit = 50, offset = 0, unreadOnly = false } = {}) {
    const result = await query(
      `SELECT * FROM doctor_notifications
       WHERE doctor_id = $1 ${unreadOnly ? 'AND is_read = FALSE' : ''}
       ORDER BY created_at DESC, id DESC
       LIMIT $2 OFFSET $3`,
      [doctor_id, limit, offset]
    );
    return result.rows;
  }

  static async unreadCount(doctor_id) {
    const result = await query(
      'SELECT COUNT(*)::int AS count FROM doctor_notifications WHERE doctor_id = $1 AND is_read = FALSE',
      [doctor_id]
    );
    return result.rows[0].count;
  }

  /** Read or unread, and only if it is this doctor's. */
  static async setRead(id, doctor_id, isRead = true) {
    const result = await query(
      `UPDATE doctor_notifications
       SET is_read = $3, read_at = CASE WHEN $3 THEN CURRENT_TIMESTAMP ELSE NULL END
       WHERE id = $1 AND doctor_id = $2
       RETURNING *`,
      [id, doctor_id, isRead]
    );
    return result.rows[0] || null;
  }

  static async markAllRead(doctor_id) {
    const result = await query(
      `UPDATE doctor_notifications
       SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
       WHERE doctor_id = $1 AND is_read = FALSE`,
      [doctor_id]
    );
    return result.rowCount;
  }

  /** Only if it is this doctor's. */
  static async remove(id, doctor_id) {
    const result = await query(
      'DELETE FROM doctor_notifications WHERE id = $1 AND doctor_id = $2',
      [id, doctor_id]
    );
    return result.rowCount > 0;
  }
}

module.exports = DoctorNotification;
