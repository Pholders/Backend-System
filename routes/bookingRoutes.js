const express = require('express');
const AppointmentController = require('../controllers/appointmentController');
const DoctorController = require('../controllers/doctorController');
const PaymentController = require('../controllers/paymentController');
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/appointments/booking-info', AppointmentController.getBookingInfo);
router.get('/appointments/doctors', authMiddleware, requireRole('patient'), AppointmentController.getAvailableDoctors);
router.get('/appointments/available-slots', authMiddleware, requireRole('patient'), AppointmentController.getAvailableTimeSlots);
router.post('/appointments/book', authMiddleware, requireRole('patient'), AppointmentController.bookAppointment);
router.get('/appointments', authMiddleware, requireRole('patient'), AppointmentController.getPatientAppointments);
router.get('/appointments/upcoming', authMiddleware, requireRole('patient'), AppointmentController.getUpcomingAppointments);
router.get('/appointments/day-availability', AppointmentController.getDayAvailability);
router.get('/appointments/:appointmentId', authMiddleware, requireRole('patient'), AppointmentController.getAppointmentDetails);
router.delete('/appointments/:appointmentId', authMiddleware, requireRole('patient'), AppointmentController.cancelAppointment);
router.put('/appointments/:appointmentId/reschedule', authMiddleware, requireRole('patient'), AppointmentController.rescheduleAppointment);
router.post('/appointments/auto-cancel-expired', authMiddleware, requireRole('admin'), AppointmentController.autoCancelExpiredPayments);
router.post('/appointments/:appointmentId/accept', authMiddleware, requireRole('doctor'), AppointmentController.acceptAppointment);
router.post('/appointments/:appointmentId/complete', authMiddleware, requireRole('doctor'), AppointmentController.completeAppointment);

router.get('/doctors/:doctorId/availability', authMiddleware, requireRole('patient'), DoctorController.getAvailability);

router.get('/payments/methods', authMiddleware, requireRole('patient'), PaymentController.getAvailablePaymentMethods);
router.post('/payments/initialize', authMiddleware, requireRole('patient'), PaymentController.initializePayment);
router.post('/payments/confirm-stripe', authMiddleware, requireRole('patient'), PaymentController.confirmStripePayment);
router.post('/payments/cash-on-arrival', authMiddleware, requireRole('patient'), PaymentController.completeCashPayment);
router.post('/payments/medical-aid', authMiddleware, requireRole('patient'), PaymentController.completeMedicalAidPayment);
router.get('/payments/appointment/:appointmentId', authMiddleware, requireRole('patient'), PaymentController.getPaymentStatus);
router.get('/payments', authMiddleware, requireRole('patient'), PaymentController.getPaymentHistory);

module.exports = router;