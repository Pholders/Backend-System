/**
 * Migration: Extend audit_logs.event_type CHECK constraint
 * to include email verification events.
 *
 * New event types:
 *   - email_verification_sent
 *   - email_verification
 *   - email_verification_resend
 */

const { query } = require('./db');

async function run() {
  console.log('🔧 Updating audit_logs.event_type CHECK constraint...');

  try {
    // Drop the old constraint (name comes from the original CREATE TABLE)
    await query(`
      ALTER TABLE audit_logs
      DROP CONSTRAINT IF EXISTS audit_logs_event_type_check;
    `);

    // Recreate with the expanded list
    await query(`
      ALTER TABLE audit_logs
      ADD CONSTRAINT audit_logs_event_type_check
      CHECK (event_type IN (
        'signup', 'login', 'logout', 'login_failed', 'password_change',
        'password_reset', 'otp_generated', 'otp_verified', 'otp_failed',
        'session_created', 'session_revoked', 'profile_updated',
        'unauthorized_access', 'account_locked', 'account_unlocked',
        'email_verification_sent', 'email_verification', 'email_verification_resend'
      ));
    `);

    console.log('✅ audit_logs.event_type constraint updated successfully');
  } catch (error) {
    console.error('❌ Failed to update audit_logs constraint:', error);
    throw error;
  }
}

if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = run;
