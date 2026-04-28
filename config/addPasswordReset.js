const { query } = require('./db');

/**
 * Migration: Add Password Reset Tokens Table
 * Creates the password_reset_tokens table for managing password reset functionality
 */

async function addPasswordResetTable() {
  try {
    console.log('🔄 Adding password reset tokens table...');

    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        reset_token VARCHAR(500) UNIQUE NOT NULL,
        reset_token_expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        used_at TIMESTAMP,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_email ON password_reset_tokens(email);
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(reset_token);
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(reset_token_expires_at);
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_used ON password_reset_tokens(used);
    `;

    await query(createTableQuery);
    console.log('✅ Password reset tokens table created successfully');

    // Verify table creation
    const verifyQuery = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'password_reset_tokens'
      ORDER BY ordinal_position;
    `;
    
    const result = await query(verifyQuery);
    if (result.rows.length > 0) {
      console.log('📋 Password Reset Tokens Table Columns:');
      result.rows.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type}`);
      });
    }

  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('ℹ️  Password reset tokens table already exists');
    } else {
      console.error('❌ Error creating password reset tokens table:', error);
      throw error;
    }
  }
}

// Run migration if executed directly
if (require.main === module) {
  addPasswordResetTable()
    .then(() => {
      console.log('✅ Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = addPasswordResetTable;
