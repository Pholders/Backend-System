const express = require('express');
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');
const MedicalHistoryController = require('../controllers/medicalHistoryController');

/**
 * A patient's own medical history: conditions, allergies, surgeries and
 * family history. :section is one of conditions, allergies, surgeries,
 * family-history.
 */
const router = express.Router();

router.use(authMiddleware, requireRole('patient'));

router.get('/', MedicalHistoryController.getAll);
router.get('/:section', MedicalHistoryController.list);
router.post('/:section', MedicalHistoryController.create);
router.delete('/:section/:id', MedicalHistoryController.remove);

module.exports = router;
