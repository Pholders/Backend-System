const express = require('express');
const router = express.Router();
const multer = require('multer');
const UserController = require('../controllers/userController');
const DoctorController = require('../controllers/doctorController');
const ProfileController = require('../controllers/profileController');
const PharmacyController = require('../controllers/pharmacyController');
const AdminController = require('../controllers/adminController');
const PharmacyPartnershipController = require('../controllers/pharmacyPartnershipController');
const PharmacyClaimRoutingController = require('../controllers/pharmacyClaimRoutingController');
const PatientProfileController = require('../controllers/patientProfileController');
const EnhancedProfileController = require('../controllers/enhancedProfileController');
const AppointmentController = require('../controllers/appointmentController');
const ReviewController = require('../controllers/reviewController');
const PaymentController = require('../controllers/paymentController');
const PHRController = require('../controllers/phrController');
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

const doctorProfileImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const patientAvatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

/**
 * @swagger
 * tags:
 *   name: Patients
 *   description: Patient management endpoints
 */

/**
 * @swagger
 * /api/users/signup:
 *   post:
 *     summary: Sign up a new patient
 *     tags: [Patients]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: Patient signed up successfully
 *       400:
 *         description: Invalid input
 */
router.post('/signup', preventAuthenticated, UserController.signup);

/**
 * @swagger
 * /api/users/login:
 *   post:
 *     summary: Login a patient
 *     tags: [Patients]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Patient logged in successfully
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', preventAuthenticated, UserController.login);

/**
 * @swagger
 * /api/users/verify-otp:
 *   post:
 *     summary: Verify OTP for a patient
 *     tags: [Patients]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *       400:
 *         description: Invalid OTP
 */
router.post('/verify-otp', preventAuthenticated, UserController.verifyOTP);

// Account Activation Routes (OTP-based)
router.post('/verify-email', preventAuthenticated, UserController.verifyEmail);
router.post('/resend-verification', preventAuthenticated, UserController.resendVerificationEmail);

/**
 * Google OAuth Routes
 */

/**
 * @swagger
 * /api/users/auth/google:
 *   get:
 *     summary: Initiate Google OAuth login/signup
 *     tags: [Google OAuth]
 *     responses:
 *       302:
 *         description: Redirect to Google OAuth consent screen
 */
router.get('/auth/google', UserController.googleAuth);

/**
 * @swagger
 * /api/users/auth/google/callback:
 *   get:
 *     summary: Google OAuth callback
 *     tags: [Google OAuth]
 *     responses:
 *       302:
 *         description: Redirect to frontend with authentication status
 */
router.get('/auth/google/callback', UserController.googleAuthCallback);

/**
 * @swagger
 * /api/users/auth/complete-profile:
 *   post:
 *     summary: Complete OAuth profile for new users
 *     tags: [Google OAuth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile completed successfully
 *       400:
 *         description: Invalid input
 */
router.post('/auth/complete-profile', authMiddleware, requireRole('patient'), UserController.completeOAuthProfile);

/**
 * @swagger
 * tags:
 *   name: Password Reset
 *   description: Password reset endpoints
 */

/**
 * @swagger
 * /api/users/forgot-password:
 *   post:
 *     summary: Request password reset
 *     tags: [Password Reset]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset email sent
 *       404:
 *         description: User not found
 */
router.post('/forgot-password', UserController.forgotPassword);

/**
 * @swagger
 * /api/users/reset-password:
 *   post:
 *     summary: Reset password using token
 *     tags: [Password Reset]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Invalid or expired token
 */
router.post('/verify-password-reset-otp', UserController.verifyPasswordResetOTP);
router.post('/reset-password', UserController.resetPassword);

/**
 * @swagger
 * tags:
 *   name: Account Deletion
 *   description: Account deletion endpoints
 */

/**
 * @swagger
 * /api/users/request-account-deletion:
 *   post:
 *     summary: Request account deletion
 *     tags: [Account Deletion]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               confirmation:
 *                 type: string
 *                 example: "Delete my account"
 *     responses:
 *       200:
 *         description: Deletion request sent
 *       400:
 *         description: Confirmation text mismatch
 */
router.post('/request-account-deletion', authMiddleware, requireRole('patient'), UserController.requestAccountDeletion);

/**
 * @swagger
 * /api/users/confirm-account-deletion:
 *   get:
 *     summary: Confirm account deletion via email link
 *     tags: [Account Deletion]
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Account deletion confirmed
 *       400:
 *         description: Invalid or expired token
 */
router.get('/confirm-account-deletion', UserController.confirmAccountDeletion);

/**
 * @swagger
 * /api/users/confirm-account-deletion:
 *   post:
 *     summary: Confirm account deletion via form submission
 *     tags: [Account Deletion]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Account deletion confirmed
 *       400:
 *         description: Invalid or expired token
 */
router.post('/confirm-account-deletion', UserController.confirmAccountDeletion);

/**
 * @swagger
 * /api/users/cancel-account-deletion:
 *   post:
 *     summary: Cancel account deletion request
 *     tags: [Account Deletion]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Deletion request cancelled
 *       400:
 *         description: No active deletion request
 */
router.post('/cancel-account-deletion', authMiddleware, requireRole('patient'), UserController.cancelAccountDeletion);

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     summary: Get patient profile
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Patient profile retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/profile', authMiddleware, requireRole('patient'), UserController.getProfile);

/**
 * @swagger
 * /api/users/profile:
 *   put:
 *     summary: Update patient profile
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Invalid input
 */
router.put('/profile', authMiddleware, requireRole('patient'), UserController.updateProfile);

/**
 * @swagger
 * /api/users/logout:
 *   post:
 *     summary: Logout patient
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *       401:
 *         description: Unauthorized
 */
router.post('/logout', authMiddleware, requireRole('patient'), UserController.logout);

/**
 * @swagger
 * /api/users/sessions:
 *   get:
 *     summary: Get patient sessions
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sessions retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/sessions', authMiddleware, requireRole('patient'), UserController.getSessions);

/**
 * @swagger
 * /api/users/activity-log:
 *   get:
 *     summary: Get patient activity log
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Activity log retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/activity-log', authMiddleware, requireRole('patient'), UserController.getActivityLog);

/**
 * @swagger
 * tags:
 *   name: Patient Profile
 *   description: Patient comprehensive profile endpoints
 */

/**
 * @swagger
 * /api/users/profile/complete:
 *   get:
 *     summary: Get complete patient profile
 *     tags: [Patient Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Complete profile retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/profile/complete', authMiddleware, requireRole('patient'), PatientProfileController.getCompleteProfile);

/**
 * @swagger
 * /api/users/profile/summary:
 *   get:
 *     summary: Get patient profile summary
 *     tags: [Patient Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile summary retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/profile/summary', authMiddleware, requireRole('patient'), PatientProfileController.getProfileSummary);

/**
 * @swagger
 * /api/users/profile/personal:
 *   put:
 *     summary: Update personal details
 *     tags: [Patient Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Personal details updated successfully
 *       400:
 *         description: Invalid input
 */
router.put('/profile/personal', authMiddleware, requireRole('patient'), PatientProfileController.updatePersonalDetails);

/**
 * @swagger
 * /api/users/profile/allergies:
 *   post:
 *     summary: Add allergy to patient profile
 *     tags: [Patient Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               severity:
 *                 type: string
 *     responses:
 *       201:
 *         description: Allergy added successfully
 *       400:
 *         description: Invalid input
 */
router.post('/profile/allergies', authMiddleware, requireRole('patient'), PatientProfileController.addAllergy);

/**
 * @swagger
 * /api/users/profile/conditions:
 *   post:
 *     summary: Add medical condition to patient profile
 *     tags: [Patient Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               diagnosisDate:
 *                 type: string
 *                 format: date
 *     responses:
 *       201:
 *         description: Medical condition added successfully
 *       400:
 *         description: Invalid input
 */
router.post('/profile/conditions', authMiddleware, requireRole('patient'), PatientProfileController.addMedicalCondition);

/**
 * @swagger
 * /api/users/profile/medications:
 *   post:
 *     summary: Add medication to patient profile
 *     tags: [Patient Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               dosage:
 *                 type: string
 *     responses:
 *       201:
 *         description: Medication added successfully
 *       400:
 *         description: Invalid input
 */
router.post('/profile/medications', authMiddleware, requireRole('patient'), PatientProfileController.addMedication);

/**
 * @swagger
 * /api/users/profile/vaccinations:
 *   post:
 *     summary: Add vaccination to patient profile
 *     tags: [Patient Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date
 *     responses:
 *       201:
 *         description: Vaccination added successfully
 *       400:
 *         description: Invalid input
 */
router.post('/profile/vaccinations', authMiddleware, requireRole('patient'), PatientProfileController.addVaccination);

/**
 * @swagger
 * /api/users/profile/test-results:
 *   post:
 *     summary: Add test result to patient profile
 *     tags: [Patient Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               result:
 *                 type: string
 *     responses:
 *       201:
 *         description: Test result added successfully
 *       400:
 *         description: Invalid input
 */
router.post('/profile/test-results', authMiddleware, requireRole('patient'), PatientProfileController.addTestResult);

/**
 * @swagger
 * /api/users/profile/providers:
 *   post:
 *     summary: Add healthcare provider to patient profile
 *     tags: [Patient Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               specialty:
 *                 type: string
 *     responses:
 *       201:
 *         description: Healthcare provider added successfully
 *       400:
 *         description: Invalid input
 */
router.post('/profile/providers', authMiddleware, requireRole('patient'), PatientProfileController.addHealthcareProvider);

/**
 * @swagger
 * /api/users/profile/lifestyle:
 *   post:
 *     summary: Add lifestyle data to patient profile
 *     tags: [Patient Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *               value:
 *                 type: string
 *     responses:
 *       201:
 *         description: Lifestyle data added successfully
 *       400:
 *         description: Invalid input
 */
router.post('/profile/lifestyle', authMiddleware, requireRole('patient'), PatientProfileController.addLifestyleData);

/**
 * @swagger
 * /api/users/profile/advance-directives:
 *   post:
 *     summary: Add advance directive to patient profile
 *     tags: [Patient Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *               details:
 *                 type: string
 *     responses:
 *       201:
 *         description: Advance directive added successfully
 *       400:
 *         description: Invalid input
 */
router.post('/profile/advance-directives', authMiddleware, requireRole('patient'), PatientProfileController.addAdvanceDirective);

/**
 * @swagger
 * /api/users/profile/custom-categories:
 *   post:
 *     summary: Create custom category in patient profile
 *     tags: [Patient Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: Custom category created successfully
 *       400:
 *         description: Invalid input
 */
router.post('/profile/custom-categories', authMiddleware, requireRole('patient'), PatientProfileController.createCustomCategory);

/**
 * @swagger
 * /api/users/profile/custom-categories/{customCategoryId}/data:
 *   post:
 *     summary: Add data to custom category
 *     tags: [Patient Profile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: customCategoryId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               data:
 *                 type: object
 *     responses:
 *       201:
 *         description: Data added to custom category successfully
 *       400:
 *         description: Invalid input
 */
router.post('/profile/custom-categories/:customCategoryId/data', authMiddleware, requireRole('patient'), PatientProfileController.addCustomCategoryData);

/**
 * @swagger
 * tags:
 *   name: Doctors
 *   description: Doctor management endpoints
 */

/**
 * @swagger
 * /api/users/doctor/signup:
 *   post:
 *     summary: Sign up a new doctor
 *     tags: [Doctors]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: Doctor signed up successfully
 *       400:
 *         description: Invalid input
 */
router.post('/doctor/signup', preventAuthenticated, DoctorController.signup);

/**
 * @swagger
 * /api/users/doctor/login:
 *   post:
 *     summary: Login a doctor
 *     tags: [Doctors]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Doctor logged in successfully
 *       401:
 *         description: Invalid credentials
 */
router.post('/doctor/login', preventAuthenticated, DoctorController.login);

/**
 * @swagger
 * /api/users/doctor/verify-otp:
 *   post:
 *     summary: Verify OTP for a doctor
 *     tags: [Doctors]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *       400:
 *         description: Invalid OTP
 */
router.post('/doctor/verify-otp', preventAuthenticated, DoctorController.verifyOTP);

// Doctor Account Activation Routes (OTP-based)
router.post('/doctor/verify-email', preventAuthenticated, DoctorController.verifyEmail);
router.post('/doctor/resend-verification', preventAuthenticated, DoctorController.resendVerificationEmail);

// Medical aid catalogue — doctors pick from it, patients read the names.
router.get('/medical-aids', authMiddleware, DoctorController.getMedicalAidCatalogue);

/**
 * @swagger
 * /api/users/doctor/profile:
 *   get:
 *     summary: Get doctor profile
 *     tags: [Doctors]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Doctor profile retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/doctor/profile', authMiddleware, requireRole('doctor'), DoctorController.getProfile);
router.get('/doctor/profile-images/:filename', DoctorController.serveProfileImage);

/**
 * @swagger
 * /api/users/doctor/profile:
 *   put:
 *     summary: Update doctor profile
 *     tags: [Doctors]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Invalid input
 */
router.put('/doctor/profile', authMiddleware, requireRole('doctor'), DoctorController.updateProfile);
router.put(
  '/doctor/profile/image',
  authMiddleware,
  requireRole('doctor'),
  doctorProfileImageUpload.single('image'),
  DoctorController.uploadProfileImage
);

// Compatibility path for patient clients using the /api/users profile base.
// The primary route remains PUT /api/profile/avatar.
router.put(
  '/profile/avatar',
  authMiddleware,
  requireRole('patient'),
  patientAvatarUpload.single('avatar'),
  ProfileController.updateAvatar
);

/**
 * @swagger
 * /api/users/doctor/logout:
 *   post:
 *     summary: Logout doctor
 *     tags: [Doctors]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *       401:
 *         description: Unauthorized
 */
router.post('/doctor/logout', authMiddleware, requireRole('doctor'), DoctorController.logout);

/**
 * @swagger
 * /api/users/doctor/sessions:
 *   get:
 *     summary: Get doctor sessions
 *     tags: [Doctors]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sessions retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/doctor/sessions', authMiddleware, requireRole('doctor'), DoctorController.getSessions);

/**
 * @swagger
 * /api/users/doctor/activity-log:
 *   get:
 *     summary: Get doctor activity log
 *     tags: [Doctors]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Activity log retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/doctor/activity-log', authMiddleware, requireRole('doctor'), DoctorController.getActivityLog);

/**
 * @swagger
 * /api/users/doctors/nearby:
 *   post:
 *     summary: Find nearby doctors by user location
 *     tags: [Doctors]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *     responses:
 *       200:
 *         description: Nearby doctors retrieved successfully
 *       400:
 *         description: Invalid input
 */
router.post('/doctors/nearby', authMiddleware, requireRole('patient'), DoctorController.getNearbyDoctors);

// Patient "Find doctors near you" listing + details (Sprint: patient app)
// GET /doctors?lat=&lng=&radius_km=&specialty=&max_fee=&page=&limit=
router.get('/doctors', authMiddleware, requireRole('patient'), DoctorController.listDoctors);
// GET /doctors/:id
router.get('/doctors/:id', authMiddleware, requireRole('patient'), DoctorController.getDoctorById);
// GET /doctors/:doctorId/availability?date=YYYY-MM-DD
router.get('/doctors/:doctorId/availability', authMiddleware, requireRole('patient'), DoctorController.getAvailability);

/**
 * @swagger
 * tags:
 *   name: Pharmacies
 *   description: Pharmacy management endpoints
 */

/**
 * @swagger
 * /api/users/pharmacy/signup:
 *   post:
 *     summary: Sign up a new pharmacy
 *     tags: [Pharmacies]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: Pharmacy signed up successfully
 *       400:
 *         description: Invalid input
 */
// Pharmacies a patient can claim a prescription at. Claiming needs a
// pharmacyId and nothing patient-callable listed them.
router.get('/pharmacies', authMiddleware, requireRole('patient'), PharmacyController.listForPatients);

router.post('/pharmacy/signup', preventAuthenticated, PharmacyController.signup);

/**
 * @swagger
 * /api/users/pharmacy/login:
 *   post:
 *     summary: Login a pharmacy
 *     tags: [Pharmacies]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Pharmacy logged in successfully
 *       401:
 *         description: Invalid credentials
 */
router.post('/pharmacy/login', preventAuthenticated, PharmacyController.login);

/**
 * @swagger
 * /api/users/pharmacy/verify-otp:
 *   post:
 *     summary: Verify OTP for a pharmacy
 *     tags: [Pharmacies]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *       400:
 *         description: Invalid OTP
 */
router.post('/pharmacy/verify-otp', preventAuthenticated, PharmacyController.verifyOTP);

// Pharmacy Account Activation Routes (OTP-based)
router.post('/pharmacy/verify-email', preventAuthenticated, PharmacyController.verifyEmail);
router.post('/pharmacy/resend-verification', preventAuthenticated, PharmacyController.resendVerificationEmail);

/**
 * @swagger
 * /api/users/pharmacy/profile:
 *   get:
 *     summary: Get pharmacy profile
 *     tags: [Pharmacies]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pharmacy profile retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/pharmacy/profile', authMiddleware, requireRole('pharmacy'), PharmacyController.getProfile);

/**
 * @swagger
 * /api/users/pharmacy/profile:
 *   put:
 *     summary: Update pharmacy profile
 *     tags: [Pharmacies]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Invalid input
 */
router.put('/pharmacy/profile', authMiddleware, requireRole('pharmacy'), PharmacyController.updateProfile);

/**
 * @swagger
 * /api/users/pharmacy/logout:
 *   post:
 *     summary: Logout pharmacy
 *     tags: [Pharmacies]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *       401:
 *         description: Unauthorized
 */
router.post('/pharmacy/logout', authMiddleware, requireRole('pharmacy'), PharmacyController.logout);

/**
 * @swagger
 * /api/users/pharmacy/sessions:
 *   get:
 *     summary: Get pharmacy sessions
 *     tags: [Pharmacies]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sessions retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/pharmacy/sessions', authMiddleware, requireRole('pharmacy'), PharmacyController.getSessions);

/**
 * @swagger
 * /api/users/pharmacy/activity-log:
 *   get:
 *     summary: Get pharmacy activity log
 *     tags: [Pharmacies]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Activity log retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/pharmacy/activity-log', authMiddleware, requireRole('pharmacy'), PharmacyController.getActivityLog);

/**
 * @swagger
 * tags:
 *   name: Admins
 *   description: Admin management endpoints
 */

/**
 * @swagger
 * /api/users/admin/login:
 *   post:
 *     summary: Login an admin
 *     tags: [Admins]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Admin logged in successfully
 *       401:
 *         description: Invalid credentials
 */
router.post('/admin/login', preventAuthenticated, AdminController.login);

/**
 * @swagger
 * /api/users/admin/verify-otp:
 *   post:
 *     summary: Verify OTP for an admin
 *     tags: [Admins]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *       400:
 *         description: Invalid OTP
 */
router.post('/admin/verify-otp', preventAuthenticated, AdminController.verifyOTP);

/**
 * @swagger
 * /api/users/admin/profile:
 *   get:
 *     summary: Get admin profile
 *     tags: [Admins]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Admin profile retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/admin/profile', authMiddleware, requireRole('admin'), AdminController.getProfile);

/**
 * @swagger
 * /api/users/admin/profile:
 *   put:
 *     summary: Update admin profile
 *     tags: [Admins]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Invalid input
 */
router.put('/admin/profile', authMiddleware, requireRole('admin'), AdminController.updateProfile);

/**
 * @swagger
 * /api/users/admin/logout:
 *   post:
 *     summary: Logout admin
 *     tags: [Admins]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *       401:
 *         description: Unauthorized
 */
router.post('/admin/logout', authMiddleware, requireRole('admin'), AdminController.logout);

/**
 * @swagger
 * /api/users/admin/sessions:
 *   get:
 *     summary: Get admin sessions
 *     tags: [Admins]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sessions retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/admin/sessions', authMiddleware, requireRole('admin'), AdminController.getSessions);

/**
 * @swagger
 * /api/users/admin/activity-log:
 *   get:
 *     summary: Get admin activity log
 *     tags: [Admins]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Activity log retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/admin/activity-log', authMiddleware, requireRole('admin'), AdminController.getActivityLog);

/**
 * @swagger
 * /api/users/admin/security/dashboard:
 *   get:
 *     summary: Get security dashboard
 *     tags: [Admins]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Security dashboard retrieved successfully
 *       401:
 *         description: Unauthorized
 */
// Pharmacy directory and admission to the partnership network.
router.get('/admin/pharmacies', authMiddleware, requireRole('admin'), AdminController.listPharmacies);
router.patch('/admin/pharmacies/:pharmacyId/status', authMiddleware, requireRole('admin'), AdminController.setPharmacyStatus);

router.get('/admin/security/dashboard', authMiddleware, requireRole('admin'), AdminController.getSecurityDashboard);

/**
 * @swagger
 * /api/users/admin/security/user-locations:
 *   get:
 *     summary: Get user login locations
 *     tags: [Admins]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User login locations retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/admin/security/user-locations', authMiddleware, requireRole('admin'), AdminController.getUserLoginLocations);

/**
 * @swagger
 * tags:
 *   name: Enhanced Profile
 *   description: Enhanced profile features
 */

/**
 * @swagger
 * /api/users/profile/tags:
 *   post:
 *     summary: Create a new tag
 *     tags: [Enhanced Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: Tag created successfully
 *       400:
 *         description: Invalid input
 */
router.post('/profile/tags', authMiddleware, requireRole('patient'), EnhancedProfileController.createTag);

/**
 * @swagger
 * /api/users/profile/tags:
 *   get:
 *     summary: Get all tags
 *     tags: [Enhanced Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tags retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/profile/tags', authMiddleware, requireRole('patient'), EnhancedProfileController.getTags);

/**
 * @swagger
 * /api/users/profile/tags/{tagId}:
 *   put:
 *     summary: Update a tag
 *     tags: [Enhanced Profile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tagId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Tag updated successfully
 *       400:
 *         description: Invalid input
 */
router.put('/profile/tags/:tagId', authMiddleware, requireRole('patient'), EnhancedProfileController.updateTag);

/**
 * @swagger
 * /api/users/profile/tags/{tagId}:
 *   delete:
 *     summary: Delete a tag
 *     tags: [Enhanced Profile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tagId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Tag deleted successfully
 *       400:
 *         description: Invalid input
 */
router.delete('/profile/tags/:tagId', authMiddleware, requireRole('patient'), EnhancedProfileController.deleteTag);

/**
 * @swagger
 * /api/users/profile/tags/assign:
 *   post:
 *     summary: Assign a tag to an item
 *     tags: [Enhanced Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tagId:
 *                 type: string
 *               itemId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Tag assigned successfully
 *       400:
 *         description: Invalid input
 */
router.post('/profile/tags/assign', authMiddleware, requireRole('patient'), EnhancedProfileController.assignTag);

/**
 * @swagger
 * /api/users/profile/tags/remove:
 *   post:
 *     summary: Remove a tag from an item
 *     tags: [Enhanced Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tagId:
 *                 type: string
 *               itemId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Tag removed successfully
 *       400:
 *         description: Invalid input
 */
router.post('/profile/tags/remove', authMiddleware, requireRole('patient'), EnhancedProfileController.removeTag);

/**
 * @swagger
 * /api/users/profile/tags/{tagId}/items:
 *   get:
 *     summary: Get items by tag
 *     tags: [Enhanced Profile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tagId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Items retrieved successfully
 *       400:
 *         description: Invalid input
 */
router.get('/profile/tags/:tagId/items', authMiddleware, requireRole('patient'), EnhancedProfileController.getItemsByTag);

/**
 * @swagger
 * /api/users/profile/search:
 *   get:
 *     summary: Search profile items
 *     tags: [Enhanced Profile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Search results retrieved successfully
 *       400:
 *         description: Invalid input
 */
router.get('/profile/search', authMiddleware, requireRole('patient'), EnhancedProfileController.search);

/**
 * @swagger
 * /api/users/profile/filter-by-tags:
 *   post:
 *     summary: Filter items by tags
 *     tags: [Enhanced Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tagIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Filtered items retrieved successfully
 *       400:
 *         description: Invalid input
 */
router.post('/profile/filter-by-tags', authMiddleware, requireRole('patient'), EnhancedProfileController.filterByTags);

/**
 * @swagger
 * /api/users/profile/history/item:
 *   get:
 *     summary: Get item history
 *     tags: [Enhanced Profile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Item history retrieved successfully
 *       400:
 *         description: Invalid input
 */
router.get('/profile/history/item', authMiddleware, requireRole('patient'), EnhancedProfileController.getItemHistory);

/**
 * @swagger
 * /api/users/profile/history/recent:
 *   get:
 *     summary: Get recent changes
 *     tags: [Enhanced Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Recent changes retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/profile/history/recent', authMiddleware, requireRole('patient'), EnhancedProfileController.getRecentChanges);

/**
 * @swagger
 * /api/users/profile/history/audit-trail:
 *   get:
 *     summary: Get audit trail
 *     tags: [Enhanced Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Audit trail retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/profile/history/audit-trail', authMiddleware, requireRole('patient'), EnhancedProfileController.getAuditTrail);

/**
 * @swagger
 * /api/users/profile/history/audit-report:
 *   get:
 *     summary: Generate audit report
 *     tags: [Enhanced Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Audit report generated successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/profile/history/audit-report', authMiddleware, requireRole('patient'), EnhancedProfileController.generateAuditReport);

/**
 * @swagger
 * /api/users/profile/files/upload:
 *   post:
 *     summary: Upload a file
 *     tags: [Enhanced Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: File uploaded successfully
 *       400:
 *         description: Invalid input
 */
router.post('/profile/files/upload', authMiddleware, requireRole('patient'), upload.single('file'), EnhancedProfileController.uploadFile);

/**
 * @swagger
 * /api/users/profile/files:
 *   get:
 *     summary: List all files
 *     tags: [Enhanced Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Files listed successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/profile/files', authMiddleware, requireRole('patient'), EnhancedProfileController.listFiles);

/**
 * @swagger
 * /api/users/profile/files/{fileId}:
 *   get:
 *     summary: Get a file
 *     tags: [Enhanced Profile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: File retrieved successfully
 *       400:
 *         description: Invalid input
 */
router.get('/profile/files/:fileId', authMiddleware, requireRole('patient'), EnhancedProfileController.getFile);

/**
 * @swagger
 * /api/users/profile/files/{fileId}:
 *   delete:
 *     summary: Delete a file
 *     tags: [Enhanced Profile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: File deleted successfully
 *       400:
 *         description: Invalid input
 */
router.delete('/profile/files/:fileId', authMiddleware, requireRole('patient'), EnhancedProfileController.deleteFile);

/**
 * @swagger
 * /api/users/profile/files/{fileId}/verify-integrity:
 *   post:
 *     summary: Verify file integrity
 *     tags: [Enhanced Profile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: File integrity verified successfully
 *       400:
 *         description: Invalid input
 */
router.post('/profile/files/:fileId/verify-integrity', authMiddleware, requireRole('patient'), EnhancedProfileController.verifyFileIntegrity);

/**
 * @swagger
 * /api/users/profile/categories/{categoryId}/rename:
 *   put:
 *     summary: Rename a category
 *     tags: [Enhanced Profile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Category renamed successfully
 *       400:
 *         description: Invalid input
 */
router.put('/profile/categories/:categoryId/rename', authMiddleware, requireRole('patient'), EnhancedProfileController.renameCategory);

/**
 * @swagger
 * /api/users/profile/categories/reorder:
 *   post:
 *     summary: Reorder categories
 *     tags: [Enhanced Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               categoryIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Categories reordered successfully
 *       400:
 *         description: Invalid input
 */
router.post('/profile/categories/reorder', authMiddleware, requireRole('patient'), EnhancedProfileController.reorderCategories);

/**
 * Appointment Booking Routes
 */
// Get booking information (time periods, date ranges)
router.get('/appointments/booking-info', AppointmentController.getBookingInfo);

// Get available doctors for appointment booking
router.get('/appointments/doctors', authMiddleware, requireRole('patient'), AppointmentController.getAvailableDoctors);

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

// Doctor: Get de-duplicated list of patients from appointment history
router.get('/doctor/patients', authMiddleware, requireRole('doctor'), AppointmentController.getDoctorPatients);

// TEST: Get signed prescriptions (early in file)
router.get('/doctor/test-static', (req, res) => {
  res.json({ test: 'static data' });
});

// Doctor: Accept appointment (acknowledge before consultation)
router.post('/appointments/:appointmentId/accept', authMiddleware, requireRole('doctor'), AppointmentController.acceptAppointment);

// Doctor: Mark appointment as completed after consultation
router.post('/appointments/:appointmentId/complete', authMiddleware, requireRole('doctor'), AppointmentController.completeAppointment);

/**
 * Appointment Reminder Routes
 */
// Set or update reminder for an appointment
router.post('/appointments/:appointmentId/reminders', authMiddleware, requireRole('patient'), AppointmentController.setAppointmentReminder);

// Get reminder for a specific appointment
router.get('/appointments/:appointmentId/reminders', authMiddleware, requireRole('patient'), AppointmentController.getAppointmentReminder);

// Update reminder settings
router.put('/appointments/:appointmentId/reminders', authMiddleware, requireRole('patient'), AppointmentController.updateAppointmentReminder);

// Toggle reminder on/off
router.patch('/appointments/:appointmentId/reminders/toggle', authMiddleware, requireRole('patient'), AppointmentController.toggleAppointmentReminder);

// Delete reminder
router.delete('/appointments/:appointmentId/reminders', authMiddleware, requireRole('patient'), AppointmentController.deleteAppointmentReminder);

// Get all reminders for patient
router.get('/reminders', authMiddleware, requireRole('patient'), AppointmentController.getPatientReminders);

// Get upcoming reminders (within 24 hours)
router.get('/reminders/upcoming', authMiddleware, requireRole('patient'), AppointmentController.getUpcomingReminders);

// Get notification history for appointment
router.get('/appointments/:appointmentId/notification-history', authMiddleware, requireRole('patient'), AppointmentController.getNotificationHistory);

// Patient notes on an appointment. Adding and deleting lock once it starts.
router.get('/appointments/:appointmentId/notes', authMiddleware, requireRole('patient'), AppointmentController.getAppointmentNotes);
router.post('/appointments/:appointmentId/notes', authMiddleware, requireRole('patient'), AppointmentController.addAppointmentNote);
router.delete('/appointments/:appointmentId/notes/:noteId', authMiddleware, requireRole('patient'), AppointmentController.deleteAppointmentNote);

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

// Doctor read-only views of payments for their own appointments
router.get('/doctor/payments/summary', authMiddleware, requireRole('doctor'), PaymentController.getDoctorPaymentSummary);
router.get('/doctor/payments', authMiddleware, requireRole('doctor'), PaymentController.getDoctorPaymentHistory);

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
 * @swagger
 * tags:
 *   name: Token Management
 *   description: Token management endpoints
 */

/**
 * @swagger
 * /api/users/refresh-token:
 *   post:
 *     summary: Refresh access token
 *     tags: [Token Management]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Access token refreshed successfully
 *       400:
 *         description: Invalid refresh token
 */
router.post('/refresh-token', RefreshController.refreshToken);

/**
 * @swagger
 * /api/users/logout:
 *   post:
 *     summary: Logout and invalidate tokens
 *     tags: [Token Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *       401:
 *         description: Unauthorized
 */
/**
 * Personal Health Record (PHR) Routes
 */

// PATIENT ENDPOINTS - View own PHR
router.get('/phr/complete', authMiddleware, requireRole('patient'), PHRController.getCompletePHR);
router.get('/phr/personal-card', authMiddleware, requireRole('patient'), PHRController.getPersonalCard);
router.put('/phr/personal-card', authMiddleware, requireRole('patient'), PHRController.updatePersonalCard);
router.get('/phr/medical-summary', authMiddleware, requireRole('patient'), PHRController.getMedicalSummary);
router.get('/phr/prescriptions', authMiddleware, requireRole('patient'), PHRController.getActivePrescriptions);
router.get('/phr/medications', authMiddleware, requireRole('patient'), PHRController.getCurrentMedications);
router.get('/phr/allergies', authMiddleware, requireRole('patient'), PHRController.getAllergies);
router.get('/phr/conditions', authMiddleware, requireRole('patient'), PHRController.getMedicalConditions);
router.get('/phr/appointments', authMiddleware, requireRole('patient'), PHRController.getUpcomingAppointments);
router.get('/phr/history', authMiddleware, requireRole('patient'), PHRController.getHealthHistory);
router.get('/phr/vitals', authMiddleware, requireRole('patient'), PHRController.getHealthVitals);
router.get('/phr/vitals/range', authMiddleware, requireRole('patient'), PHRController.getHealthVitalsRange);
router.get('/phr/documents', authMiddleware, requireRole('patient'), PHRController.getPHRDocuments);
router.post('/phr/documents', authMiddleware, requireRole('patient'), PHRController.uploadDocument);

// PATIENT ACCESS CONTROL - Manage who can access PHR
router.get('/phr/access', authMiddleware, requireRole('patient'), PHRController.getAccessList);
router.post('/phr/access', authMiddleware, requireRole('patient'), PHRController.grantAccess);
router.delete('/phr/access/:doctorId', authMiddleware, requireRole('patient'), PHRController.revokeAccess);
router.get('/phr/access/requests', authMiddleware, requireRole('patient'), PHRController.getPendingRequests);
router.post('/phr/access/requests/:requestId/approve', authMiddleware, requireRole('patient'), PHRController.approveAccessRequest);
router.post('/phr/access/requests/:requestId/deny', authMiddleware, requireRole('patient'), PHRController.denyAccessRequest);
router.get('/phr/access-logs', authMiddleware, requireRole('patient'), PHRController.getAccessLogs);

// DOCTOR ENDPOINTS - Request and access patient PHR
router.post('/phr/:patientId/access-request', authMiddleware, requireRole('doctor'), PHRController.requestAccess);
router.get('/phr/:patientId/access-status', authMiddleware, requireRole('doctor'), PHRController.getAccessStatus);
router.get('/phr/:patientId', authMiddleware, requireRole('doctor'), PHRController.viewPatientPHR);
router.get('/phr/:patientId/personal-card', authMiddleware, requireRole('doctor'), PHRController.viewPatientPersonalCard);
router.get('/phr/:patientId/vitals', authMiddleware, requireRole('doctor'), PHRController.viewPatientVitals);
// Vitals are taken by the doctor; any doctor the patient booked may record them.
router.post('/phr/:patientId/vitals', authMiddleware, requireRole('doctor'), PHRController.recordPatientVital);
router.get('/phr/:patientId/medications', authMiddleware, requireRole('doctor'), PHRController.viewPatientMedications);
// Read-only record views for any doctor the patient has booked.
router.get('/phr/:patientId/history', authMiddleware, requireRole('doctor'), PHRController.viewPatientHistory);
router.get('/phr/:patientId/documents', authMiddleware, requireRole('doctor'), PHRController.viewPatientDocuments);
router.get('/phr/:patientId/documents/:fileId', authMiddleware, requireRole('doctor'), PHRController.downloadPatientDocument);

/**
 * Pharmacy Partnership Management Routes (Admin)
 */
// Pharmacy Groups
router.post('/partnerships/groups', authMiddleware, requireRole('admin'), PharmacyPartnershipController.createGroup);
router.get('/partnerships/groups', authMiddleware, requireRole('admin'), PharmacyPartnershipController.getAllGroups);
// Literal paths must precede /:id, or Express reads 'search' as an id.
router.get('/partnerships/groups/search', authMiddleware, requireRole('admin'), PharmacyPartnershipController.searchGroups);
router.get('/partnerships/groups/:groupId', authMiddleware, requireRole('admin'), PharmacyPartnershipController.getGroupById);
router.put('/partnerships/groups/:groupId', authMiddleware, requireRole('admin'), PharmacyPartnershipController.updateGroup);
router.post('/partnerships/groups/:groupId/pharmacies', authMiddleware, requireRole('admin'), PharmacyPartnershipController.addPharmacyToGroup);
router.delete('/partnerships/groups/:groupId/pharmacies/:pharmacyId', authMiddleware, requireRole('admin'), PharmacyPartnershipController.removePharmacyFromGroup);

// Partnership Agreements
router.post('/partnerships/agreements', authMiddleware, requireRole('admin'), PharmacyPartnershipController.createAgreement);
router.get('/partnerships/agreements', authMiddleware, requireRole('admin'), PharmacyPartnershipController.getAllAgreements);
// Same here: 'expiring' would otherwise be taken for an agreement id.
router.get('/partnerships/agreements/expiring', authMiddleware, requireRole('admin'), PharmacyPartnershipController.getExpiringAgreements);
router.get('/partnerships/agreements/:agreementId', authMiddleware, requireRole('admin'), PharmacyPartnershipController.getAgreementById);
router.put('/partnerships/agreements/:agreementId', authMiddleware, requireRole('admin'), PharmacyPartnershipController.updateAgreement);
router.post('/partnerships/agreements/:agreementId/activate', authMiddleware, requireRole('admin'), PharmacyPartnershipController.activateAgreement);
router.post('/partnerships/agreements/:agreementId/suspend', authMiddleware, requireRole('admin'), PharmacyPartnershipController.suspendAgreement);

// Compliance & Reporting
router.get('/partnerships/compliance/dashboard', authMiddleware, requireRole('admin'), PharmacyPartnershipController.getComplianceDashboard);
router.get('/partnerships/compliance/pharmacy/:pharmacyId', authMiddleware, requireRole('admin'), PharmacyPartnershipController.getPharmacyCompliance);
router.get('/partnerships/compliance/report', authMiddleware, requireRole('admin'), PharmacyPartnershipController.getComplianceReport);

// Pharmacy Tier Management
router.post('/pharmacy/upgrade-tier', authMiddleware, requireRole('pharmacy'), PharmacyPartnershipController.upgradePharmacyTier);
router.get('/pharmacy/current-tier', authMiddleware, requireRole('pharmacy'), PharmacyPartnershipController.getCurrentTier);

/**
 * Prescription Claim Routing Routes (Patient & Pharmacy)
 */
// Patient: Route prescription
router.post('/prescriptions/:prescriptionId/route', authMiddleware, requireRole('patient'), PharmacyClaimRoutingController.routePrescription);
router.get('/prescriptions/:prescriptionId/routing-history', authMiddleware, requireRole('patient'), PharmacyClaimRoutingController.getRoutingHistory);

// Pharmacy: Get pending claims
router.get('/pharmacy/claims/pending', authMiddleware, requireRole('pharmacy'), PharmacyClaimRoutingController.getPendingClaims);
router.post('/pharmacy/claims/:routingId/accept', authMiddleware, requireRole('pharmacy'), PharmacyClaimRoutingController.acceptClaim);
router.post('/pharmacy/claims/:routingId/reject', authMiddleware, requireRole('pharmacy'), PharmacyClaimRoutingController.rejectClaim);
router.get('/pharmacy/performance/routing', authMiddleware, requireRole('pharmacy'), PharmacyClaimRoutingController.getPharmacyRoutingPerformance);

// Admin: Routing statistics
router.get('/partnerships/routing/candidates', authMiddleware, requireRole('admin'), PharmacyClaimRoutingController.getCandidatePharmacies);
router.get('/partnerships/routing/statistics', authMiddleware, requireRole('admin'), PharmacyClaimRoutingController.getRoutingStatistics);
router.get('/partnerships/routing/by-tier', authMiddleware, requireRole('admin'), PharmacyClaimRoutingController.getRoutingByTier);

module.exports = router;
