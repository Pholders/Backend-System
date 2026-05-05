const { pool } = require('./db');

/**
 * Migration: Create Refresh Tokens Table
 * Stores refresh tokens for long-lived authentication sessions
 */

async function createRefreshTokensTable() {
  try {
    console.log('🔄 Creating refresh_tokens table...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        user_type VARCHAR(50) NOT NULL,
        token_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        device_info TEXT,
        is_revoked BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✅ Created refresh_tokens table');

    // Create indexes for faster queries
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id 
      ON refresh_tokens(user_id);
    `);

    console.log('✅ Created index on user_id');

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires 
      ON refresh_tokens(expires_at);
    `);

    console.log('✅ Created index on expires_at');

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_revoked 
      ON refresh_tokens(is_revoked);
    `);

    console.log('✅ Created index on is_revoked');

    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

createRefreshTokensTable();
