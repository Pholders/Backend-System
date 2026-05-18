/**
 * Test script for the patient "Find doctors near you" endpoints.
 *
 * Tests against the seeded Bryanston doctors:
 *   doc1 ~1km, doc2 ~3km, doc3 ~5km, doc4 ~8km, doc5 ~15km
 *
 * Usage:
 *   1. Start the server:        npm run dev
 *   2. Login as a patient and get a JWT (verify-otp returns it)
 *   3. Run:   $env:JWT="<paste-token>"; node tests/test-doctors-listing.js
 *      (PowerShell)
 *      or:    JWT=<paste-token> node tests/test-doctors-listing.js
 *      (bash)
 *
 * Optional env vars:
 *   HOST   defaults to http://localhost:3000
 *   JWT    required, the patient access token
 */

const http = require('http');

const HOST = process.env.HOST || 'http://localhost:3000';
const JWT = process.env.JWT;
const BASE_PATH = '/api/users';

// Bryanston anchor (matches seedDoctors.js)
const LAT = -26.0565;
const LNG = 28.0227;

if (!JWT) {
  console.error('❌ Missing JWT env var. Set it to a patient access token first.');
  console.error('   Example (PowerShell):  $env:JWT="eyJhbGciOi..."');
  process.exit(1);
}

function request(path) {
  const url = new URL(HOST + BASE_PATH + path);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${JWT}`,
          Accept: 'application/json',
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, json: JSON.parse(body) });
          } catch {
            resolve({ status: res.statusCode, json: body });
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

function summarize(doctors) {
  return doctors.map((d) => `${d.display_name} (${d.specialization}, R${d.consultation_fee}, ${d.distance_km}km)`);
}

async function runCase(label, path, expect) {
  console.log(`\n── ${label}`);
  console.log(`   GET ${path}`);
  const res = await request(path);
  if (res.status !== 200) {
    console.log(`   ❌ status ${res.status}:`, res.json);
    return;
  }
  const doctors = res.json.data.doctors;
  const pagination = res.json.data.pagination;
  console.log(`   ✓ status 200, returned ${doctors.length} doctor(s) (total: ${pagination.total})`);
  summarize(doctors).forEach((line) => console.log(`     • ${line}`));
  if (expect && doctors.length !== expect) {
    console.log(`   ⚠️  expected ${expect}, got ${doctors.length}`);
  }
  return doctors;
}

async function main() {
  console.log(`Testing against ${HOST}${BASE_PATH}`);
  console.log(`Patient location: lat=${LAT}, lng=${LNG} (Bryanston anchor)`);

  await runCase(
    '5 km radius (default) — expect 3 doctors',
    `/doctors?lat=${LAT}&lng=${LNG}`,
    3
  );

  await runCase(
    '10 km radius — expect 4 doctors',
    `/doctors?lat=${LAT}&lng=${LNG}&radius_km=10`,
    4
  );

  await runCase(
    '20 km radius — expect 5 doctors',
    `/doctors?lat=${LAT}&lng=${LNG}&radius_km=20`,
    5
  );

  await runCase(
    'Filter: specialty=General Practitioner, 20km — expect 2',
    `/doctors?lat=${LAT}&lng=${LNG}&radius_km=20&specialty=General%20Practitioner`,
    2
  );

  await runCase(
    'Filter: max_fee=300, 20km — expect 2 (R250 + R300)',
    `/doctors?lat=${LAT}&lng=${LNG}&radius_km=20&max_fee=300`,
    2
  );

  await runCase(
    'Pagination: limit=2 page=1, 20km — expect 2 of 5',
    `/doctors?lat=${LAT}&lng=${LNG}&radius_km=20&limit=2&page=1`,
    2
  );

  // Validation error case
  console.log(`\n── Validation: missing lat/lng — expect 400`);
  const bad = await request('/doctors');
  console.log(`   status ${bad.status}: ${bad.json.message}`);

  // Doctor details — use the closest doctor from the 5km query
  const closest = await runCase(
    'Fetch first doctor for details test',
    `/doctors?lat=${LAT}&lng=${LNG}&limit=1`,
    1
  );
  if (closest && closest[0]) {
    const id = closest[0].id;
    console.log(`\n── GET /doctors/${id} — expect full profile`);
    const details = await request(`/doctors/${id}`);
    if (details.status === 200) {
      const d = details.json.data;
      console.log(`   ✓ status 200`);
      console.log(`     display_name:   ${d.display_name}`);
      console.log(`     specialization: ${d.specialization}`);
      console.log(`     suburb/city:    ${d.suburb} / ${d.city}`);
      console.log(`     fee:            ${d.currency} ${d.consultation_fee}`);
      console.log(`     hours:          ${d.opens_at} - ${d.closes_at}`);
      console.log(`     experience:     ${d.experience} years`);
      console.log(`     rating:         ${d.rating} (${d.review_count} reviews)`);
      console.log(`     bio:            ${(d.bio || '').slice(0, 80)}...`);
    } else {
      console.log(`   ❌ status ${details.status}:`, details.json);
    }

    console.log(`\n── GET /doctors/999999 — expect 404`);
    const notFound = await request('/doctors/999999');
    console.log(`   status ${notFound.status}: ${notFound.json.message}`);
  }

  console.log('\n✅ Test run complete.\n');
}

main().catch((err) => {
  console.error('❌ Test run crashed:', err);
  process.exit(1);
});
