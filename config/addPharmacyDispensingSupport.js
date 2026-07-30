const { query } = require('./db');

/**
 * Add pharmacy dispensing support
 * Allows pharmacies to track when they dispense medicines from prescriptions
 */

async function addPharmacyDispensingSupport() {
  console.log('🔄 Adding pharmacy dispensing support...\n');

  try {
    // Check if dispensing columns already exist
    const checkColumns = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'prescriptions' 
      AND column_name IN ('is_dispensed', 'dispensed_at', 'dispensed_by_pharmacy_id')
    `);

    if (checkColumns.rows.length > 0) {
      console.log('✅ Prescription dispensing columns already exist');
    } else {
      // Add dispensing tracking columns to prescriptions table
      await query(`
        ALTER TABLE prescriptions
        ADD COLUMN is_dispensed BOOLEAN DEFAULT FALSE,
        ADD COLUMN dispensed_at TIMESTAMP,
        ADD COLUMN dispensed_by_pharmacy_id VARCHAR(100),
        ADD COLUMN dispensed_by_pharmacy_name VARCHAR(255),
        ADD COLUMN dispensing_notes TEXT;
      `);
      console.log('✅ Added dispensing tracking columns to prescriptions table');
    }

    // Check if prescription_dispensing table already exists
    const checkTable = await query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'prescription_dispensing');
    `);

    if (!checkTable.rows[0].exists) {
      // Create prescription_dispensing table for detailed audit trail
      await query(`
        CREATE TABLE IF NOT EXISTS prescription_dispensing (
          id SERIAL PRIMARY KEY,
          prescription_id INTEGER NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
          patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          pharmacy_id VARCHAR(100) NOT NULL,
          pharmacy_name VARCHAR(255) NOT NULL,
          dispensed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          dispensed_by_staff_id INTEGER REFERENCES pharmacies(id),
          dispensed_by_staff_name VARCHAR(255),
          dispense_status VARCHAR(50) DEFAULT 'DISPENSED',
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('✅ Created prescription_dispensing table');

      // Create indexes for performance
      await query(`
        CREATE INDEX IF NOT EXISTS idx_prescription_dispensing_prescription_id ON prescription_dispensing(prescription_id);
        CREATE INDEX IF NOT EXISTS idx_prescription_dispensing_patient_id ON prescription_dispensing(patient_id);
        CREATE INDEX IF NOT EXISTS idx_prescription_dispensing_pharmacy_id ON prescription_dispensing(pharmacy_id);
        CREATE INDEX IF NOT EXISTS idx_prescription_dispensing_dispensed_at ON prescription_dispensing(dispensed_at);
        CREATE INDEX IF NOT EXISTS idx_prescriptions_is_dispensed ON prescriptions(is_dispensed);
        CREATE INDEX IF NOT EXISTS idx_prescriptions_dispensed_at ON prescriptions(dispensed_at);
      `);
      console.log('✅ Created indexes for dispensing tables');
    } else {
      console.log('✅ Prescription dispensing table already exists');
    }

    console.log('\n✅ Pharmacy dispensing support setup completed successfully!');
  } catch (error) {
    if (error.message.includes('already exists') || error.message.includes('duplicate key')) {
      console.log('✅ Pharmacy dispensing support already configured');
    } else {
      console.error('❌ Error setting up pharmacy dispensing support:', error);
      throw error;
    }
  }
}

if (require.main === module) {
  addPharmacyDispensingSupport()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = addPharmacyDispensingSupport;
