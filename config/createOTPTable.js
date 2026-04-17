const { query } = require('../config/db');

/**
 * Migration: Create OTPs table
 * Creates table to store one-time passwords for authentication
 */

const runMigration = async () => {
  console.log('🔄 Starting OTP table migration...');
  
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS otps (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        otp_code VARCHAR(6) NOT NULL,
        purpose VARCHAR(50) NOT NULL DEFAULT 'login',
        expires_at TIMESTAMP NOT NULL,
        is_used BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Created otps table');

    await query(`
      CREATE INDEX IF NOT EXISTS idx_otps_user_id ON otps(user_id);
      CREATE INDEX IF NOT EXISTS idx_otps_code ON otps(otp_code);
      CREATE INDEX IF NOT EXISTS idx_otps_expires ON otps(expires_at);
    `);
    console.log('✅ Created indexes on otps table');

    console.log('✅ OTP table migration completed successfully');
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
