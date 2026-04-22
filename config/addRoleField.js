const { query } = require('../config/db');

/**
 * Migration: Add role field to users table
 * Adds a role column with a default of 'patient'
 */

const runMigration = async () => {
  console.log('🔄 Starting role field migration...');

  try {
    // Add role column with CHECK constraint
    await query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'patient'
      CHECK (role IN ('patient', 'admin'));
    `);
    console.log('✅ Added role column');

    // Set existing users to 'patient'
    await query(`
      UPDATE users 
      SET role = 'patient' 
      WHERE role IS NULL;
    `);
    console.log('✅ Set default role for existing users');

    console.log('✅ Role migration completed successfully');
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
