const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const OTP = require('../models/OTP');
const emailService = require('../services/emailService');

class AdminController {
  /**
   * Admin Login - initiates OTP flow
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

      const admin = await Admin.findByEmail(email);
      if (!admin) {
        return res.status(403).json({
          success: false,
          message: 'No admin account found with this email. Please use the correct login page.'
        });
      }

      if (admin.status !== 'active') {
        return res.status(403).json({
          success: false,
          message: 'Account is inactive. Please contact support.'
        });
      }

      const isPasswordValid = await bcrypt.compare(password, admin.password_hash);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Generate and send OTP
      const otpRecord = await OTP.create(admin.id, 'login', 'admin');

      const isDevelopment = process.env.NODE_ENV === 'development';
      let emailSent = false;

      try {
        await emailService.sendOTP(admin.email, otpRecord.otp_code, admin.first_name);
        emailSent = true;
        console.log('✅ OTP email sent to admin successfully');
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
          email: admin.email,
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
      console.error('Admin login error:', error);
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

      const admin = await Admin.findByEmail(email);
      if (!admin) {
        return res.status(403).json({
          success: false,
          message: 'No admin account found with this email. Please use the correct login page.'
        });
      }

      const otpResult = await OTP.verify(admin.id, otp_code, 'login', 'admin');
      if (!otpResult.valid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired OTP code'
        });
      }

      delete admin.password_hash;

      const token = jwt.sign(
        {
          id: admin.id,
          email: admin.email,
          role: 'admin',
          type: 'admin'
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: { admin, token }
      });

    } catch (error) {
      console.error('Admin verify OTP error:', error);
      res.status(500).json({
        success: false,
        message: 'Error verifying OTP',
        error: error.message
      });
    }
  }

  /**
   * Get Admin Profile
   */
  static async getProfile(req, res) {
    try {
      const adminId = req.user.id;

      const admin = await Admin.findById(adminId);
      if (!admin) {
        return res.status(404).json({
          success: false,
          message: 'Admin not found'
        });
      }

      delete admin.password_hash;

      res.status(200).json({
        success: true,
        data: admin
      });

    } catch (error) {
      console.error('Get admin profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching profile',
        error: error.message
      });
    }
  }

  /**
   * Update Admin Profile
   */
  static async updateProfile(req, res) {
    try {
      const adminId = req.user.id;
      const updateData = req.body;

      delete updateData.id;
      delete updateData.password_hash;
      delete updateData.email;
      delete updateData.created_at;

      const updatedAdmin = await Admin.update(adminId, updateData);
      if (!updatedAdmin) {
        return res.status(404).json({
          success: false,
          message: 'Admin not found'
        });
      }

      delete updatedAdmin.password_hash;

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: updatedAdmin
      });

    } catch (error) {
      console.error('Update admin profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating profile',
        error: error.message
      });
    }
  }
}

module.exports = AdminController;
