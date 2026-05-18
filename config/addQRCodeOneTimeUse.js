const { query } = require('./db');

/**
 * Add one-time use QR code tracking to prescriptions
 * Enables view-once QR code feature for secure prescription access
 */

async function addQRCodeOneTimeUseTracking() {
  console.log('🔄 Adding one-time use QR code tracking...\n');

  try {
    // Create QR code access tracking table
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS prescription_qr_access (
        id SERIAL PRIMARY KEY,
        prescription_id INTEGER NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
        qr_token VARCHAR(255) UNIQUE NOT NULL,
        accessed BOOLEAN DEFAULT FALSE,
        accessed_at TIMESTAMP,
        accessed_by_ip VARCHAR(50),
        access_device_info TEXT,
        expires_at TIMESTAMP,
        max_access_count INTEGER DEFAULT 1,
        access_count INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_qr_access_prescription ON prescription_qr_access(prescription_id);
      CREATE INDEX IF NOT EXISTS idx_qr_access_token ON prescription_qr_access(qr_token);
      CREATE INDEX IF NOT EXISTS idx_qr_access_accessed ON prescription_qr_access(accessed);
      CREATE INDEX IF NOT EXISTS idx_qr_access_active ON prescription_qr_access(is_active);
    `;

    await query(createTableQuery);
    console.log('✅ QR access tracking table created successfully\n');

    // Add QR tracking columns to prescriptions table
    const addColumnsQuery = `
      ALTER TABLE prescriptions
      ADD COLUMN IF NOT EXISTS qr_code_token VARCHAR(255),
      ADD COLUMN IF NOT EXISTS qr_code_one_time_use BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS qr_code_accessed BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS qr_code_accessed_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS qr_code_expires_at TIMESTAMP;

      CREATE INDEX IF NOT EXISTS idx_prescriptions_qr_token ON prescriptions(qr_code_token);
      CREATE INDEX IF NOT EXISTS idx_prescriptions_qr_accessed ON prescriptions(qr_code_accessed);
    `;

    await query(addColumnsQuery);
    console.log('✅ QR tracking columns added to prescriptions table\n');

    console.log(`
      📋 Changes made:
      • Created prescription_qr_access table for detailed tracking
      • Added qr_code_token to prescriptions
      • Added qr_code_one_time_use flag (default: TRUE)
      • Added qr_code_accessed flag (tracks first access)
      • Added qr_code_accessed_at timestamp
      • Added qr_code_expires_at for 90-day expiry

      🔐 One-Time Use Feature:
      • Patient gets QR code that's valid for first scan only
      • After first access, QR code is marked as used
      • System records IP address and device info
      • Further access attempts rejected
      • Audit trail tracks who accessed when

      ⏰ Expiry:
      • QR codes expire after 90 days
      • Or after first access (whichever comes first)
      • System returns: "QR code already used" error on repeat access
    `);

    return true;
  } catch (error) {
    console.error('❌ Error adding QR code tracking:', error.message);
    throw error;
  }
}

// Execute if run directly
if (require.main === module) {
  addQRCodeOneTimeUseTracking()
    .then(() => {
      console.log('✅ Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = addQRCodeOneTimeUseTracking;
