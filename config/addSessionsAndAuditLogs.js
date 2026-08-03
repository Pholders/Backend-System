const Session = require('../models/Session');
const AuditLog = require('../models/AuditLog');

/**
 * Migration: Add Sessions and Audit Logs tables
 * Run with: node config/addSessionsAndAuditLogs.js
 */

async function migrate() {
  try {
    console.log('🔄 Starting migration: Adding sessions and audit logs...\n');

    // Create tables
    await Session.createTable();
    await AuditLog.createTable();

    console.log('\n✅ Migration completed successfully!\n');
    console.log('📋 New features added:');
    console.log('   - Session tracking and management');
    console.log('   - Audit logging for all security events');
    console.log('   - Device tracking and login activity monitoring\n');
  } catch (error) {
    throw error;
  }
}

if (require.main === module) {
  migrate().then(() => process.exit(0)).catch(err => {
    console.error('\n❌ Migration failed:', err);
    process.exit(1);
  });
}

module.exports = migrate;
