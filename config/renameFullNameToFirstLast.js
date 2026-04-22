const { query } = require('./db');

const runMigration = async () => {
  console.log('🔄 Replacing full_name with first_name + last_name in doctors table...');
  try {
    await query('ALTER TABLE doctors ADD COLUMN IF NOT EXISTS first_name VARCHAR(100)');
    await query('ALTER TABLE doctors ADD COLUMN IF NOT EXISTS last_name VARCHAR(100)');

    // Split existing full_name data: first word → first_name, remainder → last_name
    await query(`
      UPDATE doctors
      SET first_name = SPLIT_PART(full_name, ' ', 1),
          last_name  = TRIM(SUBSTRING(full_name FROM POSITION(' ' IN full_name)))
      WHERE first_name IS NULL AND full_name IS NOT NULL
    `);

    await query('ALTER TABLE doctors DROP COLUMN IF EXISTS full_name');
    await query('ALTER TABLE doctors ALTER COLUMN first_name SET NOT NULL');
    await query('ALTER TABLE doctors ALTER COLUMN last_name SET NOT NULL');

    console.log('✅ Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

runMigration();
