/**
 * Doctor Notifications
 * What a doctor is told, and when. Each function is called fire-and-forget
 * beside the patient's own notification, and never throws: a failed
 * notification must not undo a booking, a payment or a dispense.
 */

const DoctorNotification = require('../models/DoctorNotification');
const Appointment = require('../models/Appointment');
const Prescription = require('../models/Prescription');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Tue 4 Nov at 10:00", from a DATE column (or "2026-11-04") and a slot. */
function when(date, slot) {
  let d = date instanceof Date ? date : null;
  if (!d && date) {
    const [y, m, day] = String(date).slice(0, 10).split('-').map(Number);
    if (y && m && day) d = new Date(y, m - 1, day);
  }
  const datePart = d && !Number.isNaN(d.getTime())
    ? `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
    : 'an upcoming date';
  return slot ? `${datePart} at ${String(slot).slice(0, 5)}` : datePart;
}

function patientName(appointment) {
  const name = [appointment.patient_first_name, appointment.patient_last_name]
    .filter(Boolean).join(' ').trim();
  return name || 'A patient';
}

const PAYMENT_METHODS = {
  cash_on_arrival: 'will pay cash at the practice',
  stripe: 'paid by card',
  medical_aid: 'is claiming from medical aid',
};

async function send(doctorId, type, title, body, data) {
  if (!doctorId) return null;
  try {
    return await DoctorNotification.create({ doctor_id: doctorId, type, title, body, data });
  } catch (error) {
    console.error('Doctor notification error (non-blocking):', error.message);
    return null;
  }
}

async function loadAppointment(appointmentId) {
  try {
    return await Appointment.findById(appointmentId);
  } catch (error) {
    console.error('Doctor notification lookup failed (non-blocking):', error.message);
    return null;
  }
}

/** Paid, so it is now on the doctor's diary and waiting to be accepted. */
async function bookingConfirmed(appointmentId, paymentMethod) {
  const a = await loadAppointment(appointmentId);
  if (!a) return null;
  const how = PAYMENT_METHODS[paymentMethod] || 'has paid';
  return send(
    a.doctor_id,
    'appointment',
    'New booking to accept',
    `${patientName(a)} booked ${when(a.appointment_date, a.time_slot)} and ${how}. Accept it in Appointments.`,
    { appointmentId: a.id, paymentMethod: paymentMethod || null }
  );
}

async function appointmentCancelled(appointmentId) {
  const a = await loadAppointment(appointmentId);
  if (!a) return null;
  return send(
    a.doctor_id,
    'appointment',
    'Appointment cancelled',
    `${patientName(a)} cancelled their appointment on ${when(a.appointment_date, a.time_slot)}.`,
    { appointmentId: a.id }
  );
}

/** [previousDate] and [previousSlot] are what it was before the move. */
async function appointmentRescheduled(appointmentId, previousDate, previousSlot) {
  const a = await loadAppointment(appointmentId);
  if (!a) return null;
  return send(
    a.doctor_id,
    'appointment',
    'Appointment moved',
    `${patientName(a)} moved their appointment from ${when(previousDate, previousSlot)} ` +
      `to ${when(a.appointment_date, a.time_slot)}.`,
    { appointmentId: a.id }
  );
}

async function prescriptionDispensed(prescriptionId, pharmacyName) {
  let p;
  try {
    p = await Prescription.getById(prescriptionId);
  } catch (error) {
    console.error('Doctor notification lookup failed (non-blocking):', error.message);
    return null;
  }
  if (!p) return null;
  const where = pharmacyName ? ` at ${pharmacyName}` : '';
  return send(
    p.doctor_id,
    'prescription',
    'Prescription dispensed',
    `${p.prescription_number} for ${p.patient_name || 'your patient'} was dispensed${where}.`,
    { prescriptionId: p.id }
  );
}

/** Submitted or updated; a patient has one review per doctor. */
async function reviewReceived(review) {
  if (!review) return null;
  const stars = Number(review.rating);
  const text = String(review.review_text || '').trim();
  const quote = text ? `: "${text.length > 120 ? `${text.slice(0, 117)}...` : text}"` : '.';
  return send(
    review.doctor_id,
    'review',
    'New review',
    `A patient rated you ${stars} out of 5${quote}`,
    { reviewId: review.id, rating: stars }
  );
}

module.exports = {
  when,
  bookingConfirmed,
  appointmentCancelled,
  appointmentRescheduled,
  prescriptionDispensed,
  reviewReceived,
};
