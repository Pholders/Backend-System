// The doctor's security settings were switches with nothing behind them, and
// the sessions and activity log underneath them looked users up by id alone,
// though patients, doctors, pharmacies and admins all number from 1. These
// pin down the scoping, signing devices out, changing the password, and the
// notification choices. The database is stubbed: nothing here touches it.
//
// Run with: node tests/doctorSettings.test.js
const assert = require('assert');
const bcrypt = require('bcrypt');
const db = require('../config/db');

const sent = [];
let answer = () => ({ rows: [], rowCount: 0 });
db.query = async (sql, params) => {
  sent.push({ sql, params });
  return answer(sql, params);
};

const Session = require('../models/Session');
const AuditLog = require('../models/AuditLog');
const Doctor = require('../models/Doctor');
const DoctorNotification = require('../models/DoctorNotification');
const Appointment = require('../models/Appointment');
const DoctorController = require('../controllers/doctorController');
const doctorNotifications = require('../services/doctorNotifications');

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

const realLog = AuditLog.logSecurityEvent;
const logged = [];
AuditLog.logSecurityEvent = async (...args) => { logged.push(args); };

const doctorReq = (extra = {}) => ({
  user: { id: 17, email: 'dr@pholders.test', role: 'doctor' },
  authSession: { id: 'current-session' },
  params: {},
  body: {},
  ip: '1.2.3.4',
  get: () => 'test',
  ...extra,
});

// ── one id, four kinds of user ────────────────────────────────────────────
it('every session lookup and revocation is scoped by user type', async () => {
  sent.length = 0;
  await Session.getUserActiveSessions(17, 'doctor');
  await Session.revokeAllExcept(17, 'doctor', 'keep', 'x');
  await Session.invalidateUserSessions(17, 'patient', 'x');
  await Session.revokeOwn('s1', 17, 'doctor');
  assert.strictEqual(sent.length, 4);
  for (const { sql, params } of sent) {
    assert.match(sql, /user_id = \$\d+ AND user_type = \$\d+/, sql);
  }
  assert.deepStrictEqual(sent[0].params, [17, 'doctor']);
  assert.deepStrictEqual(sent[2].params.slice(0, 2), [17, 'patient']);
});

it('leaving the user type out fails loudly instead of matching everyone', async () => {
  await assert.rejects(() => Session.getUserActiveSessions(17), /user type required/);
  await assert.rejects(() => Session.invalidateUserSessions(17, 'Password reset'), /user type required/);
  await assert.rejects(() => AuditLog.getUserActivity(17, 50), /user type|getUserActivity/);
});

it("the doctor's activity log asks only for doctor events", async () => {
  sent.length = 0;
  await AuditLog.getUserActivity(17, 'doctor', 20);
  assert.match(sent[0].sql, /user_id = \$1 AND user_type = \$2/);
  assert.deepStrictEqual(sent[0].params, [17, 'doctor', 20]);
});

// ── signing devices out ───────────────────────────────────────────────────
it('a doctor can sign out one of their other devices', async () => {
  sent.length = 0;
  answer = () => ({ rows: [{ id: 'other' }], rowCount: 1 });
  const res = fakeRes();
  await DoctorController.revokeSession(doctorReq({ params: { sessionId: 'other' } }), res);
  assert.strictEqual(res.statusCode, 200);
  assert.deepStrictEqual(sent[0].params.slice(0, 3), ['other', 17, 'doctor']);
});

it("someone else's session, or one already over, is a 404", async () => {
  answer = () => ({ rows: [], rowCount: 0 }); // the scoped UPDATE matched nothing
  const res = fakeRes();
  await DoctorController.revokeSession(doctorReq({ params: { sessionId: 'not-mine' } }), res);
  assert.strictEqual(res.statusCode, 404);
});

it('this device is not signed out from the device list', async () => {
  sent.length = 0;
  const res = fakeRes();
  await DoctorController.revokeSession(doctorReq({ params: { sessionId: 'current-session' } }), res);
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(sent.length, 0);
});

it('signing out every other device keeps this one', async () => {
  sent.length = 0;
  answer = () => ({ rows: [{ id: 'a' }, { id: 'b' }], rowCount: 2 });
  const res = fakeRes();
  await DoctorController.revokeOtherSessions(doctorReq(), res);
  assert.strictEqual(res.body.data.revoked, 2);
  assert.deepStrictEqual(sent[0].params.slice(0, 3), [17, 'doctor', 'current-session']);
});

// ── changing the password ─────────────────────────────────────────────────
const realFind = Doctor.findById;
const realUpdate = Doctor.update;
let updated;
async function withDoctor(fn) {
  const hash = await bcrypt.hash('OldPass!2026', 4);
  Doctor.findById = async () => ({ id: 17, email: 'dr@pholders.test', password_hash: hash });
  updated = null;
  Doctor.update = async (id, data) => { updated = { id, ...data }; return {}; };
  try {
    await fn();
  } finally {
    Doctor.findById = realFind;
    Doctor.update = realUpdate;
  }
}

it('the wrong current password changes nothing', () => withDoctor(async () => {
  const res = fakeRes();
  await DoctorController.changePassword(
    doctorReq({ body: { currentPassword: 'Guess!2026x', newPassword: 'NewPass!2026' } }), res);
  assert.strictEqual(res.statusCode, 400);
  assert.match(res.body.message, /current password is not right/);
  assert.strictEqual(updated, null);
}));

it('a weak new password is refused with the reasons', () => withDoctor(async () => {
  const res = fakeRes();
  await DoctorController.changePassword(
    doctorReq({ body: { currentPassword: 'OldPass!2026', newPassword: 'short' } }), res);
  assert.strictEqual(res.statusCode, 400);
  assert.ok(res.body.errors.length > 0);
  assert.strictEqual(updated, null);
}));

it('the same password again is refused', () => withDoctor(async () => {
  const res = fakeRes();
  await DoctorController.changePassword(
    doctorReq({ body: { currentPassword: 'OldPass!2026', newPassword: 'OldPass!2026' } }), res);
  assert.strictEqual(res.statusCode, 400);
}));

it('a good change saves a new hash and signs out the other devices', () => withDoctor(async () => {
  sent.length = 0;
  answer = () => ({ rows: [{ id: 'old-laptop' }], rowCount: 1 });
  const res = fakeRes();
  await DoctorController.changePassword(
    doctorReq({ body: { currentPassword: 'OldPass!2026', newPassword: 'NewPass!2026' } }), res);
  assert.strictEqual(res.statusCode, 200);
  assert.ok(await bcrypt.compare('NewPass!2026', updated.password_hash));
  assert.strictEqual(res.body.data.otherDevicesSignedOut, 1);
  assert.deepStrictEqual(sent[0].params.slice(0, 3), [17, 'doctor', 'current-session']);
}));

// ── what the doctor wants to be told ──────────────────────────────────────
it('notification choices must be known kinds, on or off', () => {
  assert.strictEqual(doctorNotifications.preferencesProblem({ newBookings: false, reviews: true }), null);
  assert.match(doctorNotifications.preferencesProblem({ marketing: true }), /Unknown notification choice/);
  assert.match(doctorNotifications.preferencesProblem({ reviews: 'no' }), /true or false/);
  assert.match(doctorNotifications.preferencesProblem([]), /object/);
});

it('a kind the doctor switched off is not sent; the others still are', async () => {
  const created = [];
  const realCreate = DoctorNotification.create;
  const realPrefs = DoctorNotification.preferencesFor;
  DoctorNotification.create = async (row) => { created.push(row); return row; };
  DoctorNotification.preferencesFor = async () => ({ newBookings: false });
  Appointment.findById = async () => ({
    id: 69, doctor_id: 17, patient_first_name: 'Naledi', patient_last_name: 'Khumalo',
    appointment_date: new Date(2026, 10, 4), time_slot: '10:00',
  });
  try {
    await doctorNotifications.bookingConfirmed(69, 'stripe');
    assert.strictEqual(created.length, 0, 'new bookings are off');
    await doctorNotifications.appointmentCancelled(69);
    assert.strictEqual(created.length, 1, 'changes are still on');
  } finally {
    DoctorNotification.create = realCreate;
    DoctorNotification.preferencesFor = realPrefs;
  }
});

it('reviews switched off are neither added nor rewritten', async () => {
  const realPrefs = DoctorNotification.preferencesFor;
  const realReplace = DoctorNotification.replaceForReview;
  let touched = false;
  DoctorNotification.preferencesFor = async () => ({ reviews: false });
  DoctorNotification.replaceForReview = async () => { touched = true; return null; };
  try {
    const result = await doctorNotifications.reviewReceived({ id: 6, doctor_id: 17, rating: 4 });
    assert.strictEqual(result, null);
    assert.strictEqual(touched, false);
  } finally {
    DoctorNotification.preferencesFor = realPrefs;
    DoctorNotification.replaceForReview = realReplace;
  }
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
  AuditLog.logSecurityEvent = realLog;
  for (const f of failures) console.log(`FAIL  ${f.label}\n      ${f.message}`);
  console.log(`\n${passed} passed, ${failures.length} failed`);
  process.exit(failures.length ? 1 : 0);
})();
