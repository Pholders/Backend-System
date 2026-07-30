const Prescription = require('../models/Prescription');

/**
 * Create e-Prescribing tables
 * Migrates database to support prescription management system
 */

async function createPrescriptionTables() {
  console.log('🔄 Creating e-Prescribing tables...\n');

  try {
    // Create main prescriptions table
    await Prescription.createTable();

    // Create prescription items table
    await Prescription.createItemsTable();

    // Create prescription shares audit table
    await Prescription.createShareAuditTable();

    console.log('\n✅ All e-Prescribing tables created successfully!');
    console.log(`
      📋 Tables created:
      1. prescriptions - Main prescription records with AES signature support
      2. prescription_items - Individual medicines per prescription
      3. prescription_shares - Audit trail for prescription sharing

      🔑 Key Features:
      • Digital signatures with OTP verification
      • Drug interaction checking
      • QR code support for sharing
      • Audit trails for all activities
      • Support for all medicine schedule classifications
      • Revocation capability
      • Share audit trail
    `);

    return true;
  } catch (error) {
    console.error('❌ Error creating e-Prescribing tables:', error.message);
    throw error;
  }
}

// Execute if run directly
if (require.main === module) {
  createPrescriptionTables()
    .then(() => {
      console.log('✅ Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = createPrescriptionTables;
