const { pool, query } = require('./db');

const DOCTOR_EMAIL_VERIFIED_AT = '2026-09-13T10:00:00.000Z';
const PHARMACY_EMAIL_VERIFIED_AT = '2026-09-13T10:30:00.000Z';

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function titleCaseWords(value) {
  return String(value || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function buildDoctorAvailability(opensAt, closesAt) {
  return {
    monday: [`${opensAt}-${closesAt}`],
    tuesday: [`${opensAt}-${closesAt}`],
    wednesday: [`${opensAt}-${closesAt}`],
    thursday: [`${opensAt}-${closesAt}`],
    friday: [`${opensAt}-${closesAt}`],
    saturday: ['09:00-13:00'],
    sunday: [],
  };
}

function buildPharmacyHours(is24Hours) {
  if (is24Hours) {
    return {
      monday: ['00:00-23:59'],
      tuesday: ['00:00-23:59'],
      wednesday: ['00:00-23:59'],
      thursday: ['00:00-23:59'],
      friday: ['00:00-23:59'],
      saturday: ['00:00-23:59'],
      sunday: ['00:00-23:59'],
    };
  }

  return {
    monday: ['08:00-18:00'],
    tuesday: ['08:00-18:00'],
    wednesday: ['08:00-18:00'],
    thursday: ['08:00-18:00'],
    friday: ['08:00-18:00'],
    saturday: ['09:00-14:00'],
    sunday: [],
  };
}

function doctorProfile(row) {
  const firstName = titleCaseWords(row.first_name);
  const lastName = titleCaseWords(row.last_name);
  const city = titleCaseWords(row.city);
  const province = titleCaseWords(row.province);
  const specialization = titleCaseWords(row.specialization || 'General Practice');
  const clinicName = row.clinic_name || `${firstName} ${lastName} Practice`;
  const suburb = city;
  const clinicAddress = row.clinic_address || `${city}, ${province}, South Africa`;
  const address = `${clinicName}, ${clinicAddress}`;
  const zipCodeByCity = {
    Stellenbosch: '7600',
    Mmabatho: '2790',
    Johannesburg: '2000',
    Centurion: '0157',
    Boksburg: '1459',
    Empangeni: '3880',
    Mahikeng: '2745',
    Wellington: '7655',
    'Cape Town': '8001',
  };
  const qualificationBySpecialization = {
    Cardiologist: 'MBChB, FCP (SA), Cert Cardiology',
    'General Practice': 'MBChB',
    'General Practitioner': 'MBChB',
    Bio: 'BSc, MBChB',
    Thandi: 'MBChB, Dip Primary Care',
  };
  const feeBySpecialization = {
    Cardiologist: 1200,
    'General Practice': 350,
    'General Practitioner': 350,
    Bio: 300,
    Thandi: 420,
  };
  const ratingBySpecialization = {
    Cardiologist: 4.8,
    'General Practice': 4.7,
    'General Practitioner': 4.7,
    Bio: 4.4,
    Thandi: 4.5,
  };
  const opensAt = '08:00';
  const closesAt = '17:00';
  const reviewCount = row.review_count && Number(row.review_count) > 0 ? Number(row.review_count) : 180 + row.id * 37;
  const specializationSlug = slugify(specialization || 'doctor');

  return {
    qualification: qualificationBySpecialization[specialization] || 'MBChB',
    address,
    zip_code: zipCodeByCity[city] || '0001',
    consultation_fee: row.consultation_fee || feeBySpecialization[specialization] || 350,
    bio: `${firstName} ${lastName} is a ${specialization.toLowerCase()} based in ${city}, supporting patients with structured consultations and follow-up care.`,
    profile_image: `https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=600&q=80&doctor=${specializationSlug}`,
    availability: buildDoctorAvailability(opensAt, closesAt),
    details: `${firstName} consults from ${clinicName} and supports in-person care, repeat follow-ups, and coordinated referrals where needed.`,
    suburb,
    rating: row.rating || ratingBySpecialization[specialization] || 4.6,
    review_count: reviewCount,
    opens_at: opensAt,
    closes_at: closesAt,
    email_verified: row.email_verified === true ? row.email_verified : true,
    email_verified_at: row.email_verified_at || DOCTOR_EMAIL_VERIFIED_AT,
  };
}

function pharmacyProfile(row) {
  const pharmacyName = row.pharmacy_name || `${titleCaseWords(row.first_name)} Pharmacy`;
  const city = titleCaseWords(row.city);
  const province = titleCaseWords(row.province);
  const is24Hours = row.is_24_hours === true || /urgent|24|wellness/i.test(pharmacyName);
  const serviceMap = {
    Johannesburg: ['prescription_filling', 'health_screening', 'delivery'],
    'Cape Town': ['prescription_filling', 'vaccination', 'health_screening'],
    Wellington: ['prescription_filling', 'health_screening'],
    Mahikeng: ['prescription_filling', 'delivery', 'health_screening'],
  };
  const deliveryRadius = row.delivery_available === false ? 0 : 8;
  const citySlug = slugify(city || 'pharmacy');

  return {
    address: `${pharmacyName}, ${city}, ${province}, South Africa`,
    zip_code: {
      'Cape Town': '8001',
      Wellington: '7655',
      Mahikeng: '2745',
      Johannesburg: '2000',
    }[city] || '0001',
    latitude: row.latitude || ({ 'Cape Town': '-33.92490000', Wellington: '-33.63980000', Mahikeng: '-25.86520000', Johannesburg: '-26.20410000' }[city] || '-26.20410000'),
    longitude: row.longitude || ({ 'Cape Town': '18.42410000', Wellington: '18.98580000', Mahikeng: '25.64430000', Johannesburg: '28.04730000' }[city] || '28.04730000'),
    operating_hours: buildPharmacyHours(is24Hours),
    services: row.services && row.services.length ? row.services : (serviceMap[city] || ['prescription_filling', 'health_screening']),
    delivery_radius: row.delivery_radius != null ? row.delivery_radius : deliveryRadius,
    website: row.website || `https://${slugify(pharmacyName)}.seed.test`,
    description: `${pharmacyName} serves ${city} with prescription support, walk-in assistance, and reliable medication collection workflows.`,
    profile_image: `https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=600&q=80&pharmacy=${citySlug}`,
    is_24_hours: row.is_24_hours === true ? true : is24Hours,
    email_verified: row.email_verified === true ? row.email_verified : true,
    email_verified_at: row.email_verified_at || PHARMACY_EMAIL_VERIFIED_AT,
  };
}

function mergeMissingFields(row, defaults) {
  const updates = {};

  Object.entries(defaults).forEach(([key, value]) => {
    const currentValue = row[key];
    const isMissing = currentValue === null || currentValue === undefined || currentValue === '';
    const isFalseVerification = key === 'email_verified' && currentValue === false;

    if (isMissing || isFalseVerification) {
      updates[key] = value;
    }
  });

  return updates;
}

async function updateRecord(tableName, id, updates, client) {
  const keys = Object.keys(updates);
  if (!keys.length) {
    return false;
  }

  const assignments = keys.map((key, index) => `${key} = $${index + 1}`);
  const values = keys.map((key) => {
    if (key === 'availability' || key === 'operating_hours') {
      return JSON.stringify(updates[key]);
    }
    return updates[key];
  });

  values.push(id);

  await client.query(
    `UPDATE ${tableName}
     SET ${assignments.join(', ')}, updated_at = CURRENT_TIMESTAMP
     WHERE id = $${keys.length + 1}`,
    values
  );

  return true;
}

async function backfillProviderDetails() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run provider detail backfill in production');
  }

  const client = await pool.connect();

  try {
    const doctorResult = await query('SELECT * FROM doctors ORDER BY id');
    const pharmacyResult = await query('SELECT * FROM pharmacies ORDER BY id');

    await client.query('BEGIN');

    let doctorsUpdated = 0;
    for (const doctor of doctorResult.rows) {
      const updates = mergeMissingFields(doctor, doctorProfile(doctor));
      const didUpdate = await updateRecord('doctors', doctor.id, updates, client);
      if (didUpdate) {
        doctorsUpdated++;
        console.log(`  ✓ doctor    ${doctor.email}`);
      }
    }

    let pharmaciesUpdated = 0;
    for (const pharmacy of pharmacyResult.rows) {
      const updates = mergeMissingFields(pharmacy, pharmacyProfile(pharmacy));
      const didUpdate = await updateRecord('pharmacies', pharmacy.id, updates, client);
      if (didUpdate) {
        pharmaciesUpdated++;
        console.log(`  ✓ pharmacy  ${pharmacy.email}`);
      }
    }

    await client.query('COMMIT');

    console.log(`\n✅ Provider detail backfill complete. Doctors updated: ${doctorsUpdated}, Pharmacies updated: ${pharmaciesUpdated}`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  backfillProviderDetails()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Provider detail backfill failed:', error);
      pool.end().finally(() => process.exit(1));
    });
}

module.exports = { backfillProviderDetails };