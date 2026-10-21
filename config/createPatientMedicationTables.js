const { query } = require('./db');

async function runMigration() {
  await query(`
    CREATE TABLE IF NOT EXISTS medications (
      id VARCHAR(64) PRIMARY KEY,
      patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      name VARCHAR(150) NOT NULL,
      type VARCHAR(100) NOT NULL,
      dosage VARCHAR(250) NOT NULL,
      schedule JSONB NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'critical', 'past')),
      adherence_percent INTEGER NOT NULL DEFAULT 0 CHECK (adherence_percent BETWEEN 0 AND 100),
      prescribed_by VARCHAR(150) NOT NULL,
      issued_date DATE NOT NULL,
      indication VARCHAR(500) NOT NULL,
      refills_remaining INTEGER NOT NULL CHECK (refills_remaining >= 0),
      supply_unit VARCHAR(50) NOT NULL,
      next_refill_date DATE,
      notes VARCHAR(2000),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK (end_date >= start_date),
      CHECK (next_refill_date IS NULL OR next_refill_date >= issued_date)
    );

    CREATE TABLE IF NOT EXISTS medication_attachments (
      id VARCHAR(64) PRIMARY KEY,
      medication_id VARCHAR(64) NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
      type VARCHAR(20) NOT NULL CHECK (type IN ('medication_photo', 'prescription')),
      file_name VARCHAR(255) NOT NULL,
      content_type VARCHAR(100) NOT NULL,
      storage_key VARCHAR(400) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_medications_patient_id
      ON medications(patient_id, start_date DESC);
    CREATE INDEX IF NOT EXISTS idx_medication_attachments_medication_id
      ON medication_attachments(medication_id);
  `);
}

if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('Patient medication tables are ready');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed to create patient medication tables:', error);
      process.exit(1);
    });
}

module.exports = { runMigration };
