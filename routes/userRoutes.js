const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');
const DoctorController = require('../controllers/doctorController');
const PharmacyController = require('../controllers/pharmacyController');
const AdminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/auth');
const { requireRole, preventAuthenticated } = require('../middleware/auth');
const RefreshController = require('../controllers/refreshController');

/**
 * Patient Routes
 */
router.post('/signup', preventAuthenticated, UserController.signup);
router.post('/login', preventAuthenticated, UserController.login);
router.post('/verify-otp', preventAuthenticated, UserController.verifyOTP);

router.get('/profile', authMiddleware, requireRole('patient'), UserController.getProfile);
router.put('/profile', authMiddleware, requireRole('patient'), UserController.updateProfile);

/**
 * Doctor Routes
 */
router.post('/doctor/signup', preventAuthenticated, DoctorController.signup);
router.post('/doctor/login', preventAuthenticated, DoctorController.login);
router.post('/doctor/verify-otp', preventAuthenticated, DoctorController.verifyOTP);

router.get('/doctor/profile', authMiddleware, requireRole('doctor'), DoctorController.getProfile);
router.put('/doctor/profile', authMiddleware, requireRole('doctor'), DoctorController.updateProfile);

/**
 * Pharmacy Routes
 */
router.post('/pharmacy/signup', preventAuthenticated, PharmacyController.signup);
router.post('/pharmacy/login', preventAuthenticated, PharmacyController.login);
router.post('/pharmacy/verify-otp', preventAuthenticated, PharmacyController.verifyOTP);

router.get('/pharmacy/profile', authMiddleware, requireRole('pharmacy'), PharmacyController.getProfile);
router.put('/pharmacy/profile', authMiddleware, requireRole('pharmacy'), PharmacyController.updateProfile);

/**
 * Admin Routes
 */
router.post('/admin/login', preventAuthenticated, AdminController.login);
router.post('/admin/verify-otp', preventAuthenticated, AdminController.verifyOTP);

router.get('/admin/profile', authMiddleware, requireRole('admin'), AdminController.getProfile);
router.put('/admin/profile', authMiddleware, requireRole('admin'), AdminController.updateProfile);

// authenticataion routes
router.post('/refresh-token', RefreshController.refreshToken);
router.post('/logout', RefreshController.logout);

module.exports = router;
