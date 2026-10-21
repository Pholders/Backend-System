const { pool } = require('./db');

/**
 * Migration: Add Geolocation Support to Audit Logs
 * Adds geolocation and impossible_travel_detected columns to audit_logs table
 */

async function addGeolocationToAuditLogs() {
  const client = await pool.connect();

  try {
    console.log('🔄 Starting migration: Add geolocation to audit logs...\n');

    // Add geolocation column if it doesn't exist
    console.log('📍 Adding geolocation column...');
    await client.query(`
      ALTER TABLE audit_logs
      ADD COLUMN IF NOT EXISTS geolocation JSONB
    `);
    console.log('✅ geolocation column added/verified\n');

    // Add impossible_travel_detected column if it doesn't exist
    console.log('📍 Adding impossible_travel_detected column...');
    await client.query(`
      ALTER TABLE audit_logs
      ADD COLUMN IF NOT EXISTS impossible_travel_detected BOOLEAN DEFAULT FALSE
    `);
    console.log('✅ impossible_travel_detected column added/verified\n');

    // Add indices for better query performance
    console.log('📍 Adding database indices...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_impossible_travel 
      ON audit_logs(impossible_travel_detected)
    `);
    console.log('✅ Index on impossible_travel_detected created/verified\n');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_event 
      ON audit_logs(user_id, event_type, created_at)
    `);
    console.log('✅ Composite index created/verified\n');

    console.log('✅ Migration completed successfully!\n');
    console.log('📊 New features enabled:');
    console.log('   • Geolocation tracking for each login');
    console.log('   • Automatic impossible travel detection');
    console.log('   • Fraud detection capabilities');
    
  } catch (error) {
    console.error('❌ Migration error:', error.message);
    if (error.code !== '42701') throw error;
    console.log('ℹ️  Column already exists, continuing...');
  } finally {
    client.release();
  }
}

if (require.main === module) {
  addGeolocationToAuditLogs().then(() => process.exit(0)).catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  });
}

module.exports = addGeolocationToAuditLogs;
