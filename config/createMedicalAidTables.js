const { query } = require('./db');

/**
 * Migration: Medical aid tables
 *   - medical_aid_schemes
 *   - medical_aid_claims
 *   - invoices
 * Idempotent.
 */

const runMigration = async () => {
  console.log('🔄 Creating medical-aid tables...');

  try {
    await query(`
      CREATE TABLE IF NOT EXISTS medical_aid_schemes (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL UNIQUE REFERENCES patients(id) ON DELETE CASCADE,
        scheme_name VARCHAR(255) NOT NULL,
        plan_name VARCHAR(255),
        member_number_encrypted TEXT,
        dependent_code_encrypted TEXT,
        is_principal_member BOOLEAN DEFAULT true,
        principal_member_name VARCHAR(255),
        principal_member_id_encrypted TEXT,
        effective_date DATE,
        expiry_date DATE,
        card_front_path TEXT,
        card_back_path TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_medical_aid_schemes_patient ON medical_aid_schemes(patient_id);
    `);
    console.log('✅ medical_aid_schemes ready');

    await query(`
      CREATE TABLE IF NOT EXISTS medical_aid_claims (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        claim_number VARCHAR(100),
        service_date DATE,
        submitted_date DATE,
        provider_name VARCHAR(255),
        service_description TEXT,
        amount_claimed DECIMAL(12, 2),
        amount_paid DECIMAL(12, 2),
        amount_outstanding DECIMAL(12, 2),
        status VARCHAR(20) NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'approved', 'rejected', 'partial', 'paid')),
        rejection_reason TEXT,
        document_path TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_medical_aid_claims_patient ON medical_aid_claims(patient_id);
      CREATE INDEX IF NOT EXISTS idx_medical_aid_claims_status  ON medical_aid_claims(status);
      CREATE INDEX IF NOT EXISTS idx_medical_aid_claims_service_date ON medical_aid_claims(service_date DESC);
    `);
    console.log('✅ medical_aid_claims ready');

    await query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        invoice_number VARCHAR(100),
        issued_date DATE,
        due_date DATE,
        provider_name VARCHAR(255),
        description TEXT,
        subtotal DECIMAL(12, 2),
        tax DECIMAL(12, 2),
        total DECIMAL(12, 2) NOT NULL,
        amount_paid DECIMAL(12, 2) DEFAULT 0,
        currency VARCHAR(10) DEFAULT 'ZAR',
        status VARCHAR(20) NOT NULL DEFAULT 'unpaid'
          CHECK (status IN ('unpaid', 'partial', 'paid', 'void')),
        document_path TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_invoices_patient ON invoices(patient_id);
      CREATE INDEX IF NOT EXISTS idx_invoices_status  ON invoices(status);
      CREATE INDEX IF NOT EXISTS idx_invoices_issued_date ON invoices(issued_date DESC);
    `);
    console.log('✅ invoices ready');

    // Extend audit_logs CHECK to include medical-aid events.
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
          'doctor_linked', 'doctor_unlinked',
          'pharmacy_linked', 'pharmacy_unlinked',
          'dependent_added', 'dependent_updated', 'dependent_removed',
          'medical_aid_updated', 'medical_aid_card_uploaded',
          'medical_aid_document_downloaded',
          'email_verification_sent', 'email_verification', 'email_verification_resend'
        ));
    `);
    console.log('✅ Extended audit_logs event_type CHECK (medical aid)');

    console.log('✅ Medical-aid migration completed');
    return true;
  } catch (error) {
    console.error('❌ Medical-aid migration failed:', error);
    throw error;
  }
};

if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { runMigration };
