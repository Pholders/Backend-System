const { query } = require('./db');

const runMigration = async () => {
  console.log('🔄 Renaming users table to patients...');
  try {
    await query('ALTER TABLE users RENAME TO patients');
    console.log('✅ Table renamed: users → patients');

    // Rename indexes
    await query('ALTER INDEX IF EXISTS idx_users_email RENAME TO idx_patients_email');
    await query('ALTER INDEX IF EXISTS idx_users_id_passport RENAME TO idx_patients_id_passport');
    await query('ALTER INDEX IF EXISTS idx_users_status RENAME TO idx_patients_status');
    console.log('✅ Indexes renamed');

    console.log('✅ Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

runMigration();
