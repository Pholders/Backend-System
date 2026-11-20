const { query } = require('../config/db');

/**
 * AdminNotification Model
 *
 * One feed shared by every admin: something happened that an admin should
 * look at. Whether it has been read or dismissed is kept per admin, in
 * admin_notification_states, so one admin reading it doesn't hide it from
 * the others.
 *
 * dedupe_key stops the same event being announced twice (an order going
 * overdue is checked every 15 minutes; a pharmacy can verify by OTP and by
 * email link). An insert whose key already exists is a no-op.
 */

const VALID_TYPES = [
  'support_ticket',
  'security_alert',
  'order_overdue',
  'order_rejected',
  'provider_joined',
  'review_low_rating',
];
const VALID_PRIORITIES = ['normal', 'high'];

const TS = (col, as) => `${col} AT TIME ZONE 'UTC' AS ${as}`;

// A notification as one admin sees it: is_read / read_at are theirs.
const COLUMNS = `
  n.id, n.type, n.priority, n.title, n.body, n.data,
  ${TS('n.created_at', 'created_at')},
  (s.read_at IS NOT NULL) AS is_read,
  ${TS('s.read_at', 'read_at')}`;

const FROM = `
  admin_notifications n
  LEFT JOIN admin_notification_states s
    ON s.notification_id = n.id AND s.admin_id = $1`;

class AdminNotification {
  static get VALID_TYPES() { return VALID_TYPES; }
  static get VALID_PRIORITIES() { return VALID_PRIORITIES; }

  static async createTable() {
    await query(`
      CREATE TABLE IF NOT EXISTS admin_notifications (
        id SERIAL PRIMARY KEY,
        type VARCHAR(32) NOT NULL,
        priority VARCHAR(10) NOT NULL DEFAULT 'normal',
        title VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        data JSONB,
        dedupe_key VARCHAR(255) UNIQUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_admin_notifications_created
        ON admin_notifications(created_at DESC, id DESC);

      CREATE TABLE IF NOT EXISTS admin_notification_states (
        notification_id INTEGER NOT NULL REFERENCES admin_notifications(id) ON DELETE CASCADE,
        admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
        read_at TIMESTAMP,
        dismissed_at TIMESTAMP,
        PRIMARY KEY (notification_id, admin_id)
      );

      CREATE INDEX IF NOT EXISTS idx_admin_notification_states_admin
        ON admin_notification_states(admin_id);
    `);

    // Rebuilt every boot so they follow VALID_TYPES / VALID_PRIORITIES.
    const list = (values) => values.map((v) => `'${v}'`).join(', ');
    await query(`ALTER TABLE admin_notifications DROP CONSTRAINT IF EXISTS admin_notifications_type_check;`);
    await query(`ALTER TABLE admin_notifications ADD CONSTRAINT admin_notifications_type_check
                 CHECK (type IN (${list(VALID_TYPES)}));`);
    await query(`ALTER TABLE admin_notifications DROP CONSTRAINT IF EXISTS admin_notifications_priority_check;`);
    await query(`ALTER TABLE admin_notifications ADD CONSTRAINT admin_notifications_priority_check
                 CHECK (priority IN (${list(VALID_PRIORITIES)}));`);
    console.log('✅ admin_notifications tables ready');
  }

  /**
   * Returns the new row, or null when one with the same dedupe_key exists.
   */
  static async create({ type, priority = 'normal', title, body, data = null, dedupe_key = null }) {
    if (!VALID_TYPES.includes(type)) throw new Error(`Invalid admin notification type: ${type}`);
    if (!VALID_PRIORITIES.includes(priority)) throw new Error(`Invalid admin notification priority: ${priority}`);
    const result = await query(
      `INSERT INTO admin_notifications (type, priority, title, body, data, dedupe_key)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (dedupe_key) DO NOTHING
       RETURNING id, type, priority, title, body, data,
                 ${TS('created_at', 'created_at')}`,
      [type, priority, title, body, data, dedupe_key]
    );
    const row = result.rows[0];
    return row ? { ...row, is_read: false, read_at: null } : null;
  }

  /** Newest first, leaving out what this admin dismissed. */
  static async listForAdmin(adminId, { limit = 50, offset = 0, unreadOnly = false, type, priority } = {}) {
    const params = [adminId];
    const clauses = ['s.dismissed_at IS NULL'];
    if (unreadOnly) clauses.push('s.read_at IS NULL');
    if (type) { params.push(type); clauses.push(`n.type = $${params.length}`); }
    if (priority) { params.push(priority); clauses.push(`n.priority = $${params.length}`); }
    const where = `WHERE ${clauses.join(' AND ')}`;

    const count = await query(`SELECT COUNT(*)::int AS total FROM ${FROM} ${where}`, params);
    params.push(limit, offset);
    const rows = await query(
      `SELECT ${COLUMNS} FROM ${FROM} ${where}
        ORDER BY n.created_at DESC, n.id DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return { total: count.rows[0].total, notifications: rows.rows };
  }

  /** Unread and not dismissed, overall and how many of those are high priority. */
  static async unreadCounts(adminId) {
    const result = await query(
      `SELECT COUNT(*)::int AS unread,
              COUNT(*) FILTER (WHERE n.priority = 'high')::int AS unread_high
         FROM ${FROM}
        WHERE s.dismissed_at IS NULL AND s.read_at IS NULL`,
      [adminId]
    );
    return result.rows[0];
  }

  /** Read or unread for this admin. Null when there is no such notification. */
  static async setRead(id, adminId, isRead = true) {
    const exists = await query('SELECT 1 FROM admin_notifications WHERE id = $1', [id]);
    if (!exists.rows[0]) return null;
    await query(
      `INSERT INTO admin_notification_states (notification_id, admin_id, read_at)
       VALUES ($1, $2, CASE WHEN $3::boolean THEN CURRENT_TIMESTAMP END)
       ON CONFLICT (notification_id, admin_id)
         DO UPDATE SET read_at = CASE WHEN $3::boolean
                                      THEN COALESCE(admin_notification_states.read_at, CURRENT_TIMESTAMP)
                                 END`,
      [id, adminId, isRead]
    );
    const result = await query(`SELECT ${COLUMNS} FROM ${FROM} WHERE n.id = $2`, [adminId, id]);
    return result.rows[0];
  }

  /** Marks everything this admin hasn't read as read. Returns how many. */
  static async markAllRead(adminId) {
    const result = await query(
      `INSERT INTO admin_notification_states (notification_id, admin_id, read_at)
       SELECT n.id, $1, CURRENT_TIMESTAMP
         FROM ${FROM}
        WHERE s.read_at IS NULL AND s.dismissed_at IS NULL
       ON CONFLICT (notification_id, admin_id)
         DO UPDATE SET read_at = CURRENT_TIMESTAMP`,
      [adminId]
    );
    return result.rowCount;
  }

  /** Hides it from this admin's feed only. False when there is no such notification. */
  static async dismiss(id, adminId) {
    const exists = await query('SELECT 1 FROM admin_notifications WHERE id = $1', [id]);
    if (!exists.rows[0]) return false;
    await query(
      `INSERT INTO admin_notification_states (notification_id, admin_id, read_at, dismissed_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (notification_id, admin_id)
         DO UPDATE SET dismissed_at = CURRENT_TIMESTAMP,
                       read_at = COALESCE(admin_notification_states.read_at, CURRENT_TIMESTAMP)`,
      [id, adminId]
    );
    return true;
  }
}

module.exports = AdminNotification;
