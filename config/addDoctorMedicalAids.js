const { query } = require('./db');

/**
 * Migration: which medical aids a doctor accepts
 *   - medical_aid_schemes_catalogue  (canonical scheme list)
 *   - doctor_medical_aids            (doctor -> scheme)
 *
 * Phase 1 asks that a patient can find "a doctor that's covered by medical
 * plan", and the SRS has doctor search filtered by medical aid acceptance.
 * Nothing on the doctors table recorded that, so there was nothing to filter.
 *
 * Patients store their scheme as free text in medical_aid_schemes.scheme_name,
 * so matching a doctor to a patient by that string alone would fail on
 * "Discovery" vs "Discovery Health". Rather than migrate the patient side —
 * which would drag the patient app into this — the catalogue holds a
 * normalised form and the patient's free text is normalised the same way at
 * match time. The patient tables are untouched.
 *
 * Additive and idempotent: no column is dropped, no row rewritten.
 */

/// Schemes registered with the Council for Medical Schemes that cover most of
/// the private market. Adding to this list later is just another seed run.
const SCHEMES = [
  'Discovery Health Medical Scheme',
  'Momentum Health',
  'Bonitas Medical Fund',
  'Fedhealth Medical Scheme',
  'Medihelp',
  'Bestmed Medical Scheme',
  'Government Employees Medical Scheme (GEMS)',
  'Polmed',
  'Profmed',
  'Medshield Medical Scheme',
  'Sizwe Hosmed Medical Scheme',
  'Keyhealth',
  'Thebemed',
  'Camaf',
  'Bankmed',
  'LA Health Medical Scheme',
  'Umvuzo Health Medical Scheme',
  'Compcare Wellness Medical Scheme',
  'Genesis Medical Scheme',
  'Massmart Health Plan',
];

/**
 * Reduces a scheme name to something comparable.
 *
 * Drops punctuation, the words every scheme shares, and anything in brackets,
 * so "Discovery Health Medical Scheme", "Discovery Health" and "discovery"
 * all land on "discovery". Exported because the matcher has to normalise the
 * patient's free text exactly the same way.
 */
function normaliseSchemeName(raw) {
  if (!raw) return '';
  return String(raw)
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(medical|scheme|schemes|fund|health|plan|society|the)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const runMigration = async () => {
  try {
    console.log('🔄 Adding doctor medical aid acceptance...');

    await query(`
      CREATE TABLE IF NOT EXISTS medical_aid_schemes_catalogue (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        normalised_name VARCHAR(255) NOT NULL UNIQUE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_scheme_catalogue_normalised
        ON medical_aid_schemes_catalogue(normalised_name);
    `);
    console.log('✅ medical_aid_schemes_catalogue ready');

    for (const name of SCHEMES) {
      const normalised = normaliseSchemeName(name);
      if (!normalised) continue;
      // Re-running must not duplicate or clobber a name an admin has edited.
      await query(
        `INSERT INTO medical_aid_schemes_catalogue (name, normalised_name)
         VALUES ($1, $2)
         ON CONFLICT (normalised_name) DO NOTHING;`,
        [name, normalised]
      );
    }
    console.log(`✅ Seeded ${SCHEMES.length} medical aid schemes`);

    await query(`
      CREATE TABLE IF NOT EXISTS doctor_medical_aids (
        doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
        scheme_id INTEGER NOT NULL REFERENCES medical_aid_schemes_catalogue(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (doctor_id, scheme_id)
      );

      CREATE INDEX IF NOT EXISTS idx_doctor_medical_aids_doctor
        ON doctor_medical_aids(doctor_id);
      CREATE INDEX IF NOT EXISTS idx_doctor_medical_aids_scheme
        ON doctor_medical_aids(scheme_id);
    `);
    console.log('✅ doctor_medical_aids ready');

    console.log('✅ Doctor medical aid migration completed');
    return true;
  } catch (error) {
    console.error('❌ Doctor medical aid migration failed:', error);
    throw error;
  }
};

if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { runMigration, normaliseSchemeName, SCHEMES };
