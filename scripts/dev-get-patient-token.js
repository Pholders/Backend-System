/**
 * Dev-only helper: get a ready-to-use JWT for an existing patient.
 *
 * Bypasses the entire login/OTP/email-verification flow by:
 *   1. Looking up the patient by email
 *   2. Forcing email_verified = true
 *   3. Minting a JWT with the same payload the verify-otp endpoint uses
 *   4. Creating a Session row so the auth middleware accepts it
 *
 * Usage:
 *   node scripts/dev-get-patient-token.js
 *   node scripts/dev-get-patient-token.js other.patient@example.com
 */

require('dotenv').config();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { pool, query } = require('../config/db');
const Session = require('../models/Session');

const DEFAULT_EMAIL = 'test.patient@pholders.com';

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ Refusing to run in production');
    process.exit(1);
  }
  if (!process.env.JWT_SECRET) {
    console.error('❌ JWT_SECRET is not set in .env');
    process.exit(1);
  }

  const email = process.argv[2] || DEFAULT_EMAIL;

  const result = await query(
    'SELECT id, email, role FROM patients WHERE email = $1',
    [email]
  );
  if (result.rowCount === 0) {
    console.error(`❌ No patient found with email ${email}`);
    await pool.end();
    process.exit(1);
  }
  const patient = result.rows[0];

  await query('UPDATE patients SET email_verified = true WHERE id = $1', [patient.id]);

  const token = jwt.sign(
    {
      id: patient.id,
      email: patient.email,
      role: patient.role || 'patient',
      type: 'patient',
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  await Session.create(
    patient.id,
    'patient',
    tokenHash,
    '127.0.0.1',
    'dev-get-patient-token-script',
    { source: 'dev-get-patient-token', timestamp: new Date().toISOString() }
  );

  console.log('\n✅ Ready-to-use patient token (valid for 7 days):\n');
  console.log(token);
  console.log('\nNext steps (PowerShell):');
  console.log(`  $env:JWT = "${token}"`);
  console.log('  node tests/test-doctors-listing.js\n');

  await pool.end();
}

main().catch(async (err) => {
  console.error('❌ Failed:', err);
  try { await pool.end(); } catch {}
  process.exit(1);
});
