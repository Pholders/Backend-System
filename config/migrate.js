const { query } = require('../config/db');

/**
 * Migration: Add id_passport_number and phone as required
 * Updates users table to add id_passport_number field and make phone required
 */

const runMigration = async () => {
  console.log('🔄 Starting migration...');
  
  try {
    // Add id_passport_number column if it doesn't exist
    await query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS id_passport_number VARCHAR(50) UNIQUE;
    `);
    console.log('✅ Added id_passport_number column');

    // Create index for id_passport_number
    await query(`
      CREATE INDEX IF NOT EXISTS idx_users_id_passport ON users(id_passport_number);
    `);
    console.log('✅ Created index for id_passport_number');

    // Make phone column NOT NULL (if you want existing records to not break, skip this)
    // Note: This will fail if there are existing records with NULL phone numbers
    // Uncomment the following if you want to make phone required:
    /*
    await query(`
      ALTER TABLE users 
      ALTER COLUMN phone SET NOT NULL;
    `);
    console.log('✅ Made phone column required');
    */

    console.log('✅ Migration completed successfully');
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
