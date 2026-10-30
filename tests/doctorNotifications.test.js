// A doctor used to be told nothing: notifications were stored for patients
// only. These pin down what a doctor is now told, that a failed notification
// never breaks the action behind it, and that a doctor reaches only their own
// inbox. The database is stubbed: nothing here touches it.
//
// Run with: node tests/doctorNotifications.test.js
const assert = require('assert');
const db = require('../config/db');

// Every query is recorded and answered from `answer`, never sent.
const sent = [];
let answer = () => ({ rows: [], rowCount: 0 });
db.query = async (sql, params) => {
  sent.push({ sql, params });
  return answer(sql, params);
};

const DoctorNotification = require('../models/DoctorNotification');
const Appointment = require('../models/Appointment');
const Prescription = require('../models/Prescription');
const DoctorReview = require('../models/DoctorReview');
const Doctor = require('../models/Doctor');
const AuditLog = require('../models/AuditLog');
const doctorNotifications = require('../services/doctorNotifications');
const DoctorNotificationController = require('../controllers/doctorNotificationController');
const ReviewController = require('../controllers/reviewController');

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

// Capture inbox writes instead of making them.
let created = [];
const realCreate = DoctorNotification.create;
const capture = async (row) => { created.push(row); return { id: created.length, ...row }; };

const appointment = {
  id: 69,
  doctor_id: 17,
  patient_first_name: 'Naledi',
  patient_last_name: 'Khumalo',
  appointment_date: new Date(2026, 10, 4), // Wed 4 Nov
  time_slot: '10:00:00',
};

// ── the wording ───────────────────────────────────────────────────────────
it('dates read as a day, date and time', () => {
  assert.strictEqual(doctorNotifications.when(new Date(2026, 10, 4), '10:00:00'), 'Wed 4 Nov at 10:00');
  assert.strictEqual(doctorNotifications.when('2026-10-30', '09:30'), 'Fri 30 Oct at 09:30');
  assert.strictEqual(doctorNotifications.when(null, null), 'an upcoming date');
});

it('a paid booking tells the doctor who, when, how they paid, and to accept it', async () => {
  created = [];
  DoctorNotification.create = capture;
  Appointment.findById = async () => appointment;
  await doctorNotifications.bookingConfirmed(69, 'cash_on_arrival');
  assert.strictEqual(created.length, 1);
  const [n] = created;
  assert.strictEqual(n.doctor_id, 17);
  assert.strictEqual(n.type, 'appointment');
  assert.strictEqual(n.title, 'New booking to accept');
  assert.match(n.body, /Naledi Khumalo booked Wed 4 Nov at 10:00 and will pay cash at the practice/);
  assert.deepStrictEqual(n.data, { appointmentId: 69, paymentMethod: 'cash_on_arrival' });
});

it('a move says where it was and where it is now', async () => {
  created = [];
  DoctorNotification.create = capture;
  Appointment.findById = async () => appointment;
  await doctorNotifications.appointmentRescheduled(69, new Date(2026, 9, 30), '09:00');
  assert.match(created[0].body, /from Fri 30 Oct at 09:00 to Wed 4 Nov at 10:00/);
});

it('a cancellation names the patient and the slot', async () => {
  created = [];
  DoctorNotification.create = capture;
  Appointment.findById = async () => appointment;
  await doctorNotifications.appointmentCancelled(69);
  assert.strictEqual(created[0].title, 'Appointment cancelled');
  assert.match(created[0].body, /Naledi Khumalo cancelled their appointment on Wed 4 Nov at 10:00/);
});

it('a dispensed script goes to the doctor who wrote it', async () => {
  created = [];
  DoctorNotification.create = capture;
  Prescription.getById = async () => ({
    id: 15, doctor_id: 17, prescription_number: 'RX-1', patient_name: 'Naledi Khumalo',
  });
  await doctorNotifications.prescriptionDispensed(15, 'Sunset Pharmacy');
  assert.strictEqual(created[0].doctor_id, 17);
  assert.strictEqual(created[0].type, 'prescription');
  assert.match(created[0].body, /RX-1 for Naledi Khumalo was dispensed at Sunset Pharmacy/);
});

it('a review gives the stars and a short quote, without the name', async () => {
  created = [];
  DoctorNotification.create = capture;
  await doctorNotifications.reviewReceived({
    id: 3, doctor_id: 17, rating: 4, review_text: 'x'.repeat(200),
  });
  assert.match(created[0].body, /^A patient rated you 4 out of 5: "x{117}\.\.\."$/);
});

it('editing a review rewrites the notification the doctor has, not a new one', async () => {
  created = [];
  DoctorNotification.create = capture;
  const replaced = [];
  const realReplace = DoctorNotification.replaceForReview;
  DoctorNotification.replaceForReview = async (doctorId, reviewId, row) => {
    replaced.push({ doctorId, reviewId, ...row });
    return { id: 9, ...row };
  };
  try {
    await doctorNotifications.reviewReceived({ id: 6, doctor_id: 17, rating: 2, review_text: 'Changed my mind' });
    assert.deepStrictEqual(created, [], 'no second row');
    assert.strictEqual(replaced.length, 1);
    assert.strictEqual(replaced[0].doctorId, 17);
    assert.strictEqual(replaced[0].reviewId, 6);
    assert.strictEqual(replaced[0].title, 'Review updated');
    assert.match(replaced[0].body, /rated you 2 out of 5: "Changed my mind"/);
  } finally {
    DoctorNotification.replaceForReview = realReplace;
  }
});

it('the first review has nothing to rewrite, so it arrives as new', async () => {
  created = [];
  DoctorNotification.create = capture;
  answer = () => ({ rows: [], rowCount: 0 }); // no notification for this review yet
  await doctorNotifications.reviewReceived({ id: 7, doctor_id: 17, rating: 5, review_text: '' });
  assert.strictEqual(created.length, 1);
  assert.strictEqual(created[0].title, 'New review');
});

it('the rewrite keeps the newest row and deletes older duplicates, for this doctor only', async () => {
  sent.length = 0;
  answer = () => ({ rows: [{ id: 4 }], rowCount: 1 });
  await DoctorNotification.replaceForReview(17, 6, { title: 't', body: 'b', data: {} });
  const { sql, params } = sent[0];
  assert.match(sql, /DELETE FROM doctor_notifications/);
  assert.match(sql, /ORDER BY created_at DESC, id DESC\s+LIMIT 1/);
  assert.match(sql, /doctor_id = \$1 AND type = 'review'/);
  assert.deepStrictEqual(params.slice(0, 2), [17, '6']);
});

// ── never breaks the action behind it ─────────────────────────────────────
it('a failed write or lookup is logged, not thrown', async () => {
  const realError = console.error;
  console.error = () => {};
  try {
    DoctorNotification.create = async () => { throw new Error('db down'); };
    Appointment.findById = async () => appointment;
    assert.strictEqual(await doctorNotifications.bookingConfirmed(69, 'stripe'), null);
    Appointment.findById = async () => { throw new Error('db down'); };
    assert.strictEqual(await doctorNotifications.appointmentCancelled(69), null);
    Prescription.getById = async () => { throw new Error('db down'); };
    assert.strictEqual(await doctorNotifications.prescriptionDispensed(15), null);
  } finally {
    console.error = realError;
  }
});

it('an appointment that is gone sends nothing', async () => {
  created = [];
  DoctorNotification.create = capture;
  Appointment.findById = async () => undefined;
  await doctorNotifications.bookingConfirmed(404, 'stripe');
  assert.deepStrictEqual(created, []);
});

it('submitting a review notifies the doctor', async () => {
  created = [];
  DoctorNotification.create = capture;
  answer = () => ({ rows: [], rowCount: 0 }); // their first review
  Doctor.findById = async () => ({ id: 17 });
  Appointment.hasPatientVisitedDoctor = async () => true;
  DoctorReview.create = async () => ({ id: 3, doctor_id: 17, rating: 5, review_text: 'Great' });
  AuditLog.logSecurityEvent = async () => {};
  const res = fakeRes();
  await ReviewController.submitReview(
    { body: { doctorId: 17, rating: 5, reviewText: 'Great' }, user: { id: 20, email: 'p@x' } }, res);
  await new Promise((resolve) => setImmediate(resolve));
  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(created.length, 1);
  assert.strictEqual(created[0].type, 'review');
});

// ── a doctor reaches only their own inbox ─────────────────────────────────
it('every inbox query is scoped to the signed-in doctor', async () => {
  DoctorNotification.create = realCreate;
  sent.length = 0;
  answer = (sql) => (sql.includes('COUNT') ? { rows: [{ count: 2 }] } : { rows: [], rowCount: 0 });
  await DoctorNotification.listForDoctor(17, { limit: 10 });
  await DoctorNotification.unreadCount(17);
  await DoctorNotification.setRead(5, 17);
  await DoctorNotification.markAllRead(17);
  await DoctorNotification.remove(5, 17);
  for (const { sql, params } of sent) {
    assert.match(sql, /doctor_id = \$/, sql);
    assert.ok(params.includes(17), `doctor id missing from ${sql}`);
  }
  assert.strictEqual(sent.length, 5);
});

it('the list returns the notifications and the unread count', async () => {
  answer = (sql) => (sql.includes('COUNT')
    ? { rows: [{ count: 1 }] }
    : { rows: [{ id: 1, title: 'New booking to accept', is_read: false }] });
  const res = fakeRes();
  await DoctorNotificationController.list({ user: { id: 17 }, query: { limit: '999' } }, res);
  assert.strictEqual(res.body.data.unreadCount, 1);
  assert.strictEqual(res.body.data.notifications.length, 1);
  const listing = sent.filter((q) => q.sql.includes('LIMIT')).pop();
  assert.strictEqual(listing.params[1], 200, 'the limit is capped');
});

it("marking another doctor's notification is a 404, not a change", async () => {
  answer = () => ({ rows: [], rowCount: 0 }); // the scoped UPDATE matched nothing
  const res = fakeRes();
  await DoctorNotificationController.setRead({ user: { id: 99 }, params: { id: '5' }, body: {} }, res);
  assert.strictEqual(res.statusCode, 404);
});

it('read: false marks it unread again', async () => {
  sent.length = 0;
  answer = () => ({ rows: [{ id: 5, is_read: false }], rowCount: 1 });
  const res = fakeRes();
  await DoctorNotificationController.setRead(
    { user: { id: 17 }, params: { id: '5' }, body: { read: false } }, res);
  assert.strictEqual(res.statusCode, 200);
  assert.deepStrictEqual(sent[0].params, [5, 17, false]);
});

it('a malformed id is a 400', async () => {
  const res = fakeRes();
  await DoctorNotificationController.setRead({ user: { id: 17 }, params: { id: 'abc' }, body: {} }, res);
  assert.strictEqual(res.statusCode, 400);
});

// ── report ────────────────────────────────────────────────────────────────
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
