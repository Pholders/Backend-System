const { query } = require('./db');

const runMigration = async () => {
  console.log('🔄 Starting refresh_tokens table migration...');
  
  try {
    // Create refresh_tokens table
    await query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('patient', 'doctor', 'pharmacy', 'admin')),
        token_hash VARCHAR(255) NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        is_revoked BOOLEAN DEFAULT FALSE,
        device_info VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Created refresh_tokens table');

    // Create indexes for performance
    await query(`
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id, user_type);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active ON refresh_tokens(is_revoked, expires_at);
    `);
    console.log('✅ Created indexes on refresh_tokens table');

    // Skip if constraint already exists (idempotent)
    const constraintExists = await query(`
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_name = 'refresh_tokens' AND constraint_name = 'chk_valid_user_type'
    `);
    if (constraintExists.rows.length === 0) {
      await query(`
        ALTER TABLE refresh_tokens 
        ADD CONSTRAINT chk_valid_user_type 
        CHECK (user_type IN ('patient', 'doctor', 'pharmacy', 'admin'));
      `);
      console.log('✅ Added check constraint for user_type');
    } else {
      console.log('ℹ️  Check constraint already exists or not needed');
    }

    console.log('✅ Refresh tokens table migration completed successfully');
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
      console.log('👍 Migration successful - refresh_tokens table ready!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('👎 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { runMigration };