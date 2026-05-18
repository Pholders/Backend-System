/**
 * Seed script: insert test doctors around Bryanston, Johannesburg for the
 * patient "Find doctors near you" feature.
 *
 * Usage:   node config/seedDoctors.js
 *
 * Safety:
 *   - Refuses to run when NODE_ENV === 'production'
 *   - Idempotent: skips doctors whose seed email already exists
 *   - All seeded records use the email suffix "@seed.test" and HPCSA
 *     numbers prefixed with "SEED-" so they are trivial to identify and
 *     bulk-delete later if needed.
 *
 * Distance design (anchor: Bryanston ~ -26.0565, 28.0227):
 *   Each doctor is placed at a known offset so the 5 km radius filter
 *   can be verified end-to-end. Approximate offsets used:
 *     1 degree latitude  ~ 111 km
 *     1 degree longitude ~ 101 km (at this latitude)
 *
 *   doc1: ~1 km north         (inside 5 km)
 *   doc2: ~3 km east          (inside 5 km)
 *   doc3: ~5 km south-west    (right at the 5 km boundary)
 *   doc4: ~8 km north-east    (outside 5 km, inside 10 km)
 *   doc5: ~15 km east         (outside 10 km, inside 20 km)
 */

const bcrypt = require('bcrypt');
const { pool, query } = require('./db');

const ANCHOR = { lat: -26.0565, lng: 28.0227 }; // Bryanston, Johannesburg

// Approximate degree-per-km at this latitude
const KM_PER_DEG_LAT = 1 / 111;
const KM_PER_DEG_LNG = 1 / 101;

function offset(latKm, lngKm) {
  return {
    latitude: +(ANCHOR.lat + latKm * KM_PER_DEG_LAT).toFixed(6),
    longitude: +(ANCHOR.lng + lngKm * KM_PER_DEG_LNG).toFixed(6),
  };
}

const SEED_DOCTORS = [
  {
    label: '~1 km north',
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
    clinic_address: 'Bryanston, Johannesburg',
    suburb: 'Bryanston',
    rating: 4.9,
    review_count: 2500,
    currency: 'ZAR',
    consultation_fee: 250,
    opens_at: '05:00',
    closes_at: '01:00',
    bio: 'Dr Sam is a general practitioner who specialises in general consultations, preventative care and family medicine.',
    ...offset(1, 0),
  },
  {
    label: '~3 km east',
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
    clinic_address: 'Sandton, Johannesburg',
    suburb: 'Sandton',
    rating: 4.7,
    review_count: 1200,
    currency: 'ZAR',
    consultation_fee: 450,
    opens_at: '08:00',
    closes_at: '17:00',
    bio: 'Dr Lerato is a paediatrician with 7 years of experience caring for children from birth through adolescence.',
    ...offset(0, 3),
  },
  {
    label: '~5 km south-west (boundary)',
    first_name: 'Thabo',
    last_name: 'Nkosi',
    email: 'seed.doc3@seed.test',
    phone: '+27110000003',
    hpcsa_number: 'SEED-0003',
    specialization: 'Dermatologist',
    experience: 12,
    clinic_name: 'Randburg Skin Clinic',
    city: 'Johannesburg',
    province: 'Gauteng',
    clinic_address: 'Randburg, Johannesburg',
    suburb: 'Randburg',
    rating: 4.6,
    review_count: 980,
    currency: 'ZAR',
    consultation_fee: 600,
    opens_at: '09:00',
    closes_at: '18:00',
    bio: 'Dr Thabo treats a full range of skin conditions and offers cosmetic dermatology services.',
    ...offset(-3.5, -3.5), // ~5 km diagonal
  },
  {
    label: '~8 km north-east (outside 5 km)',
    first_name: 'Aisha',
    last_name: 'Patel',
    email: 'seed.doc4@seed.test',
    phone: '+27110000004',
    hpcsa_number: 'SEED-0004',
    specialization: 'General Practitioner',
    experience: 5,
    clinic_name: 'Fourways Medical Centre',
    city: 'Johannesburg',
    province: 'Gauteng',
    clinic_address: 'Fourways, Johannesburg',
    suburb: 'Fourways',
    rating: 4.5,
    review_count: 430,
    currency: 'ZAR',
    consultation_fee: 300,
    opens_at: '07:00',
    closes_at: '19:00',
    bio: 'Dr Aisha offers comprehensive primary care including chronic disease management and minor procedures.',
    ...offset(5.5, 5.5), // ~7.8 km diagonal
  },
  {
    label: '~15 km east (outside 10 km)',
    first_name: 'Sipho',
    last_name: 'Dlamini',
    email: 'seed.doc5@seed.test',
    phone: '+27110000005',
    hpcsa_number: 'SEED-0005',
    specialization: 'Cardiologist',
    experience: 20,
    clinic_name: 'Edenvale Heart Institute',
    city: 'Johannesburg',
    province: 'Gauteng',
    clinic_address: 'Edenvale, Johannesburg',
    suburb: 'Edenvale',
    rating: 4.8,
    review_count: 3100,
    currency: 'ZAR',
    consultation_fee: 1200,
    opens_at: '08:00',
    closes_at: '16:00',
    bio: 'Dr Sipho is a consultant cardiologist with two decades of experience in interventional cardiology.',
    ...offset(0, 15),
  },
];

async function seed() {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ Refusing to run seed script in production');
    process.exit(1);
  }

  console.log(`🔄 Seeding ${SEED_DOCTORS.length} test doctors around Bryanston...`);
  const password_hash = await bcrypt.hash('SeedPassword#2025', 10);
  let inserted = 0;
  let skipped = 0;

  for (const doc of SEED_DOCTORS) {
    const existing = await query('SELECT id FROM doctors WHERE email = $1', [doc.email]);
    if (existing.rows.length > 0) {
      console.log(`  • skip   ${doc.email} (already exists)`);
      skipped++;
      continue;
    }

    await query(
      `INSERT INTO doctors (
        first_name, last_name, email, password_hash, phone,
        hpcsa_number, specialization, experience,
        clinic_name, city, province,
        latitude, longitude, clinic_address,
        suburb, rating, review_count, currency,
        consultation_fee, opens_at, closes_at, bio,
        status
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8,
        $9, $10, $11,
        $12, $13, $14,
        $15, $16, $17, $18,
        $19, $20, $21, $22,
        'active'
      )`,
      [
        doc.first_name, doc.last_name, doc.email, password_hash, doc.phone,
        doc.hpcsa_number, doc.specialization, doc.experience,
        doc.clinic_name, doc.city, doc.province,
        doc.latitude, doc.longitude, doc.clinic_address,
        doc.suburb, doc.rating, doc.review_count, doc.currency,
        doc.consultation_fee, doc.opens_at, doc.closes_at, doc.bio,
      ]
    );
    console.log(`  ✓ insert ${doc.email}  (${doc.label})`);
    inserted++;
  }

  console.log(`\n✅ Seed complete. Inserted: ${inserted}, Skipped: ${skipped}`);
  console.log(`   Anchor point for testing: lat=${ANCHOR.lat}, lng=${ANCHOR.lng}`);
}

if (require.main === module) {
  seed()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Seed failed:', err);
      pool.end().finally(() => process.exit(1));
    });
}

module.exports = { seed, SEED_DOCTORS, ANCHOR };
