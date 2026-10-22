// The dispensary turns each line of a prescription into an active medication
// for the patient, and works out when to take it from the frequency the
// doctor typed. That text is free-form, so this pins down what each shape of
// it produces. No database: both functions under test are pure.
//
// Run with: node tests/prescriptionMedicationService.test.js
const assert = require('assert');
const {
  scheduleFromFrequency,
  durationDays,
} = require('../services/prescriptionMedicationService');

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

const times = (frequency) => scheduleFromFrequency(frequency).slice().sort();

// ── how often, in words ───────────────────────────────────────────────────
it('once a day is a single morning dose', () => {
  assert.deepStrictEqual(times('Once a day'), ['08:00']);
});

it('twice a day is morning and evening', () => {
  assert.deepStrictEqual(times('Twice a day'), ['08:00', '20:00']);
});

it('three times a day spreads across the waking day', () => {
  assert.deepStrictEqual(times('Three times a day'), ['08:00', '14:00', '20:00']);
});

it('four times a day is every four hours while awake', () => {
  assert.deepStrictEqual(times('Four times a day'), ['08:00', '12:00', '16:00', '20:00']);
});

it('a digit reads the same as the word', () => {
  assert.deepStrictEqual(times('3 times a day'), times('Three times a day'));
  assert.deepStrictEqual(times('2x daily'), times('Twice a day'));
});

// ── how often, in the abbreviations prescribers actually write ────────────
it('the Latin abbreviations are understood', () => {
  assert.deepStrictEqual(times('BD'), ['08:00', '20:00']);
  assert.deepStrictEqual(times('TDS'), ['08:00', '14:00', '20:00']);
  assert.deepStrictEqual(times('QDS'), ['08:00', '12:00', '16:00', '20:00']);
  assert.deepStrictEqual(times('bid'), ['08:00', '20:00']);
  assert.deepStrictEqual(times('tid'), ['08:00', '14:00', '20:00']);
  assert.deepStrictEqual(times('qid'), ['08:00', '12:00', '16:00', '20:00']);
});

it('case does not matter', () => {
  assert.deepStrictEqual(times('tds'), times('TDS'));
});

// ── intervals ─────────────────────────────────────────────────────────────
it('every 8 hours runs right round the clock, unlike three times a day', () => {
  // The distinction matters clinically: an antibiotic on a strict interval
  // wakes the patient; a three-times-a-day dose does not.
  assert.deepStrictEqual(times('every 8 hours'), ['00:00', '08:00', '16:00']);
  assert.notDeepStrictEqual(times('every 8 hours'), times('three times a day'));
});

it('every 6 and every 12 hours', () => {
  assert.deepStrictEqual(times('every 6 hours'), ['02:00', '08:00', '14:00', '20:00']);
  assert.deepStrictEqual(times('every 12 hours'), ['08:00', '20:00']);
});

it('the q8h shorthand works too', () => {
  assert.deepStrictEqual(times('q8h'), ['00:00', '08:00', '16:00']);
});

it('every 24 hours is one dose, not two', () => {
  assert.deepStrictEqual(times('every 24 hours'), ['08:00']);
});

// ── time of day ───────────────────────────────────────────────────────────
it('night-time wording moves the dose to the evening', () => {
  assert.deepStrictEqual(times('at night'), ['21:00']);
  assert.deepStrictEqual(times('nocte'), ['21:00']);
  assert.deepStrictEqual(times('Once daily at bedtime'), ['21:00']);
});

// ── nothing useful to go on ───────────────────────────────────────────────
it('unreadable or missing frequency still yields a dose rather than none', () => {
  // A medication with an empty schedule would never remind the patient, so
  // falling back to one morning dose is the safer failure.
  for (const input of ['', null, undefined, 'as directed', 'PRN']) {
    assert.deepStrictEqual(scheduleFromFrequency(input), ['08:00'],
      `expected a fallback dose for ${JSON.stringify(input)}`);
  }
});

// ── how long to take it ───────────────────────────────────────────────────
it('a stated duration wins', () => {
  assert.strictEqual(durationDays('7 days', 21, 3), 7);
  assert.strictEqual(durationDays('2 weeks', 100, 2), 14);
  assert.strictEqual(durationDays('1 month', 30, 1), 30);
  assert.strictEqual(durationDays('three days', 9, 3), 3);
});

it('with no duration, the quantity dispensed decides', () => {
  assert.strictEqual(durationDays('', 24, 3), 8);
  assert.strictEqual(durationDays(null, 30, 1), 30);
});

it('a part day rounds up, so the last dose is covered', () => {
  assert.strictEqual(durationDays('', 10, 3), 4);
});

it('with neither, it falls back to a month', () => {
  assert.strictEqual(durationDays('', null, 3), 30);
  assert.strictEqual(durationDays(null, 0, 3), 30);
});

it('a duration never comes back as zero days', () => {
  // A zero-day course would end before it started.
  assert.ok(durationDays('', 1, 3) >= 1);
  assert.ok(durationDays('', 2, 4) >= 1);
});

// ── report ────────────────────────────────────────────────────────────────
for (const f of failures) console.log(`FAIL  ${f.label}\n      ${f.message}`);
console.log(`\n${passed} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
