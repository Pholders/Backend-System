/**
 * Seed test pharmacies into the database
 * Usage: node tests/seed-test-pharmacies.js
 * 
 * Creates 3 test pharmacies
 * All use @seed.test emails for easy identification and cleanup
 */

const bcrypt = require('bcrypt');
const { pool, query } = require('../config/db');

const SEED_PHARMACIES = [
  {
    pharmacy_name: 'MediCare Pharmacy',
    first_name: 'Grace',
    last_name: 'Okafor',
    email: 'seed.pharma1@seed.test',
    phone: '+27110001001',
    license_number: 'SEED-PHARMA-0001',
    city: 'Johannesburg',
    province: 'Gauteng',
    address: '123 Main St, Bryanston, Johannesburg',
    zip_code: '2000',
    delivery_available: true,
    delivery_radius: 5,
    description: 'Quality pharmaceutical services with prescription delivery available.',
  },
  {
    pharmacy_name: 'HealthFirst Pharmacy',
    first_name: 'David',
    last_name: 'Nkosi',
    email: 'seed.pharma2@seed.test',
    phone: '+27110001002',
    license_number: 'SEED-PHARMA-0002',
    city: 'Johannesburg',
    province: 'Gauteng',
    address: '456 Park Road, Sandton, Johannesburg',
    zip_code: '2146',
    delivery_available: true,
    delivery_radius: 10,
    description: 'Leading pharmacy chain with 24-hour services.',
  },
  {
    pharmacy_name: 'Care Plus Pharmacy',
    first_name: 'Amani',
    last_name: 'Mwangi',
    email: 'seed.pharma3@seed.test',
    phone: '+27110001003',
    license_number: 'SEED-PHARMA-0003',
    city: 'Johannesburg',
    province: 'Gauteng',
    address: '789 Health Ave, Midrand, Johannesburg',
    zip_code: '1685',
    delivery_available: false,
    description: 'Community pharmacy dedicated to patient care.',
  },
];

async function seedPharmacies() {
  console.log('\n═'.repeat(60));
  console.log('💊 SEEDING TEST PHARMACIES');
  console.log('═'.repeat(60));

  try {
    let insertedCount = 0;

    for (const pharma of SEED_PHARMACIES) {
      // Check if already exists (idempotent)
      const existing = await query(
        'SELECT id FROM pharmacies WHERE email = $1',
        [pharma.email]
      );

      if (existing.rows.length > 0) {
        console.log(`⏭️  Skipping ${pharma.pharmacy_name} - already exists`);
        continue;
      }

      // Hash password
      const hashedPassword = await bcrypt.hash('pharmacypass123', 10);

      // Insert pharmacy
      const result = await query(
        `INSERT INTO pharmacies (
          pharmacy_name, first_name, last_name, email, password_hash, phone,
          license_number, city, province, address, zip_code, 
          delivery_available, delivery_radius, description, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING id, pharmacy_name, email`,
        [
          pharma.pharmacy_name,
          pharma.first_name,
          pharma.last_name,
          pharma.email,
          hashedPassword,
          pharma.phone,
          pharma.license_number,
          pharma.city,
          pharma.province,
          pharma.address,
          pharma.zip_code,
          pharma.delivery_available,
          pharma.delivery_radius || null,
          pharma.description,
          'active',
        ]
      );

      insertedCount++;
      const createdPharm = result.rows[0];
      console.log(`✅ Created: ${createdPharm.pharmacy_name} (${pharma.city})`);
    }

    console.log(`\n📊 Result: ${insertedCount} new pharmacy/pharmacies seeded`);
    console.log('\n💡 All test pharmacies use password: pharmacypass123');
    console.log('   Email format: seed.pharma1@seed.test, seed.pharma2@seed.test, etc.');
    console.log('\n✅ Seeding complete!');

    return true;
  } catch (error) {
    console.error('\n❌ Seeding failed:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  seedPharmacies()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { seedPharmacies };
