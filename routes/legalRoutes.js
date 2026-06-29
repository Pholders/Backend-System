const express = require('express');
const router = express.Router();
const LegalController = require('../controllers/legalController');

/**
 * Legal Routes — mounted at /api/legal in server.js
 * Public endpoints (no auth required).
 */

router.get('/terms',   LegalController.getTerms);
router.get('/privacy', LegalController.getPrivacy);

module.exports = router;
