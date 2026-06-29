const { query } = require('./db');

/**
 * Migration: Add profile + security columns to patients table
 * Adds columns required by the User Profiles sprint.
 * Idempotent — safe to re-run.
 */

const runMigration = async () => {
  console.log('🔄 Adding profile/security columns to patients...');

  try {
    await query(`
      ALTER TABLE patients
        ADD COLUMN IF NOT EXISTS avatar_url TEXT,
        ADD COLUMN IF NOT EXISTS id_number_encrypted TEXT,
        ADD COLUMN IF NOT EXISTS suburb VARCHAR(100),
        ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS password_strength VARCHAR(20),
        ADD COLUMN IF NOT EXISTS face_id_enabled BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS fingerprint_enabled BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS two_fa_enabled BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS two_fa_method VARCHAR(20),
        ADD COLUMN IF NOT EXISTS two_fa_secret TEXT,
        ADD COLUMN IF NOT EXISTS account_frozen BOOLEAN DEFAULT false;
    `);
    console.log('✅ Added profile/security columns to patients');

    // Drop any prior 2FA method constraint, then add the current one (email | authenticator).
    // SMS is deferred — see plan considerations.
    await query(`
      ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_two_fa_method_check;
    `);
    await query(`
      ALTER TABLE patients
        ADD CONSTRAINT patients_two_fa_method_check
        CHECK (two_fa_method IS NULL OR two_fa_method IN ('email', 'authenticator'));
    `);
    console.log('✅ Added two_fa_method CHECK constraint');

    await query(`CREATE INDEX IF NOT EXISTS idx_patients_account_frozen ON patients(account_frozen);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_patients_two_fa_enabled ON patients(two_fa_enabled);`);
    console.log('✅ Created supporting indexes');

    // Extend audit_logs.event_type CHECK to allow new profile/security events.
    // Drop the old constraint (if present) then add the expanded one.
    await query(`ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_event_type_check;`);
    await query(`
      ALTER TABLE audit_logs
        ADD CONSTRAINT audit_logs_event_type_check
        CHECK (event_type IN (
          'signup', 'login', 'logout', 'login_failed',
          'password_change', 'password_changed', 'password_reset',
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
          'email_verification_sent', 'email_verification', 'email_verification_resend'
        ));
    `);
    console.log('✅ Extended audit_logs event_type CHECK');

    console.log('✅ Migration completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};

if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { runMigration };
