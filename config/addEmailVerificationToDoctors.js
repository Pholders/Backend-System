const { query } = require('./db');

/**
 * Add Email Verification Fields to Doctors Table
 * Adds email_verified and email_verified_at columns for account activation
 */
async function addEmailVerificationToDoctors() {
  try {
    console.log('🔄 Adding email verification fields to doctors table...');

    // Check if columns already exist
    const checkQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'doctors' AND column_name = 'email_verified'
      )
    `;
    const result = await query(checkQuery);
    
    if (result.rows[0].exists) {
      console.log('✅ Email verification fields already exist in doctors table');
      return;
    }

    // Add columns
    const alterQuery = `
      ALTER TABLE doctors
      ADD COLUMN email_verified BOOLEAN DEFAULT false,
      ADD COLUMN email_verified_at TIMESTAMP;
    `;

    await query(alterQuery);
    console.log('✅ Email verification fields added to doctors table successfully');

  } catch (error) {
    console.error('❌ Error adding email verification to doctors table:', error);
    throw error;
  }
}

// Run migration
addEmailVerificationToDoctors().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
