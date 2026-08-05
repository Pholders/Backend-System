const { query } = require('./db');
const LoginLocation = require('../models/LoginLocation');

/**
 * Migration: Add LoginLocation table for suspicious activity tracking
 */

async function migrate() {
  console.log('🔄 Running migration: Add login_locations table...');
  await LoginLocation.createTable();
  console.log('✅ Migration completed successfully');
}

if (require.main === module) {
  migrate().then(() => process.exit(0)).catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  });
}

module.exports = migrate;

module.exports = migrate;
