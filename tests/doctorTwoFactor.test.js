// Doctor two-factor sign-in: an emailed code on the first sign-in of the day
// on each browser, when the doctor has it switched on (agreed 2026-11-25).
// The database is stubbed before anything loads: nothing here touches it.
//
// Run with: node tests/doctorTwoFactor.test.js
const assert = require('assert');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
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
const twoFactor = require('../utils/doctorTwoFactor');

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
const req = (body, user) => ({ body, user, headers: {}, socket: {} });

// ── stubs ─────────────────────────────────────────────────────────────────
const PASSWORD = 'CheckDoc!2026xY';
const HASH = bcrypt.hashSync(PASSWORD, 4);
const state = {};
function reset({ twoFa = false } = {}) {
  Object.assign(state, {
    doctor: {
      id: 17, email: 'dr@pholders.test', first_name: 'Thabo', last_name: 'M',
      status: 'active', password_hash: HASH, two_fa_enabled: twoFa,
    },
    failed: 0,
    codeValid: true,
    otps: [],
    emails: [],
    sessions: 0,
    updates: [],
  });
  sent.length = 0;
}
Doctor.findByEmail = async () => state.doctor;
Doctor.findById = async () => state.doctor;
Doctor.update = async (id, data) => { state.updates.push(data); Object.assign(state.doctor, data); return state.doctor; };
OTP.create = async (...args) => { state.otps.push(args); return { otp_code: '654321' }; };
OTP.verify = async () => (state.codeValid ? { valid: true } : { valid: false, message: 'Invalid or expired OTP' });
Session.create = async () => { state.sessions++; return { id: 's1' }; };
AuditLog.logSecurityEvent = async () => {};
AuditLog.getFailedLoginAttempts = async () => state.failed;
emailService.sendOTP = async (...args) => { state.emails.push(args); };

const login = async (extra = {}) => {
  const res = fakeRes();
  await DoctorController.login(req({ email: 'dr@pholders.test', password: PASSWORD, ...extra }), res);
  return res;
};

// ── the "verified today" token ────────────────────────────────────────────
it('the browser token lasts until midnight in South Africa', () => {
  // 21:59 UTC is 23:59 SAST: one minute left.
  assert.strictEqual(twoFactor.secondsUntilSastMidnight(new Date(Date.UTC(2026, 10, 25, 21, 59))), 60);
  // 22:00 UTC is midnight SAST: a whole day.
  assert.strictEqual(twoFactor.secondsUntilSastMidnight(new Date(Date.UTC(2026, 10, 25, 22, 0))), 86400);
});

it('the token only works for the same doctor with the same password', () => {
  reset();
  const token = twoFactor.issueTrustedToday(state.doctor);
  assert.ok(twoFactor.isTrustedToday(token, state.doctor));
  assert.ok(!twoFactor.isTrustedToday(token, { ...state.doctor, id: 18 }));
  assert.ok(!twoFactor.isTrustedToday(token, { ...state.doctor, password_hash: 'changed' }),
    'a password change or reset must end it');
  assert.ok(!twoFactor.isTrustedToday('rubbish', state.doctor));
  const otherPurpose = jwt.sign({ id: 17, role: 'doctor' }, process.env.JWT_SECRET || 'jwtSecret');
  assert.ok(!twoFactor.isTrustedToday(otherPurpose, state.doctor),
    'a normal session token is not a browser token');
});

// ── login ─────────────────────────────────────────────────────────────────
it('with 2FA off, login signs in as before', async () => {
  reset();
  const res = await login();
  assert.strictEqual(res.statusCode, 200);
  assert.ok(res.body.data.token);
  assert.strictEqual(state.otps.length, 0);
  assert.strictEqual(state.sessions, 1);
});

it('with 2FA on, the first sign-in emails a code and creates no session', async () => {
  reset({ twoFa: true });
  const res = await login();
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.data.requiresOtp, true);
  assert.strictEqual(res.body.data.token, undefined);
  assert.deepStrictEqual(state.otps[0], [17, 'login', 'doctor', 10]);
  assert.deepStrictEqual(state.emails[0], ['dr@pholders.test', '654321', 'Thabo']);
  assert.strictEqual(state.sessions, 0);
});

it('a wrong password never gets as far as a code', async () => {
  reset({ twoFa: true });
  const res = await login({ password: 'Wrong!2026xY' });
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(state.otps.length, 0);
  assert.strictEqual(state.emails.length, 0);
});

it('a browser verified today skips the code', async () => {
  reset({ twoFa: true });
  const res = await login({ trusted_device_token: twoFactor.issueTrustedToday(state.doctor) });
  assert.ok(res.body.data.token);
  assert.strictEqual(state.otps.length, 0);
});

// ── verify-otp ────────────────────────────────────────────────────────────
it('the right code signs in and trusts this browser for today', async () => {
  reset({ twoFa: true });
  const res = fakeRes();
  await DoctorController.verifyOTP(req({ email: 'dr@pholders.test', otp_code: '654321' }), res);
  assert.strictEqual(res.statusCode, 200);
  const { token, trustedDeviceToken, doctorId } = res.body.data;
  assert.strictEqual(jwt.decode(token).role, 'doctor', 'same token as a normal login');
  assert.strictEqual(doctorId, 17);
  assert.ok(twoFactor.isTrustedToday(trustedDeviceToken, state.doctor));
  assert.strictEqual(state.sessions, 1);
});

it('a wrong code signs nobody in', async () => {
  reset({ twoFa: true });
  state.codeValid = false;
  const res = fakeRes();
  await DoctorController.verifyOTP(req({ email: 'dr@pholders.test', otp_code: '000000' }), res);
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(state.sessions, 0);
});

it('after five failures in an hour the code is burned', async () => {
  reset({ twoFa: true });
  state.failed = 5;
  const res = fakeRes();
  await DoctorController.verifyOTP(req({ email: 'dr@pholders.test', otp_code: '654321' }), res);
  assert.strictEqual(res.statusCode, 429);
  assert.strictEqual(state.sessions, 0);
  assert.match(sent[0].sql, /UPDATE otps SET is_used = true/);
  assert.match(sent[0].sql, /purpose = 'login'/);
});

// ── settings ──────────────────────────────────────────────────────────────
it('turning it on emails a code, and only the code turns it on', async () => {
  reset();
  const start = fakeRes();
  await DoctorController.startTwoFactorEnable(req({}, { id: 17 }), start);
  assert.strictEqual(start.statusCode, 200);
  assert.deepStrictEqual(state.otps[0], [17, 'twofa_enable', 'doctor', 10]);
  assert.strictEqual(state.updates.length, 0);

  state.codeValid = false;
  const wrong = fakeRes();
  await DoctorController.confirmTwoFactorEnable(req({ code: '000000' }, { id: 17 }), wrong);
  assert.strictEqual(wrong.statusCode, 400);
  assert.strictEqual(state.doctor.two_fa_enabled, false);

  state.codeValid = true;
  const right = fakeRes();
  await DoctorController.confirmTwoFactorEnable(req({ code: '654321' }, { id: 17 }), right);
  assert.strictEqual(right.statusCode, 200);
  assert.strictEqual(state.doctor.two_fa_enabled, true);
  assert.ok(twoFactor.isTrustedToday(right.body.data.trustedDeviceToken, state.doctor),
    'the browser that just proved the code is not asked again today');
});

it('turning it off needs the current password', async () => {
  reset({ twoFa: true });
  const wrong = fakeRes();
  await DoctorController.disableTwoFactor(req({ current_password: 'Nope!2026xY' }, { id: 17 }), wrong);
  assert.strictEqual(wrong.statusCode, 400);
  assert.strictEqual(state.doctor.two_fa_enabled, true);

  const right = fakeRes();
  await DoctorController.disableTwoFactor(req({ current_password: PASSWORD }, { id: 17 }), right);
  assert.strictEqual(right.statusCode, 200);
  assert.strictEqual(state.doctor.two_fa_enabled, false);
});

it('the routes are registered behind doctor auth', () => {
  const src = require('fs').readFileSync(require.resolve('../routes/userRoutes'), 'utf8');
  for (const [path, handler] of [
    ['/doctor/2fa/start', 'startTwoFactorEnable'],
    ['/doctor/2fa/enable', 'confirmTwoFactorEnable'],
    ['/doctor/2fa/disable', 'disableTwoFactor'],
  ]) {
    assert.ok(
      src.includes(`router.post('${path}', authMiddleware, requireRole('doctor'), DoctorController.${handler});`),
      path
    );
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
  for (const f of failures) console.log(`FAIL  ${f.label}\n      ${f.message}`);
  console.log(`\n${passed} passed, ${failures.length} failed`);
  process.exit(failures.length ? 1 : 0);
})();
