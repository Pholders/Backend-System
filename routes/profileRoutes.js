const express = require('express');
const multer = require('multer');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');
const ProfileController = require('../controllers/profileController');
const ProfileSecurityController = require('../controllers/profileSecurityController');
const AccountProtectionController = require('../controllers/accountProtectionController');
const LinkedServicesController = require('../controllers/linkedServicesController');
const MedicalAidController = require('../controllers/medicalAidController');
const SupportController = require('../controllers/supportController');
const UserController = require('../controllers/userController');

/**
 * Profile Routes — mounted at /api/profile in server.js
 *
 * Sprint 1  : Personal profile
 * Sprint 2  : Security settings  (added in Phase 2)
 * Sprint 3  : Devices + login activity (added in Phase 3)
 * Sprint 4  : Account protection (added in Phase 4)
 * Sprint 5  : Linked services    (added in Phase 5)
 * Sprint 6  : Medical aid        (added in Phase 6)
 * Sprint 7  : Billing            (added in Phase 7)
 */

// Avatar upload: images only, 5MB cap
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, or WEBP images are allowed for avatars'));
  }
});

// Medical aid card upload: images, 8MB cap, two fields (front, back)
const medicalAidCardUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, or WEBP images are allowed'));
  }
});

// ===== Sprint 1 — Personal profile =====

// Email-change confirmation (token in query string — NO auth required)
router.get('/email/verify', ProfileController.verifyEmailChange);

router.get('/',          authMiddleware, requireRole('patient'), ProfileController.getProfile);
router.put('/personal',  authMiddleware, requireRole('patient'), ProfileController.updatePersonal);
router.put('/account',   authMiddleware, requireRole('patient'), ProfileController.updateAccount);
router.put('/avatar',    authMiddleware, requireRole('patient'), avatarUpload.single('avatar'), ProfileController.updateAvatar);

// ===== Sprint 2 — Security settings =====
router.get('/security',                         authMiddleware, requireRole('patient'), ProfileSecurityController.getSecurity);
router.put('/security/biometrics',              authMiddleware, requireRole('patient'), ProfileSecurityController.updateBiometrics);
router.put('/security/2fa',                     authMiddleware, requireRole('patient'), ProfileSecurityController.updateTwoFA);
router.post('/security/2fa/verify',             authMiddleware, requireRole('patient'), ProfileSecurityController.verifyTwoFAEnable);
router.put('/security/password',                authMiddleware, requireRole('patient'), ProfileSecurityController.updatePassword);
// Task 9 — alias to existing forgot-password flow (no auth needed)
router.post('/security/password/reset',         UserController.forgotPassword);

// ===== Sprint 3 — Devices + login activity =====
router.get('/devices',                          authMiddleware, requireRole('patient'), ProfileSecurityController.listDevices);
router.delete('/devices/:sessionId',            authMiddleware, requireRole('patient'), ProfileSecurityController.revokeDevice);
router.post('/devices/revoke-others',           authMiddleware, requireRole('patient'), ProfileSecurityController.revokeOtherDevices);
router.get('/login-activity',                   authMiddleware, requireRole('patient'), ProfileSecurityController.getLoginActivity);

// ===== Sprint 4 — Account protection =====
router.post('/security/report-suspicious',      authMiddleware, requireRole('patient'), AccountProtectionController.reportSuspicious);
router.post('/security/freeze',                 authMiddleware, requireRole('patient'), AccountProtectionController.freezeAccount);
// Unfreeze link — NO auth (user is locked out)
router.get('/security/unfreeze',                AccountProtectionController.unfreezeAccount);
router.get('/security/audit-log/export',        authMiddleware, requireRole('patient'), AccountProtectionController.exportAuditLog);

// ===== Sprint 5 — Linked services =====
// Connected doctors
router.get('/linked-services/doctors',                       authMiddleware, requireRole('patient'), LinkedServicesController.listConnectedDoctors);
router.post('/linked-services/doctors',                      authMiddleware, requireRole('patient'), LinkedServicesController.linkDoctor);
router.delete('/linked-services/doctors/:connectionId',      authMiddleware, requireRole('patient'), LinkedServicesController.unlinkDoctor);

// Connected pharmacies
router.get('/linked-services/pharmacies',                    authMiddleware, requireRole('patient'), LinkedServicesController.listConnectedPharmacies);
router.post('/linked-services/pharmacies',                   authMiddleware, requireRole('patient'), LinkedServicesController.linkPharmacy);
router.delete('/linked-services/pharmacies/:connectionId',   authMiddleware, requireRole('patient'), LinkedServicesController.unlinkPharmacy);

// Family / dependents
router.get('/linked-services/dependents',                    authMiddleware, requireRole('patient'), LinkedServicesController.listDependents);
router.post('/linked-services/dependents',                   authMiddleware, requireRole('patient'), LinkedServicesController.addDependent);
router.put('/linked-services/dependents/:id',                authMiddleware, requireRole('patient'), LinkedServicesController.updateDependent);
router.delete('/linked-services/dependents/:id',             authMiddleware, requireRole('patient'), LinkedServicesController.removeDependent);

// ===== Sprint 6 — Medical aid =====
// Signed-file download — NO auth, token validates ownership
router.get('/medical-aid/files/download',                    MedicalAidController.downloadFile);

router.get('/medical-aid',                                   authMiddleware, requireRole('patient'), MedicalAidController.getScheme);
router.put('/medical-aid',                                   authMiddleware, requireRole('patient'), MedicalAidController.updateScheme);
router.put('/medical-aid/card',                              authMiddleware, requireRole('patient'),
  medicalAidCardUpload.fields([{ name: 'front', maxCount: 1 }, { name: 'back', maxCount: 1 }]),
  MedicalAidController.uploadCard);
router.get('/medical-aid/card/:side/url',                    authMiddleware, requireRole('patient'), MedicalAidController.getCardSignedUrl);
router.get('/medical-aid/claims',                            authMiddleware, requireRole('patient'), MedicalAidController.listClaims);
router.get('/medical-aid/claims/:id',                        authMiddleware, requireRole('patient'), MedicalAidController.getClaim);
router.get('/medical-aid/invoices',                          authMiddleware, requireRole('patient'), MedicalAidController.listInvoices);
router.get('/medical-aid/invoices/:id',                      authMiddleware, requireRole('patient'), MedicalAidController.getInvoice);

// ===== Sprint 8 — Permanent account deletion =====
router.post('/account/delete-request',                       authMiddleware, requireRole('patient'), SupportController.requestAccountDeletion);
// Confirmation link — NO auth (consumed from email)
router.get('/account/delete-confirm',                        SupportController.confirmAccountDeletion);

module.exports = router;
