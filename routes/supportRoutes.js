const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');
const SupportController = require('../controllers/supportController');

/**
 * Support Routes — mounted at /api/support in server.js
 *
 * Anonymous endpoints (no auth):
 *   POST /tickets
 *   POST /contact
 *   GET  /faq
 *
 * Authenticated endpoints (patient):
 *   GET  /tickets           — list my tickets
 */

router.post('/tickets',  SupportController.submitTicket);
router.post('/contact',  SupportController.contactUs);
router.get('/faq',       SupportController.getFAQ);

router.get('/tickets',   authMiddleware, requireRole('patient'), SupportController.listMyTickets);

module.exports = router;
