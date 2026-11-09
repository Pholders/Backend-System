// A consultation records blood pressure, pulse and weight as a rule, so the
// doctor's form shows those three and lets the doctor add the rest. One list
// on the server drives both the checks and the form. BMI is worked out from
// weight and height, taking whichever was not measured today from the last
// reading. The database is stubbed: nothing here touches it.
//
// Run with: node tests/vitalKinds.test.js
const assert = require('assert');
const { VITAL_KINDS, LIMITS } = require('../services/vitalsService');
const PHR = require('../models/PHR');
const PHRAccess = require('../models/PHRAccess');
const PHRController = require('../controllers/phrController');

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

// ── the list ──────────────────────────────────────────────────────────────
it('blood pressure, pulse and weight are the defaults, in that order', () => {
  assert.deepStrictEqual(
    VITAL_KINDS.filter((k) => k.default).map((k) => k.key),
    ['blood_pressure', 'heart_rate', 'weight_kg']
  );
});

it('height, temperature, oxygen and glucose can be added', () => {
  assert.deepStrictEqual(
    VITAL_KINDS.filter((k) => !k.default).map((k) => k.key),
    ['height_cm', 'temperature_c', 'oxygen_saturation', 'blood_glucose']
  );
});

it('the checks come from the same list, one rule per field', () => {
  const fields = VITAL_KINDS.flatMap((k) => k.fields.map((f) => f.key));
  assert.deepStrictEqual(Object.keys(LIMITS), fields);
  assert.strictEqual(LIMITS.systolic_bp.unit, 'mmHg');
  assert.strictEqual(LIMITS.heart_rate.integer, true);
});

it('the endpoint serves the list and says BMI is worked out', () => {
  const res = fakeRes();
  PHRController.getVitalKinds({}, res);
  assert.strictEqual(res.body.data.kinds, VITAL_KINDS);
  assert.deepStrictEqual(res.body.data.derived[0].from, ['weight_kg', 'height_cm']);
});

// ── BMI ───────────────────────────────────────────────────────────────────
let saved;
let latest;
PHRAccess.hasAppointmentWith = async () => true;
PHRAccess.hasAccess = async () => false;
PHRAccess.logAccess = async () => {};
PHR.getLatestWeight = async () => latest.weight;
PHR.getLatestHeight = async () => latest.height;
PHR.recordHealthVital = async (patientId, values) => { saved = values; return values; };

async function record(body) {
  saved = null;
  const res = fakeRes();
  await PHRController.recordPatientVital(
    { user: { id: 17 }, params: { patientId: '20' }, body, ip: '1.2.3.4' }, res);
  return res;
}

it('weight and height taken together give the BMI', async () => {
  latest = { weight: null, height: null };
  const res = await record({ weight_kg: 81, height_cm: 180 });
  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(saved.bmi, 25);
});

it('weight today uses the height on record', async () => {
  latest = { weight: null, height: 175 };
  await record({ weight_kg: 81.2 });
  assert.strictEqual(saved.bmi, 26.51);
});

it('height today uses the weight on record', async () => {
  latest = { weight: 72, height: null };
  const res = await record({ height_cm: 170 });
  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(saved.bmi, 24.91);
});

it('no BMI without both, and none for a pulse alone', async () => {
  latest = { weight: null, height: null };
  await record({ weight_kg: 70 });
  assert.strictEqual(saved.bmi, null);
  await record({ heart_rate: 72 });
  assert.strictEqual(saved.bmi, undefined);
});

(async () => {
  for (const { label, fn } of tests) {
    try {
      await fn();
      passed++;
    } catch (error) {
      failures.push({ label, message: error.message });
    }
  }
  for (const f of failures) console.log(`FAIL  ${f.label}\n      ${f.message}`);
  console.log(`\n${passed} passed, ${failures.length} failed`);
  process.exit(failures.length ? 1 : 0);
})();
