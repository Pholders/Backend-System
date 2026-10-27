const { query } = require('./db');

// Medications created when a prescription is dispensed point back at the
// prescription item they came from. The unique index stops a retried
// dispense from creating the same medication twice. Runs after the
// prescription tables exist, since medications is created before them.
async function linkMedicationsToPrescriptions() {
  try {
    await query(`
      ALTER TABLE medications
      ADD COLUMN IF NOT EXISTS prescription_id INTEGER
        REFERENCES prescriptions(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS prescription_item_id INTEGER
        REFERENCES prescription_items(id) ON DELETE SET NULL
    `);

    await query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_medications_prescription_item
      ON medications(prescription_item_id)
      WHERE prescription_item_id IS NOT NULL
    `);

    console.log('✅ Linked medications to prescriptions');
  } catch (error) {
    console.error('❌ Error linking medications to prescriptions:', error);
    throw error;
  }
}

if (require.main === module) {
  linkMedicationsToPrescriptions()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { linkMedicationsToPrescriptions };
