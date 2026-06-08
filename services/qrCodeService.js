const crypto = require('crypto');

/**
 * QR Code Service
 * Generates secure QR codes for prescription sharing and access
 * For actual QR code generation, integrate with 'qrcode' npm package
 */

class QRCodeService {
  /**
   * Generate QR code data for prescription
   * @param {Object} prescriptionData - { id, number, patientEmail, doctorName }
   * @returns {Object} - QR code data and access link
   */
  static generateQRCodeData(prescriptionData) {
    const { id, prescriptionNumber, patientEmail, doctorName } = prescriptionData;

    // Generate secure one-time-use token for QR code
    const qrToken = crypto
      .createHash('sha256')
      .update(`${id}:${prescriptionNumber}:${Date.now()}:${process.env.QR_SECRET || 'qrSecret'}:${Math.random()}`)
      .digest('hex');

    const baseUrl = process.env.FRONTEND_URL || 'https://app.healthcare.local';
    const accessLink = `${baseUrl}/prescriptions/qr/${qrToken}`;

    // QR code data structure (to be encoded into QR code image)
    const qrData = {
      type: 'PRESCRIPTION_ONE_TIME_USE',
      version: '2.0',
      prescriptionId: id,
      prescriptionNumber,
      accessToken: qrToken,
      accessLink,
      oneTimeUse: true,
      maxAccess: 1,
      expiresIn: '90 days',
      generatedAt: new Date().toISOString(),
      validFor: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      warning: 'This QR code can only be scanned once. After first access, it will be invalid.'
    };

    return {
      qrCode: JSON.stringify(qrData),
      accessLink,
      qrToken,
      qrString: this.encodeQRString(qrData),
      oneTimeUse: true,
      status: 'VALID'
    };
  }

  /**
   * Encode QR data into a string format suitable for QR code generation
   */
  static encodeQRString(qrData) {
    // Standard format: [TYPE]|[ID]|[TOKEN]|[TIMESTAMP]
    return `PRESCRIPTION|${qrData.prescriptionId}|${qrData.accessToken}|${Date.now()}`;
  }

  /**
   * Decode QR string
   */
  static decodeQRString(qrString) {
    const parts = qrString.split('|');
    if (parts.length !== 4 || parts[0] !== 'PRESCRIPTION') {
      return null;
    }

    return {
      type: parts[0],
      prescriptionId: parseInt(parts[1]),
      accessToken: parts[2],
      timestamp: parseInt(parts[3])
    };
  }

  /**
   * Generate secure download link for prescription
   */
  static generateDownloadLink(prescriptionId, patientId) {
    const downloadToken = crypto
      .createHash('sha256')
      .update(`${prescriptionId}:${patientId}:${Date.now()}:${process.env.DOWNLOAD_SECRET || 'downloadSecret'}`)
      .digest('hex');

    const baseUrl = process.env.BACKEND_URL || 'https://api.healthcare.local';
    const downloadLink = `${baseUrl}/api/prescriptions/${prescriptionId}/download/${downloadToken}`;

    return {
      downloadLink,
      downloadToken,
      expiresIn: '7 days',
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    };
  }

  /**
   * Generate secure share link
   */
  static generateShareLink(prescriptionId, patientId, shareWithEmail) {
    const shareToken = crypto
      .createHash('sha256')
      .update(`${prescriptionId}:${patientId}:${shareWithEmail}:${Date.now()}:${process.env.SHARE_SECRET || 'shareSecret'}`)
      .digest('hex');

    const baseUrl = process.env.FRONTEND_URL || 'https://app.healthcare.local';
    const shareLink = `${baseUrl}/prescriptions/shared/${shareToken}`;

    return {
      shareLink,
      shareToken,
      shareWithEmail,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      expiresIn: '30 days'
    };
  }

  /**
   * Generate email share link
   */
  static generateEmailShareLink(prescriptionData) {
    const { id, prescriptionNumber, patientName, doctorName, shareWithEmail } = prescriptionData;

    const shareToken = crypto
      .createHash('sha256')
      .update(`${id}:${shareWithEmail}:${Date.now()}:${process.env.SHARE_SECRET || 'shareSecret'}`)
      .digest('hex');

    const baseUrl = process.env.FRONTEND_URL || 'https://app.healthcare.local';
    const viewLink = `${baseUrl}/prescriptions/shared/${shareToken}`;

    return {
      shareToken,
      viewLink,
      emailSubject: `Prescription from ${doctorName}`,
      emailBody: `
        <p>Hello,</p>
        <p>${patientName} has shared their prescription (${prescriptionNumber}) with you.</p>
        <p>You can view the prescription using the link below:</p>
        <p><a href="${viewLink}">View Prescription</a></p>
        <p>This link will expire in 30 days.</p>
        <p>Best regards,<br/>Healthcare System</p>
      `,
      expiresIn: '30 days',
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    };
  }

  /**
   * Verify access token
   */
  static async verifyAccessToken(token, prescriptionId) {
    try {
      // In production, verify token against stored token in database
      // For now, we'll just validate the format
      if (!token || typeof token !== 'string' || token.length !== 64) {
        return {
          valid: false,
          message: 'Invalid access token'
        };
      }

      return {
        valid: true,
        prescriptionId,
        accessGranted: true
      };
    } catch (error) {
      return {
        valid: false,
        message: 'Token verification failed',
        error: error.message
      };
    }
  }

  /**
   * Generate prescription access metadata for sharing
   */
  static generateAccessMetadata(prescriptionId, accessType) {
    return {
      prescriptionId,
      accessType, // 'view', 'print', 'email', 'qrcode'
      accessToken: crypto.randomBytes(32).toString('hex'),
      timestamp: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      oneTime: false,
      downloadable: accessType === 'view' || accessType === 'print',
      shareable: accessType === 'qrcode' || accessType === 'email'
    };
  }

  /**
   * Generate all prescription sharing options
   */
  static generateAllSharingOptions(prescriptionData) {
    const { id, prescriptionNumber, patientId, patientName, doctorName } = prescriptionData;

    return {
      qrCode: this.generateQRCodeData(prescriptionData),
      download: this.generateDownloadLink(id, patientId),
      print: {
        printLink: `${process.env.FRONTEND_URL || 'https://app.healthcare.local'}/prescriptions/${id}/print`,
        format: 'PDF',
        watermark: `Patient: ${patientName} | Doctor: ${doctorName} | Rx: ${prescriptionNumber}`
      },
      email: {
        format: 'Can be emailed as PDF attachment',
        recipientLimit: 5,
        expiresIn: '30 days'
      },
      shareLink: {
        type: 'Shareable Link',
        description: 'Create a unique link to share with authorized recipients',
        expiresIn: '30 days'
      }
    };
  }

  /**
   * Verify one-time use QR code access
   * @param {string} qrToken - The QR code token
   * @param {string} ipAddress - IP address of accessor
   * @param {string} deviceInfo - Device information (User-Agent, etc.)
   * @returns {Object} - Verification result with prescription details
   */
  static async verifyOneTimeQRCode(qrToken, ipAddress = '', deviceInfo = '') {
    const Prescription = require('../models/Prescription');
    
    try {
      // Verify and consume the QR code
      const verificationResult = await Prescription.verifyAndConsumeQRCode(qrToken, ipAddress, deviceInfo);

      return {
        success: verificationResult.valid,
        message: verificationResult.message,
        prescriptionId: verificationResult.prescriptionId,
        accessedAt: verificationResult.accessedAt,
        status: verificationResult.valid ? 'ACCESSED' : 'DENIED'
      };
    } catch (error) {
      console.error('❌ Error verifying one-time QR code:', error);
      return {
        success: false,
        message: 'Error verifying QR code',
        error: error.message
      };
    }
  }

  /**
   * Check QR code status without consuming it
   * Useful for displaying QR code validity before access
   */
  static async checkQRCodeValidity(qrToken) {
    const Prescription = require('../models/Prescription');

    try {
      const status = await Prescription.checkQRCodeStatus(qrToken);
      return status;
    } catch (error) {
      console.error('❌ Error checking QR code validity:', error);
      return {
        valid: false,
        message: 'Error checking QR code',
        error: error.message
      };
    }
  }
}

module.exports = QRCodeService;
