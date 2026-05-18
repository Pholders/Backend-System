const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Pharmacy = require('../models/Pharmacy');
const OTP = require('../models/OTP');
const Session = require('../models/Session');
const AuditLog = require('../models/AuditLog');
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

      // Hash password
      const saltRounds = 10;
      const password_hash = await bcrypt.hash(password, saltRounds);

      // Create new pharmacy
      const newPharmacy = await Pharmacy.create({
        pharmacy_name,
        first_name,
        last_name,
        email,
        phone,
        license_number,
        city,
        province,
        password_hash
      });

      // Log successful signup
      await AuditLog.logSecurityEvent(req, newPharmacy.id, 'pharmacy', email, 'signup', 'success');

      delete newPharmacy.password_hash;

      res.status(201).json({
        success: true,
        message: 'Pharmacy registered successfully. Please log in.',
        data: { pharmacy: newPharmacy }
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

      // Generate and send OTP
      const otpRecord = await OTP.create(pharmacy.id, 'login', 'pharmacy');

      // Log OTP generation
      await AuditLog.logSecurityEvent(req, pharmacy.id, 'pharmacy', email, 'otp_generated', 'success');

      const isDevelopment = process.env.NODE_ENV === 'development';
      let emailSent = false;

      try {
        await emailService.sendOTP(pharmacy.email, otpRecord.otp_code, pharmacy.first_name);
        emailSent = true;
        console.log('✅ OTP email sent to pharmacy successfully');
      } catch (emailError) {
        console.error('❌ Failed to send OTP email:', emailError.message);

        if (!isDevelopment) {
          await AuditLog.logSecurityEvent(req, pharmacy.id, 'pharmacy', email, 'otp_generated', 'failed', `Email error: ${emailError.message}`);
          return res.status(500).json({
            success: false,
            message: 'Failed to send OTP email. Please try again.'
          });
        }

        console.log('⚠️  Development mode: Skipping email requirement');
      }

      const response = {
        success: true,
        message: emailSent
          ? 'OTP sent to your email. Please verify to complete login.'
          : 'OTP generated. Check server logs for code (development mode).',
        data: {
          email: pharmacy.email,
          expiresIn: '10 minutes'
        }
      };

      if (isDevelopment && !emailSent) {
        response.data.otp_code = otpRecord.otp_code;
        response.data.dev_note = 'OTP included in response (development mode only)';
        console.log(`\n🔐 Development OTP Code: ${otpRecord.otp_code}\n`);
      }

      res.status(200).json(response);

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
          message: 'No pharmacy account found with this email. Please use the correct login page.'
        });
      }

      const otpResult = await OTP.verify(pharmacy.id, otp_code, 'login', 'pharmacy');
      if (!otpResult.valid) {
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
          type: 'pharmacy'
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
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
          pharmacy,
          token,
          session: {
            id: session.id,
            expiresAt: session.expires_at
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
}

module.exports = PharmacyController;
