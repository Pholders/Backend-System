/**
 * Seed script: Reset users/patients table and insert test patient
 * 
 * Usage:   node config/seedUsers.js
 * 
 * Safety:
 *   - Refuses to run when NODE_ENV === 'production'
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

seedUsers();
