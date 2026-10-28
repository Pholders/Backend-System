const { query } = require('../config/db');

// Notes can change only while the appointment is still ahead: not yet
// started, finished, cancelled or missed. time_slot is stored as 'HH:MM'.
// Compared against LOCALTIMESTAMP, the same clock CURRENT_DATE uses for the
// upcoming-appointment queries.
const NOTES_EDITABLE = `
  a.status IN ('scheduled', 'rescheduled', 'pending_payment')
  AND (a.appointment_date + a.time_slot::time) > LOCALTIMESTAMP
`;

/**
 * AppointmentNote Model
 * Notes a patient adds to an appointment after booking. Deleting one only
 * sets deleted_at: the doctor may already have read it, so the row stays
 * for audit and is hidden from everyone.
 */
class AppointmentNote {
  static async createTable() {
    await query(`
      CREATE TABLE IF NOT EXISTS appointment_patient_notes (
        id SERIAL PRIMARY KEY,
        appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        body VARCHAR(2000) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMPTZ
      );

      CREATE INDEX IF NOT EXISTS idx_appointment_patient_notes_appointment_id
        ON appointment_patient_notes(appointment_id, created_at)
        WHERE deleted_at IS NULL;
    `);
  }

  static async notesEditable(appointmentId) {
    const result = await query(
      `SELECT ${NOTES_EDITABLE} AS editable FROM appointments a WHERE a.id = $1`,
      [appointmentId]
    );
    return result.rows[0]?.editable === true;
  }

  static async listForAppointment(appointmentId) {
    const result = await query(
      `SELECT id, appointment_id, body, created_at
       FROM appointment_patient_notes
       WHERE appointment_id = $1 AND deleted_at IS NULL
       ORDER BY created_at ASC, id ASC`,
      [appointmentId]
    );
    return result.rows;
  }

  /**
   * Adds a note, or returns null when the appointment is locked. The lock is
   * checked in the same statement so a note can't slip in as the slot starts.
   */
  static async create(appointmentId, patientId, body) {
    const result = await query(
      `INSERT INTO appointment_patient_notes (appointment_id, patient_id, body)
       SELECT a.id, $2, $3
       FROM appointments a
       WHERE a.id = $1 AND a.patient_id = $2 AND ${NOTES_EDITABLE}
       RETURNING id, appointment_id, body, created_at`,
      [appointmentId, patientId, body]
    );
    return result.rows[0] || null;
  }

  /**
   * Hides a note, or returns null when it doesn't exist, is already deleted,
   * or the appointment is locked.
   */
  static async softDelete(noteId, appointmentId, patientId) {
    const result = await query(
      `UPDATE appointment_patient_notes n
       SET deleted_at = NOW()
       FROM appointments a
       WHERE n.id = $1
         AND n.appointment_id = $2
         AND n.patient_id = $3
         AND n.deleted_at IS NULL
         AND a.id = n.appointment_id
         AND ${NOTES_EDITABLE}
       RETURNING n.id, n.appointment_id, n.deleted_at`,
      [noteId, appointmentId, patientId]
    );
    return result.rows[0] || null;
  }

  static async exists(noteId, appointmentId, patientId) {
    const result = await query(
      `SELECT 1 FROM appointment_patient_notes
       WHERE id = $1 AND appointment_id = $2 AND patient_id = $3 AND deleted_at IS NULL`,
      [noteId, appointmentId, patientId]
    );
    return result.rows.length > 0;
  }
}

module.exports = AppointmentNote;
