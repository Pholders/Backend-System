const express = require('express');
const router = express.Router();
const multer = require('multer');
const UserController = require('../controllers/userController');
const DoctorController = require('../controllers/doctorController');
const PharmacyController = require('../controllers/pharmacyController');
const AdminController = require('../controllers/adminController');
const PatientProfileController = require('../controllers/patientProfileController');
const EnhancedProfileController = require('../controllers/enhancedProfileController');
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
 * Token Management Routes (for access/refresh token system)
 */
// Refresh Token Routes
router.post('/refresh-token', RefreshController.refreshToken);
router.post('/logout', authMiddleware, RefreshController.logout);

module.exports = router;
