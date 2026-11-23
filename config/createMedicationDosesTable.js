const { pool } = require('./db');

// One row per scheduled dose of a medication. The reminder job creates the
// rows from medications.schedule, reminds the patient when each is due, and
// marks the ones nobody logged as missed. Adherence is worked out from these
// rows (see services/medicationDoseService.js).
//
// dose_tracking_from on medications says from when doses are tracked. Adding
// it with DEFAULT now() stamps existing medications with the time this
// migration first ran, so they are not back-filled with doses from before
// tracking existed (which would all count as missed). New medications get
// their insert time.
async function runMigration(db = pool) {
  await db.query(`
    ALTER TABLE medications
      ADD COLUMN IF NOT EXISTS dose_tracking_from TIMESTAMPTZ NOT NULL DEFAULT now();

    CREATE TABLE IF NOT EXISTS medication_doses (
      id BIGSERIAL PRIMARY KEY,
      medication_id VARCHAR(64) NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
      patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      scheduled_at TIMESTAMPTZ NOT NULL,
      status VARCHAR(10) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'taken', 'skipped', 'missed')),
      taken_at TIMESTAMPTZ,
      reminded_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (medication_id, scheduled_at),
      CHECK ((status = 'taken') = (taken_at IS NOT NULL))
    );

    CREATE INDEX IF NOT EXISTS idx_medication_doses_patient_scheduled
      ON medication_doses(patient_id, scheduled_at);
    CREATE INDEX IF NOT EXISTS idx_medication_doses_pending
      ON medication_doses(scheduled_at) WHERE status = 'pending';
  `);
}

if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('medication_doses table is ready');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed to create medication_doses table:', error);
      process.exit(1);
    });
}

module.exports = { runMigration };
