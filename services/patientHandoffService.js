/**
 * Patient Handoff Service
 * What to say when a script reaches the pharmacy through the patient (QR code
 * or downloaded PDF) instead of being sent by the app to the pharmacy the
 * patient chose. SAPC prefers direct transmission; a patient-presented script
 * is allowed, but the pharmacist must verify it first, so it can be delayed or
 * refused, Schedule 5 and 6 most of all (SRS BR-024, BR-103; Reg 33(4)).
 */

const CONTROLLED_SCHEDULES = new Set(['schedule5', 'schedule6']);

function hasControlledMedicine(items) {
  return (items || []).some((item) =>
    CONTROLLED_SCHEDULES.has(String(item.schedule_classification || '').toLowerCase())
  );
}

/** Shown to the patient before they take the script to a pharmacy. */
function patientNotice(items) {
  const controlled = hasControlledMedicine(items);
  const message =
    'You are taking this script to the pharmacy yourself, so the pharmacist ' +
    'must check it is genuine before dispensing. This can take longer, and a ' +
    'pharmacy may refuse it. For the quickest service, choose a pharmacy in ' +
    'the app and we will send the script to them directly.';
  return {
    level: controlled ? 'controlled' : 'standard',
    message: controlled
      ? `${message} This script includes Schedule 5 or 6 medicine, which ` +
        'pharmacies are most likely to refuse when it is not sent directly.'
      : message,
  };
}

/** Shown to the pharmacist who opens a script from the patient's QR code. */
function pharmacistNotice(items) {
  const controlled = hasControlledMedicine(items);
  return {
    method: 'patient_presented',
    controlledMedicine: controlled,
    message:
      'Presented by the patient, not sent directly by the prescriber. Verify ' +
      "the prescriber's signature and HPCSA number before dispensing " +
      '(Regulation 33(4)).',
  };
}

module.exports = { hasControlledMedicine, patientNotice, pharmacistNotice };
