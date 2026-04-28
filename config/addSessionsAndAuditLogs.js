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

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
