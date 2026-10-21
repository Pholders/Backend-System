const { query } = require('./db');

async function addPrescriptionPdfSnapshots() {
  try {
    await query(`
      ALTER TABLE prescriptions
      ADD COLUMN IF NOT EXISTS prescription_pdf_path TEXT
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_prescriptions_pdf_path
      ON prescriptions(prescription_pdf_path)
      WHERE prescription_pdf_path IS NOT NULL
    `);

    console.log('✅ Added prescription PDF snapshot storage');
  } catch (error) {
    console.error('❌ Error adding prescription PDF snapshot storage:', error);
    throw error;
  }
}

if (require.main === module) {
  addPrescriptionPdfSnapshots()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { addPrescriptionPdfSnapshots };
