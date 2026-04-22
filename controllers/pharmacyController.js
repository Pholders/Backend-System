const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Pharmacy = require('../models/Pharmacy');
const OTP = require('../models/OTP');
const emailService = require('../services/emailService');

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
        return res.status(400).json({
          success: false,
          message: 'All fields are required: pharmacy_name, first_name, last_name, email, phone, password, license_number, city, province'
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
      }

      // Validate password strength
      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters long'
        });
      }

      // Check if email already exists
      const existingPharmacy = await Pharmacy.findByEmail(email);
      if (existingPharmacy) {
        return res.status(409).json({
          success: false,
          message: 'Email already registered'
        });
      }

      // Check if license number already exists
      const existingLicense = await Pharmacy.findByLicense(license_number);
      if (existingLicense) {
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

      delete newPharmacy.password_hash;

      res.status(201).json({
        success: true,
        message: 'Pharmacy registered successfully',
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
        return res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
      }

      const pharmacy = await Pharmacy.findByEmail(email);
      if (!pharmacy) {
        return res.status(403).json({
          success: false,
          message: 'No pharmacy account found with this email. Please use the correct login page.'
        });
      }

      if (pharmacy.status !== 'active') {
        return res.status(403).json({
          success: false,
          message: 'Account is inactive. Please contact support.'
        });
      }

      const isPasswordValid = await bcrypt.compare(password, pharmacy.password_hash);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Generate and send OTP
      const otpRecord = await OTP.create(pharmacy.id, 'login', 'pharmacy');

      const isDevelopment = process.env.NODE_ENV === 'development';
      let emailSent = false;

      try {
        await emailService.sendOTP(pharmacy.email, otpRecord.otp_code, pharmacy.name);
        emailSent = true;
        console.log('✅ OTP email sent to pharmacy successfully');
      } catch (emailError) {
        console.error('❌ Failed to send OTP email:', emailError.message);

        if (!isDevelopment) {
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

      if (!email || !otp_code) {
        return res.status(400).json({
          success: false,
          message: 'Email and OTP code are required'
        });
      }

      const pharmacy = await Pharmacy.findByEmail(email);
      if (!pharmacy) {
        return res.status(403).json({
          success: false,
          message: 'No pharmacy account found with this email. Please use the correct login page.'
        });
      }

      const otpResult = await OTP.verify(pharmacy.id, otp_code, 'login', 'pharmacy');
      if (!otpResult.valid) {
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

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: { pharmacy, token }
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

      // Remove fields that shouldn't be updated directly
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
