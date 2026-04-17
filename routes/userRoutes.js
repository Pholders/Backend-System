const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');
const authMiddleware = require('../middleware/auth');

/**
 * User Routes
 */

// Public routes (no authentication required)
router.post('/signup', UserController.signup);
router.post('/login', UserController.login);

// Protected routes (authentication required)
router.get('/profile', authMiddleware, UserController.getProfile);
router.put('/profile', authMiddleware, UserController.updateProfile);

module.exports = router;
