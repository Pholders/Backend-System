const { query } = require('../config/db');

/**
 * Migration: Add user_type column to OTP table
 * Run with: node config/addUserTypeToOTP.js
 */

async function migrate() {
  try {
    console.log('🔄 Starting migration: Adding user_type to OTP table...\n');

    const alterQuery = `
      ALTER TABLE otps ADD COLUMN IF NOT EXISTS user_type VARCHAR(50) DEFAULT 'patient';
    `;

    await query(alterQuery);
    console.log('✅ user_type column added to otps table');

    console.log('\n✅ Migration completed successfully!\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

if (require.main === module) { migrate(); }

module.exports = { migrate };
