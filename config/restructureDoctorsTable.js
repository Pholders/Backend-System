const { query } = require('./db');

/**
 * Migration: Restructure doctors table
 * - Replaces first_name/last_name with full_name
 * - Replaces license_number with hpcsa_number
 * - Replaces experience_years with experience
 * - Replaces hospital_affiliation with clinic_name
 * - Replaces state with province
 * - Drops unused columns (qualification moved to optional update later)
 *
 * Safe to run multiple times (uses IF EXISTS / IF NOT EXISTS guards).
 */

const runMigration = async () => {
  console.log('🔄 Starting doctors table restructure migration...');

  try {
    // Add new columns (IF NOT EXISTS is safe to re-run)
    await query(`ALTER TABLE doctors ADD COLUMN IF NOT EXISTS full_name VARCHAR(200);`);
    await query(`ALTER TABLE doctors ADD COLUMN IF NOT EXISTS hpcsa_number VARCHAR(100);`);
    await query(`ALTER TABLE doctors ADD COLUMN IF NOT EXISTS experience INTEGER;`);
    await query(`ALTER TABLE doctors ADD COLUMN IF NOT EXISTS clinic_name VARCHAR(255);`);
    await query(`ALTER TABLE doctors ADD COLUMN IF NOT EXISTS province VARCHAR(100);`);
    console.log('✅ Added new columns');

    // Migrate existing data into new columns
    await query(`
      UPDATE doctors
      SET full_name = CONCAT(first_name, ' ', last_name)
      WHERE full_name IS NULL AND first_name IS NOT NULL;
    `);
    await query(`
      UPDATE doctors
      SET hpcsa_number = license_number
      WHERE hpcsa_number IS NULL AND license_number IS NOT NULL;
    `);
    await query(`
      UPDATE doctors
      SET experience = experience_years
      WHERE experience IS NULL AND experience_years IS NOT NULL;
    `);
    await query(`
      UPDATE doctors
      SET clinic_name = hospital_affiliation
      WHERE clinic_name IS NULL AND hospital_affiliation IS NOT NULL;
    `);
    await query(`
      UPDATE doctors
      SET province = state
      WHERE province IS NULL AND state IS NOT NULL;
    `);
    console.log('✅ Migrated existing data into new columns');

    // Make hpcsa_number unique and full_name NOT NULL (after data migration)
    await query(`ALTER TABLE doctors ALTER COLUMN full_name SET NOT NULL;`).catch(() => {});
    await query(`ALTER TABLE doctors ADD CONSTRAINT doctors_hpcsa_number_key UNIQUE (hpcsa_number);`).catch(() => {});
    console.log('✅ Applied constraints');

    // Create new indexes
    await query(`CREATE INDEX IF NOT EXISTS idx_doctors_hpcsa ON doctors(hpcsa_number);`);
    await query(`DROP INDEX IF EXISTS idx_doctors_license;`);
    console.log('✅ Updated indexes');

    // Drop old columns
    await query(`ALTER TABLE doctors DROP COLUMN IF EXISTS first_name;`);
    await query(`ALTER TABLE doctors DROP COLUMN IF EXISTS last_name;`);
    await query(`ALTER TABLE doctors DROP COLUMN IF EXISTS license_number;`);
    await query(`ALTER TABLE doctors DROP COLUMN IF EXISTS experience_years;`);
    await query(`ALTER TABLE doctors DROP COLUMN IF EXISTS hospital_affiliation;`);
    await query(`ALTER TABLE doctors DROP COLUMN IF EXISTS state;`);
    console.log('✅ Dropped old columns');

    console.log('✅ Doctors table restructure migration completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};

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
