/**
 * Seed script: create or refresh an admin account.
 *
 * Usage:
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='StrongPass!123' npm run seed:admin
 *
 * Production safety:
 *   - Requires ALLOW_ADMIN_SEED=true when NODE_ENV=production
 *   - Refuses to run without both ADMIN_EMAIL and ADMIN_PASSWORD
 */

const bcrypt = require('bcrypt');
const { query, pool } = require('./db');

const DEFAULT_FIRST_NAME = 'Tobun';
const DEFAULT_LAST_NAME = 'Admin';
const DEFAULT_PHONE = null;

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function seedAdmin() {
  const isProduction = process.env.NODE_ENV === 'production';
  const allowProductionSeed = process.env.ALLOW_ADMIN_SEED === 'true';

  if (isProduction && !allowProductionSeed) {
    throw new Error('Refusing to seed admin in production without ALLOW_ADMIN_SEED=true');
  }

  const email = requireEnv('ADMIN_EMAIL').toLowerCase();
  const password = requireEnv('ADMIN_PASSWORD');
  const firstName = process.env.ADMIN_FIRST_NAME?.trim() || DEFAULT_FIRST_NAME;
  const lastName = process.env.ADMIN_LAST_NAME?.trim() || DEFAULT_LAST_NAME;
  const phone = process.env.ADMIN_PHONE?.trim() || DEFAULT_PHONE;
  const passwordHash = await bcrypt.hash(password, 10);

  console.log(`🔄 Seeding admin account for ${email}...`);

  const result = await query(
    `INSERT INTO admins (first_name, last_name, email, password_hash, phone, status)
     VALUES ($1, $2, $3, $4, $5, 'active')
     ON CONFLICT (email)
     DO UPDATE SET
       first_name = EXCLUDED.first_name,
       last_name = EXCLUDED.last_name,
       password_hash = EXCLUDED.password_hash,
       phone = EXCLUDED.phone,
       status = 'active',
       updated_at = CURRENT_TIMESTAMP
     RETURNING id, email, first_name, last_name, phone, status, created_at, updated_at`,
    [firstName, lastName, email, passwordHash, phone]
  );

  const admin = result.rows[0];

  console.log('✅ Admin account is ready');
  console.log(`   ID: ${admin.id}`);
  console.log(`   Email: ${admin.email}`);
  console.log(`   Name: ${admin.first_name} ${admin.last_name}`);
  console.log(`   Status: ${admin.status}`);
  console.log(`   Updated: ${admin.updated_at}`);

  return admin;
}

if (require.main === module) {
  seedAdmin()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch(async (error) => {
      console.error(`❌ Admin seed failed: ${error.message}`);
      try {
        await pool.end();
      } catch (closeError) {
        console.error(`❌ Failed to close DB pool: ${closeError.message}`);
      }
      process.exit(1);
    });
}

module.exports = { seedAdmin };