// The reminder text and the local-time helpers behind medication doses.
// Schedule times are South African wall-clock time while the server and
// database run in UTC, so these pin the conversion. No database.
//
// Run with: node tests/medicationDoseService.test.js
const assert = require('assert');
const {
  localTime,
  localDate,
  reminderMessage,
} = require('../services/medicationDoseService');

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

it('a UTC instant is shown in South African time', () => {
  assert.strictEqual(localTime('2026-11-21T06:00:00.000Z'), '08:00');
  assert.strictEqual(localTime('2026-11-21T18:30:00.000Z'), '20:30');
});

it('midnight shows as 00:00, not 24:00', () => {
  assert.strictEqual(localTime('2026-11-20T22:00:00.000Z'), '00:00');
});

it('the local date rolls over two hours before UTC does', () => {
  assert.strictEqual(localDate('2026-11-20T21:59:00.000Z'), '2026-11-20');
  assert.strictEqual(localDate('2026-11-20T22:00:00.000Z'), '2026-11-21');
});

it('the reminder names the medication, dosage and local time', () => {
  const message = reminderMessage({
    name: 'Metformin',
    dosage: '500mg tablet',
    scheduled_at: new Date('2026-11-21T06:00:00.000Z'),
  });
  assert.strictEqual(message.title, 'Medication Reminder');
  assert.strictEqual(message.body, 'Your 08:00 dose of Metformin (500mg tablet) is due.');
});

it('a missing dosage is left out rather than shown empty', () => {
  const message = reminderMessage({ name: 'Metformin', dosage: '', scheduled_at: '2026-11-21T06:00:00Z' });
  assert.strictEqual(message.body, 'Your 08:00 dose of Metformin is due.');
});

it('a long dosage is cut so the notification stays readable', () => {
  const message = reminderMessage({ name: 'X', dosage: 'a'.repeat(250), scheduled_at: '2026-11-21T06:00:00Z' });
  assert.ok(message.body.length < 120, `body is ${message.body.length} characters`);
});

console.log(`${passed} passed, ${failures.length} failed`);
for (const failure of failures) console.log(`  ✗ ${failure.label}\n    ${failure.message}`);
process.exit(failures.length ? 1 : 0);
