// A pharmacy's own profile edits. The settings screens sent nothing, and the
// endpoint behind them passed the body straight to the model, which let a
// pharmacy set its own status (so a suspended one could reactivate itself)
// while dropping names and operating hours. The database is stubbed.
//
// Run with: node tests/pharmacyProfile.test.js
const assert = require('assert');
const db = require('../config/db');

const sent = [];
db.query = async (sql, params) => {
  sent.push({ sql, params });
  if (/UPDATE pharmacies/.test(sql)) {
    return { rows: [{ id: 17, email: 'p@x.test', password_hash: 'secret' }], rowCount: 1 };
  }
  return { rows: [], rowCount: 0 };
};

const PharmacyController = require('../controllers/pharmacyController');

let passed = 0;
const failures = [];
const tests = [];
const it = (label, fn) => tests.push({ label, fn });

function fakeRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

const request = (body) => ({
  user: { id: 17, role: 'pharmacy' },
  body,
  headers: {},
  get: () => undefined,
  ip: '127.0.0.1',
  connection: { remoteAddress: '127.0.0.1' },
  socket: { remoteAddress: '127.0.0.1' },
});

const lastUpdate = () => sent.filter((s) => /UPDATE pharmacies/.test(s.sql)).pop();

it('a pharmacy cannot set its own status, licence or email', async () => {
  sent.length = 0;
  const res = fakeRes();
  await PharmacyController.updateProfile(request({
    pharmacy_name: 'Bryanston Central',
    status: 'active',
    license_number: 'FAKE',
    email: 'new@x.test',
  }), res);
  assert.strictEqual(res.statusCode, 200);
  const update = lastUpdate();
  assert.ok(update, 'an update was sent');
  assert.ok(!/status\s*=/.test(update.sql), update.sql);
  assert.ok(!/license_number|email\s*=/.test(update.sql), update.sql);
  assert.ok(/pharmacy_name = \$1/.test(update.sql));
});

it('names and operating hours are saved', async () => {
  sent.length = 0;
  const hours = { monday: ['08:00-18:00'], sunday: [] };
  const res = fakeRes();
  await PharmacyController.updateProfile(request({
    first_name: 'Alice',
    last_name: 'Johnson',
    operating_hours: hours,
  }), res);
  assert.strictEqual(res.statusCode, 200);
  const update = lastUpdate();
  assert.ok(/first_name = \$1, last_name = \$2, operating_hours = \$3/.test(update.sql), update.sql);
  assert.deepStrictEqual(update.params.slice(0, 3), ['Alice', 'Johnson', JSON.stringify(hours)]);
  assert.strictEqual(update.params[3], 17, 'scoped to the signed-in pharmacy');
});

it('the password hash never comes back', async () => {
  const res = fakeRes();
  await PharmacyController.updateProfile(request({ phone: '0110001001' }), res);
  assert.strictEqual(res.body.data.password_hash, undefined);
});

it('an empty required field is refused before the database', async () => {
  sent.length = 0;
  const res = fakeRes();
  await PharmacyController.updateProfile(request({ pharmacy_name: '   ' }), res);
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(lastUpdate(), undefined);
});

it('a body with nothing editable is refused', async () => {
  sent.length = 0;
  const res = fakeRes();
  await PharmacyController.updateProfile(request({ status: 'active' }), res);
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(lastUpdate(), undefined);
});

(async () => {
  for (const { label, fn } of tests) {
    try {
      await fn();
      passed += 1;
      console.log(`  ok  ${label}`);
    } catch (error) {
      failures.push(label);
      console.log(`  FAIL ${label}\n       ${error.message}`);
    }
  }
  console.log(`\n${passed} passed, ${failures.length} failed`);
  process.exit(failures.length ? 1 : 0);
})();
