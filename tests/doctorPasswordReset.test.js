// Doctors could not reset a forgotten password: /users/forgot-password only
// looks in the patients table. These pin down the doctor pair of endpoints.
// The database is stubbed before anything loads: nothing here touches it.
//
// Run with: node tests/doctorPasswordReset.test.js
const assert = require('assert');
const bcrypt = require('bcrypt');
const db = require('../config/db');

const sent = [];
db.query = async (sql, params) => {
  sent.push({ sql, params });
  return { rows: [], rowCount: 0 };
};

const Doctor = require('../models/Doctor');
const OTP = require('../models/OTP');
const Session = require('../models/Session');
const AuditLog = require('../models/AuditLog');
const emailService = require('../services/emailService');
const DoctorController = require('../controllers/doctorController');

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
const req = (body) => ({ body, headers: {}, socket: {} });

// ── stubs ─────────────────────────────────────────────────────────────────
const doctor = { id: 17, email: 'dr@pholders.test', first_name: 'Thabo', password_hash: 'old' };
const state = {};
function reset() {
  Object.assign(state, {
    found: doctor,
    codeValid: true,
    wrongCodes: 0,
    emailFails: false,
    logged: [],
    emails: [],
    updates: [],
    signedOut: [],
    otpsCreated: [],
  });
  sent.length = 0;
}
Doctor.findByEmail = async () => state.found;
Doctor.update = async (id, data) => { state.updates.push({ id, data }); return {}; };
OTP.create = async (...args) => { state.otpsCreated.push(args); return { otp_code: '123456' }; };
OTP.verify = async () => (state.codeValid ? { valid: true } : { valid: false, message: 'Invalid or expired OTP' });
Session.invalidateUserSessions = async (...args) => { state.signedOut.push(args); return []; };
AuditLog.logSecurityEvent = async (...args) => { state.logged.push(args.slice(1)); };
AuditLog.countRecentEvents = async () => state.wrongCodes;
emailService.sendPasswordResetOTP = async (...args) => {
  if (state.emailFails) throw new Error('smtp down');
  state.emails.push(['otp', ...args]);
};
emailService.sendPasswordResetConfirmation = async (...args) => { state.emails.push(['done', ...args]); };

const goodReset = (extra = {}) => ({
  email: 'dr@pholders.test', otp: '123456',
  new_password: 'NewPass!2026', confirm_password: 'NewPass!2026', ...extra,
});

// ── forgot password ───────────────────────────────────────────────────────
it('a doctor gets a 15-minute doctor reset code by email', async () => {
  reset();
  const res = fakeRes();
  await DoctorController.forgotPassword(req({ email: ' dr@pholders.test ' }), res);
  assert.strictEqual(res.statusCode, 200);
  assert.deepStrictEqual(state.otpsCreated[0], [17, 'password_reset', 'doctor', 15]);
  assert.deepStrictEqual(state.emails[0], ['otp', 'dr@pholders.test', '123456', 'Thabo']);
});

it('an unknown email gets the same answer and no email', async () => {
  reset();
  state.found = undefined;
  const known = fakeRes();
  const unknown = fakeRes();
  reset();
  await DoctorController.forgotPassword(req({ email: 'dr@pholders.test' }), known);
  state.found = undefined;
  await DoctorController.forgotPassword(req({ email: 'nobody@pholders.test' }), unknown);
  assert.deepStrictEqual(unknown.body, known.body);
  assert.strictEqual(state.emails.length, 1, 'only the real doctor is emailed');
});

it('a missing or malformed email is refused', async () => {
  reset();
  for (const email of ['', 'not-an-email']) {
    const res = fakeRes();
    await DoctorController.forgotPassword(req({ email }), res);
    assert.strictEqual(res.statusCode, 400);
  }
  assert.strictEqual(state.otpsCreated.length, 0);
});

it('says so when the email could not be sent', async () => {
  reset();
  state.emailFails = true;
  const res = fakeRes();
  await DoctorController.forgotPassword(req({ email: 'dr@pholders.test' }), res);
  assert.strictEqual(res.statusCode, 500);
});

// ── reset password ────────────────────────────────────────────────────────
it('a right code sets the new password and signs every device out', async () => {
  reset();
  const res = fakeRes();
  await DoctorController.resetPassword(req(goodReset()), res);
  assert.strictEqual(res.statusCode, 200, JSON.stringify(res.body));
  assert.strictEqual(state.updates.length, 1);
  assert.ok(await bcrypt.compare('NewPass!2026', state.updates[0].data.password_hash));
  assert.deepStrictEqual(state.signedOut[0].slice(0, 2), [17, 'doctor']);
  assert.strictEqual(state.emails[0][0], 'done');
});

it('a wrong code changes nothing and is not a login failure', async () => {
  reset();
  state.codeValid = false;
  const res = fakeRes();
  await DoctorController.resetPassword(req(goodReset()), res);
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(state.updates.length, 0);
  const events = state.logged.map((l) => l[3]); // [userId, type, email, event, ...]
  assert.ok(events.includes('password_reset'));
  assert.ok(!events.includes('otp_failed') && !events.includes('login_failed'),
    'those would count towards the login lockout');
});

it('after five wrong codes the code is burned', async () => {
  reset();
  state.wrongCodes = 5;
  const res = fakeRes();
  await DoctorController.resetPassword(req(goodReset()), res);
  assert.strictEqual(res.statusCode, 429);
  assert.strictEqual(state.updates.length, 0);
  assert.match(sent[0].sql, /UPDATE otps SET is_used = true/);
  assert.deepStrictEqual(sent[0].params, [17]);
});

it('a weak or mismatched password is refused before the code is used', async () => {
  reset();
  let verified = 0;
  const realVerify = OTP.verify;
  OTP.verify = async () => { verified++; return { valid: true }; };
  try {
    for (const body of [
      goodReset({ confirm_password: 'Different!2026' }),
      goodReset({ new_password: 'weak', confirm_password: 'weak' }),
      goodReset({ otp: '' }),
    ]) {
      const res = fakeRes();
      await DoctorController.resetPassword(req(body), res);
      assert.strictEqual(res.statusCode, 400, JSON.stringify(body));
    }
    assert.strictEqual(verified, 0);
    assert.strictEqual(state.updates.length, 0);
  } finally {
    OTP.verify = realVerify;
  }
});

it('an unknown email gets the same answer as a wrong code', async () => {
  reset();
  state.found = undefined;
  const res = fakeRes();
  await DoctorController.resetPassword(req(goodReset()), res);
  assert.strictEqual(res.statusCode, 400);
  assert.match(res.body.message, /wrong or has expired/);
});

it('the routes exist and take no auth middleware', () => {
  // Loading the router pulls in payment clients that need live keys, so the
  // registration is checked in the source instead.
  const src = require('fs').readFileSync(require.resolve('../routes/userRoutes'), 'utf8');
  assert.match(src, /router\.post\('\/doctor\/forgot-password', DoctorController\.forgotPassword\);/);
  assert.match(src, /router\.post\('\/doctor\/reset-password', DoctorController\.resetPassword\);/);
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
