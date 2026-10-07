const { pool, query } = require('../config/db');
const { normaliseSchemeName } = require('../config/addDoctorMedicalAids');

/**
 * The canonical medical aid list, and which schemes each doctor accepts.
 *
 * Patients keep their own scheme as free text on medical_aid_schemes, so
 * every lookup that starts from a patient goes through normaliseSchemeName
 * rather than comparing strings directly.
 */
class MedicalAid {
  /** Every scheme a doctor can pick from. */
  static async listCatalogue() {
    const result = await query(
      `SELECT id, name
         FROM medical_aid_schemes_catalogue
        WHERE is_active = TRUE
        ORDER BY name ASC;`
    );
    return result.rows;
  }

  /** The schemes one doctor accepts. */
  static async getForDoctor(doctorId) {
    const result = await query(
      `SELECT c.id, c.name
         FROM doctor_medical_aids d
         JOIN medical_aid_schemes_catalogue c ON c.id = d.scheme_id
        WHERE d.doctor_id = $1
        ORDER BY c.name ASC;`,
      [doctorId]
    );
    return result.rows;
  }

  /**
   * Replaces a doctor's accepted schemes with [schemeIds].
   *
   * A replace rather than a merge, because the UI sends the full selection —
   * a merge would make unticking a scheme impossible. Wrapped in a
   * transaction so a half-applied change cannot leave a doctor advertising
   * cover they do not have.
   */
  static async setForDoctor(doctorId, schemeIds) {
    const unique = [...new Set((schemeIds || []).map(Number).filter(Number.isInteger))];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM doctor_medical_aids WHERE doctor_id = $1;', [doctorId]);

      if (unique.length > 0) {
        // Unknown ids are dropped by the join against the catalogue rather
        // than failing the whole save.
        await client.query(
          `INSERT INTO doctor_medical_aids (doctor_id, scheme_id)
           SELECT $1, c.id
             FROM medical_aid_schemes_catalogue c
            WHERE c.id = ANY($2::int[]) AND c.is_active = TRUE
           ON CONFLICT DO NOTHING;`,
          [doctorId, unique]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return MedicalAid.getForDoctor(doctorId);
  }

  /**
   * Finds a catalogue scheme from whatever a patient typed.
   *
   * Returns null when nothing matches, which callers must treat as "cannot
   * filter by cover" rather than "no doctors cover this patient".
   */
  static async findSchemeByName(rawName) {
    const normalised = normaliseSchemeName(rawName);
    if (!normalised) return null;

    const result = await query(
      `SELECT id, name
         FROM medical_aid_schemes_catalogue
        WHERE normalised_name = $1 AND is_active = TRUE
        LIMIT 1;`,
      [normalised]
    );
    return result.rows[0] || null;
  }

  /** The scheme a patient is on, as free text, or null. */
  static async getPatientSchemeName(patientId) {
    const result = await query(
      'SELECT scheme_name FROM medical_aid_schemes WHERE patient_id = $1 LIMIT 1;',
      [patientId]
    );
    return result.rows[0] ? result.rows[0].scheme_name : null;
  }

  /**
   * Doctor ids accepting [schemeId], for narrowing a search.
   */
  static async doctorIdsAccepting(schemeId) {
    const result = await query(
      'SELECT doctor_id FROM doctor_medical_aids WHERE scheme_id = $1;',
      [schemeId]
    );
    return result.rows.map((r) => r.doctor_id);
  }

  /** The accepted schemes for several doctors at once, keyed by doctor id. */
  static async getForDoctors(doctorIds) {
    const ids = (doctorIds || []).map(Number).filter(Number.isInteger);
    if (ids.length === 0) return {};

    const result = await query(
      `SELECT d.doctor_id, c.id, c.name
         FROM doctor_medical_aids d
         JOIN medical_aid_schemes_catalogue c ON c.id = d.scheme_id
        WHERE d.doctor_id = ANY($1::int[])
        ORDER BY c.name ASC;`,
      [ids]
    );

    const byDoctor = {};
    for (const row of result.rows) {
      (byDoctor[row.doctor_id] ||= []).push({ id: row.id, name: row.name });
    }
    return byDoctor;
  }
}

module.exports = MedicalAid;
