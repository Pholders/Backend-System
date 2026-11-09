const { query } = require('./db');
const { auditEventTypeList } = require('./auditEventTypes');

/**
 * Migration: what the admin needs to moderate reviews and answer support.
 *
 *   - doctor_reviews gains is_hidden / hidden_at / hidden_by / hidden_reason.
 *     A hidden review stays in the table (the patient still sees their own)
 *     but drops out of the doctor's public list and rating figures.
 *   - support_ticket_replies holds what an admin wrote back on a ticket.
 *     Before this a ticket could only be forwarded to the support inbox, and
 *     whatever was answered from there left no trace on the ticket.
 *   - audit_logs_event_type_check is rebuilt from auditEventTypes.js so the
 *     admin event types added with this migration are accepted.
 *
 * Idempotent. Runs after doctor_reviews and support_tickets exist.
 */
const runMigration = async () => {
  console.log('🔄 Running admin moderation migration...');
  try {
    await query(`
      ALTER TABLE doctor_reviews
        ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS hidden_by INTEGER,
        ADD COLUMN IF NOT EXISTS hidden_reason TEXT;
    `);
    console.log('✅ doctor_reviews moderation columns ready');

    await query(`
      CREATE TABLE IF NOT EXISTS support_ticket_replies (
        id SERIAL PRIMARY KEY,
        ticket_id INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
        admin_id INTEGER,
        message TEXT NOT NULL,
        email_sent BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_support_ticket_replies_ticket
        ON support_ticket_replies(ticket_id);
    `);
    console.log('✅ support_ticket_replies ready');

    await query(`ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_event_type_check;`);
    await query(`
      ALTER TABLE audit_logs
        ADD CONSTRAINT audit_logs_event_type_check
        CHECK (event_type IN (${auditEventTypeList()}));
    `);
    console.log('✅ audit_logs event_type CHECK includes the admin events');

    return true;
  } catch (error) {
    console.error('❌ Admin moderation migration failed:', error);
    throw error;
  }
};

if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { runMigration };
