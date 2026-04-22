const { query } = require('./db');

const runMigration = async () => {
  console.log('🔄 Restructuring pharmacies table...');
  try {
    // Add new columns
    await query(`ALTER TABLE pharmacies ADD COLUMN IF NOT EXISTS pharmacy_name VARCHAR(255)`);
    await query(`ALTER TABLE pharmacies ADD COLUMN IF NOT EXISTS first_name VARCHAR(100)`);
    await query(`ALTER TABLE pharmacies ADD COLUMN IF NOT EXISTS last_name VARCHAR(100)`);
    await query(`ALTER TABLE pharmacies ADD COLUMN IF NOT EXISTS province VARCHAR(100)`);

    // Migrate existing data
    await query(`UPDATE pharmacies SET pharmacy_name = name WHERE pharmacy_name IS NULL AND name IS NOT NULL`);
    await query(`UPDATE pharmacies SET first_name = SPLIT_PART(owner_name, ' ', 1) WHERE first_name IS NULL AND owner_name IS NOT NULL`);
    await query(`UPDATE pharmacies SET last_name = TRIM(SUBSTRING(owner_name FROM POSITION(' ' IN owner_name))) WHERE last_name IS NULL AND owner_name IS NOT NULL`);
    await query(`UPDATE pharmacies SET province = state WHERE province IS NULL AND state IS NOT NULL`);
    console.log('✅ Migrated existing data');

    // Make address nullable (was NOT NULL before)
    await query(`ALTER TABLE pharmacies ALTER COLUMN address DROP NOT NULL`);
    await query(`ALTER TABLE pharmacies ALTER COLUMN city DROP NOT NULL`);

    // Re-apply NOT NULL on new required columns (only if table has data, skip errors)
    await query(`ALTER TABLE pharmacies ALTER COLUMN province DROP NOT NULL`).catch(() => {});

    // Drop old columns
    await query(`ALTER TABLE pharmacies DROP COLUMN IF EXISTS name`);
    await query(`ALTER TABLE pharmacies DROP COLUMN IF EXISTS owner_name`);
    await query(`ALTER TABLE pharmacies DROP COLUMN IF EXISTS registration_number`);
    await query(`ALTER TABLE pharmacies DROP COLUMN IF EXISTS state`);
    console.log('✅ Dropped old columns');

    console.log('✅ Pharmacies table restructure completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

runMigration();
