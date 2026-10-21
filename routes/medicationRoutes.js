const express = require('express');
const multer = require('multer');
const medicationAuth = require('../middleware/medicationAuth');
const MedicationController = require('../controllers/medicationController');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

function handleUploadError(error, req, res, next) {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'Attachment files must not exceed 10 MB.' }
    });
  }
  return next(error);
}

router.post('/', medicationAuth, MedicationController.create);
router.get('/', medicationAuth, MedicationController.list);
router.post(
  '/:medicationId/attachments',
  medicationAuth,
  upload.single('file'),
  handleUploadError,
  MedicationController.uploadAttachment
);
router.get(
  '/:medicationId/attachments/:attachmentId',
  medicationAuth,
  MedicationController.getAttachment
);

module.exports = router;
