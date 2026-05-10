const { query } = require('../config/db');

/**
 * Migration: Add OAuth support to users table
 * Adds OAuth fields for Google and other OAuth providers
 */

const runMigration = async () => {
  console.log('🔄 Starting OAuth support migration...');
  
  try {
    // Add OAuth columns if they don't exist
    await query(`
      ALTER TABLE patients 
      ADD COLUMN IF NOT EXISTS oauth_provider VARCHAR(50),
      ADD COLUMN IF NOT EXISTS oauth_provider_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS oauth_profile_picture TEXT;
    `);
    console.log('✅ Added OAuth columns');

    // Make password_hash nullable for OAuth users
    await query(`
      ALTER TABLE patients 
      ALTER COLUMN password_hash DROP NOT NULL;
    `);
    console.log('✅ Made password_hash nullable for OAuth users');

    // Create index for OAuth lookups
    await query(`
      CREATE INDEX IF NOT EXISTS idx_patients_oauth_provider 
      ON patients(oauth_provider, oauth_provider_id);
    `);
    console.log('✅ Created OAuth index');

    // Add authentication method check constraint
    await query(`
      ALTER TABLE patients 
      DROP CONSTRAINT IF EXISTS check_auth_method;
    `);
    console.log('✅ Dropped old auth method constraint if exists');

    console.log('✅ OAuth support migration completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};

// Run migration if this file is executed directly
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('✅ Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = runMigration;
