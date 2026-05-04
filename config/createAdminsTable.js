const { query } = require('./db');

/**
 * Migration: Create admins table
 * Creates table for admin users
 */

const runMigration = async () => {
  console.log('🔄 Starting admins table migration...');
  
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Created admins table');

    await query(`
      CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);
      CREATE INDEX IF NOT EXISTS idx_admins_status ON admins(status);
    `);
    console.log('✅ Created indexes on admins table');

    console.log('✅ Admins table migration completed successfully');
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
      console.log('👍 Admins table migration successful!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('👎 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { runMigration };