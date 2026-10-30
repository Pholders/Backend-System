// A script the patient carries to the pharmacy (QR code or PDF) is allowed,
// but SAPC prefers the app sending it straight to the chosen pharmacy. The
// patient must be warned it may be delayed or refused, the pharmacist told to
// verify it, and the hand-off logged (SRS BR-024, BR-103). These pin that
// down. The model is stubbed: nothing here touches the database.
//
// Run with: node tests/patientHandoff.test.js
const assert = require('assert');
const {
  hasControlledMedicine,
  patientNotice,
  pharmacistNotice,
} = require('../services/patientHandoffService');
const Prescription = require('../models/Prescription');
const QRCodeService = require('../services/qrCodeService');
const PrescriptionController = require('../controllers/prescriptionController');

let passed = 0;
const failures = [];
const tests = [];

function it(label, fn) {
  tests.push({ label, fn });
}

const ordinary = [{ schedule_classification: 'schedule3' }];
const controlled = [
  { schedule_classification: 'schedule3' },
  { schedule_classification: 'schedule6' },
];

function fakeRes() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    setHeader(name, value) { this.headers[name] = value; },
    send(body) { this.body = body; return this; },
  };
}

// Record share-audit writes instead of making them.
let audits = [];
Prescription.addShareAudit = async (id, entry) => { audits.push({ id, ...entry }); };
Prescription.generateQRCodeAccess = async () => {};
QRCodeService.toDataURL = async () => 'data:image/png;base64,';
PrescriptionController.renderOrLoadPdfSnapshot = async () => ({
  buffer: Buffer.from('%PDF'),
  contentType: 'application/pdf',
});

const script = (items) => ({
  id: 15,
  patient_id: 20,
  prescription_number: 'RX-1',
  patient_email: 'p@example.com',
  prescriber_name: 'Dr A',
  items,
});

// ── the wording ───────────────────────────────────────────────────────────
it('Schedule 5 and 6 count as controlled, others do not', () => {
  assert.strictEqual(hasControlledMedicine(ordinary), false);
  assert.strictEqual(hasControlledMedicine(controlled), true);
  assert.strictEqual(hasControlledMedicine([{ schedule_classification: 'schedule5' }]), true);
  assert.strictEqual(hasControlledMedicine([]), false);
  assert.strictEqual(hasControlledMedicine(undefined), false);
  assert.strictEqual(hasControlledMedicine([{}]), false);
});

it('the patient is told it may be delayed or refused, and what is quicker', () => {
  const notice = patientNotice(ordinary);
  assert.strictEqual(notice.level, 'standard');
  assert.match(notice.message, /may refuse/);
  assert.match(notice.message, /choose a pharmacy in the app/);
  assert.doesNotMatch(notice.message, /Schedule 5 or 6/);
});

it('a controlled script gets the stronger warning', () => {
  const notice = patientNotice(controlled);
  assert.strictEqual(notice.level, 'controlled');
  assert.match(notice.message, /Schedule 5 or 6/);
});

it('the pharmacist is told it came through the patient and to verify it', () => {
  const notice = pharmacistNotice(controlled);
  assert.strictEqual(notice.method, 'patient_presented');
  assert.strictEqual(notice.controlledMedicine, true);
  assert.match(notice.message, /Regulation 33\(4\)/);
});

// ── the handlers ──────────────────────────────────────────────────────────
it('showing the QR code warns the patient and logs the hand-off', async () => {
  audits = [];
  Prescription.getById = async () => script(controlled);
  const res = fakeRes();
  await PrescriptionController.generateQRCode(
    { user: { id: 20, role: 'patient' }, params: { prescriptionId: '15' } }, res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.data.handoffNotice.level, 'controlled');
  assert.deepStrictEqual(audits, [{ id: '15', shared_with: 'patient', share_method: 'qr_code' }]);
});

it("someone else's script gets no QR code and no log entry", async () => {
  audits = [];
  Prescription.getById = async () => script(ordinary);
  const res = fakeRes();
  await PrescriptionController.generateQRCode(
    { user: { id: 99, role: 'patient' }, params: { prescriptionId: '15' } }, res);
  assert.strictEqual(res.statusCode, 404);
  assert.deepStrictEqual(audits, []);
});

it('the patient downloading the PDF is logged; the doctor downloading it is not', async () => {
  audits = [];
  PrescriptionController.loadPrescriptionForReader = async () => script(ordinary);
  await PrescriptionController.downloadPrescription(
    { user: { id: 20, role: 'patient' }, params: { prescriptionId: '15' } }, fakeRes());
  await PrescriptionController.downloadPrescription(
    { user: { id: 7, role: 'doctor' }, params: { prescriptionId: '15' } }, fakeRes());
  assert.deepStrictEqual(audits, [{ id: 15, shared_with: 'patient', share_method: 'pdf_download' }]);
});

it('a failed log never stops the patient getting the QR code', async () => {
  const realAudit = Prescription.addShareAudit;
  Prescription.addShareAudit = async () => { throw new Error('db down'); };
  const realError = console.error;
  console.error = () => {};
  try {
    Prescription.getById = async () => script(ordinary);
    const res = fakeRes();
    await PrescriptionController.generateQRCode(
      { user: { id: 20, role: 'patient' }, params: { prescriptionId: '15' } }, res);
    await new Promise((resolve) => setImmediate(resolve));
    assert.strictEqual(res.statusCode, 200);
  } finally {
    Prescription.addShareAudit = realAudit;
    console.error = realError;
  }
});

it('the pharmacist opening the QR link sees it was patient-presented', async () => {
  Prescription.verifyAndConsumeQRCode = async () => ({
    valid: true, prescriptionId: 15, accessedAt: new Date().toISOString(),
  });
  Prescription.getById = async () => script(controlled);
  const res = fakeRes();
  await PrescriptionController.accessQRCodePrescription(
    { params: { qrToken: 'tok' }, ip: '1.2.3.4', get: () => 'test' }, res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.data.transmission.method, 'patient_presented');
  assert.strictEqual(res.body.data.transmission.controlledMedicine, true);
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
