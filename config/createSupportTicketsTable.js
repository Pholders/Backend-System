const { query } = require('./db');
const { auditEventTypeList } = require('./auditEventTypes');

/**
 * Migration: support_tickets
 * Idempotent.
 */

const runMigration = async () => {
  console.log('🔄 Creating support_tickets table...');
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS support_tickets (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER REFERENCES patients(id) ON DELETE SET NULL,
        email VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        category VARCHAR(50) NOT NULL DEFAULT 'general'
          CHECK (category IN ('general', 'billing', 'medical', 'technical', 'account', 'contact')),
        subject VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'open'
          CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
        priority VARCHAR(10) NOT NULL DEFAULT 'normal'
          CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
        ip_address VARCHAR(50),
        user_agent TEXT,
        resolved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_support_tickets_patient  ON support_tickets(patient_id);
      CREATE INDEX IF NOT EXISTS idx_support_tickets_email    ON support_tickets(email);
      CREATE INDEX IF NOT EXISTS idx_support_tickets_status   ON support_tickets(status);
      CREATE INDEX IF NOT EXISTS idx_support_tickets_category ON support_tickets(category);
    `);
    console.log('✅ support_tickets ready');

    // Extend audit_logs CHECK with support/legal events
    await query(`ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_event_type_check;`);
    await query(`
      ALTER TABLE audit_logs
        ADD CONSTRAINT audit_logs_event_type_check
        CHECK (event_type IN (${auditEventTypeList()}));
    `);
    console.log('✅ Extended audit_logs event_type CHECK (support & legal)');

    console.log('✅ support_tickets migration completed');
    return true;
  } catch (error) {
    console.error('❌ support_tickets migration failed:', error);
    throw error;
  }
};

if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { runMigration };
