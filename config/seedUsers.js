/**
 * Seed script: Reset users/patients table and insert test patient
 * 
 * Usage:   node config/seedUsers.js
 * 
 * Safety:
 *   - Runs ONLY when invoked directly, never on require. It used to call
 *     itself at module scope, so anything that merely imported this file --
 *     a module-load check, a tooling scan, an editor -- deleted every
 *     patient. That is not hypothetical: it happened on 21 October 2026
 *     against the live database.
 *   - Refuses to run against a remote database. The NODE_ENV guard below is
 *     kept but is not enough on its own: the deployed service runs with
 *     NODE_ENV=development, so it has never once fired where it mattered.
 *   - Deletes ALL existing patients/users (be careful!)
 *   - Creates a fresh test patient with known credentials
 */

const bcrypt = require('bcrypt');
const { pool } = require('./db');

async function seedUsers() {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ SAFETY GUARD: Refusing to run in production environment');
    process.exit(1);
  }

  // The real guard. DB_HOST points at the live Render database in the usual
  // .env, and NODE_ENV there says "development", so refusing on NODE_ENV
  // alone protects nothing. Deleting every patient is only ever meant for a
  // database on this machine.
  const host = String(process.env.DB_HOST || '');
  const isLocal = host === '' || host === 'localhost' || host === '127.0.0.1';
  if (!isLocal) {
    console.error(
      `❌ SAFETY GUARD: Refusing to wipe patients on a remote database (${host}).
` +
      '   Point DB_HOST at a local database if you really mean to seed.'
    );
    process.exit(1);
  }

  try {
    console.log('🔄 Starting user seeding...');

    // Delete all patients
    console.log('🗑️  Deleting all existing patients...');
    const deleteResult = await pool.query('DELETE FROM patients');
    console.log(`   ✅ Deleted ${deleteResult.rowCount} existing patients`);

    // Hash test password
    const testPassword = 'Test@1234';
    const hashedPassword = await bcrypt.hash(testPassword, 10);

    // Create test patient
    const testEmail = 'princengwakomashumu@gmail.com';
    console.log(`\n👤 Creating test patient:...`);
    console.log(`   Email: ${testEmail}`);
    console.log(`   Password: ${testPassword}`);
    console.log(`   Status: active`);
    console.log(`   Email verified: true`);

    const insertResult = await pool.query(
      `INSERT INTO patients (first_name, last_name, email, password_hash, phone, id_passport_number, nationality, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, email, status, created_at`,
      [
        'Prince',                    // first_name
        'Ngwako Mashumu',           // last_name
        testEmail,                   // email
        hashedPassword,              // password_hash
        '0712345678',               // phone (required)
        'ID123456',                 // id_passport_number (required, unique)
        'South African',            // nationality (required)
        'active'                    // status
      ]
    );

    const user = insertResult.rows[0];
    console.log(`\n✅ Test patient created:`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Status: ${user.status}`);
    console.log(`   Created: ${user.created_at}`);

    console.log('\n✨ User seeding complete!');
    console.log('\n🔑 Test credentials:');
    console.log(`   Email: ${testEmail}`);
    console.log(`   Password: ${testPassword}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error during seeding:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Only when run as `node config/seedUsers.js`. Requiring this file must not
// delete anything.
if (require.main === module) {
  seedUsers();
}

module.exports = { seedUsers };
