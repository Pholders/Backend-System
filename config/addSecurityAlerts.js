const SecurityAlert = require('../models/SecurityAlert');

/**
 * Migration: Add SecurityAlert table for enterprise-level security monitoring
 */

async function migrate() {
  try {
    console.log('🔄 Running migration: Add security_alerts table...');
    
    // Create table
    await SecurityAlert.createTable();
    
    console.log('✅ Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
