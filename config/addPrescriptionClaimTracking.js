const { query } = require('./db');

/**
 * Add prescription claim tracking (one-time use at pharmacy)
 * Ensures prescriptions can only be used once to claim medicine
 */

async function addPrescriptionClaimTracking() {
  console.log('🔄 Adding prescription claim tracking...\n');

  try {
    // Check if claim columns already exist
    const checkColumns = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'prescriptions' 
      AND column_name IN ('claimed', 'claimed_at', 'claimed_by_pharmacy_id')
    `);

    if (checkColumns.rows.length > 0) {
      console.log('✅ Prescription claim columns already exist');
      return;
    }

    // Add claim tracking columns to prescriptions table
    await query(`
      ALTER TABLE prescriptions
      ADD COLUMN claimed BOOLEAN DEFAULT FALSE,
      ADD COLUMN claimed_at TIMESTAMP,
      ADD COLUMN claimed_by_pharmacy_id VARCHAR(100),
      ADD COLUMN claimed_by_pharmacy_name VARCHAR(255),
      ADD COLUMN claim_location JSONB,
      ADD COLUMN claim_verified_at TIMESTAMP,
      ADD COLUMN claim_expires_at TIMESTAMP,
      ADD COLUMN claim_verification_method VARCHAR(50),
      ADD COLUMN claim_notes TEXT;
    `);
    console.log('✅ Added claim tracking columns to prescriptions table');

    // Create prescription_claims table for detailed audit trail
    await query(`
      CREATE TABLE IF NOT EXISTS prescription_claims (
        id SERIAL PRIMARY KEY,
        prescription_id INTEGER NOT NULL UNIQUE REFERENCES prescriptions(id) ON DELETE CASCADE,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        claimed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        pharmacy_id VARCHAR(100),
        pharmacy_name VARCHAR(255) NOT NULL,
        pharmacy_location JSONB,
        claim_method VARCHAR(50) NOT NULL DEFAULT 'QR',
        claim_verification_token VARCHAR(255),
        claim_verified_by VARCHAR(100),
        verified_at TIMESTAMP,
        claimed_by_ip_address VARCHAR(45),
        claimed_device_info TEXT,
        claim_status VARCHAR(50) DEFAULT 'CLAIMED',
        claim_reverted_at TIMESTAMP,
        reverted_reason TEXT,
        reverted_by INTEGER REFERENCES admins(id),
        claim_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Created prescription_claims table');

    // Create indexes for performance
    await query(`
      CREATE INDEX IF NOT EXISTS idx_prescription_claims_prescription_id ON prescription_claims(prescription_id);
      CREATE INDEX IF NOT EXISTS idx_prescription_claims_patient_id ON prescription_claims(patient_id);
      CREATE INDEX IF NOT EXISTS idx_prescription_claims_pharmacy_id ON prescription_claims(pharmacy_id);
      CREATE INDEX IF NOT EXISTS idx_prescription_claims_claimed_at ON prescription_claims(claimed_at);
      CREATE INDEX IF NOT EXISTS idx_prescription_claims_status ON prescription_claims(claim_status);
      CREATE INDEX IF NOT EXISTS idx_prescriptions_claimed ON prescriptions(claimed);
      CREATE INDEX IF NOT EXISTS idx_prescriptions_claim_expires_at ON prescriptions(claim_expires_at);
    `);
    console.log('✅ Created indexes for claim tracking tables');

    // Update prescriptions that don't have claim_expires_at
    await query(`
      UPDATE prescriptions
      SET claim_expires_at = created_at + INTERVAL '30 days'
      WHERE claim_expires_at IS NULL;
    `);
    console.log('✅ Set claim expiry dates for existing prescriptions');

    console.log('\n✅ Prescription claim tracking setup completed successfully!');
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('✅ Prescription claim tracking already exists');
    } else {
      console.error('❌ Error setting up prescription claim tracking:', error);
      throw error;
    }
  }
}

if (require.main === module) {
  addPrescriptionClaimTracking()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = addPrescriptionClaimTracking;
