const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');
const OrderController = require('../controllers/orderController');

/**
 * Orders v1 routes.
 *
 * Patient routes are gated to role 'patient'.
 * Pharmacy routes are gated to role 'pharmacy'.
 *
 * IMPORTANT: More specific paths come first so `/pharmacy/queue` isn't
 * captured by `/:id`.
 */

// -------- Pharmacy --------
router.get(
  '/pharmacy/queue',
  authMiddleware,
  requireRole('pharmacy'),
  OrderController.pharmacyQueue
);

router.patch(
  '/:id/accept',
  authMiddleware,
  requireRole('pharmacy'),
  OrderController.pharmacyAccept
);

router.patch(
  '/:id/reject',
  authMiddleware,
  requireRole('pharmacy'),
  OrderController.pharmacyReject
);

router.patch(
  '/:id/status',
  authMiddleware,
  requireRole('pharmacy'),
  OrderController.pharmacySetStatus
);

router.post(
  '/:id/claim',
  authMiddleware,
  requireRole('pharmacy'),
  OrderController.pharmacyRecordClaim
);

// -------- Patient --------
router.post(
  '/',
  authMiddleware,
  requireRole('patient'),
  OrderController.create
);

router.get(
  '/',
  authMiddleware,
  requireRole('patient'),
  OrderController.listMine
);

router.patch(
  '/:id/cancel',
  authMiddleware,
  requireRole('patient'),
  OrderController.patientCancel
);

// Shared read — both patient and pharmacy. requireRole accepts multiple roles.
router.get(
  '/:id',
  authMiddleware,
  requireRole('patient', 'pharmacy'),
  OrderController.getOne
);

module.exports = router;
