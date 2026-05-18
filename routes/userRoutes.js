const express = require('express');
const router = express.Router();
const multer = require('multer');
const UserController = require('../controllers/userController');
const DoctorController = require('../controllers/doctorController');
const PharmacyController = require('../controllers/pharmacyController');
const AdminController = require('../controllers/adminController');
const PatientProfileController = require('../controllers/patientProfileController');
const EnhancedProfileController = require('../controllers/enhancedProfileController');
const AppointmentController = require('../controllers/appointmentController');
const ReviewController = require('../controllers/reviewController');
const PaymentController = require('../controllers/paymentController');
const PrescriptionController = require('../controllers/prescriptionController');
const authMiddleware = require('../middleware/auth');
const { requireRole, preventAuthenticated } = require('../middleware/auth');
const RefreshController = require('../controllers/refreshController');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

/**
 * Patient Routes
 */
router.post('/signup', preventAuthenticated, UserController.signup);
router.post('/login', preventAuthenticated, UserController.login);
router.post('/verify-otp', preventAuthenticated, UserController.verifyOTP);

// Email Verification (account activation)
router.post('/verify-email', preventAuthenticated, UserController.verifyEmail);
router.post('/resend-verification', preventAuthenticated, UserController.resendVerificationEmail);

/**
 * Google OAuth Routes
 */
// Initiate Google login/signup
router.get('/auth/google', UserController.googleAuth);

// Google OAuth callback
router.get('/auth/google/callback', UserController.googleAuthCallback);

// Complete OAuth profile (required for new OAuth users)
router.post('/auth/complete-profile', authMiddleware, requireRole('patient'), UserController.completeOAuthProfile);

// Password Reset Routes (No authentication required)
router.post('/forgot-password', UserController.forgotPassword);
router.post('/reset-password', UserController.resetPassword);

// Account Deletion Routes
// Step 1: Request deletion (must be logged in and type "Delete my account")
router.post('/request-account-deletion', authMiddleware, requireRole('patient'), UserController.requestAccountDeletion);

// Step 2: Confirm deletion (click link in email - no authentication needed)
router.get('/confirm-account-deletion', UserController.confirmAccountDeletion);
router.post('/confirm-account-deletion', UserController.confirmAccountDeletion);

// Step 3: Cancel deletion (can be done before confirmation)
router.post('/cancel-account-deletion', authMiddleware, requireRole('patient'), UserController.cancelAccountDeletion);

router.get('/profile', authMiddleware, requireRole('patient'), UserController.getProfile);
router.put('/profile', authMiddleware, requireRole('patient'), UserController.updateProfile);

router.post('/logout', authMiddleware, requireRole('patient'), UserController.logout);
router.get('/sessions', authMiddleware, requireRole('patient'), UserController.getSessions);
router.get('/activity-log', authMiddleware, requireRole('patient'), UserController.getActivityLog);

/**
 * Patient Comprehensive Profile Routes
 */
// Profile retrieval
router.get('/profile/complete', authMiddleware, requireRole('patient'), PatientProfileController.getCompleteProfile);
router.get('/profile/summary', authMiddleware, requireRole('patient'), PatientProfileController.getProfileSummary);

// Personal details
router.put('/profile/personal', authMiddleware, requireRole('patient'), PatientProfileController.updatePersonalDetails);

// Allergies
router.post('/profile/allergies', authMiddleware, requireRole('patient'), PatientProfileController.addAllergy);

// Medical conditions
router.post('/profile/conditions', authMiddleware, requireRole('patient'), PatientProfileController.addMedicalCondition);

// Medications
router.post('/profile/medications', authMiddleware, requireRole('patient'), PatientProfileController.addMedication);

// Vaccinations
router.post('/profile/vaccinations', authMiddleware, requireRole('patient'), PatientProfileController.addVaccination);

// Test results
router.post('/profile/test-results', authMiddleware, requireRole('patient'), PatientProfileController.addTestResult);

// Healthcare providers
router.post('/profile/providers', authMiddleware, requireRole('patient'), PatientProfileController.addHealthcareProvider);

// Lifestyle data
router.post('/profile/lifestyle', authMiddleware, requireRole('patient'), PatientProfileController.addLifestyleData);

// Advance directives
router.post('/profile/advance-directives', authMiddleware, requireRole('patient'), PatientProfileController.addAdvanceDirective);

// Custom categories
router.post('/profile/custom-categories', authMiddleware, requireRole('patient'), PatientProfileController.createCustomCategory);
router.post('/profile/custom-categories/:customCategoryId/data', authMiddleware, requireRole('patient'), PatientProfileController.addCustomCategoryData);

/**
 * Doctor Routes
 */
router.post('/doctor/signup', preventAuthenticated, DoctorController.signup);
router.post('/doctor/login', preventAuthenticated, DoctorController.login);
router.post('/doctor/verify-otp', preventAuthenticated, DoctorController.verifyOTP);

router.get('/doctor/profile', authMiddleware, requireRole('doctor'), DoctorController.getProfile);
router.put('/doctor/profile', authMiddleware, requireRole('doctor'), DoctorController.updateProfile);

router.post('/doctor/logout', authMiddleware, requireRole('doctor'), DoctorController.logout);
router.get('/doctor/sessions', authMiddleware, requireRole('doctor'), DoctorController.getSessions);
router.get('/doctor/activity-log', authMiddleware, requireRole('doctor'), DoctorController.getActivityLog);

// Find nearby doctors by user location (available to authenticated patients)
router.post('/doctors/nearby', authMiddleware, requireRole('patient'), DoctorController.getNearbyDoctors);

// Patient "Find doctors near you" listing + details (Sprint: patient app)
// GET /doctors?lat=&lng=&radius_km=&specialty=&max_fee=&page=&limit=
router.get('/doctors', authMiddleware, requireRole('patient'), DoctorController.listDoctors);
// GET /doctors/:id
router.get('/doctors/:id', authMiddleware, requireRole('patient'), DoctorController.getDoctorById);

/**
 * Pharmacy Routes
 */
router.post('/pharmacy/signup', preventAuthenticated, PharmacyController.signup);
router.post('/pharmacy/login', preventAuthenticated, PharmacyController.login);
router.post('/pharmacy/verify-otp', preventAuthenticated, PharmacyController.verifyOTP);

router.get('/pharmacy/profile', authMiddleware, requireRole('pharmacy'), PharmacyController.getProfile);
router.put('/pharmacy/profile', authMiddleware, requireRole('pharmacy'), PharmacyController.updateProfile);

router.post('/pharmacy/logout', authMiddleware, requireRole('pharmacy'), PharmacyController.logout);
router.get('/pharmacy/sessions', authMiddleware, requireRole('pharmacy'), PharmacyController.getSessions);
router.get('/pharmacy/activity-log', authMiddleware, requireRole('pharmacy'), PharmacyController.getActivityLog);

/**
 * Admin Routes
 */
router.post('/admin/login', preventAuthenticated, AdminController.login);
router.post('/admin/verify-otp', preventAuthenticated, AdminController.verifyOTP);

router.get('/admin/profile', authMiddleware, requireRole('admin'), AdminController.getProfile);
router.put('/admin/profile', authMiddleware, requireRole('admin'), AdminController.updateProfile);

router.post('/admin/logout', authMiddleware, requireRole('admin'), AdminController.logout);
router.get('/admin/sessions', authMiddleware, requireRole('admin'), AdminController.getSessions);
router.get('/admin/activity-log', authMiddleware, requireRole('admin'), AdminController.getActivityLog);

// Security Monitoring Routes
router.get('/admin/security/dashboard', authMiddleware, requireRole('admin'), AdminController.getSecurityDashboard);
router.get('/admin/security/user-locations', authMiddleware, requireRole('admin'), AdminController.getUserLoginLocations);

/**
 * Enhanced Profile Features: Tagging, Searching, Version History, File Management
 */

// Tagging Routes
router.post('/profile/tags', authMiddleware, requireRole('patient'), EnhancedProfileController.createTag);
router.get('/profile/tags', authMiddleware, requireRole('patient'), EnhancedProfileController.getTags);
router.put('/profile/tags/:tagId', authMiddleware, requireRole('patient'), EnhancedProfileController.updateTag);
router.delete('/profile/tags/:tagId', authMiddleware, requireRole('patient'), EnhancedProfileController.deleteTag);
router.post('/profile/tags/assign', authMiddleware, requireRole('patient'), EnhancedProfileController.assignTag);
router.post('/profile/tags/remove', authMiddleware, requireRole('patient'), EnhancedProfileController.removeTag);
router.get('/profile/tags/:tagId/items', authMiddleware, requireRole('patient'), EnhancedProfileController.getItemsByTag);

// Search Routes
router.get('/profile/search', authMiddleware, requireRole('patient'), EnhancedProfileController.search);
router.post('/profile/filter-by-tags', authMiddleware, requireRole('patient'), EnhancedProfileController.filterByTags);

// Version History & Audit Routes
router.get('/profile/history/item', authMiddleware, requireRole('patient'), EnhancedProfileController.getItemHistory);
router.get('/profile/history/recent', authMiddleware, requireRole('patient'), EnhancedProfileController.getRecentChanges);
router.get('/profile/history/audit-trail', authMiddleware, requireRole('patient'), EnhancedProfileController.getAuditTrail);
router.get('/profile/history/audit-report', authMiddleware, requireRole('patient'), EnhancedProfileController.generateAuditReport);

// File Upload Routes
router.post('/profile/files/upload', authMiddleware, requireRole('patient'), upload.single('file'), EnhancedProfileController.uploadFile);
router.get('/profile/files', authMiddleware, requireRole('patient'), EnhancedProfileController.listFiles);
router.get('/profile/files/:fileId', authMiddleware, requireRole('patient'), EnhancedProfileController.getFile);
router.delete('/profile/files/:fileId', authMiddleware, requireRole('patient'), EnhancedProfileController.deleteFile);
router.post('/profile/files/:fileId/verify-integrity', authMiddleware, requireRole('patient'), EnhancedProfileController.verifyFileIntegrity);

// Category Management Routes
router.put('/profile/categories/:categoryId/rename', authMiddleware, requireRole('patient'), EnhancedProfileController.renameCategory);
router.post('/profile/categories/reorder', authMiddleware, requireRole('patient'), EnhancedProfileController.reorderCategories);

/**
 * Appointment Booking Routes
 */
// Get booking information (time periods, date ranges)
router.get('/appointments/booking-info', AppointmentController.getBookingInfo);

// Get available doctors for appointment booking
router.get('/appointments/doctors', AppointmentController.getAvailableDoctors);

// Get available time slots for a specific doctor, date, and time period
router.get('/appointments/available-slots', authMiddleware, requireRole('patient'), AppointmentController.getAvailableTimeSlots);

// Book a new appointment
router.post('/appointments/book', authMiddleware, requireRole('patient'), AppointmentController.bookAppointment);

// Get all appointments for the patient
router.get('/appointments', authMiddleware, requireRole('patient'), AppointmentController.getPatientAppointments);

// Get patient's upcoming appointments
router.get('/appointments/upcoming', authMiddleware, requireRole('patient'), AppointmentController.getUpcomingAppointments);

// Get specific appointment details
router.get('/appointments/:appointmentId', authMiddleware, requireRole('patient'), AppointmentController.getAppointmentDetails);

// Cancel an appointment
router.delete('/appointments/:appointmentId', authMiddleware, requireRole('patient'), AppointmentController.cancelAppointment);

// Reschedule an appointment
router.put('/appointments/:appointmentId/reschedule', authMiddleware, requireRole('patient'), AppointmentController.rescheduleAppointment);

// Get daily availability (all time periods) for a doctor
router.get('/appointments/day-availability', AppointmentController.getDayAvailability);

// Auto-cancel expired pending payments (admin endpoint)
router.post('/appointments/auto-cancel-expired', authMiddleware, requireRole('admin'), AppointmentController.autoCancelExpiredPayments);

// Doctor: Get appointments for doctor
router.get('/doctor/appointments', authMiddleware, requireRole('doctor'), AppointmentController.getDoctorAppointments);

// Doctor: Accept appointment (acknowledge before consultation)
router.post('/appointments/:appointmentId/accept', authMiddleware, requireRole('doctor'), AppointmentController.acceptAppointment);

/**
 * Doctor Reviews & Ratings Routes
 */
// Submit or update a review for a doctor
router.post('/appointments/doctors/:doctorId/reviews', authMiddleware, requireRole('patient'), ReviewController.submitReview);

// Get all reviews for a doctor
router.get('/appointments/doctors/:doctorId/reviews', ReviewController.getDoctorReviews);

// Get rating summary for a doctor
router.get('/appointments/doctors/:doctorId/reviews/summary', ReviewController.getRatingSummary);

// Check if patient has already reviewed a doctor
router.get('/appointments/doctors/:doctorId/reviews/check-review', authMiddleware, requireRole('patient'), ReviewController.checkExistingReview);

// Get patient's reviews
router.get('/reviews', authMiddleware, requireRole('patient'), ReviewController.getPatientReviews);

// Update a review
router.put('/reviews/:reviewId', authMiddleware, requireRole('patient'), ReviewController.updateReview);

// Delete a review
router.delete('/reviews/:reviewId', authMiddleware, requireRole('patient'), ReviewController.deleteReview);

/**
 * Payment Routes
 */
// Get available payment methods
router.get('/payments/methods', authMiddleware, requireRole('patient'), PaymentController.getAvailablePaymentMethods);

// Initialize payment for appointment
router.post('/payments/initialize', authMiddleware, requireRole('patient'), PaymentController.initializePayment);

// Confirm Stripe payment
router.post('/payments/confirm-stripe', authMiddleware, requireRole('patient'), PaymentController.confirmStripePayment);

// Complete cash on arrival payment
router.post('/payments/cash-on-arrival', authMiddleware, requireRole('patient'), PaymentController.completeCashPayment);

// Complete medical aid payment
router.post('/payments/medical-aid', authMiddleware, requireRole('patient'), PaymentController.completeMedicalAidPayment);

// Get payment status for appointment
router.get('/payments/appointment/:appointmentId', authMiddleware, requireRole('patient'), PaymentController.getPaymentStatus);

// Get payment history
router.get('/payments', authMiddleware, requireRole('patient'), PaymentController.getPaymentHistory);

/**
 * Stripe Payment Routes (Enhanced Stripe Integration)
 */
// Create Stripe Payment Intent
router.post('/payments/stripe/create-intent', authMiddleware, requireRole('patient'), PaymentController.createStripePaymentIntent);

// Get saved payment methods
router.get('/payments/stripe/methods', authMiddleware, requireRole('patient'), PaymentController.getStripePaymentMethods);

// Get payment status
router.get('/payments/:paymentId/status', authMiddleware, requireRole('patient'), PaymentController.getPaymentStatus);

// Request refund
router.post('/payments/:paymentId/refund', authMiddleware, requireRole('patient'), PaymentController.requestRefund);

// Get payment breakdown
router.get('/payments/appointment/:appointmentId/breakdown', authMiddleware, requireRole('patient'), PaymentController.getPaymentBreakdown);

// Stripe Webhook (no auth required - for Stripe)
router.post('/payments/webhook/stripe', PaymentController.handleStripeWebhook);

// Test Stripe connection (admin only)
router.get('/payments/stripe/test', authMiddleware, requireRole('admin'), PaymentController.testStripeConnection);

/**
 * Token Management Routes (for access/refresh token system)
 */
// Refresh Token Routes
router.post('/refresh-token', RefreshController.refreshToken);
router.post('/logout', authMiddleware, RefreshController.logout);

/**
 * e-Prescribing Routes
 */
// Doctor: Create new prescription (after appointment acceptance)
router.post('/prescriptions', authMiddleware, requireRole('doctor'), PrescriptionController.createPrescription);

// Doctor: Add medicine to prescription
router.post('/prescriptions/:prescriptionId/medicines', authMiddleware, requireRole('doctor'), PrescriptionController.addMedicine);

// Doctor: Check drug interactions before signing
router.post('/prescriptions/:prescriptionId/check-interactions', authMiddleware, requireRole('doctor'), PrescriptionController.checkDrugInteractions);

// Doctor: Request OTP for prescription signature
router.post('/prescriptions/:prescriptionId/request-otp', authMiddleware, requireRole('doctor'), PrescriptionController.requestSignatureOTP);

// Doctor: Sign prescription with OTP
router.post('/prescriptions/:prescriptionId/sign', authMiddleware, requireRole('doctor'), PrescriptionController.signPrescription);

// Doctor: Revoke prescription
router.post('/prescriptions/:prescriptionId/revoke', authMiddleware, requireRole('doctor'), PrescriptionController.revokePrescription);

// Doctor: Get all prescriptions issued by doctor
router.get('/doctor/prescriptions', authMiddleware, requireRole('doctor'), PrescriptionController.getDoctorPrescriptions);

// Patient: Get all prescriptions
router.get('/prescriptions', authMiddleware, requireRole('patient'), PrescriptionController.getPatientPrescriptions);

// Patient: View prescription details
router.get('/prescriptions/:prescriptionId', authMiddleware, requireRole('patient'), PrescriptionController.viewPrescription);

// Patient: Download prescription as PDF
router.get('/prescriptions/:prescriptionId/download', authMiddleware, requireRole('patient'), PrescriptionController.downloadPrescription);

// Patient: Print prescription
router.get('/prescriptions/:prescriptionId/print', authMiddleware, requireRole('patient'), PrescriptionController.printPrescription);

// Patient: Share prescription via email
router.post('/prescriptions/:prescriptionId/share-email', authMiddleware, requireRole('patient'), PrescriptionController.sharePrescriptionEmail);

// Patient: Generate QR code for prescription
router.get('/prescriptions/:prescriptionId/qrcode', authMiddleware, requireRole('patient'), PrescriptionController.generateQRCode);

// Patient: Get prescription share history
router.get('/prescriptions/:prescriptionId/share-history', authMiddleware, requireRole('patient'), PrescriptionController.getShareHistory);

// Patient: Get QR code access history
router.get('/prescriptions/:prescriptionId/qrcode-history', authMiddleware, requireRole('patient'), PrescriptionController.getQRCodeAccessHistory);

// Public: Access prescription via one-time use QR code (no auth required)
// This endpoint verifies the QR code and marks it as used
router.get('/qr/:qrToken', PrescriptionController.accessQRCodePrescription);

// Public: Check QR code status before accessing (optional - no auth required)
router.get('/qr/:qrToken/status', PrescriptionController.checkQRCodeStatus);

/**
 * Prescription Claim Routes (One-time use at pharmacy)
 * Patient claims prescription at pharmacy - cannot be used again after claiming
 */

// Patient: Claim prescription at pharmacy (one-time use)
router.post('/prescriptions/:prescriptionId/claim', authMiddleware, requireRole('patient'), PrescriptionController.claimPrescription);

// Patient: Check prescription claim status
router.get('/prescriptions/:prescriptionId/claim-status', authMiddleware, requireRole('patient'), PrescriptionController.checkClaimStatus);

// Patient: Get prescription claim information
router.get('/prescriptions/:prescriptionId/claim-info', authMiddleware, requireRole('patient'), PrescriptionController.getClaimInfo);

// Admin: Revert prescription claim (for errors or fraud)
router.post('/prescriptions/:prescriptionId/revert-claim', authMiddleware, requireRole('admin'), PrescriptionController.revertClaim);

module.exports = router;
