const SecurityAlert = require('../models/SecurityAlert');

/**
 * Migration: Add SecurityAlert table for enterprise-level security monitoring
 */

async function migrate() {
  console.log('🔄 Running migration: Add security_alerts table...');
  await SecurityAlert.createTable();
  console.log('✅ Migration completed successfully');
}

if (require.main === module) {
  migrate().then(() => process.exit(0)).catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  });
}

module.exports = migrate;
