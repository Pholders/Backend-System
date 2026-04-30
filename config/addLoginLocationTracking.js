const { query } = require('./db');
const LoginLocation = require('../models/LoginLocation');

/**
 * Migration: Add LoginLocation table for suspicious activity tracking
 */

async function migrate() {
  try {
    console.log('🔄 Running migration: Add login_locations table...');
    
    // Create table
    await LoginLocation.createTable();
    
    console.log('✅ Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
