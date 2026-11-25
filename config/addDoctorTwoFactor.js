const { query } = require('./db');

/**
 * Migration: optional two-factor sign-in for doctors.
 *
 * Agreed with the team on 2026-11-21/25: when a doctor turns it on, the first
 * sign-in of the day on each browser asks for a 6-digit code sent by email.
 * Signing prescriptions asks for nothing extra. Codes live in the existing
 * otps table (user_type 'doctor', purpose 'login' / 'twofa_enable'), so the
 * only new state is whether the doctor has it switched on.
 *
 * Additive and idempotent: off for every existing doctor.
 */
const runMigration = async () => {
  try {
    await query(`
      ALTER TABLE doctors
        ADD COLUMN IF NOT EXISTS two_fa_enabled BOOLEAN NOT NULL DEFAULT false
    `);
    console.log('✅ Doctor two-factor column ready');
    return true;
  } catch (error) {
    console.error('❌ Doctor two-factor migration failed:', error);
    throw error;
  }
};

if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { runMigration };
