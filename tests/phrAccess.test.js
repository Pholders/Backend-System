// A doctor sees a patient's health record (vitals included) only once the
// patient approves. These pin down who may ask, who may answer, and what a
// doctor is told about where they stand.
//
// No database: every PHRAccess, Doctor and notification call the controller
// makes is replaced below, and a call nobody replaced fails the test, so a
// stray query cannot reach the real (production) database.
//
// Run with: node tests/phrAccess.test.js
const assert = require('assert');

process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy';
const db = require('../config/db');
db.query = async () => { throw new Error('test reached the database'); };
db.pool.query = db.query;

const PHRAccess = require('../models/PHRAccess');
const Doctor = require('../models/Doctor');
const notificationService = require('../services/notificationService');
const { describeAccess } = require('../services/phrAccessService');
const controller = require('../controllers/phrController');

let passed = 0;
const failures = [];
const tests = [];
function it(label, fn) { tests.push({ label, fn }); }

function fakeRes() {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

let calls;
function stub(overrides) {
  calls = [];
  const record = (name, fn) => async (...args) => { calls.push([name, ...args]); return fn(...args); };
  const defaults = {
    hasAppointmentWith: () => true,
    getActiveGrant: () => null,
    getLatestRequest: () => null,
    getRequestById: () => null,
    requestAccess: (p, d, reason) => ({ id: 77, patient_id: p, doctor_id: d, reason, status: 'pending', requested_at: 'now' }),
    approveAccessRequest: (id) => ({ id: 1, request: id }),
    denyAccessRequest: (id) => ({ id, status: 'denied' }),
  };
  for (const [name, fn] of Object.entries({ ...defaults, ...overrides })) {
    PHRAccess[name] = record(name, fn);
  }
  Doctor.findById = record('Doctor.findById', () => ({ first_name: 'Thandi', last_name: 'Nkosi' }));
  notificationService.sendToPatient = record('notify', () => ({ delivered: true }));
}
const called = (name) => calls.some((c) => c[0] === name);

// ── where a doctor stands ─────────────────────────────────────────────────
it('a current grant means granted, whatever the requests say', () => {
  assert.strictEqual(describeAccess({ granted_at: 't' }, { status: 'denied' }).status, 'granted');
});

it('no grant and no request means never asked', () => {
  assert.strictEqual(describeAccess(null, null).status, 'none');
});

it('the latest request decides: pending, then denied', () => {
  assert.strictEqual(describeAccess(null, { id: 1, status: 'pending' }).status, 'pending');
  assert.strictEqual(describeAccess(null, { id: 1, status: 'denied' }).status, 'denied');
});

it('approved once but no grant now means it was withdrawn', () => {
  assert.strictEqual(describeAccess(null, { id: 1, status: 'approved' }).status, 'revoked');
});

// ── a patient answering ───────────────────────────────────────────────────
it("a patient cannot approve a request made to someone else's record", async () => {
  stub({ getRequestById: () => ({ id: 5, patient_id: 99, doctor_id: 17, status: 'pending' }) });
  const res = fakeRes();
  await controller.approveAccessRequest({ params: { requestId: '5' }, body: {}, user: { id: 20 } }, res);
  assert.strictEqual(res.statusCode, 404);
  assert.ok(!called('approveAccessRequest'));
});

it("a patient cannot deny a request made to someone else's record", async () => {
  stub({ getRequestById: () => ({ id: 5, patient_id: 99, doctor_id: 17, status: 'pending' }) });
  const res = fakeRes();
  await controller.denyAccessRequest({ params: { requestId: '5' }, body: {}, user: { id: 20 } }, res);
  assert.strictEqual(res.statusCode, 404);
  assert.ok(!called('denyAccessRequest'));
});

it('a patient can approve their own pending request', async () => {
  stub({ getRequestById: () => ({ id: 5, patient_id: 20, doctor_id: 17, status: 'pending' }) });
  const res = fakeRes();
  await controller.approveAccessRequest({ params: { requestId: '5' }, body: {}, user: { id: 20 } }, res);
  assert.strictEqual(res.statusCode, 200);
  assert.ok(called('approveAccessRequest'));
});

it('a request already answered cannot be answered again', async () => {
  stub({ getRequestById: () => ({ id: 5, patient_id: 20, doctor_id: 17, status: 'denied' }) });
  const res = fakeRes();
  await controller.approveAccessRequest({ params: { requestId: '5' }, body: {}, user: { id: 20 } }, res);
  assert.strictEqual(res.statusCode, 409);
  assert.ok(!called('approveAccessRequest'));
});

it('a request id that is not a number is simply not found', async () => {
  stub({});
  const res = fakeRes();
  await controller.denyAccessRequest({ params: { requestId: 'abc' }, body: {}, user: { id: 20 } }, res);
  assert.strictEqual(res.statusCode, 404);
});

// ── a doctor asking ───────────────────────────────────────────────────────
const ask = (overrides, body = { reason: 'Follow-up on blood pressure' }) => {
  stub(overrides);
  const res = fakeRes();
  return controller.requestAccess({ params: { patientId: '20' }, body, user: { id: 17 } }, res).then(() => res);
};

it('a doctor the patient never booked cannot ask', async () => {
  const res = await ask({ hasAppointmentWith: () => false });
  assert.strictEqual(res.statusCode, 403);
  assert.ok(!called('requestAccess'));
});

it('a first request is stored, and the patient is told', async () => {
  const res = await ask({});
  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(res.body.data.status, 'pending');
  assert.ok(called('requestAccess'));
  assert.ok(called('notify'));
});

it('asking again while a request waits does not make a second one', async () => {
  const res = await ask({ getLatestRequest: () => ({ id: 3, status: 'pending' }) });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.data.status, 'pending');
  assert.ok(!called('requestAccess'));
  assert.ok(!called('notify'));
});

it('asking when access is already granted changes nothing', async () => {
  const res = await ask({ getActiveGrant: () => ({ granted_at: 't' }) });
  assert.strictEqual(res.body.data.status, 'granted');
  assert.ok(!called('requestAccess'));
});

it('after a refusal the doctor may ask again', async () => {
  const res = await ask({ getLatestRequest: () => ({ id: 3, status: 'denied' }) });
  assert.strictEqual(res.statusCode, 201);
});

it('a very long reason is cut to 500 characters', async () => {
  await ask({}, { reason: 'x'.repeat(900) });
  const req = calls.find((c) => c[0] === 'requestAccess');
  assert.strictEqual(req[3].length, 500);
});

// ── the doctor checking ───────────────────────────────────────────────────
it('status says whether the doctor may ask', async () => {
  stub({ getLatestRequest: () => ({ id: 3, status: 'denied' }) });
  const res = fakeRes();
  await controller.getAccessStatus({ params: { patientId: '20' }, user: { id: 17 } }, res);
  assert.strictEqual(res.body.data.status, 'denied');
  assert.strictEqual(res.body.data.canRequest, true);

  stub({ getLatestRequest: () => ({ id: 3, status: 'pending' }) });
  const res2 = fakeRes();
  await controller.getAccessStatus({ params: { patientId: '20' }, user: { id: 17 } }, res2);
  assert.strictEqual(res2.body.data.canRequest, false);
});

// ── report ────────────────────────────────────────────────────────────────
(async () => {
  for (const t of tests) {
    try {
      await t.fn();
      passed++;
    } catch (error) {
      failures.push({ label: t.label, message: error.message });
    }
  }
  for (const f of failures) console.log(`FAIL  ${f.label}\n      ${f.message}`);
  console.log(`\n${passed} passed, ${failures.length} failed`);
  process.exit(failures.length ? 1 : 0);
})();
