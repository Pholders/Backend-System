/**
 * Seed script: insert test pharmacies around Johannesburg
 *
 * Usage:   node config/seedPharmacies.js
 *
 * Safety:
 *   - Refuses to run when NODE_ENV === 'production'
 *   - Idempotent: skips pharmacies whose seed email already exists
 *   - All seeded records use the email suffix "@seed.test" and license
 *     numbers prefixed with "SEED-" for easy identification
 *
 * Location design (anchor: Bryanston ~ -26.0565, 28.0227):
 *   Multiple pharmacies spread across Johannesburg for testing
 */

const bcrypt = require('bcrypt');
const { pool } = require('./db');

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

const SEED_PHARMACIES = [
  {
    label: 'Bryanston Central Pharmacy',
    pharmacy_name: 'Bryanston Central Pharmacy',
    first_name: 'Alice',
    last_name: 'Johnson',
    email: 'seed.pharm1@seed.test',
    phone: '+27110001001',
    license_number: 'SEED-PHARM-0001',
    city: 'Bryanston',
    province: 'Gauteng',
    address: '123 Main Street, Bryanston',
    zip_code: '2191',
    ...offset(0, 0),
    is_24_hours: true,
    delivery_available: true,
    delivery_radius: 5,
    services: ['prescription_filling', 'health_screening', 'vaccination', 'delivery'],
    description: 'Full-service pharmacy with 24/7 availability and delivery service'
  },
  {
    label: 'Sandton Premium Pharmacy',
    pharmacy_name: 'Sandton Premium Pharmacy',
    first_name: 'Bob',
    last_name: 'Smith',
    email: 'seed.pharm2@seed.test',
    phone: '+27110002002',
    license_number: 'SEED-PHARM-0002',
    city: 'Sandton',
    province: 'Gauteng',
    address: '456 Commerce Road, Sandton',
    zip_code: '2146',
    ...offset(2, 1.5),
    is_24_hours: false,
    delivery_available: true,
    delivery_radius: 10,
    services: ['prescription_filling', 'compounding', 'health_screening'],
    description: 'Premium pharmacy specializing in compounded medications'
  },
  {
    label: 'Rosebank Healthcare Pharmacy',
    pharmacy_name: 'Rosebank Healthcare Pharmacy',
    first_name: 'Carol',
    last_name: 'Williams',
    email: 'seed.pharm3@seed.test',
    phone: '+27110003003',
    license_number: 'SEED-PHARM-0003',
    city: 'Rosebank',
    province: 'Gauteng',
    address: '789 Park Lane, Rosebank',
    zip_code: '2196',
    ...offset(-1.5, 2),
    is_24_hours: false,
    delivery_available: false,
    delivery_radius: 0,
    services: ['prescription_filling', 'health_screening', 'vaccination'],
    description: 'Community-focused pharmacy with expert consultation'
  },
  {
    label: 'Midrand Quick Pharmacy',
    pharmacy_name: 'Midrand Quick Pharmacy',
    first_name: 'David',
    last_name: 'Brown',
    email: 'seed.pharm4@seed.test',
    phone: '+27110004004',
    license_number: 'SEED-PHARM-0004',
    city: 'Midrand',
    province: 'Gauteng',
    address: '321 Tech Street, Midrand',
    zip_code: '1685',
    ...offset(3, -2),
    is_24_hours: true,
    delivery_available: true,
    delivery_radius: 15,
    services: ['prescription_filling', 'delivery', 'online_ordering'],
    description: 'Modern pharmacy with online ordering and fast delivery'
  },
  {
    label: 'Randburg Family Pharmacy',
    pharmacy_name: 'Randburg Family Pharmacy',
    first_name: 'Eve',
    last_name: 'Davis',
    email: 'seed.pharm5@seed.test',
    phone: '+27110005005',
    license_number: 'SEED-PHARM-0005',
    city: 'Randburg',
    province: 'Gauteng',
    address: '654 Family Road, Randburg',
    zip_code: '2194',
    ...offset(-2.5, -1.5),
    is_24_hours: false,
    delivery_available: true,
    delivery_radius: 8,
    services: ['prescription_filling', 'vaccination', 'health_screening', 'delivery'],
    description: 'Family-friendly pharmacy with extended operating hours'
  },
  {
    label: 'Johannesburg CBD Pharmacy',
    pharmacy_name: 'Johannesburg CBD Pharmacy',
    first_name: 'Frank',
    last_name: 'Miller',
    email: 'seed.pharm6@seed.test',
    phone: '+27110006006',
    license_number: 'SEED-PHARM-0006',
    city: 'Johannesburg',
    province: 'Gauteng',
    address: '987 Central Ave, Johannesburg CBD',
    zip_code: '2000',
    ...offset(-4, 3),
    is_24_hours: true,
    delivery_available: false,
    delivery_radius: 0,
    services: ['prescription_filling', 'health_screening'],
    description: 'Busy CBD pharmacy serving the business district'
  },
  {
    label: 'Parktown Medical Pharmacy',
    pharmacy_name: 'Parktown Medical Pharmacy',
    first_name: 'Grace',
    last_name: 'Wilson',
    email: 'seed.pharm7@seed.test',
    phone: '+27110007007',
    license_number: 'SEED-PHARM-0007',
    city: 'Parktown',
    province: 'Gauteng',
    address: '111 Medical Plaza, Parktown',
    zip_code: '2193',
    ...offset(1, -1),
    is_24_hours: false,
    delivery_available: true,
    delivery_radius: 5,
    services: ['prescription_filling', 'compounding', 'vaccination', 'health_screening'],
    description: 'Specialized medical pharmacy near hospitals'
  },
  {
    label: 'Soweto Community Pharmacy',
    pharmacy_name: 'Soweto Community Pharmacy',
    first_name: 'Henry',
    last_name: 'Taylor',
    email: 'seed.pharm8@seed.test',
    phone: '+27110008008',
    license_number: 'SEED-PHARM-0008',
    city: 'Soweto',
    province: 'Gauteng',
    address: '222 Community Street, Soweto',
    zip_code: '1804',
    ...offset(-5, -3),
    is_24_hours: false,
    delivery_available: true,
    delivery_radius: 12,
    services: ['prescription_filling', 'health_screening', 'vaccination', 'delivery'],
    description: 'Community pharmacy dedicated to affordable healthcare'
  },
  {
    label: 'Hillbrow Urgent Care Pharmacy',
    pharmacy_name: 'Hillbrow Urgent Care Pharmacy',
    first_name: 'Isabel',
    last_name: 'Anderson',
    email: 'seed.pharm9@seed.test',
    phone: '+27110009009',
    license_number: 'SEED-PHARM-0009',
    city: 'Hillbrow',
    province: 'Gauteng',
    address: '333 Urgent Lane, Hillbrow',
    zip_code: '2001',
    ...offset(-3, 2),
    is_24_hours: true,
    delivery_available: true,
    delivery_radius: 20,
    services: ['prescription_filling', 'emergency_supplies', 'delivery'],
    description: 'Urgent care pharmacy with emergency supplies'
  },
  {
    label: 'Cresta Quality Pharmacy',
    pharmacy_name: 'Cresta Quality Pharmacy',
    first_name: 'Jack',
    last_name: 'Martinez',
    email: 'seed.pharm10@seed.test',
    phone: '+27110010010',
    license_number: 'SEED-PHARM-0010',
    city: 'Cresta',
    province: 'Gauteng',
    address: '444 Quality Road, Cresta',
    zip_code: '2118',
    ...offset(2, -2.5),
    is_24_hours: false,
    delivery_available: true,
    delivery_radius: 6,
    services: ['prescription_filling', 'health_screening', 'vaccination'],
    description: 'Quality-focused pharmacy with excellent customer service'
  }
];

async function seedPharmacies() {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ SAFETY GUARD: Refusing to run in production environment');
    process.exit(1);
  }

  try {
    console.log('🔄 Seeding ' + SEED_PHARMACIES.length + ' test pharmacies around Johannesburg...');

    let inserted = 0;
    let skipped = 0;

    for (const pharmacy of SEED_PHARMACIES) {
      try {
        // Check if pharmacy already exists
        const existing = await pool.query(
          'SELECT id FROM pharmacies WHERE email = $1',
          [pharmacy.email]
        );

        if (existing.rows.length > 0) {
          console.log(`  • skip   ${pharmacy.email} (already exists)`);
          skipped++;
          continue;
        }

        // Hash password
        const password_hash = await bcrypt.hash('Test@1234', 10);

        // Insert pharmacy
        const result = await pool.query(
          `INSERT INTO pharmacies 
          (pharmacy_name, first_name, last_name, email, password_hash, phone, 
           license_number, city, province, address, zip_code, 
           latitude, longitude, is_24_hours, delivery_available, delivery_radius,
           services, description, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
          RETURNING id, email`,
          [
            pharmacy.pharmacy_name, pharmacy.first_name, pharmacy.last_name,
            pharmacy.email, password_hash, pharmacy.phone,
            pharmacy.license_number, pharmacy.city, pharmacy.province,
            pharmacy.address, pharmacy.zip_code,
            pharmacy.latitude, pharmacy.longitude,
            pharmacy.is_24_hours, pharmacy.delivery_available, pharmacy.delivery_radius,
            pharmacy.services, // Array of strings (PostgreSQL native array)
            pharmacy.description, 'active'
          ]
        );

        console.log(`  ✅ added   ${pharmacy.email} (${pharmacy.label})`);
        inserted++;
      } catch (err) {
        if (err.code === '23505') { // Unique violation
          console.log(`  • skip   ${pharmacy.email} (duplicate)`);
          skipped++;
        } else {
          throw err;
        }
      }
    }

    console.log(`\n✅ Seed complete. Inserted: ${inserted}, Skipped: ${skipped}`);
    console.log(`\n🔑 All pharmacies use password: Test@1234`);
    console.log(`📍 Test area anchor: Bryanston, Johannesburg (lat=${ANCHOR.lat}, lng=${ANCHOR.lng})`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error during seeding:', error.message);
    console.error(error);
    process.exit(1);
  }
}

seedPharmacies();
