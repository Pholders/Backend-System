const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Pharmacy = require('../models/Pharmacy');
const OTP = require('../models/OTP');
const Session = require('../models/Session');
const AuditLog = require('../models/AuditLog');
const RefreshToken = require('../models/RefreshToken');
const PasswordValidator = require('../utils/passwordValidator');
const emailService = require('../services/emailService');

/**
 * Pharmacy Controller
 * Handles pharmacy authentication and profile management
 */

class PharmacyController {
  /**
   * Pharmacy Signup/Registration
   */
  static async signup(req, res) {
    try {
      const {
        pharmacy_name,
        first_name,
        last_name,
        email,
        phone,
        password,
        license_number,
        city,
        province
      } = req.body;

      // Validate required fields
      if (!pharmacy_name || !first_name || !last_name || !email || !phone || !password || !license_number || !city || !province) {
        await AuditLog.logSecurityEvent(req, null, 'pharmacy', email, 'signup', 'failed', 'Missing required fields');
        return res.status(400).json({
          success: false,
          message: 'All fields are required: pharmacy_name, first_name, last_name, email, phone, password, license_number, city, province'
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        await AuditLog.logSecurityEvent(req, null, 'pharmacy', email, 'signup', 'failed', 'Invalid email format');
        return res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
      }

      // Validate password strength
      const passwordValidation = PasswordValidator.validate(password);
      if (!passwordValidation.valid) {
        await AuditLog.logSecurityEvent(req, null, 'pharmacy', email, 'signup', 'failed', `Weak password: ${passwordValidation.errors.join(', ')}`);
        return res.status(400).json({
          success: false,
          message: 'Password does not meet security requirements',
          errors: passwordValidation.errors,
          strength: PasswordValidator.getStrengthDescription(PasswordValidator.getStrength(password))
        });
      }

      // Check if email already exists
      const existingPharmacy = await Pharmacy.findByEmail(email);
      if (existingPharmacy) {
        await AuditLog.logSecurityEvent(req, null, 'pharmacy', email, 'signup', 'failed', 'Email already registered');
        return res.status(409).json({
          success: false,
          message: 'Email already registered'
        });
      }

      // Check if license number already exists
      const existingLicense = await Pharmacy.findByLicense(license_number);
      if (existingLicense) {
        await AuditLog.logSecurityEvent(req, null, 'pharmacy', email, 'signup', 'failed', 'License number already registered');
        return res.status(409).json({
          success: false,
          message: 'License number already registered'
        });
      }

      // Hash password for temporary storage
      const saltRounds = 10;
      const password_hash = await bcrypt.hash(password, saltRounds);

      // Create temporary pharmacy record with 'pending' status for OTP verification
      const tempPharmacy = await Pharmacy.createTemp({
        pharmacy_name,
        first_name,
        last_name,
        email,
        phone,
        license_number,
        city,
        province,
        password_hash,
        status: 'pending_verification'
      });

      // Generate and send OTP
      const otpRecord = await OTP.create(tempPharmacy.id, 'signup', 'pharmacy');
      const otpCode = otpRecord.otp_code;

      // Send OTP email
      await emailService.sendOTP(email, otpCode, first_name);

      // Log signup initiation
      await AuditLog.logSecurityEvent(req, null, 'pharmacy', email, 'signup', 'success', 'OTP sent for verification');

      res.status(200).json({
        success: true,
        message: 'Pharmacy registration initiated. Please verify your email with the OTP code sent to your email address.',
        data: {
          email: email,
          pharmacy_name: pharmacy_name,
          message: 'Check your email for the OTP code (valid for 10 minutes)',
          nextStep: 'Call /api/users/pharmacy/verify-otp with email and otp_code'
        }
      });

    } catch (error) {
      console.error('Pharmacy signup error:', error);
      res.status(500).json({
        success: false,
        message: 'Error registering pharmacy',
        error: error.message
      });
    }
  }

  /**
   * Pharmacy Login - initiates OTP flow
   */
  static async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        await AuditLog.logSecurityEvent(req, null, 'pharmacy', email, 'login', 'failed', 'Missing email or password');
        return res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
      }

      // Check for suspicious activity
      const failedAttempts = await AuditLog.getFailedLoginAttempts(email, 1);
      if (failedAttempts >= 5) {
        await AuditLog.logSecurityEvent(req, null, 'pharmacy', email, 'login_failed', 'failed', `Too many failed attempts: ${failedAttempts}`);
        return res.status(429).json({
          success: false,
          message: 'Too many failed login attempts. Please try again later or contact support.'
        });
      }

      const pharmacy = await Pharmacy.findByEmail(email);
      if (!pharmacy) {
        await AuditLog.logSecurityEvent(req, null, 'pharmacy', email, 'login', 'failed', 'Pharmacy not found');
        return res.status(403).json({
          success: false,
          message: 'No pharmacy account found with this email. Please use the correct login page.'
        });
      }

      if (pharmacy.status !== 'active') {
        await AuditLog.logSecurityEvent(req, pharmacy.id, 'pharmacy', email, 'login', 'failed', 'Account inactive');
        return res.status(403).json({
          success: false,
          message: 'Account is inactive. Please contact support.'
        });
      }

      const isPasswordValid = await bcrypt.compare(password, pharmacy.password_hash);
      if (!isPasswordValid) {
        await AuditLog.logSecurityEvent(req, pharmacy.id, 'pharmacy', email, 'login_failed', 'failed', 'Invalid password');
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // ✅ Direct login: Generate tokens immediately (no OTP)
      // OTP is used ONLY for email verification during signup
      delete pharmacy.password_hash;

      const accessToken = jwt.sign(
        {
          id: pharmacy.id,
          email: pharmacy.email,
          role: 'pharmacy',
          pharmacy_name: pharmacy.pharmacy_name,
          first_name: pharmacy.first_name,
          last_name: pharmacy.last_name
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Create session with accessToken hash
      const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');
      const userAgent = req.headers['user-agent'];
      const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
      const deviceInfo = {
        userAgent: userAgent,
        ipAddress: ipAddress,
        timestamp: new Date().toISOString()
      };

      const session = await Session.create(
        pharmacy.id,
        'pharmacy',
        tokenHash,
        ipAddress,
        userAgent,
        deviceInfo
      );

      const refreshTokenData = await RefreshToken.create(pharmacy.id, 'pharmacy', userAgent);

      // Log successful login
      await AuditLog.logSecurityEvent(req, pharmacy.id, 'pharmacy', email, 'login', 'success', null);

      console.log(`✅ Pharmacy ${pharmacy.id} logged in directly (password auth, no OTP)`);

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          pharmacy,
          tokens: {
            accessToken,
            refreshToken: refreshTokenData.token,
            expiresIn: 28800 // 8 hours
          },
          session: {
            id: session.id,
            expiresAt: session.expires_at
          }
        }
      });

    } catch (error) {
      console.error('Pharmacy login error:', error);
      res.status(500).json({
        success: false,
        message: 'Error logging in',
        error: error.message
      });
    }
  }

  /**
   * Verify OTP and complete login
   */
  static async verifyOTP(req, res) {
    try {
      const { email, otp_code } = req.body;

      const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      if (!email || !otp_code) {
        await AuditLog.logSecurityEvent(req, null, 'pharmacy', email, 'otp_verified', 'failed', 'Missing email or OTP');
        return res.status(400).json({
          success: false,
          message: 'Email and OTP code are required'
        });
      }

      const pharmacy = await Pharmacy.findByEmail(email);
      if (!pharmacy) {
        await AuditLog.logSecurityEvent(req, null, 'pharmacy', email, 'otp_verified', 'failed', 'Pharmacy not found');
        return res.status(403).json({
          success: false,
          message: 'No pharmacy account found with this email. Please use the correct page.'
        });
      }

      const otpResult = await OTP.verify(pharmacy.id, otp_code, 'signup', 'pharmacy');
      
      // If signup OTP verification
      if (otpResult.valid && pharmacy.status === 'pending_verification') {
        // Activate the pharmacy account
        await Pharmacy.update(pharmacy.id, { status: 'active' });

        await AuditLog.logSecurityEvent(req, pharmacy.id, 'pharmacy', email, 'email_verification', 'success');

        delete pharmacy.password_hash;

        return res.status(200).json({
          success: true,
          message: 'Email verified successfully! Your pharmacy account is now active. You can now log in.',
          data: {
            pharmacy: pharmacy,
            nextStep: 'Use /api/users/pharmacy/login with your email and password'
          }
        });
      }

      // If login OTP verification
      const otpResultLogin = await OTP.verify(pharmacy.id, otp_code, 'login', 'pharmacy');
      if (!otpResultLogin.valid) {
        await AuditLog.logSecurityEvent(req, pharmacy.id, 'pharmacy', email, 'otp_failed', 'failed', 'Invalid or expired OTP');
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired OTP code'
        });
      }

      delete pharmacy.password_hash;

      const token = jwt.sign(
        {
          id: pharmacy.id,
          email: pharmacy.email,
          role: 'pharmacy',
          type: 'pharmacy',
          pharmacy_name: pharmacy.pharmacy_name,
          first_name: pharmacy.first_name,
          last_name: pharmacy.last_name
        },
        process.env.JWT_SECRET,
        { expiresIn: '8h' }
      );

      // Create session
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const deviceInfo = {
        userAgent: userAgent,
        ipAddress: ipAddress,
        timestamp: new Date().toISOString()
      };
      
      const session = await Session.create(
        pharmacy.id,
        'pharmacy',
        tokenHash,
        ipAddress,
        userAgent,
        deviceInfo
      );

      // Log successful login
      await AuditLog.logSecurityEvent(req, pharmacy.id, 'pharmacy', email, 'login', 'success');

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          token,
          pharmacyId: pharmacy.id,
          pharmacy_name: pharmacy.pharmacy_name,
          email: pharmacy.email,
          sessionInfo: {
            expiresIn: '8 hours',
            createdAt: new Date().toISOString()
          }
        }
      });

    } catch (error) {
      console.error('Pharmacy verify OTP error:', error);
      res.status(500).json({
        success: false,
        message: 'Error verifying OTP',
        error: error.message
      });
    }
  }

  /**
   * Pharmacy Logout
   */
  static async logout(req, res) {
    try {
      const pharmacyId = req.user.id;
      const sessionId = req.authSession?.id;

      if (sessionId) {
        await Session.revoke(sessionId, 'User logout');
        await AuditLog.logSecurityEvent(req, pharmacyId, 'pharmacy', req.user.email, 'logout', 'success');
      }

      res.status(200).json({
        success: true,
        message: 'Logged out successfully'
      });

    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Error logging out',
        error: error.message
      });
    }
  }

  /**
   * Get Active Sessions
   */
  static async getSessions(req, res) {
    try {
      const pharmacyId = req.user.id;

      const sessions = await Session.getUserActiveSessions(pharmacyId);

      res.status(200).json({
        success: true,
        data: {
          sessions,
          count: sessions.length
        }
      });

    } catch (error) {
      console.error('Get sessions error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching sessions',
        error: error.message
      });
    }
  }

  /**
   * Get Activity Log
   */
  static async getActivityLog(req, res) {
    try {
      const pharmacyId = req.user.id;
      const limit = parseInt(req.query.limit) || 50;

      const activityLog = await AuditLog.getUserActivity(pharmacyId, limit);

      res.status(200).json({
        success: true,
        data: {
          activities: activityLog,
          count: activityLog.length
        }
      });

    } catch (error) {
      console.error('Get activity log error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching activity log',
        error: error.message
      });
    }
  }

  /**
   * Get Pharmacy Profile
   */
  static async getProfile(req, res) {
    try {
      const pharmacyId = req.user.id;

      const pharmacy = await Pharmacy.findById(pharmacyId);
      if (!pharmacy) {
        return res.status(404).json({
          success: false,
          message: 'Pharmacy not found'
        });
      }

      delete pharmacy.password_hash;

      res.status(200).json({
        success: true,
        data: pharmacy
      });

    } catch (error) {
      console.error('Get pharmacy profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching profile',
        error: error.message
      });
    }
  }

  /**
   * Update Pharmacy Profile
   */
  static async updateProfile(req, res) {
    try {
      const pharmacyId = req.user.id;
      const updateData = req.body;

      delete updateData.id;
      delete updateData.password_hash;
      delete updateData.email;
      delete updateData.license_number;
      delete updateData.created_at;

      const updatedPharmacy = await Pharmacy.update(pharmacyId, updateData);
      if (!updatedPharmacy) {
        return res.status(404).json({
          success: false,
          message: 'Pharmacy not found'
        });
      }

      delete updatedPharmacy.password_hash;

      await AuditLog.logSecurityEvent(req, pharmacyId, 'pharmacy', updatedPharmacy.email, 'profile_updated', 'success');

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: updatedPharmacy
      });

    } catch (error) {
      console.error('Update pharmacy profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating profile',
        error: error.message
      });
    }
  }

  /**
   * Get all claimed prescriptions for this pharmacy (available to dispense)
   */
  static async getClaimedPrescriptions(req, res) {
    try {
      const pharmacyId = req.user.id;
      const { limit = 50, offset = 0 } = req.query;

      const Prescription = require('../models/Prescription');

      // Get claimed prescriptions
      const prescriptions = await Prescription.getClaimedPrescriptionsByPharmacy(
        pharmacyId,
        req.user.pharmacy_name,
        parseInt(limit),
        parseInt(offset)
      );

      // Get total count
      const totalCount = await Prescription.getClaimedPrescriptionsCount(pharmacyId);

      res.status(200).json({
        success: true,
        message: 'Claimed prescriptions retrieved',
        data: {
          total: totalCount,
          limit: parseInt(limit),
          offset: parseInt(offset),
          prescriptions: prescriptions.map(p => ({
            prescriptionId: p.prescription_id,
            prescriptionNumber: p.prescription_number,
            patientName: `${p.patient_first_name} ${p.patient_last_name}`,
            patientEmail: p.patient_email,
            patientPhone: p.patient_phone,
            diagnosis: p.diagnosis,
            claimedAt: p.claimed_at,
            medicines: p.medicines,
            medicineCount: (p.medicines || []).length
          }))
        }
      });
    } catch (error) {
      console.error('❌ Error getting claimed prescriptions:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving claimed prescriptions',
        error: error.message
      });
    }
  }

  /**
   * Dispense a prescription (mark as dispensed at pharmacy)
   */
  static async dispensePrescription(req, res) {
    try {
      const pharmacyId = req.user.id;
      const pharmacyName = req.user.pharmacy_name;
      const staffName = `${req.user.first_name} ${req.user.last_name}`;
      const { prescriptionId } = req.params;
      const { notes } = req.body;

      if (!prescriptionId) {
        return res.status(400).json({
          success: false,
          message: 'Prescription ID is required'
        });
      }

      const Prescription = require('../models/Prescription');

      // Verify prescription exists and is claimed
      const prescription = await Prescription.getById(prescriptionId);
      if (!prescription) {
        return res.status(404).json({
          success: false,
          message: 'Prescription not found'
        });
      }

      if (!prescription.claimed || prescription.claimed_by_pharmacy_id !== String(pharmacyId)) {
        return res.status(400).json({
          success: false,
          message: 'Prescription is not claimed at your pharmacy'
        });
      }

      if (prescription.is_dispensed) {
        return res.status(400).json({
          success: false,
          message: 'Prescription has already been dispensed'
        });
      }

      // Dispense the prescription
      const result = await Prescription.dispensePrescription(
        prescriptionId,
        pharmacyId,
        pharmacyName,
        staffName,
        notes || 'Dispensed at pharmacy'
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.message
        });
      }

      res.status(200).json({
        success: true,
        message: 'Prescription dispensed successfully',
        data: {
          prescriptionId: result.data.id,
          prescriptionNumber: result.data.prescription_number,
          patientId: result.data.patient_id,
          dispensedAt: result.data.dispensed_at,
          dispensedBy: staffName,
          pharmacy: pharmacyName
        }
      });
    } catch (error) {
      console.error('❌ Error dispensing prescription:', error);
      res.status(500).json({
        success: false,
        message: 'Error dispensing prescription',
        error: error.message
      });
    }
  }

  /**
   * Get dispensing history for this pharmacy
   */
  static async getDispenseHistory(req, res) {
    try {
      const pharmacyId = req.user.id;
      const { limit = 50, offset = 0 } = req.query;

      const Prescription = require('../models/Prescription');

      const history = await Prescription.getPharmacyDispenseHistory(
        pharmacyId,
        parseInt(limit),
        parseInt(offset)
      );

      res.status(200).json({
        success: true,
        message: 'Dispensing history retrieved',
        data: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          dispensedCount: history.length,
          history: history.map(h => ({
            prescriptionId: h.prescription_id,
            prescriptionNumber: h.prescription_number,
            patientName: `${h.patient_first_name} ${h.patient_last_name}`,
            patientEmail: h.patient_email,
            diagnosis: h.diagnosis,
            dispensedAt: h.dispensed_at,
            notes: h.dispensing_notes,
            medicines: h.medicines,
            medicineCount: h.medicine_count
          }))
        }
      });
    } catch (error) {
      console.error('❌ Error getting dispense history:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving dispensing history',
        error: error.message
      });
    }
  }

  /**
   * View detailed medicines for a claimed prescription
   */
  static async viewClaimedPrescriptionMedicines(req, res) {
    try {
      const pharmacyId = req.user.id;
      const { prescriptionId } = req.params;

      if (!prescriptionId) {
        return res.status(400).json({
          success: false,
          message: 'Prescription ID is required'
        });
      }

      const Prescription = require('../models/Prescription');

      // Get prescription
      const prescription = await Prescription.getById(prescriptionId);
      if (!prescription) {
        return res.status(404).json({
          success: false,
          message: 'Prescription not found'
        });
      }

      // Verify prescription is claimed at this pharmacy
      if (!prescription.claimed || (prescription.claimed_by_pharmacy_id && String(prescription.claimed_by_pharmacy_id) !== String(pharmacyId))) {
        return res.status(403).json({
          success: false,
          message: 'Prescription is not claimed at your pharmacy'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Prescription medicines retrieved successfully',
        data: {
          prescriptionId: prescription.id,
          prescriptionNumber: prescription.prescription_number,
          patientName: prescription.patient_name,
          patientEmail: prescription.patient_email,
          patientPhone: prescription.patient_phone,
          diagnosis: prescription.diagnosis,
          clinicalNotes: prescription.clinical_notes,
          claimedAt: prescription.claimed_at_pharmacy,
          medicines: (prescription.items && Array.isArray(prescription.items)) 
            ? prescription.items.map(item => ({
                id: item.id,
                name: item.medicine_name,
                genericName: item.generic_name,
                dosage: item.dosage,
                form: item.dosage_form,
                quantity: item.quantity,
                quantityUnit: item.quantity_unit,
                frequency: item.frequency,
                route: item.route_of_administration,
                duration: item.duration,
                instructions: item.special_instructions,
                schedule: item.schedule_classification,
                interactions: item.possible_interactions,
                contraindications: item.contraindications,
                warnings: item.warnings
              }))
            : [],
          totalMedicines: (prescription.items || []).length
        }
      });
    } catch (error) {
      console.error('❌ Error viewing claimed prescription medicines:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving prescription medicines',
        error: error.message
      });
    }
  }

  /**
   * Get dispensing statistics for this pharmacy
   */
  static async getDispenseStats(req, res) {
    try {
      const pharmacyId = req.user.id;

      const Prescription = require('../models/Prescription');

      const stats = await Prescription.getPharmacyDispenseStats(pharmacyId);

      res.status(200).json({
        success: true,
        message: 'Dispensing statistics retrieved',
        data: {
          pendingDispense: parseInt(stats.pending_dispense),
          dispensedCount: parseInt(stats.dispensed_count),
          uniquePatients: parseInt(stats.unique_patients),
          dispensedThisWeek: parseInt(stats.dispensed_this_week),
          dispensedThisMonth: parseInt(stats.dispensed_this_month)
        }
      });
    } catch (error) {
      console.error('❌ Error getting dispense stats:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving dispensing statistics',
        error: error.message
      });
    }
  }

  /**
   * Verify OTP for Email Verification (Account Activation)
   * Pharmacy-specific OTP verification endpoint
   */
  static async verifyEmail(req, res) {
    try {
      const { email, otp_code } = req.body;

      if (!email || !otp_code) {
        await AuditLog.logSecurityEvent(req, null, 'pharmacy', email, 'email_verification', 'failed', 'Missing email or code');
        return res.status(400).json({
          success: false,
          message: 'Email and verification code are required'
        });
      }

      const pharmacy = await Pharmacy.findByEmail(email);
      if (!pharmacy) {
        await AuditLog.logSecurityEvent(req, null, 'pharmacy', email, 'email_verification', 'failed', 'Pharmacy not found');
        // Generic response to prevent account enumeration
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired verification code'
        });
      }

      // Idempotent: already verified
      if (pharmacy.email_verified === true) {
        return res.status(200).json({
          success: true,
          message: 'Email is already verified. You can log in.',
          data: { email: pharmacy.email, alreadyVerified: true }
        });
      }

      const otpResult = await OTP.verify(pharmacy.id, otp_code, 'email_verification', 'pharmacy');
      if (!otpResult || !otpResult.valid) {
        await AuditLog.logSecurityEvent(req, pharmacy.id, 'pharmacy', email, 'email_verification', 'failed', 'Invalid or expired code');
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired verification code'
        });
      }

      await Pharmacy.markEmailVerified(pharmacy.id);
      await AuditLog.logSecurityEvent(req, pharmacy.id, 'pharmacy', email, 'email_verification', 'success');

      return res.status(200).json({
        success: true,
        message: 'Email verified successfully. You can now log in.',
        data: {
          email: pharmacy.email,
          email_verified: true
        }
      });
    } catch (error) {
      console.error('Pharmacy verify email error:', error);
      res.status(500).json({
        success: false,
        message: 'Error verifying email',
        error: error.message
      });
    }
  }

  /**
   * Resend Email Verification Code (OTP)
   * Pharmacy-specific resend verification endpoint
   */
  static async resendVerificationEmail(req, res) {
    try {
      const { email } = req.body;
      const isDevelopment = process.env.NODE_ENV === 'development';

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email is required'
        });
      }

      const genericResponse = {
        success: true,
        message: 'If an unverified account exists for this email, a new verification code has been sent.'
      };

      const pharmacy = await Pharmacy.findByEmail(email);

      // Don't reveal whether the account exists or its verification state
      if (!pharmacy || pharmacy.email_verified === true) {
        return res.status(200).json(genericResponse);
      }

      // Rate-limit: reject if a code was issued in the last 60 seconds
      const latest = await OTP.getLatest(pharmacy.id, 'email_verification', 'pharmacy');
      if (latest) {
        const ageSeconds = (Date.now() - new Date(latest.created_at).getTime()) / 1000;
        if (ageSeconds < 60) {
          await AuditLog.logSecurityEvent(req, pharmacy.id, 'pharmacy', email, 'email_verification_resend', 'failed', 'Rate limited');
          return res.status(429).json({
            success: false,
            message: `Please wait ${Math.ceil(60 - ageSeconds)} seconds before requesting another code.`
          });
        }
      }

      const otpRecord = await OTP.create(pharmacy.id, 'email_verification', 'pharmacy', 15);
      await AuditLog.logSecurityEvent(req, pharmacy.id, 'pharmacy', email, 'email_verification_resend', 'success');

      try {
        await emailService.sendVerificationOTP(pharmacy.email, otpRecord.otp_code, pharmacy.first_name);
      } catch (emailError) {
        console.error('❌ Failed to resend verification email:', emailError.message);
        if (!isDevelopment) {
          return res.status(500).json({
            success: false,
            message: 'Failed to send verification email. Please try again.'
          });
        }
        console.log(`\n🔐 Development Email Verification Code: ${otpRecord.otp_code}\n`);
      }

      const response = { ...genericResponse };
      if (isDevelopment) {
        response.data = {
          verification_code: otpRecord.otp_code,
          dev_note: 'Verification code included in response (development mode only)'
        };
      }
      return res.status(200).json(response);
    } catch (error) {
      console.error('Pharmacy resend verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Error resending verification code',
        error: error.message
      });
    }
  }
}

module.exports = PharmacyController;
