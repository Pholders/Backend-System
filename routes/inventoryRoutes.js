const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');
const InventoryController = require('../controllers/inventoryController');

/**
 * Inventory routes. All pharmacy-scoped and role-gated.
 * More specific paths come before `/:id`.
 */

router.get(
  '/meta/summary',
  authMiddleware,
  requireRole('pharmacy'),
  InventoryController.summary
);

router.get(
  '/',
  authMiddleware,
  requireRole('pharmacy'),
  InventoryController.list
);

router.post(
  '/',
  authMiddleware,
  requireRole('pharmacy'),
  InventoryController.create
);

router.get(
  '/:id/adjustments',
  authMiddleware,
  requireRole('pharmacy'),
  InventoryController.listAdjustments
);

router.post(
  '/:id/adjust',
  authMiddleware,
  requireRole('pharmacy'),
  InventoryController.adjust
);

router.get(
  '/:id',
  authMiddleware,
  requireRole('pharmacy'),
  InventoryController.getOne
);

router.patch(
  '/:id',
  authMiddleware,
  requireRole('pharmacy'),
  InventoryController.update
);

router.delete(
  '/:id',
  authMiddleware,
  requireRole('pharmacy'),
  InventoryController.softDelete
);

module.exports = router;
