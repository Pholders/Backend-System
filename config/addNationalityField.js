const { query } = require('../config/db');

/**
 * Migration: Add nationality field
 * Updates users table to add nationality field with CHECK constraint
 */

const runMigration = async () => {
  console.log('🔄 Starting nationality migration...');
  
  try {
    // Add nationality column with CHECK constraint
    await query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS nationality VARCHAR(20) 
      CHECK (nationality IN ('South African', 'Other'));
    `);
    console.log('✅ Added nationality column with constraint');

    // For existing rows, you might want to set a default value
    // Uncomment if you have existing data that needs a default
    /*
    await query(`
      UPDATE users 
      SET nationality = 'Other' 
      WHERE nationality IS NULL;
    `);
    console.log('✅ Set default nationality for existing users');
    */

    // Now make it NOT NULL (skip if you have existing data without nationality)
    /*
    await query(`
      ALTER TABLE users 
      ALTER COLUMN nationality SET NOT NULL;
    `);
    console.log('✅ Made nationality column required');
    */

    console.log('✅ Nationality migration completed successfully');
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
