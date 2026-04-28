const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const OTP = require('../models/OTP');
const Session = require('../models/Session');
const AuditLog = require('../models/AuditLog');
const PasswordValidator = require('../utils/passwordValidator');
const emailService = require('../services/emailService');
const PasswordResetToken = require('../models/PasswordResetToken');

/**
 * User Controller
 * Handles user authentication and registration
 */

class UserController {
  /**
   * User Signup/Registration
   */
  static async signup(req, res) {
    try {
      const { 
        first_name, 
        last_name, 
        email, 
        phone, 
        id_passport_number,
        nationality, 
        password 
      } = req.body;

      const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;

      // Validate required fields
      if (!first_name || !last_name || !email || !phone || !id_passport_number || !nationality || !password) {
        await AuditLog.logSecurityEvent(req, null, 'patient', email, 'signup', 'failed', 'Missing required fields');
        return res.status(400).json({
          success: false,
          message: 'All fields are required: first_name, last_name, email, phone, id_passport_number, nationality, password'
        });
      }

      // Validate nationality
      const validNationalities = ['South African', 'Other'];
      if (!validNationalities.includes(nationality)) {
        await AuditLog.logSecurityEvent(req, null, 'patient', email, 'signup', 'failed', 'Invalid nationality');
        return res.status(400).json({
          success: false,
          message: 'Nationality must be either "South African" or "Other"'
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        await AuditLog.logSecurityEvent(req, null, 'patient', email, 'signup', 'failed', 'Invalid email format');
        return res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
      }

      // Validate password strength
      const passwordValidation = PasswordValidator.validate(password);
      if (!passwordValidation.valid) {
        await AuditLog.logSecurityEvent(req, null, 'patient', email, 'signup', 'failed', `Weak password: ${passwordValidation.errors.join(', ')}`);
        return res.status(400).json({
          success: false,
          message: 'Password does not meet security requirements',
          errors: passwordValidation.errors,
          strength: PasswordValidator.getStrengthDescription(PasswordValidator.getStrength(password))
        });
      }

      // Check if email already exists
      const existingUserByEmail = await User.findByEmail(email);
      if (existingUserByEmail) {
        await AuditLog.logSecurityEvent(req, null, 'patient', email, 'signup', 'failed', 'Email already registered');
        return res.status(409).json({
          success: false,
          message: 'Email already registered'
        });
      }

      // Check if ID/Passport number already exists
      const existingUserByIdPassport = await User.findByIdPassport(id_passport_number);
      if (existingUserByIdPassport) {
        await AuditLog.logSecurityEvent(req, null, 'patient', email, 'signup', 'failed', 'ID/Passport already registered');
        return res.status(409).json({
          success: false,
          message: 'ID/Passport number already registered'
        });
      }

      // Hash password
      const saltRounds = 10;
      const password_hash = await bcrypt.hash(password, saltRounds);

      // Create new user
      const newUser = await User.create({
        first_name,
        last_name,
        email,
        phone,
        id_passport_number,
        nationality,
        password_hash
      });

      // Log successful signup
      await AuditLog.logSecurityEvent(req, newUser.id, 'patient', email, 'signup', 'success');

      // Remove password_hash from response
      delete newUser.password_hash;

      res.status(201).json({
        success: true,
        message: 'User registered successfully. Please log in.',
        data: {
          user: newUser
        }
      });

    } catch (error) {
      console.error('Signup error:', error);
      res.status(500).json({
        success: false,
        message: 'Error registering user',
        error: error.message
      });
    }
  }

  /**
   * User Login
   */
  static async login(req, res) {
    try {
      const { email, password } = req.body;

      const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;

      // Validate required fields
      if (!email || !password) {
        await AuditLog.logSecurityEvent(req, null, 'patient', email, 'login', 'failed', 'Missing email or password');
        return res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
      }

      // Check for suspicious activity (multiple failed attempts)
      const failedAttempts = await AuditLog.getFailedLoginAttempts(email, 1);
      if (failedAttempts >= 5) {
        await AuditLog.logSecurityEvent(req, null, 'patient', email, 'login_failed', 'failed', `Too many failed attempts: ${failedAttempts}`);
        return res.status(429).json({
          success: false,
          message: 'Too many failed login attempts. Please try again later or contact support.'
        });
      }

      // Find user by email
      const user = await User.findByEmail(email);
      if (!user) {
        await AuditLog.logSecurityEvent(req, null, 'patient', email, 'login', 'failed', 'User not found');
        return res.status(403).json({
          success: false,
          message: 'No patient account found with this email. Please use the correct login page.'
        });
      }

      // Check if user is active
      if (user.status !== 'active') {
        await AuditLog.logSecurityEvent(req, user.id, 'patient', email, 'login', 'failed', 'Account inactive');
        return res.status(403).json({
          success: false,
          message: 'Account is inactive. Please contact support.'
        });
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        await AuditLog.logSecurityEvent(req, user.id, 'patient', email, 'login_failed', 'failed', 'Invalid password');
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Generate and send OTP
      const otpRecord = await OTP.create(user.id, 'login', 'patient');
      
      // Log OTP generation
      await AuditLog.logSecurityEvent(req, user.id, 'patient', email, 'otp_generated', 'success');
      
      // Send OTP email
      const isDevelopment = process.env.NODE_ENV === 'development';
      let emailSent = false;
      
      try {
        await emailService.sendOTP(user.email, otpRecord.otp_code, user.first_name);
        emailSent = true;
        console.log('✅ OTP email sent successfully');
      } catch (emailError) {
        console.error('❌ Failed to send OTP email:', emailError.message);
        
        if (!isDevelopment) {
          await AuditLog.logSecurityEvent(req, user.id, 'patient', email, 'otp_generated', 'failed', `Email error: ${emailError.message}`);
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
          email: user.email,
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
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Error logging in',
        error: error.message
      });
    }
  }

  /**
   * Verify OTP and Complete Login
   */
  static async verifyOTP(req, res) {
    try {
      const { email, otp_code } = req.body;

      const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      // Validate required fields
      if (!email || !otp_code) {
        await AuditLog.logSecurityEvent(req, null, 'patient', email, 'otp_verified', 'failed', 'Missing email or OTP');
        return res.status(400).json({
          success: false,
          message: 'Email and OTP code are required'
        });
      }

      // Find user by email
      const user = await User.findByEmail(email);
      if (!user) {
        await AuditLog.logSecurityEvent(req, null, 'patient', email, 'otp_verified', 'failed', 'User not found');
        return res.status(403).json({
          success: false,
          message: 'No patient account found with this email. Please use the correct login page.'
        });
      }

      // Verify OTP
      const isOTPValid = await OTP.verify(user.id, otp_code, 'login', 'patient');
      if (!isOTPValid || !isOTPValid.valid) {
        await AuditLog.logSecurityEvent(req, user.id, 'patient', email, 'otp_failed', 'failed', 'Invalid or expired OTP');
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired OTP code'
        });
      }

      // Remove password_hash from response
      delete user.password_hash;

      // Generate JWT token
      const token = jwt.sign(
        { 
          id: user.id, 
          email: user.email,
          role: user.role,
          type: 'patient'
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
        user.id,
        'patient',
        tokenHash,
        ipAddress,
        userAgent,
        deviceInfo
      );

      // Log successful login
      await AuditLog.logSecurityEvent(req, user.id, 'patient', email, 'login', 'success', null);

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user,
          token,
          session: {
            id: session.id,
            expiresAt: session.expires_at
          }
        }
      });

    } catch (error) {
      console.error('Verify OTP error:', error);
      res.status(500).json({
        success: false,
        message: 'Error verifying OTP',
        error: error.message
      });
    }
  }

  /**
   * User Logout
   */
  static async logout(req, res) {
    try {
      const userId = req.user.id;
      const sessionId = req.session?.id;

      if (sessionId) {
        await Session.revoke(sessionId, 'User logout');
        await AuditLog.logSecurityEvent(req, userId, 'patient', req.user.email, 'logout', 'success');
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
      const userId = req.user.id;

      const sessions = await Session.getUserActiveSessions(userId);

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
      const userId = req.user.id;
      const limit = parseInt(req.query.limit) || 50;

      const activityLog = await AuditLog.getUserActivity(userId, limit);

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
   * Get User Profile
   */
  static async getProfile(req, res) {
    try {
      const userId = req.user.id;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      delete user.password_hash;

      res.status(200).json({
        success: true,
        data: user
      });

    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching profile',
        error: error.message
      });
    }
  }

  /**
   * Update User Profile
   */
  static async updateProfile(req, res) {
    try {
      const userId = req.user.id;
      const updateData = req.body;

      delete updateData.id;
      delete updateData.password_hash;
      delete updateData.email;
      delete updateData.id_passport_number;
      delete updateData.created_at;

      const updatedUser = await User.update(userId, updateData);
      if (!updatedUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      delete updatedUser.password_hash;

      await AuditLog.logSecurityEvent(req, userId, 'patient', updatedUser.email, 'profile_updated', 'success');

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: updatedUser
      });

    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating profile',
        error: error.message
      });
    }
  }

  /**
   * Forgot Password - Send Password Reset Email
   * No authentication required
   */
  static async forgotPassword(req, res) {
    try {
      const { email } = req.body;

      const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      // Validate required fields
      if (!email) {
        await AuditLog.logSecurityEvent(req, null, 'patient', email, 'forgot_password', 'failed', 'Missing email');
        return res.status(400).json({
          success: false,
          message: 'Email is required'
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        await AuditLog.logSecurityEvent(req, null, 'patient', email, 'forgot_password', 'failed', 'Invalid email format');
        return res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
      }

      // Find user by email
      const user = await User.findByEmail(email);
      if (!user) {
        // For security reasons, don't reveal if email exists or not
        // But log the failed attempt
        await AuditLog.logSecurityEvent(req, null, 'patient', email, 'forgot_password', 'failed', 'User not found');
        return res.status(200).json({
          success: true,
          message: 'If an account with this email exists, a password reset link has been sent to your email. Please check your inbox and spam folder.'
        });
      }

      // Create password reset token
      let resetTokenData;
      try {
        resetTokenData = await PasswordResetToken.create(user.id, email, ipAddress, userAgent);
      } catch (tokenError) {
        console.error('Error creating reset token:', tokenError);
        await AuditLog.logSecurityEvent(req, user.id, 'patient', email, 'forgot_password', 'failed', `Token creation error: ${tokenError.message}`);
        return res.status(500).json({
          success: false,
          message: 'Error generating password reset token. Please try again later.'
        });
      }

      // Build reset link
      const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetTokenData.token}`;

      // Send password reset email
      let emailSent = false;
      const isDevelopment = process.env.NODE_ENV === 'development';

      try {
        await emailService.sendPasswordReset(email, user.first_name, resetTokenData.token, resetLink);
        emailSent = true;
        console.log('✅ Password reset email sent successfully');
      } catch (emailError) {
        console.error('❌ Failed to send password reset email:', emailError.message);

        if (!isDevelopment) {
          await AuditLog.logSecurityEvent(req, user.id, 'patient', email, 'forgot_password', 'failed', `Email error: ${emailError.message}`);
          // Invalidate the token if email couldn't be sent
          await PasswordResetToken.markAsUsed(resetTokenData.data.id);
          return res.status(500).json({
            success: false,
            message: 'Failed to send password reset email. Please try again later.'
          });
        }

        console.log('⚠️  Development mode: Skipping email requirement');
      }

      // Log successful request
      await AuditLog.logSecurityEvent(req, user.id, 'patient', email, 'forgot_password', 'success');

      const response = {
        success: true,
        message: emailSent 
          ? 'Password reset link has been sent to your email. The link will expire in 24 hours.'
          : 'Password reset token generated. Check server logs (development mode only).'
      };

      if (isDevelopment && !emailSent) {
        response.dev_token = resetTokenData.token;
        response.dev_link = resetLink;
        response.dev_note = 'Token and link included in response (development mode only)';
        console.log(`\n🔐 Development Reset Token: ${resetTokenData.token}\n`);
        console.log(`🔗 Development Reset Link: ${resetLink}\n`);
      }

      res.status(200).json(response);

    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({
        success: false,
        message: 'Error processing password reset request',
        error: error.message
      });
    }
  }

  /**
   * Reset Password - Verify Token and Update Password
   * No authentication required
   */
  static async resetPassword(req, res) {
    try {
      const { token, new_password, confirm_password } = req.body;

      const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;

      // Validate required fields
      if (!token || !new_password || !confirm_password) {
        return res.status(400).json({
          success: false,
          message: 'Token, new password, and password confirmation are required'
        });
      }

      // Verify passwords match
      if (new_password !== confirm_password) {
        await AuditLog.logSecurityEvent(req, null, 'patient', null, 'reset_password', 'failed', 'Passwords do not match');
        return res.status(400).json({
          success: false,
          message: 'Passwords do not match'
        });
      }

      // Validate password strength
      const passwordValidation = PasswordValidator.validate(new_password);
      if (!passwordValidation.valid) {
        await AuditLog.logSecurityEvent(req, null, 'patient', null, 'reset_password', 'failed', `Weak password: ${passwordValidation.errors.join(', ')}`);
        return res.status(400).json({
          success: false,
          message: 'Password does not meet security requirements',
          errors: passwordValidation.errors,
          strength: PasswordValidator.getStrengthDescription(PasswordValidator.getStrength(new_password))
        });
      }

      // Find reset token
      const resetToken = await PasswordResetToken.findByToken(token);
      if (!resetToken) {
        await AuditLog.logSecurityEvent(req, null, 'patient', null, 'reset_password', 'failed', 'Invalid or expired reset token');
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired password reset token. Please request a new one.'
        });
      }

      // Get user
      const user = await User.findById(resetToken.user_id);
      if (!user) {
        await AuditLog.logSecurityEvent(req, resetToken.user_id, 'patient', resetToken.email, 'reset_password', 'failed', 'User not found');
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Hash new password
      const saltRounds = 10;
      const password_hash = await bcrypt.hash(new_password, saltRounds);

      // Update user password
      const updatedUser = await User.update(user.id, { password_hash });

      // Mark token as used
      await PasswordResetToken.markAsUsed(resetToken.id);

      // Invalidate all other unused reset tokens for this user
      await PasswordResetToken.invalidateAllUserTokens(user.id);

      // Invalidate all sessions for this user (force re-login)
      try {
        await Session.invalidateUserSessions(user.id);
      } catch (sessionError) {
        console.error('Error invalidating sessions:', sessionError);
        // Don't fail the password reset if session invalidation fails
      }

      // Log successful password reset
      await AuditLog.logSecurityEvent(req, user.id, 'patient', user.email, 'reset_password', 'success', `IP: ${ipAddress}`);

      // Send confirmation email
      try {
        await emailService.sendPasswordResetConfirmation(user.email, user.first_name);
      } catch (emailError) {
        console.error('Failed to send confirmation email:', emailError.message);
        // Don't fail the password reset if confirmation email fails
      }

      res.status(200).json({
        success: true,
        message: 'Password has been reset successfully. You can now log in with your new password.'
      });

    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({
        success: false,
        message: 'Error resetting password',
        error: error.message
      });
    }
  }
}

module.exports = UserController;
