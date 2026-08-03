const { query } = require('./db');

/**
 * Migration: Add Email Verification Columns
 * Adds email_verified and email_verified_at columns to the patients table
 * so signup can require proof of email ownership before login is allowed.
 *
 * Existing patients are backfilled to email_verified = true so they are not
 * locked out by the new login gate.
 */
async function addEmailVerificationColumns() {
  try {
    console.log('🔄 Adding email verification columns to patients...');

    await query(`
      ALTER TABLE patients
      ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;
    `);
    console.log('✅ Added email_verified column');

    await query(`
      ALTER TABLE patients
      ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP NULL;
    `);
    console.log('✅ Added email_verified_at column');

    await query(`
      CREATE INDEX IF NOT EXISTS idx_patients_email_verified ON patients(email_verified);
    `);
    console.log('✅ Created index on email_verified');

    // Backfill existing patients: trust accounts that existed before this feature
    const backfill = await query(`
      UPDATE patients
      SET email_verified = true,
          email_verified_at = COALESCE(email_verified_at, created_at, CURRENT_TIMESTAMP)
      WHERE email_verified = false
        AND created_at < CURRENT_TIMESTAMP;
    `);
    console.log(`✅ Backfilled ${backfill.rowCount} existing patient(s) as verified`);

    // Verify columns
    const verifyQuery = `
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'patients'
        AND column_name IN ('email_verified', 'email_verified_at')
      ORDER BY column_name;
    `;
    const result = await query(verifyQuery);
    console.log('📋 Email verification columns:');
    result.rows.forEach((col) => {
      console.log(`   - ${col.column_name}: ${col.data_type} (default: ${col.column_default}, nullable: ${col.is_nullable})`);
    });
  } catch (error) {
    console.error('❌ Error adding email verification columns:', error);
    throw error;
  }
}

if (require.main === module) {
  addEmailVerificationColumns()
    .then(() => {
      console.log('✅ Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

if (require.main === module) {
  addEmailVerificationColumns()
    .then(() => {
      console.log('✅ Email verification migration completed');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}

module.exports = addEmailVerificationColumns;
