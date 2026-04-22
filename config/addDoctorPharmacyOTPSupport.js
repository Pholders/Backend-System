const { query } = require('./db');

/**
 * Migration: Add doctor/pharmacy OTP support
 * - Drops the FK constraint on otps.user_id so it can hold doctor/pharmacy IDs
 * - Adds user_type column to distinguish between patient, doctor, pharmacy
 */

const runMigration = async () => {
  console.log('🔄 Starting doctor/pharmacy OTP support migration...');

  try {
    // Drop the foreign key constraint so otps can reference any entity
    await query(`
      ALTER TABLE otps
        DROP CONSTRAINT IF EXISTS otps_user_id_fkey;
    `);
    console.log('✅ Dropped FK constraint on otps.user_id');

    // Add user_type column if it doesn't exist
    await query(`
      ALTER TABLE otps
        ADD COLUMN IF NOT EXISTS user_type VARCHAR(20) NOT NULL DEFAULT 'patient';
    `);
    console.log('✅ Added user_type column to otps table');

    // Add index on user_type for faster queries
    await query(`
      CREATE INDEX IF NOT EXISTS idx_otps_user_type ON otps(user_type);
    `);
    console.log('✅ Created index on otps.user_type');

    console.log('✅ Doctor/pharmacy OTP support migration completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};

if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('👍 Migration successful');
      process.exit(0);
    })
    .catch((error) => {
      console.error('👎 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { runMigration };
