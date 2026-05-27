const { query } = require('../config/db');

/**
 * DeviceToken Model
 * Stores FCM device tokens per patient. A patient may have multiple devices,
 * so we keep tokens in a dedicated table (UNIQUE on the token).
 *
 * For backward-compat with the sprint description we also keep a copy of the
 * most recent token + platform on the patients table via addDeviceTokenColumns().
 */

const VALID_PLATFORMS = ['ios', 'android'];

class DeviceToken {
  static get VALID_PLATFORMS() {
    return VALID_PLATFORMS;
  }

  static async createTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS device_tokens (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        platform VARCHAR(16) NOT NULL CHECK (platform IN ('ios', 'android')),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_device_tokens_patient ON device_tokens(patient_id);
    `;
    await query(sql);
    console.log('✅ device_tokens table ready');
  }

  /**
   * Add device_token and device_platform columns to the patients table.
   * Holds the most-recently-registered token for quick access.
   */
  static async addDeviceTokenColumns() {
    const sql = `
      ALTER TABLE patients
        ADD COLUMN IF NOT EXISTS device_token TEXT,
        ADD COLUMN IF NOT EXISTS device_platform VARCHAR(16);
    `;
    await query(sql);
    console.log('✅ patients.device_token / device_platform columns ready');
  }

  /**
   * Register (upsert) a device token for a patient.
   */
  static async register(patient_id, token, platform) {
    if (!token) throw new Error('token required');
    if (!VALID_PLATFORMS.includes(platform)) {
      throw new Error(`platform must be one of: ${VALID_PLATFORMS.join(', ')}`);
    }

    const sql = `
      INSERT INTO device_tokens (patient_id, token, platform)
      VALUES ($1, $2, $3)
      ON CONFLICT (token) DO UPDATE
        SET patient_id = EXCLUDED.patient_id,
            platform = EXCLUDED.platform,
            last_seen_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    const result = await query(sql, [patient_id, token, platform]);

    // Mirror the latest token onto patients for the "first login" simple case.
    await query(
      `UPDATE patients SET device_token = $1, device_platform = $2 WHERE id = $3`,
      [token, platform, patient_id]
    );

    return result.rows[0];
  }

  /**
   * Get all active tokens for a patient.
   */
  static async listForPatient(patient_id) {
    const result = await query(
      `SELECT * FROM device_tokens WHERE patient_id = $1 ORDER BY last_seen_at DESC`,
      [patient_id]
    );
    return result.rows;
  }

  /**
   * Remove an invalid token (e.g. when FCM reports it as unregistered).
   */
  static async remove(token) {
    await query(`DELETE FROM device_tokens WHERE token = $1`, [token]);
    await query(
      `UPDATE patients SET device_token = NULL, device_platform = NULL WHERE device_token = $1`,
      [token]
    );
  }
}

module.exports = DeviceToken;
