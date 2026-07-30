const express = require('express');
const router = express.Router();
const PrescriptionController = require('../controllers/prescriptionController');
const PharmacyController = require('../controllers/pharmacyController');
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');

/**
 * IMPORTANT: Route order matters! More specific routes must come before catch-all routes.
 * This prevents /:prescriptionId from matching routes like /pharmacy/claimed
 */

/**
 * PUBLIC: QR Code Access Routes (No Authentication Required)
 * Must come early to avoid being caught by /:prescriptionId
 */

// Access prescription via QR code (one-time use)
router.get('/qr/:qrToken', PrescriptionController.accessQRCodePrescription);

// Check QR code status before accessing
router.get('/qr/:qrToken/status', PrescriptionController.checkQRCodeStatus);

/**
 * DOCTOR: Named routes to avoid being caught by /:prescriptionId
 */

// Get all doctor's issued prescriptions
router.get('/doctor/all', authMiddleware, requireRole('doctor'), PrescriptionController.getDoctorPrescriptions);

// Get doctor's signed prescriptions
router.post('/doctor/signed', authMiddleware, PrescriptionController.doctorSignedRx);

/**
 * PHARMACY: Specific routes must come before /:prescriptionId catch-all
 */

// Get all claimed prescriptions available for dispensing
router.get('/pharmacy/claimed', authMiddleware, requireRole('pharmacy'), PharmacyController.getClaimedPrescriptions);

// Get dispensing history
router.get('/pharmacy/dispense-history', authMiddleware, requireRole('pharmacy'), PharmacyController.getDispenseHistory);

// Get dispensing stats
router.get('/pharmacy/dispense-stats', authMiddleware, requireRole('pharmacy'), PharmacyController.getDispenseStats);

// View detailed medicines for a claimed prescription
router.get('/pharmacy/medicines/:prescriptionId', authMiddleware, requireRole('pharmacy'), PharmacyController.viewClaimedPrescriptionMedicines);

/**
 * DOCTOR: Create new prescription (POST to root)
 */

// Create new prescription from appointment
router.post('/', authMiddleware, requireRole('doctor'), PrescriptionController.createPrescription);

/**
 * CATCH-ALL ROUTES: Prescription ID based routes (must come LAST)
 * IMPORTANT: These catch-all routes must be at the end after all specific routes above
 */

// POST operations on specific prescriptions
router.post('/:prescriptionId/medicines', authMiddleware, requireRole('doctor'), PrescriptionController.addMedicine);

router.post('/:prescriptionId/check-interactions', authMiddleware, requireRole('doctor'), PrescriptionController.checkDrugInteractions);

router.post('/:prescriptionId/sign', authMiddleware, requireRole('doctor'), PrescriptionController.signPrescription);

router.post('/:prescriptionId/revoke', authMiddleware, requireRole('doctor'), PrescriptionController.revokePrescription);

router.post('/:prescriptionId/share-email', authMiddleware, requireRole('patient'), PrescriptionController.sharePrescriptionEmail);

router.post('/:prescriptionId/claim', authMiddleware, requireRole('patient'), PrescriptionController.claimPrescription);

router.post('/:prescriptionId/dispense', authMiddleware, requireRole('pharmacy'), PharmacyController.dispensePrescription);

router.post('/:prescriptionId/revert-claim', authMiddleware, requireRole('admin'), PrescriptionController.revertClaim);

// GET operations on specific prescriptions
router.get('/', authMiddleware, requireRole('patient'), PrescriptionController.getPatientPrescriptions);

router.get('/:prescriptionId', authMiddleware, requireRole('patient'), PrescriptionController.viewPrescription);

router.get('/:prescriptionId/download', authMiddleware, requireRole('patient'), PrescriptionController.downloadPrescription);

router.get('/:prescriptionId/print', authMiddleware, requireRole('patient'), PrescriptionController.printPrescription);

router.get('/:prescriptionId/qrcode', authMiddleware, requireRole('patient'), PrescriptionController.generateQRCode);

router.get('/:prescriptionId/qrcode-history', authMiddleware, requireRole('patient'), PrescriptionController.getQRCodeAccessHistory);

router.get('/:prescriptionId/share-history', authMiddleware, requireRole('patient'), PrescriptionController.getShareHistory);

router.get('/:prescriptionId/claim-status', authMiddleware, requireRole('patient'), PrescriptionController.checkClaimStatus);

router.get('/:prescriptionId/claim-info', authMiddleware, requireRole('patient'), PrescriptionController.getClaimInfo);

module.exports = router;
