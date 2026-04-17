const { query } = require('../config/db');

/**
 * Migration: Remove OAuth support from users table
 * Removes OAuth fields and restores original constraints
 */

const runMigration = async () => {
  console.log('🔄 Starting OAuth removal migration...');
  
  try {
    // Remove the auth method constraint
    await query(`
      ALTER TABLE users 
      DROP CONSTRAINT IF EXISTS check_auth_method;
    `);
    console.log('✅ Removed authentication method constraint');

    // Drop OAuth index
    await query(`
      DROP INDEX IF EXISTS idx_users_oauth;
    `);
    console.log('✅ Removed OAuth index');

    // Remove OAuth columns
    await query(`
      ALTER TABLE users 
      DROP COLUMN IF EXISTS oauth_provider,
      DROP COLUMN IF EXISTS oauth_provider_id,
      DROP COLUMN IF EXISTS oauth_profile_picture;
    `);
    console.log('✅ Removed OAuth columns');

    // Restore NOT NULL constraints for standard auth fields
    await query(`
      ALTER TABLE users 
      ALTER COLUMN password_hash SET NOT NULL,
      ALTER COLUMN phone SET NOT NULL,
      ALTER COLUMN id_passport_number SET NOT NULL,
      ALTER COLUMN nationality SET NOT NULL;
    `);
    console.log('✅ Restored NOT NULL constraints');

    console.log('✅ OAuth removal migration completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};

// Run migration if this script is executed directly
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
