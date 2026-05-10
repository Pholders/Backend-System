const { pool } = require('./db');

/**
 * Migration: Convert OTP codes to hashed storage
 * Updates the otps table to use hashed OTP codes for security
 */

async function migrateOTPToHashed() {
  try {
    console.log('🔄 Migrating OTP table to use hashed codes...');

    // Drop the old index on otp_code if it exists
    await pool.query(`
      DROP INDEX IF EXISTS idx_otps_code;
    `);
    console.log('✅ Dropped old otp_code index');

    // Drop the old otp_code column and add otp_hash
    await pool.query(`
      ALTER TABLE otps 
      DROP COLUMN IF EXISTS otp_code,
      ADD COLUMN IF NOT EXISTS otp_hash VARCHAR(255) NOT NULL DEFAULT '';
    `);
    console.log('✅ Updated otps table schema');

    // Verify the migration
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'otps'
      ORDER BY ordinal_position;
    `);

    console.log('✅ Current otps table schema:');
    result.rows.forEach(row => {
      console.log(`   - ${row.column_name}: ${row.data_type}`);
    });

    console.log('✅ OTP migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

migrateOTPToHashed();
