const Prescription = require('../models/Prescription');
const PrescriptionItem = require('../models/PrescriptionItem');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const User = require('../models/User');
const DrugInteractionService = require('../services/drugInteractionService');
const DigitalSignatureService = require('../services/digitalSignatureService');
const QRCodeService = require('../services/qrCodeService');
const EmailService = require('../services/emailService');

/**
 * Prescription Controller
 * Handles prescription creation, management, and sharing
 */

class PrescriptionController {
  /**
   * Doctor: Create a new prescription (after appointment acceptance)
   */
  static async createPrescription(req, res) {
    try {
      const doctorId = req.user.id;
      const { appointmentId, diagnosis, clinicalNotes } = req.body;

      if (!appointmentId || !diagnosis) {
        return res.status(400).json({
          success: false,
          message: 'appointmentId and diagnosis are required'
        });
      }

      // Verify appointment exists and belongs to this doctor
      const appointmentResult = await Appointment.getById(appointmentId);
      if (!appointmentResult || appointmentResult.doctor_id !== doctorId) {
        return res.status(404).json({
          success: false,
          message: 'Appointment not found or not assigned to you'
        });
      }

      // Get doctor and patient details
      const doctor = await Doctor.findById(doctorId);
      const patientResult = await User.findById(appointmentResult.patient_id);

      // Create prescription
      const prescriptionData = {
        appointment_id: appointmentId,
        doctor_id: doctorId,
        patient_id: appointmentResult.patient_id,
        prescriber_name: `${doctor.first_name} ${doctor.last_name}`,
        prescriber_hpcsa: doctor.hpcsa_number,
        prescriber_phone: doctor.phone,
        prescriber_email: doctor.email,
        patient_name: `${patientResult.first_name} ${patientResult.last_name}`,
        patient_id_number: patientResult.id_number || '',
        patient_dob: patientResult.dob || null,
        patient_phone: patientResult.phone,
        patient_email: patientResult.email,
        diagnosis,
        clinical_notes: clinicalNotes
      };

      const prescription = await Prescription.create(prescriptionData);

      res.status(201).json({
        success: true,
        message: 'Prescription created successfully',
        data: {
          prescriptionId: prescription.id,
          prescriptionNumber: prescription.prescription_number,
          status: prescription.signature_status,
          createdAt: prescription.created_at
        }
      });
    } catch (error) {
      console.error('❌ Error creating prescription:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating prescription',
        error: error.message
      });
    }
  }

  /**
   * Doctor: Add medicines to prescription
   */
  static async addMedicine(req, res) {
    try {
      const doctorId = req.user.id;
      const { prescriptionId } = req.params;
      const medicineData = req.body;

      // Verify prescription exists and belongs to this doctor
      const prescription = await Prescription.getById(prescriptionId);
      if (!prescription || prescription.doctor_id !== doctorId) {
        return res.status(404).json({
          success: false,
          message: 'Prescription not found or not yours'
        });
      }

      if (prescription.signature_status === 'signed') {
        return res.status(400).json({
          success: false,
          message: 'Cannot modify a signed prescription'
        });
      }

      // Create prescription item
      const itemData = {
        prescription_id: prescriptionId,
        ...medicineData
      };

      const item = await PrescriptionItem.create(itemData);

      // Check drug interactions (optional warning)
      const existingItems = await PrescriptionItem.getByPrescriptionId(prescriptionId);
      const medicineNames = existingItems.map(i => i.medicine_name);

      const interactions = await DrugInteractionService.checkDrugInteractions(
        medicineNames,
        []
      );

      res.status(201).json({
        success: true,
        message: 'Medicine added successfully',
        data: {
          itemId: item.id,
          medicine: item.medicine_name,
          dosage: item.dosage,
          warnings: interactions.moderate.length > 0 ? interactions : null
        }
      });
    } catch (error) {
      console.error('❌ Error adding medicine:', error);
      res.status(500).json({
        success: false,
        message: 'Error adding medicine',
        error: error.message
      });
    }
  }

  /**
   * Doctor: Perform drug interaction check before signing
   */
  static async checkDrugInteractions(req, res) {
    try {
      const { prescriptionId } = req.params;
      const { patientConditions = [], currentMedications = [] } = req.body;

      const prescription = await Prescription.getById(prescriptionId);
      if (!prescription) {
        return res.status(404).json({
          success: false,
          message: 'Prescription not found'
        });
      }

      // Get all medicines in prescription
      const medicines = prescription.items || [];

      // Perform comprehensive safety check
      const safetyReport = await DrugInteractionService.generateSafetyReport({
        medicines,
        patientAge: req.body.patientAge || 35,
        patientWeight: req.body.patientWeight || 70,
        patientConditions,
        currentMedications
      });

      res.status(200).json({
        success: true,
        message: 'Drug interaction check completed',
        data: safetyReport
      });
    } catch (error) {
      console.error('❌ Error checking drug interactions:', error);
      res.status(500).json({
        success: false,
        message: 'Error checking drug interactions',
        error: error.message
      });
    }
  }

  /**
   * Doctor: Request OTP for prescription signature
   */
  static async requestSignatureOTP(req, res) {
    try {
      const doctorId = req.user.id;
      const { prescriptionId } = req.params;

      // Verify prescription
      const prescription = await Prescription.getById(prescriptionId);
      if (!prescription || prescription.doctor_id !== doctorId) {
        return res.status(404).json({
          success: false,
          message: 'Prescription not found or not yours'
        });
      }

      if (prescription.items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot sign prescription without medicines'
        });
      }

      // Generate OTP
      const { otp, hash, expiry } = DigitalSignatureService.generateOTP();

      // Store OTP hash in database
      await Prescription.storeOTP(prescriptionId, hash, expiry);

      // Send OTP via email
      await EmailService.sendEmail({
        to: prescription.prescriber_email,
        subject: 'Prescription Signature OTP',
        template: 'prescription-signature-otp',
        data: {
          doctorName: prescription.prescriber_name,
          prescriptionNumber: prescription.prescription_number,
          otp,
          expiryTime: '10 minutes'
        }
      });

      res.status(200).json({
        success: true,
        message: 'OTP sent to your registered email',
        data: {
          prescriptionId,
          otpSent: true,
          validFor: '10 minutes'
        }
      });
    } catch (error) {
      console.error('❌ Error requesting OTP:', error);
      res.status(500).json({
        success: false,
        message: 'Error requesting signature OTP',
        error: error.message
      });
    }
  }

  /**
   * Doctor: Sign prescription with OTP
   */
  static async signPrescription(req, res) {
    try {
      const doctorId = req.user.id;
      const { prescriptionId } = req.params;
      const { otp } = req.body;

      if (!otp) {
        return res.status(400).json({
          success: false,
          message: 'OTP is required'
        });
      }

      // Get prescription
      const prescription = await Prescription.getById(prescriptionId);
      if (!prescription || prescription.doctor_id !== doctorId) {
        return res.status(404).json({
          success: false,
          message: 'Prescription not found'
        });
      }

      // Verify OTP
      const otpHash = require('crypto')
        .createHash('sha256')
        .update(otp + process.env.OTP_SECRET || 'prescriptionSecret')
        .digest('hex');

      const otpVerification = await Prescription.verifyOTP(prescriptionId, otpHash);
      if (!otpVerification.valid) {
        return res.status(400).json({
          success: false,
          message: otpVerification.message
        });
      }

      // Generate digital signature
      const signatureData = {
        prescriptionId,
        doctorId,
        doctorName: prescription.prescriber_name,
        hpcsa: prescription.prescriber_hpcsa,
        patientId: prescription.patient_id,
        medicines: prescription.items
      };

      const digitalSignature = DigitalSignatureService.generateDigitalSignature(signatureData);

      // Update prescription with signature
      const timestamp = new Date().toISOString();
      await Prescription.updateSignature(prescriptionId, JSON.stringify(digitalSignature), timestamp);

      // Generate QR code
      const qrCodeData = QRCodeService.generateQRCodeData(prescription);

      // Create audit trail entry
      const auditEntry = DigitalSignatureService.createAuditEntry(
        'PRESCRIPTION_SIGNED',
        {
          userId: doctorId,
          name: prescription.prescriber_name,
          role: 'Doctor',
          ip: req.ip
        },
        prescription
      );

      res.status(200).json({
        success: true,
        message: 'Prescription signed successfully',
        data: {
          prescriptionId,
          prescriptionNumber: prescription.prescription_number,
          status: 'SIGNED',
          signatureTimestamp: timestamp,
          qrCode: qrCodeData.qrString,
          accessLink: qrCodeData.accessLink,
          medicineCount: prescription.items.length
        }
      });
    } catch (error) {
      console.error('❌ Error signing prescription:', error);
      res.status(500).json({
        success: false,
        message: 'Error signing prescription',
        error: error.message
      });
    }
  }

  /**
   * Patient: Get all prescriptions
   */
  static async getPatientPrescriptions(req, res) {
    try {
      const patientId = req.user.id;
      const { limit = 50, offset = 0, filter = 'all' } = req.query;

      const prescriptions = await Prescription.getByPatientId(patientId, parseInt(limit), parseInt(offset));

      // Filter by signature status if needed
      let filtered = prescriptions;
      if (filter === 'signed') {
        filtered = prescriptions.filter(p => p.signature_status === 'signed');
      } else if (filter === 'pending') {
        filtered = prescriptions.filter(p => p.signature_status === 'pending');
      }

      res.status(200).json({
        success: true,
        message: 'Prescriptions retrieved successfully',
        data: {
          total: filtered.length,
          prescriptions: filtered.map(p => ({
            id: p.id,
            prescriptionNumber: p.prescription_number,
            doctor: p.prescriber_name,
            diagnosis: p.diagnosis,
            status: p.signature_status,
            createdAt: p.created_at,
            isRevoked: p.is_revoked
          }))
        }
      });
    } catch (error) {
      console.error('❌ Error fetching prescriptions:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching prescriptions',
        error: error.message
      });
    }
  }

  /**
   * Patient: View prescription details
   */
  static async viewPrescription(req, res) {
    try {
      const patientId = req.user.id;
      const { prescriptionId } = req.params;

      const prescription = await Prescription.getById(prescriptionId);
      if (!prescription || prescription.patient_id !== patientId) {
        return res.status(404).json({
          success: false,
          message: 'Prescription not found'
        });
      }

      if (prescription.is_revoked) {
        return res.status(410).json({
          success: false,
          message: 'This prescription has been revoked',
          revokeReason: prescription.revoke_reason,
          revokedAt: prescription.revoke_timestamp
        });
      }

      res.status(200).json({
        success: true,
        message: 'Prescription retrieved successfully',
        data: {
          prescription: {
            id: prescription.id,
            prescriptionNumber: prescription.prescription_number,
            prescriber: {
              name: prescription.prescriber_name,
              hpcsa: prescription.prescriber_hpcsa,
              phone: prescription.prescriber_phone,
              email: prescription.prescriber_email
            },
            patient: {
              name: prescription.patient_name,
              idNumber: prescription.patient_id_number,
              dob: prescription.patient_dob,
              phone: prescription.patient_phone,
              email: prescription.patient_email
            },
            diagnosis: prescription.diagnosis,
            clinicalNotes: prescription.clinical_notes,
            medicines: prescription.items.map(item => ({
              id: item.id,
              name: item.medicine_name,
              genericName: item.generic_name,
              dosage: item.dosage,
              form: item.dosage_form,
              quantity: item.quantity,
              frequency: item.frequency,
              route: item.route_of_administration,
              duration: item.duration,
              instructions: item.special_instructions,
              schedule: item.schedule_classification,
              warnings: item.warnings
            })),
            signature: {
              status: prescription.signature_status,
              timestamp: prescription.signature_timestamp,
              certificate: prescription.digital_signature ? JSON.parse(prescription.digital_signature) : null
            },
            createdAt: prescription.created_at,
            updatedAt: prescription.updated_at
          }
        }
      });
    } catch (error) {
      console.error('❌ Error viewing prescription:', error);
      res.status(500).json({
        success: false,
        message: 'Error viewing prescription',
        error: error.message
      });
    }
  }

  /**
   * Patient: Download prescription as PDF
   */
  static async downloadPrescription(req, res) {
    try {
      const patientId = req.user.id;
      const { prescriptionId } = req.params;

      const prescription = await Prescription.getById(prescriptionId);
      if (!prescription || prescription.patient_id !== patientId) {
        return res.status(404).json({
          success: false,
          message: 'Prescription not found'
        });
      }

      // Note: In production, generate actual PDF using a library like pdfkit
      res.status(200).json({
        success: true,
        message: 'Prescription download initiated',
        data: {
          prescriptionNumber: prescription.prescription_number,
          downloadLink: `/api/prescriptions/${prescriptionId}/download`,
          format: 'PDF',
          size: 'estimated 500KB'
        }
      });
    } catch (error) {
      console.error('❌ Error downloading prescription:', error);
      res.status(500).json({
        success: false,
        message: 'Error downloading prescription',
        error: error.message
      });
    }
  }

  /**
   * Patient: Print prescription
   */
  static async printPrescription(req, res) {
    try {
      const patientId = req.user.id;
      const { prescriptionId } = req.params;

      const prescription = await Prescription.getById(prescriptionId);
      if (!prescription || prescription.patient_id !== patientId) {
        return res.status(404).json({
          success: false,
          message: 'Prescription not found'
        });
      }

      // Generate print-friendly format
      res.status(200).json({
        success: true,
        message: 'Print data generated',
        data: {
          prescriptionNumber: prescription.prescription_number,
          printUrl: `/api/prescriptions/${prescriptionId}/print`,
          printFormat: 'A4',
          watermark: `Patient: ${prescription.patient_name} | Doctor: ${prescription.prescriber_name}`
        }
      });
    } catch (error) {
      console.error('❌ Error printing prescription:', error);
      res.status(500).json({
        success: false,
        message: 'Error printing prescription',
        error: error.message
      });
    }
  }

  /**
   * Patient: Share prescription via email
   */
  static async sharePrescriptionEmail(req, res) {
    try {
      const patientId = req.user.id;
      const { prescriptionId } = req.params;
      const { recipientEmail, message = '' } = req.body;

      if (!recipientEmail) {
        return res.status(400).json({
          success: false,
          message: 'recipientEmail is required'
        });
      }

      const prescription = await Prescription.getById(prescriptionId);
      if (!prescription || prescription.patient_id !== patientId) {
        return res.status(404).json({
          success: false,
          message: 'Prescription not found'
        });
      }

      // Generate secure share link
      const shareData = QRCodeService.generateEmailShareLink({
        id: prescriptionId,
        prescriptionNumber: prescription.prescription_number,
        patientName: prescription.patient_name,
        doctorName: prescription.prescriber_name,
        shareWithEmail: recipientEmail
      });

      // Send email
      await EmailService.sendEmail({
        to: recipientEmail,
        subject: shareData.emailSubject,
        html: shareData.emailBody
      });

      // Add to audit trail
      await Prescription.addShareAudit(prescriptionId, {
        shared_with: recipientEmail,
        share_method: 'email'
      });

      res.status(200).json({
        success: true,
        message: 'Prescription shared successfully',
        data: {
          prescriptionId,
          sharedWith: recipientEmail,
          shareMethod: 'email',
          expiresIn: shareData.expiresIn
        }
      });
    } catch (error) {
      console.error('❌ Error sharing prescription:', error);
      res.status(500).json({
        success: false,
        message: 'Error sharing prescription',
        error: error.message
      });
    }
  }

  /**
   * Patient: Generate QR code for prescription
   */
  static async generateQRCode(req, res) {
    try {
      const patientId = req.user.id;
      const { prescriptionId } = req.params;

      const prescription = await Prescription.getById(prescriptionId);
      if (!prescription || prescription.patient_id !== patientId) {
        return res.status(404).json({
          success: false,
          message: 'Prescription not found'
        });
      }

      const qrCodeData = QRCodeService.generateQRCodeData({
        id: prescriptionId,
        prescriptionNumber: prescription.prescription_number,
        patientEmail: prescription.patient_email,
        doctorName: prescription.prescriber_name
      });

      // Store QR code access record for one-time use tracking
      await Prescription.generateQRCodeAccess(prescriptionId, qrCodeData.qrToken, 90);

      res.status(200).json({
        success: true,
        message: 'QR code generated successfully',
        data: {
          prescriptionId,
          qrCode: qrCodeData.qrString,
          accessLink: qrCodeData.accessLink,
          expiresIn: '90 days',
          validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          oneTimeUse: true,
          warning: 'This QR code can only be scanned once. After first access, it will be invalid.'
        }
      });
    } catch (error) {
      console.error('❌ Error generating QR code:', error);
      res.status(500).json({
        success: false,
        message: 'Error generating QR code',
        error: error.message
      });
    }
  }

  /**
   * Public: Access prescription via one-time use QR code
   * Can only be accessed once - after first access, becomes invalid
   */
  static async accessQRCodePrescription(req, res) {
    try {
      const { qrToken } = req.params;

      if (!qrToken) {
        return res.status(400).json({
          success: false,
          message: 'QR token is required'
        });
      }

      // Get IP address of accessor
      const ipAddress = req.ip || req.connection.remoteAddress;
      const deviceInfo = req.get('User-Agent') || 'Unknown Device';

      // Verify and consume the one-time use QR code
      const verificationResult = await Prescription.verifyAndConsumeQRCode(qrToken, ipAddress, deviceInfo);

      if (!verificationResult.valid) {
        return res.status(403).json({
          success: false,
          message: verificationResult.message,
          status: 'DENIED'
        });
      }

      // Get the prescription details
      const prescription = await Prescription.getById(verificationResult.prescriptionId);

      if (!prescription) {
        return res.status(404).json({
          success: false,
          message: 'Prescription not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Prescription accessed successfully via QR code (one-time use)',
        data: {
          prescription: {
            id: prescription.id,
            prescriptionNumber: prescription.prescription_number,
            prescriber: {
              name: prescription.prescriber_name,
              hpcsa: prescription.prescriber_hpcsa,
              phone: prescription.prescriber_phone,
              email: prescription.prescriber_email
            },
            patient: {
              name: prescription.patient_name,
              idNumber: prescription.patient_id_number,
              dob: prescription.patient_dob,
              phone: prescription.patient_phone,
              email: prescription.patient_email
            },
            diagnosis: prescription.diagnosis,
            clinicalNotes: prescription.clinical_notes,
            medicines: prescription.items.map(item => ({
              id: item.id,
              name: item.medicine_name,
              genericName: item.generic_name,
              dosage: item.dosage,
              form: item.dosage_form,
              quantity: item.quantity,
              frequency: item.frequency,
              route: item.route_of_administration,
              duration: item.duration,
              instructions: item.special_instructions,
              schedule: item.schedule_classification,
              warnings: item.warnings
            })),
            signature: {
              status: prescription.signature_status,
              timestamp: prescription.signature_timestamp
            },
            createdAt: prescription.created_at
          },
          accessInfo: {
            accessedAt: verificationResult.accessedAt,
            accessedFrom: ipAddress,
            device: deviceInfo,
            status: 'ONE_TIME_ACCESS_COMPLETE',
            note: 'This QR code has been used and cannot be accessed again'
          }
        }
      });

      // Add to audit trail
      await Prescription.addShareAudit(verificationResult.prescriptionId, {
        shared_with: 'QR Code Scan',
        share_method: 'qrcode'
      });
    } catch (error) {
      console.error('❌ Error accessing QR code prescription:', error);
      res.status(500).json({
        success: false,
        message: 'Error accessing prescription via QR code',
        error: error.message
      });
    }
  }

  /**
   * Check QR code status before accessing
   */
  static async checkQRCodeStatus(req, res) {
    try {
      const { qrToken } = req.params;

      if (!qrToken) {
        return res.status(400).json({
          success: false,
          message: 'QR token is required'
        });
      }

      const status = await Prescription.checkQRCodeStatus(qrToken);

      res.status(200).json({
        success: true,
        message: 'QR code status retrieved',
        data: status
      });
    } catch (error) {
      console.error('❌ Error checking QR code status:', error);
      res.status(500).json({
        success: false,
        message: 'Error checking QR code status',
        error: error.message
      });
    }
  }

  /**
   * Get QR code access history for a prescription
   */
  static async getQRCodeAccessHistory(req, res) {
    try {
      const patientId = req.user.id;
      const { prescriptionId } = req.params;

      const prescription = await Prescription.getById(prescriptionId);
      if (!prescription || prescription.patient_id !== patientId) {
        return res.status(404).json({
          success: false,
          message: 'Prescription not found'
        });
      }

      const accessHistory = await Prescription.getQRCodeAccessHistory(prescriptionId);

      res.status(200).json({
        success: true,
        message: 'QR code access history retrieved',
        data: {
          prescriptionId,
          totalQRCodesGenerated: accessHistory.length,
          qrAccesses: accessHistory.map(access => ({
            qrToken: access.qr_token,
            status: access.accessed ? 'USED' : access.is_active ? 'VALID' : 'INVALID',
            accessed: access.accessed,
            accessedAt: access.accessed_at,
            accessedFromIP: access.accessed_by_ip,
            device: access.access_device_info,
            expiresAt: access.expires_at,
            createdAt: access.created_at
          }))
        }
      });
    } catch (error) {
      console.error('❌ Error fetching QR access history:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching QR access history',
        error: error.message
      });
    }
  }

  /**
   * Patient: Get prescription share history
   */
  static async getShareHistory(req, res) {
    try {
      const patientId = req.user.id;
      const { prescriptionId } = req.params;

      const prescription = await Prescription.getById(prescriptionId);
      if (!prescription || prescription.patient_id !== patientId) {
        return res.status(404).json({
          success: false,
          message: 'Prescription not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Share history retrieved',
        data: {
          prescriptionId,
          shareHistory: prescription.share_audit || []
        }
      });
    } catch (error) {
      console.error('❌ Error retrieving share history:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving share history',
        error: error.message
      });
    }
  }

  /**
   * Doctor: Revoke prescription
   */
  static async revokePrescription(req, res) {
    try {
      const doctorId = req.user.id;
      const { prescriptionId } = req.params;
      const { revokeReason } = req.body;

      if (!revokeReason) {
        return res.status(400).json({
          success: false,
          message: 'revokeReason is required'
        });
      }

      const prescription = await Prescription.getById(prescriptionId);
      if (!prescription || prescription.doctor_id !== doctorId) {
        return res.status(404).json({
          success: false,
          message: 'Prescription not found or not yours'
        });
      }

      // Revoke prescription
      await Prescription.revoke(prescriptionId, revokeReason);

      // Send notification to patient
      await EmailService.sendEmail({
        to: prescription.patient_email,
        subject: 'Prescription Revoked',
        template: 'prescription-revoked',
        data: {
          patientName: prescription.patient_name,
          prescriptionNumber: prescription.prescription_number,
          reason: revokeReason,
          doctorName: prescription.prescriber_name
        }
      });

      res.status(200).json({
        success: true,
        message: 'Prescription revoked successfully',
        data: {
          prescriptionId,
          status: 'REVOKED',
          reason: revokeReason
        }
      });
    } catch (error) {
      console.error('❌ Error revoking prescription:', error);
      res.status(500).json({
        success: false,
        message: 'Error revoking prescription',
        error: error.message
      });
    }
  }

  /**
   * Doctor: Get all prescriptions issued by doctor
   */
  static async getDoctorPrescriptions(req, res) {
    try {
      const doctorId = req.user.id;
      const { limit = 50, offset = 0, filter = 'all' } = req.query;

      const prescriptions = await Prescription.getByDoctorId(doctorId, parseInt(limit), parseInt(offset));

      let filtered = prescriptions;
      if (filter === 'signed') {
        filtered = prescriptions.filter(p => p.signature_status === 'signed');
      } else if (filter === 'pending') {
        filtered = prescriptions.filter(p => p.signature_status === 'pending');
      }

      res.status(200).json({
        success: true,
        message: 'Doctor prescriptions retrieved',
        data: {
          total: filtered.length,
          prescriptions: filtered.map(p => ({
            id: p.id,
            prescriptionNumber: p.prescription_number,
            patient: p.patient_name,
            diagnosis: p.diagnosis,
            status: p.signature_status,
            createdAt: p.created_at
          }))
        }
      });
    } catch (error) {
      console.error('❌ Error fetching doctor prescriptions:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching prescriptions',
        error: error.message
      });
    }
  }

  /**
   * Patient: Claim prescription at pharmacy (one-time use)
   * After claiming, prescription cannot be claimed again
   */
  static async claimPrescription(req, res) {
    try {
      const patientId = req.user.id;
      const { prescriptionId } = req.params;
      const { pharmacyId, pharmacyName, location } = req.body;

      if (!prescriptionId || !pharmacyId || !pharmacyName) {
        return res.status(400).json({
          success: false,
          message: 'prescriptionId, pharmacyId, and pharmacyName are required'
        });
      }

      // Verify prescription belongs to patient
      const prescription = await Prescription.getById(prescriptionId);
      if (!prescription || prescription.patient_id !== patientId) {
        return res.status(404).json({
          success: false,
          message: 'Prescription not found or not yours'
        });
      }

      // Check claim status
      const claimStatus = await Prescription.checkClaimStatus(prescriptionId);
      if (claimStatus.claimed) {
        return res.status(409).json({
          success: false,
          message: 'Prescription already claimed at ' + claimStatus.claimedBy,
          claimedAt: claimStatus.claimedAt
        });
      }

      if (claimStatus.isExpired) {
        return res.status(410).json({
          success: false,
          message: 'Prescription claim window has expired (30 days)'
        });
      }

      // Get IP address and device info
      const ipAddress = req.ip || req.connection.remoteAddress;
      const deviceInfo = req.get('User-Agent') || 'Unknown Device';

      // Claim the prescription
      const claimResult = await Prescription.claimPrescription(
        prescriptionId,
        patientId,
        {
          id: pharmacyId,
          name: pharmacyName,
          location: location || {}
        },
        ipAddress,
        deviceInfo
      );

      if (!claimResult.success) {
        return res.status(400).json({
          success: false,
          message: claimResult.message
        });
      }

      res.status(200).json({
        success: true,
        message: 'Prescription claimed successfully at pharmacy',
        data: {
          prescriptionId: prescription.id,
          prescriptionNumber: prescription.prescription_number,
          claimedAt: claimResult.claimTime,
          pharmacy: pharmacyName,
          note: 'This prescription cannot be used again'
        }
      });
    } catch (error) {
      console.error('❌ Error claiming prescription:', error);
      res.status(500).json({
        success: false,
        message: 'Error claiming prescription',
        error: error.message
      });
    }
  }

  /**
   * Patient: Check prescription claim status
   */
  static async checkClaimStatus(req, res) {
    try {
      const patientId = req.user.id;
      const { prescriptionId } = req.params;

      // Verify prescription belongs to patient
      const prescription = await Prescription.getById(prescriptionId);
      if (!prescription || prescription.patient_id !== patientId) {
        return res.status(404).json({
          success: false,
          message: 'Prescription not found or not yours'
        });
      }

      const claimStatus = await Prescription.checkClaimStatus(prescriptionId);

      res.status(200).json({
        success: true,
        message: 'Prescription claim status retrieved',
        data: {
          prescriptionId,
          prescriptionNumber: prescription.prescription_number,
          status: claimStatus.status,
          claimed: claimStatus.claimed,
          claimedAt: claimStatus.claimedAt,
          claimedBy: claimStatus.claimedBy,
          expiresAt: claimStatus.expiresAt,
          isExpired: claimStatus.isExpired,
          daysRemaining: claimStatus.isExpired ? 0 : Math.ceil((new Date(claimStatus.expiresAt) - new Date()) / (1000 * 60 * 60 * 24))
        }
      });
    } catch (error) {
      console.error('❌ Error checking claim status:', error);
      res.status(500).json({
        success: false,
        message: 'Error checking claim status',
        error: error.message
      });
    }
  }

  /**
   * Patient: Get prescription claim information
   */
  static async getClaimInfo(req, res) {
    try {
      const patientId = req.user.id;
      const { prescriptionId } = req.params;

      // Verify prescription belongs to patient
      const prescription = await Prescription.getById(prescriptionId);
      if (!prescription || prescription.patient_id !== patientId) {
        return res.status(404).json({
          success: false,
          message: 'Prescription not found or not yours'
        });
      }

      const claimInfo = await Prescription.getClaimInfo(prescriptionId);

      res.status(200).json({
        success: true,
        message: 'Prescription claim information retrieved',
        data: {
          prescriptionId,
          prescriptionNumber: prescription.prescription_number,
          ...claimInfo
        }
      });
    } catch (error) {
      console.error('❌ Error fetching claim info:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching claim information',
        error: error.message
      });
    }
  }

  /**
   * Admin: Revert prescription claim
   */
  static async revertClaim(req, res) {
    try {
      const adminId = req.user.id;
      const { prescriptionId } = req.params;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({
          success: false,
          message: 'reason is required for reverting claim'
        });
      }

      const revertResult = await Prescription.revertClaim(prescriptionId, adminId, reason);

      if (!revertResult.success) {
        return res.status(400).json({
          success: false,
          message: revertResult.message
        });
      }

      res.status(200).json({
        success: true,
        message: 'Prescription claim reverted successfully',
        data: {
          prescriptionId: revertResult.prescription.id,
          prescriptionNumber: revertResult.prescription.prescription_number
        }
      });
    } catch (error) {
      console.error('❌ Error reverting claim:', error);
      res.status(500).json({
        success: false,
        message: 'Error reverting claim',
        error: error.message
      });
    }
  }
}

module.exports = PrescriptionController;
