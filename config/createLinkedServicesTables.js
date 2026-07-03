const { query } = require('./db');

/**
 * Migration: Linked services tables
 *   - connected_doctors
 *   - connected_pharmacies
 *   - family_dependents
 * Idempotent.
 */

const runMigration = async () => {
  console.log('🔄 Creating linked-services tables...');

  try {
    await query(`
      CREATE TABLE IF NOT EXISTS connected_doctors (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'active'
          CHECK (status IN ('active', 'pending', 'removed')),
        note TEXT,
        linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (patient_id, doctor_id)
      );

      CREATE INDEX IF NOT EXISTS idx_connected_doctors_patient ON connected_doctors(patient_id);
      CREATE INDEX IF NOT EXISTS idx_connected_doctors_doctor  ON connected_doctors(doctor_id);
      CREATE INDEX IF NOT EXISTS idx_connected_doctors_status  ON connected_doctors(status);
    `);
    console.log('✅ connected_doctors ready');

    await query(`
      CREATE TABLE IF NOT EXISTS connected_pharmacies (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        pharmacy_id INTEGER NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'active'
          CHECK (status IN ('active', 'pending', 'removed')),
        note TEXT,
        linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (patient_id, pharmacy_id)
      );

      CREATE INDEX IF NOT EXISTS idx_connected_pharmacies_patient  ON connected_pharmacies(patient_id);
      CREATE INDEX IF NOT EXISTS idx_connected_pharmacies_pharmacy ON connected_pharmacies(pharmacy_id);
      CREATE INDEX IF NOT EXISTS idx_connected_pharmacies_status   ON connected_pharmacies(status);
    `);
    console.log('✅ connected_pharmacies ready');

    await query(`
      CREATE TABLE IF NOT EXISTS family_dependents (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        date_of_birth DATE,
        gender VARCHAR(20),
        relationship VARCHAR(50) NOT NULL,
        id_number_encrypted TEXT,
        phone VARCHAR(20),
        linked_patient_id INTEGER REFERENCES patients(id) ON DELETE SET NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_family_dependents_patient        ON family_dependents(patient_id);
      CREATE INDEX IF NOT EXISTS idx_family_dependents_linked_patient ON family_dependents(linked_patient_id);
    `);
    console.log('✅ family_dependents ready');

    // Extend audit_logs CHECK to allow linked-service events. Drop & re-add idempotently.
    await query(`ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_event_type_check;`);
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
    console.log('✅ Extended audit_logs event_type CHECK (linked services)');

    console.log('✅ Linked-services migration completed');
    return true;
  } catch (error) {
    console.error('❌ Linked-services migration failed:', error);
    throw error;
  }
};

if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { runMigration };
