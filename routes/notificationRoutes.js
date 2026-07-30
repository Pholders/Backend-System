const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');
const NotificationController = require('../controllers/notificationController');

/**
 * Patient notification routes. All require an authenticated patient.
 */

// Inbox
router.get('/', authMiddleware, requireRole('patient'), NotificationController.list);
router.patch('/read-all', authMiddleware, requireRole('patient'), NotificationController.markAllRead);
router.patch('/:id/read', authMiddleware, requireRole('patient'), NotificationController.markRead);

// Settings
router.get('/settings', authMiddleware, requireRole('patient'), NotificationController.getSettings);
router.put('/settings', authMiddleware, requireRole('patient'), NotificationController.updateSettings);

// Device tokens (registered by the mobile app)
router.post('/device-token', authMiddleware, requireRole('patient'), NotificationController.registerDeviceToken);
router.delete('/device-token', authMiddleware, requireRole('patient'), NotificationController.removeDeviceToken);

module.exports = router;
