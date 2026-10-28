// Patients type their own vitals into the app. These pin down which readings
// are accepted, which are turned away as typos, and how BMI is worked out.
// No database: both functions under test are pure.
//
// Run with: node tests/vitalsService.test.js
const assert = require('assert');
const { validateVitals, computeBmi } = require('../services/vitalsService');

let passed = 0;
const failures = [];

function it(label, fn) {
  try {
    fn();
    passed++;
  } catch (error) {
    failures.push({ label, message: error.message });
  }
}

const NOW = new Date('2026-10-28T12:00:00Z');
const check = (body) => validateVitals(body, NOW);

// ── what gets through ─────────────────────────────────────────────────────
it('a full set of ordinary readings is accepted as numbers', () => {
  const { errors, values } = check({
    systolic_bp: 120, diastolic_bp: 80, heart_rate: 72, weight_kg: 74.5,
    blood_glucose: 5.4, oxygen_saturation: 98, temperature_c: 36.6,
  });
  assert.deepStrictEqual(errors, []);
  assert.strictEqual(values.weight_kg, 74.5);
  assert.strictEqual(values.blood_glucose, 5.4);
});

it('numbers typed as text are read as numbers', () => {
  const { errors, values } = check({ heart_rate: ' 72 ', weight_kg: '80.2' });
  assert.deepStrictEqual(errors, []);
  assert.strictEqual(values.heart_rate, 72);
  assert.strictEqual(values.weight_kg, 80.2);
});

it('a single reading on its own is enough', () => {
  assert.deepStrictEqual(check({ temperature_c: 37.2 }).errors, []);
});

it('an unhealthy but possible reading is kept, not judged', () => {
  assert.deepStrictEqual(check({ systolic_bp: 190, diastolic_bp: 110 }).errors, []);
  assert.deepStrictEqual(check({ blood_glucose: 22 }).errors, []);
});

it('blank fields are skipped rather than stored as zero', () => {
  const { errors, values } = check({ heart_rate: 70, weight_kg: '', blood_glucose: null });
  assert.deepStrictEqual(errors, []);
  assert.deepStrictEqual(Object.keys(values), ['heart_rate']);
});

// ── what gets turned away ─────────────────────────────────────────────────
it('an empty form is refused', () => {
  assert.strictEqual(check({}).errors.length, 1);
  assert.strictEqual(check({ notes: 'felt fine', height_cm: 170 }).errors.length, 1);
});

it('an impossible heart rate is refused', () => {
  assert.match(check({ heart_rate: 9999 }).errors[0], /Heart rate must be between/);
});

it('text that is not a number is refused', () => {
  assert.match(check({ weight_kg: 'heavy' }).errors[0], /must be a number/);
});

it('a fractional heart rate is refused', () => {
  assert.match(check({ heart_rate: 72.5 }).errors[0], /whole number/);
});

it('half a blood pressure is refused, either half', () => {
  assert.match(check({ systolic_bp: 120 }).errors[0], /both numbers/);
  assert.match(check({ diastolic_bp: 80 }).errors[0], /both numbers/);
});

it('blood pressure entered the wrong way round is refused', () => {
  assert.match(check({ systolic_bp: 80, diastolic_bp: 120 }).errors[0], /must be higher/);
});

it('oxygen above 100% is refused', () => {
  assert.strictEqual(check({ oxygen_saturation: 101 }).errors.length, 1);
});

it('every problem is reported, not just the first', () => {
  assert.strictEqual(check({ heart_rate: 0, temperature_c: 50 }).errors.length, 2);
});

it('any bmi the app sends is ignored', () => {
  assert.strictEqual(check({ weight_kg: 70, bmi: 99 }).values.bmi, undefined);
});

// ── when it was taken ─────────────────────────────────────────────────────
it('a reading from earlier today keeps its own time', () => {
  const { errors, values } = check({ heart_rate: 70, measured_at: '2026-10-28T07:30:00Z' });
  assert.deepStrictEqual(errors, []);
  assert.strictEqual(values.measured_at.toISOString(), '2026-10-28T07:30:00.000Z');
});

it('no time means the server stamps it now', () => {
  assert.strictEqual(check({ heart_rate: 70 }).values.measured_at, undefined);
});

it('a phone clock a minute fast is tolerated, tomorrow is not', () => {
  assert.deepStrictEqual(check({ heart_rate: 70, measured_at: '2026-10-28T12:01:00Z' }).errors, []);
  assert.match(check({ heart_rate: 70, measured_at: '2026-10-29T12:00:00Z' }).errors[0], /future/);
});

it('a reading over a year old is refused', () => {
  assert.match(check({ heart_rate: 70, measured_at: '2025-01-01T00:00:00Z' }).errors[0], /older than a year/);
});

it('a garbled time is refused', () => {
  assert.match(check({ heart_rate: 70, measured_at: 'yesterday' }).errors[0], /not a valid date/);
});

// ── notes ─────────────────────────────────────────────────────────────────
it('notes are trimmed and kept', () => {
  assert.strictEqual(check({ heart_rate: 70, notes: '  after a run ' }).values.notes, 'after a run');
});

it('an essay in the notes is refused', () => {
  assert.match(check({ heart_rate: 70, notes: 'x'.repeat(501) }).errors[0], /500 characters/);
});

// ── BMI ───────────────────────────────────────────────────────────────────
it('BMI is weight over height squared, to two places', () => {
  assert.strictEqual(computeBmi(70, 175), 22.86);
});

it('without a height there is no BMI', () => {
  assert.strictEqual(computeBmi(70, null), null);
  assert.strictEqual(computeBmi(null, 175), null);
});

// ── report ────────────────────────────────────────────────────────────────
for (const f of failures) console.log(`FAIL  ${f.label}\n      ${f.message}`);
console.log(`\n${passed} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
