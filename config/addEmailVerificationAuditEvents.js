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
        'signup', 'signup_verified',
        'login', 'logout', 'login_failed',
        'google_login', 'oauth_profile_completed',
        'password_change', 'password_changed', 'password_reset', 'reset_password',
        'otp_generated', 'otp_verified', 'otp_failed',
        'session_created', 'session_revoked', 'sessions_revoked_others',
        'profile_updated', 'account_updated', 'avatar_updated',
        'email_change_requested', 'email_changed',
        'biometrics_updated',
        'twofa_enable_started', 'twofa_enable_verify',
        'twofa_enabled', 'twofa_disabled', 'twofa_disable',
        'unauthorized_access', 'account_locked', 'account_unlocked',
        'account_frozen', 'account_unfrozen',
        'suspicious_activity_reported', 'audit_log_exported',
        'forgot_password',
        'doctor_linked', 'doctor_unlinked',
        'pharmacy_linked', 'pharmacy_unlinked',
        'dependent_added', 'dependent_updated', 'dependent_removed',
        'medical_aid_updated', 'medical_aid_card_uploaded',
        'medical_aid_document_downloaded',
        'support_ticket_submitted', 'contact_message_submitted',
        'account_deletion_requested', 'account_deleted', 'delete_account_request',
        'payment_init', 'payment_confirm', 'payment_cash', 'payment_medical_aid',
        'security_alert_reviewed', 'security_alerts_bulk_updated',
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
