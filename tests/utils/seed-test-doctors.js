/**
 * Seed test doctors into the database
 * Usage: node tests/seed-test-doctors.js
 * 
 * Creates 5 test doctors with various specializations
 * All use @seed.test emails for easy identification and cleanup
 */

const bcrypt = require('bcrypt');
const { pool, query } = require('../config/db');

const SEED_DOCTORS = [
  {
    first_name: 'Sam',
    last_name: 'Smith',
    email: 'seed.doc1@seed.test',
    phone: '+27110000001',
    hpcsa_number: 'SEED-0001',
    specialization: 'General Practitioner',
    experience: 10,
    clinic_name: 'Bryanston Family Clinic',
    city: 'Johannesburg',
    province: 'Gauteng',
    consultation_fee: 250,
    bio: 'Dr Sam is a general practitioner with 10 years of experience in family medicine.',
    clinic_address: '123 Main Street, Bryanston, Johannesburg, 2000',
    latitude: -26.0565,
    longitude: 28.0227,
  },
  {
    first_name: 'Lerato',
    last_name: 'Moloi',
    email: 'seed.doc2@seed.test',
    phone: '+27110000002',
    hpcsa_number: 'SEED-0002',
    specialization: 'Paediatrician',
    experience: 7,
    clinic_name: 'Sandton Kids Health',
    city: 'Johannesburg',
    province: 'Gauteng',
    consultation_fee: 350,
    bio: 'Dr Lerato specializes in pediatric care and child health.',
    clinic_address: '456 Park Road, Sandton, Johannesburg, 2146',
    latitude: -26.1050,
    longitude: 28.0472,
  },
  {
    first_name: 'Thabo',
    last_name: 'Ndlela',
    email: 'seed.doc3@seed.test',
    phone: '+27110000003',
    hpcsa_number: 'SEED-0003',
    specialization: 'Cardiologist',
    experience: 12,
    clinic_name: 'Heart Care Clinic',
    city: 'Johannesburg',
    province: 'Gauteng',
    consultation_fee: 450,
    bio: 'Dr Thabo is a specialist cardiologist with 12 years of experience.',
    clinic_address: '789 Medical Avenue, Midrand, Johannesburg, 1685',
    latitude: -26.0085,
    longitude: 28.0895,
  },
  {
    first_name: 'Naledi',
    last_name: 'Khumalo',
    email: 'seed.doc4@seed.test',
    phone: '+27110000004',
    hpcsa_number: 'SEED-0004',
    specialization: 'Dermatologist',
    experience: 8,
    clinic_name: 'Skin Health Clinic',
    city: 'Johannesburg',
    province: 'Gauteng',
    consultation_fee: 300,
    bio: 'Dr Naledi specializes in dermatology and skin health treatment.',
    clinic_address: '321 Wellness Plaza, Rosebank, Johannesburg, 2196',
    latitude: -26.1350,
    longitude: 28.0450,
  },
  {
    first_name: 'Kobus',
    last_name: 'van der Merwe',
    email: 'seed.doc5@seed.test',
    phone: '+27110000005',
    hpcsa_number: 'SEED-0005',
    specialization: 'Orthopedic Surgeon',
    experience: 15,
    clinic_name: 'Bone & Joint Center',
    city: 'Johannesburg',
    province: 'Gauteng',
    consultation_fee: 500,
    bio: 'Dr Kobus specializes in orthopedic surgery with 15 years of experience.',
    clinic_address: '654 Health Boulevard, Fourways, Johannesburg, 2055',
    latitude: -25.9880,
    longitude: 28.0550,
  },
];

async function seedDoctors() {
  console.log('\n═'.repeat(60));
  console.log('🏥 SEEDING TEST DOCTORS');
  console.log('═'.repeat(60));

  try {
    // Check if already exists (idempotent)
    let insertedCount = 0;
    for (const doc of SEED_DOCTORS) {
      // Check if doctor already exists
      const existing = await query(
        'SELECT id FROM doctors WHERE email = $1',
        [doc.email]
      );

      if (existing.rows.length > 0) {
        console.log(`⏭️  Skipping ${doc.first_name} ${doc.last_name} - already exists`);
        continue;
      }

      // Hash password
      const hashedPassword = await bcrypt.hash('doctorpass123', 10);

      // Insert doctor
      const result = await query(
        `INSERT INTO doctors (
          first_name, last_name, email, password_hash, phone,
          hpcsa_number, specialization, experience,
          clinic_name, city, province, consultation_fee, bio,
          clinic_address, latitude, longitude
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING id, first_name, last_name, email, specialization`,
        [
          doc.first_name,
          doc.last_name,
          doc.email,
          hashedPassword,
          doc.phone,
          doc.hpcsa_number,
          doc.specialization,
          doc.experience,
          doc.clinic_name,
          doc.city,
          doc.province,
          doc.consultation_fee,
          doc.bio,
          doc.clinic_address,
          doc.latitude,
          doc.longitude,
        ]
      );

      insertedCount++;
      const createdDoc = result.rows[0];
      console.log(`✅ Created: ${createdDoc.first_name} ${createdDoc.last_name} (${createdDoc.specialization})`);
    }

    console.log(`\n📊 Result: ${insertedCount} new doctor(s) seeded`);
    console.log('\n💡 All test doctors use password: doctorpass123');
    console.log('   Email format: seed.doc1@seed.test, seed.doc2@seed.test, etc.');
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
  seedDoctors()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { seedDoctors };
