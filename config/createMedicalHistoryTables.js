const { query } = require('./db');

/**
 * Patient-entered medical history. Conditions and allergies already have
 * tables (patient_medical_conditions, patient_allergies); surgeries and
 * family history are new.
 */
async function runMigration() {
  await query(`
    CREATE TABLE IF NOT EXISTS patient_surgeries (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      procedure_name VARCHAR(200) NOT NULL,
      surgery_date DATE,
      hospital VARCHAR(200),
      notes VARCHAR(2000),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS patient_family_history (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      relative VARCHAR(100) NOT NULL,
      condition_name VARCHAR(200) NOT NULL,
      notes VARCHAR(2000),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_patient_surgeries_patient_id
      ON patient_surgeries(patient_id, surgery_date DESC);
    CREATE INDEX IF NOT EXISTS idx_patient_family_history_patient_id
      ON patient_family_history(patient_id);
  `);

  // The app records a condition as chronic, acute or resolved; the original
  // check only knew active, resolved and remission. Widened once, in place.
  await query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'patient_medical_conditions_status_check'
          AND pg_get_constraintdef(oid) NOT LIKE '%chronic%'
      ) THEN
        ALTER TABLE patient_medical_conditions
          DROP CONSTRAINT patient_medical_conditions_status_check;
        ALTER TABLE patient_medical_conditions
          ADD CONSTRAINT patient_medical_conditions_status_check
          CHECK (status IN ('active', 'chronic', 'acute', 'resolved', 'remission'));
      END IF;
    END $$;
  `);
}

if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('Medical history tables are ready');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed to create medical history tables:', error);
      process.exit(1);
    });
}

module.exports = { runMigration };
