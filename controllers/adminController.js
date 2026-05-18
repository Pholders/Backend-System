const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Admin = require('../models/Admin');
const OTP = require('../models/OTP');
const Session = require('../models/Session');
const AuditLog = require('../models/AuditLog');
const emailService = require('../services/emailService');

/**
 * Admin Controller
 * Handles admin authentication and profile management
 */

class AdminController {
  /**
   * Admin Login - initiates OTP flow
   */
  static async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        await AuditLog.logSecurityEvent(req, null, 'admin', email, 'login', 'failed', 'Missing email or password');
        return res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
      }

      // Check for suspicious activity
      const failedAttempts = await AuditLog.getFailedLoginAttempts(email, 1);
      if (failedAttempts >= 5) {
        await AuditLog.logSecurityEvent(req, null, 'admin', email, 'login_failed', 'failed', `Too many failed attempts: ${failedAttempts}`);
        return res.status(429).json({
          success: false,
          message: 'Too many failed login attempts. Please try again later or contact support.'
        });
      }

      const admin = await Admin.findByEmail(email);
      if (!admin) {
        await AuditLog.logSecurityEvent(req, null, 'admin', email, 'login', 'failed', 'Admin not found');
        return res.status(403).json({
          success: false,
          message: 'No admin account found with this email. Please use the correct login page.'
        });
      }

      if (admin.status !== 'active') {
        await AuditLog.logSecurityEvent(req, admin.id, 'admin', email, 'login', 'failed', 'Account inactive');
        return res.status(403).json({
          success: false,
          message: 'Account is inactive. Please contact support.'
        });
      }

      const isPasswordValid = await bcrypt.compare(password, admin.password_hash);
      if (!isPasswordValid) {
        await AuditLog.logSecurityEvent(req, admin.id, 'admin', email, 'login_failed', 'failed', 'Invalid password');
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Generate and send OTP
      const otpRecord = await OTP.create(admin.id, 'login', 'admin');

      // Log OTP generation
      await AuditLog.logSecurityEvent(req, admin.id, 'admin', email, 'otp_generated', 'success');

      const isDevelopment = process.env.NODE_ENV === 'development';
      let emailSent = false;

      try {
        await emailService.sendOTP(admin.email, otpRecord.otp_code, admin.first_name);
        emailSent = true;
        console.log('✅ OTP email sent to admin successfully');
      } catch (emailError) {
        console.error('❌ Failed to send OTP email:', emailError.message);

        if (!isDevelopment) {
          await AuditLog.logSecurityEvent(req, admin.id, 'admin', email, 'otp_generated', 'failed', `Email error: ${emailError.message}`);
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

      const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      if (!email || !otp_code) {
        await AuditLog.logSecurityEvent(req, null, 'admin', email, 'otp_verified', 'failed', 'Missing email or OTP');
        return res.status(400).json({
          success: false,
          message: 'Email and OTP code are required'
        });
      }

      const admin = await Admin.findByEmail(email);
      if (!admin) {
        await AuditLog.logSecurityEvent(req, null, 'admin', email, 'otp_verified', 'failed', 'Admin not found');
        return res.status(403).json({
          success: false,
          message: 'No admin account found with this email. Please use the correct login page.'
        });
      }

      const otpResult = await OTP.verify(admin.id, otp_code, 'login', 'admin');
      if (!otpResult.valid) {
        await AuditLog.logSecurityEvent(req, admin.id, 'admin', email, 'otp_failed', 'failed', 'Invalid or expired OTP');
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

      // Create session
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const deviceInfo = {
        userAgent: userAgent,
        ipAddress: ipAddress,
        timestamp: new Date().toISOString()
      };
      
      const session = await Session.create(
        admin.id,
        'admin',
        tokenHash,
        ipAddress,
        userAgent,
        deviceInfo
      );

      // Log successful login
      await AuditLog.logSecurityEvent(req, admin.id, 'admin', email, 'login', 'success');

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          admin,
          token,
          session: {
            id: session.id,
            expiresAt: session.expires_at
          }
        }
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
   * Admin Logout
   */
  static async logout(req, res) {
    try {
      const adminId = req.user.id;
      const sessionId = req.authSession?.id;

      if (sessionId) {
        await Session.revoke(sessionId, 'User logout');
        await AuditLog.logSecurityEvent(req, adminId, 'admin', req.user.email, 'logout', 'success');
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
      const adminId = req.user.id;

      const sessions = await Session.getUserActiveSessions(adminId);

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
      const adminId = req.user.id;
      const limit = parseInt(req.query.limit) || 50;

      const activityLog = await AuditLog.getUserActivity(adminId, limit);

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

      await AuditLog.logSecurityEvent(req, adminId, 'admin', updatedAdmin.email, 'profile_updated', 'success');

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

  /**
   * Get Security Dashboard
   */
  static async getSecurityDashboard(req, res) {
    try {
      const hours = req.query.hours || 24;
      
      const [dashboard, impossibleTravels, suspiciousLocations] = await Promise.all([
        AuditLog.getSecurityDashboard(hours),
        AuditLog.getImpossibleTravelAlerts(hours),
        AuditLog.getSuspiciousLocations(3, hours)
      ]);

      res.status(200).json({
        success: true,
        data: {
          period: `${hours} hours`,
          summary: dashboard,
          alerts: {
            impossible_travels: impossibleTravels.length,
            suspicious_locations: suspiciousLocations.length
          },
          impossible_travels: impossibleTravels,
          suspicious_locations: suspiciousLocations
        }
      });

    } catch (error) {
      console.error('Security dashboard error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching security dashboard',
        error: error.message
      });
    }
  }

  /**
   * Get User Login Locations
   */
  static async getUserLoginLocations(req, res) {
    try {
      const { user_id, days } = req.query;

      if (!user_id) {
        return res.status(400).json({
          success: false,
          message: 'user_id is required'
        });
      }

      const locations = await AuditLog.getLoginsByLocation(user_id, days || 30);

      res.status(200).json({
        success: true,
        data: {
          user_id,
          days: days || 30,
          locations
        }
      });

    } catch (error) {
      console.error('User login locations error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching user login locations',
        error: error.message
      });
    }
  }

  /**
   * Get Activity Log (User's recent actions)
   */
  static async getActivityLog(req, res) {
    try {
      const adminId = req.user.id;

      const activities = await AuditLog.getUserActivity(adminId, 50);

      res.status(200).json({
        success: true,
        message: 'Activity log retrieved successfully',
        data: activities
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
}

module.exports = AdminController;
