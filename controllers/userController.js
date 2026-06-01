const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const OTP = require('../models/OTP');
const Session = require('../models/Session');
const AuditLog = require('../models/AuditLog');
const LoginLocation = require('../models/LoginLocation');
const RefreshToken = require('../models/RefreshToken');
const PasswordValidator = require('../utils/passwordValidator');
const emailService = require('../services/emailService');
const SecurityAlertService = require('../services/securityAlertService');
const GeolocationService = require('../services/geolocationService');
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

      // Create new user (email_verified defaults to false via DB default)
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

      // Generate email verification OTP (15-min expiry) and send it
      let verificationEmailSent = false;
      let devVerificationCode = null;
      const isDevelopment = process.env.NODE_ENV === 'development';

      try {
        const otpRecord = await OTP.create(newUser.id, 'email_verification', 'patient', 15);
        await AuditLog.logSecurityEvent(req, newUser.id, 'patient', email, 'email_verification_sent', 'success');

        try {
          await emailService.sendVerificationOTP(email, otpRecord.otp_code, first_name);
          verificationEmailSent = true;
          console.log('✅ Email verification code sent');
        } catch (emailError) {
          console.error('❌ Failed to send verification email:', emailError.message);
          await AuditLog.logSecurityEvent(req, newUser.id, 'patient', email, 'email_verification_sent', 'failed', `Email error: ${emailError.message}`);

          if (isDevelopment) {
            devVerificationCode = otpRecord.otp_code;
            console.log(`\n🔐 Development Email Verification Code: ${otpRecord.otp_code}\n`);
          }
        }
      } catch (otpError) {
        console.error('❌ Failed to create verification OTP:', otpError.message);
      }

      // Remove password_hash from response
      delete newUser.password_hash;

      const response = {
        success: true,
        message: verificationEmailSent
          ? 'Account created. Please check your email for a verification code to activate your account.'
          : 'Account created, but we could not send the verification email. Please request a new code.',
        data: {
          user: newUser,
          requiresEmailVerification: true,
          email: newUser.email,
          expiresIn: '15 minutes'
        }
      };

      if (isDevelopment && devVerificationCode) {
        response.data.verification_code = devVerificationCode;
        response.data.dev_note = 'Verification code included in response (development mode only)';
      }

      res.status(201).json(response);

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
      const { email, password, skipOTP } = req.body;

      const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

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

      // ✅ Direct password authentication (no OTP on login)
      if (skipOTP === true) {
        delete user.password_hash;

        // Generate access token (8 hours)
        const accessToken = jwt.sign(
          { 
            id: user.id, 
            email: user.email,
            role: 'patient'
          },
          process.env.JWT_SECRET,
          { expiresIn: '8h' }
        );

        // Create session with accessToken hash
        const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');
        
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

        // Generate refresh token
        const refreshTokenData = await RefreshToken.create(
          user.id, 
          'patient',
          userAgent
        );

        // Log successful login
        await AuditLog.logSecurityEvent(req, user.id, 'patient', email, 'login', 'success', null);

        res.status(200).json({
          success: true,
          message: 'Login successful',
          data: {
            user,
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

        return;
      }

      // ❌ OTP removed from login - use password auth only
      // OTP is used ONLY for email verification during signup
      console.log(`[LOGIN DEBUG] Reached end of login without skipOTP - sending error`);
      return res.status(400).json({
        success: false,
        message: 'Invalid login request. Use skipOTP: true for direct password login or signup first.',
        code: 'INVALID_LOGIN_REQUEST'
      });

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

      // 🛡️  Email verification gate (defense in depth)
      if (user.email_verified === false) {
        await AuditLog.logSecurityEvent(req, user.id, 'patient', email, 'otp_verified', 'failed', 'Email not verified');
        return res.status(403).json({
          success: false,
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Please verify your email before logging in.'
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

      // 🔒 ENTERPRISE SECURITY: Analyze for suspicious activity
      let activityAnalysis = { alerts: [], riskScore: 0 };
      let geolocation = null;
      let nearbyDoctors = [];
      
      try {
        // Get geolocation from IP
        geolocation = await GeolocationService.getLocationFromIP(ipAddress);
        
        // Fetch nearby doctors if geolocation is available and has valid coordinates
        if (geolocation && geolocation.latitude && geolocation.longitude && !geolocation.is_private) {
          try {
            const radiusKm = 15; // Default 15km radius
            nearbyDoctors = await Doctor.findNearby(geolocation.latitude, geolocation.longitude, radiusKm);
            
            // Remove password hashes and limit results
            nearbyDoctors = nearbyDoctors.slice(0, 10).map(doc => ({
              id: doc.id,
              first_name: doc.first_name,
              last_name: doc.last_name,
              specialization: doc.specialization,
              clinic_name: doc.clinic_name,
              phone: doc.phone,
              distance_km: doc.distance_km,
              experience: doc.experience,
              consultation_fee: doc.consultation_fee
            }));
            
            console.log(`✅ Found ${nearbyDoctors.length} nearby doctors for patient ${user.id}`);
          } catch (doctorError) {
            console.error('❌ Error fetching nearby doctors (non-blocking):', doctorError.message);
            nearbyDoctors = [];
          }
        }
        
        // Generate device fingerprint
        const deviceFingerprint = crypto.createHash('sha256').update(userAgent || '').digest('hex');
        
        // Parse device info
        const userAgentParser = require('ua-parser-js');
        const parser = new userAgentParser();
        const deviceInfo = parser.setUA(userAgent).getResult();
        
        // Analyze login activity for anomalies
        activityAnalysis = await SecurityAlertService.analyzeLoginActivity({
          userId: user.id,
          userType: 'patient',
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          ipAddress,
          geolocation,
          deviceFingerprint,
          deviceName: `${deviceInfo.device.name || 'Unknown'} ${deviceInfo.device.type || ''}`.trim(),
          browser: `${deviceInfo.browser.name || 'Unknown'} ${deviceInfo.browser.version || ''}`.trim(),
          os: `${deviceInfo.os.name || 'Unknown'} ${deviceInfo.os.version || ''}`.trim(),
          userAgent
        });
        
        // Send alerts if high risk
        if (activityAnalysis.riskScore > 40) {
          const riskLevel = SecurityAlertService.getRiskLevel(activityAnalysis.riskScore);
          await SecurityAlertService.sendSecurityAlert({
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            eventType: 'NEW_LOGIN',
            details: activityAnalysis,
            location: geolocation,
            deviceInfo,
            timestamp: new Date(),
            riskLevel,
            actionRequired: activityAnalysis.riskScore > 70
          });
        }
      } catch (alertError) {
        console.error('❌ Security alert error (non-blocking):', alertError.message);
      }

      // Generate access token (8 hours - matches doctor session duration)
      const accessToken = jwt.sign(
        { 
          id: user.id, 
          email: user.email,
          type: 'user' // or 'patient'
        },
        process.env.JWT_SECRET,
        { expiresIn: '8h' } // 8 hours for consistent session duration
      );

      // Generate refresh token
      const refreshTokenData = await RefreshToken.create(
        user.id, 
        'patient', // or appropriate user type
        req.headers['user-agent'] // Optional device info
      );

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user,
          tokens: {
            accessToken,
            refreshToken: refreshTokenData.token,
            expiresIn: 28800 // 8 hours (28800 seconds)
          },
          session: {
            id: session.id,
            expiresAt: session.expires_at
          },
          location: geolocation ? {
            city: geolocation.city,
            country: geolocation.country,
            latitude: geolocation.latitude,
            longitude: geolocation.longitude,
            timezone: geolocation.timezone
          } : null,
          nearby_doctors: {
            count: nearbyDoctors.length,
            radius_km: 15,
            doctors: nearbyDoctors
          },
          security: {
            riskScore: activityAnalysis.riskScore,
            alertsSent: activityAnalysis.alerts?.length > 0
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
      const sessionId = req.authSession?.id;

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

      // 🔒 ENTERPRISE SECURITY: Send password change security alert
      let geolocation = null;
      try {
        geolocation = await GeolocationService.getLocationFromIP(ipAddress);
        const userAgent = req.headers['user-agent'];
        const userAgentParser = require('ua-parser-js');
        const parser = new userAgentParser();
        const deviceInfo = parser.setUA(userAgent).getResult();
        
        await SecurityAlertService.sendPasswordChangeAlert({
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          timestamp: new Date(),
          ipAddress,
          location: geolocation,
          deviceInfo
        });
      } catch (alertError) {
        console.error('❌ Password change alert error (non-blocking):', alertError.message);
      }

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

  /**
   * Request Account Deletion
   * User must:
   * 1. Be logged in
   * 2. Type "Delete my account" to confirm
   * 3. Receive confirmation email
   * 4. Click link in email to actually delete account
   */
  static async requestAccountDeletion(req, res) {
    try {
      const userId = req.user.id;
      const { confirmation_text } = req.body;
      const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      // Get user data
      const user = await User.findById(userId);
      if (!user) {
        await AuditLog.logSecurityEvent(req, userId, 'patient', user?.email, 'delete_account_request', 'failed', 'User not found');
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Validate confirmation text
      const requiredConfirmation = 'Delete my account';
      if (!confirmation_text || confirmation_text.trim() !== requiredConfirmation) {
        await AuditLog.logSecurityEvent(req, userId, 'patient', user.email, 'delete_account_request', 'failed', `Invalid confirmation text. Expected: "${requiredConfirmation}"`);
        return res.status(400).json({
          success: false,
          message: `To delete your account, you must type exactly: "${requiredConfirmation}"`,
          required_text: requiredConfirmation
        });
      }

      // Check if there's already an active deletion request
      const AccountDeletionToken = require('../models/AccountDeletionToken');
      const activeDeletion = await AccountDeletionToken.getActiveDeletionRequest(userId);
      
      if (activeDeletion) {
        await AuditLog.logSecurityEvent(req, userId, 'patient', user.email, 'delete_account_request', 'failed', 'Active deletion request already exists');
        return res.status(409).json({
          success: false,
          message: 'You already have an active account deletion request. Check your email for the confirmation link.',
          expiresAt: activeDeletion.deletion_token_expires_at
        });
      }

      // Create deletion token
      const tokenResult = await AccountDeletionToken.create(userId, user.email, ipAddress, userAgent);
      if (!tokenResult.success) {
        throw new Error('Failed to create deletion token');
      }

      // Build deletion confirmation link
      const deletionLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/confirm-account-deletion?token=${tokenResult.token}`;

      // Send confirmation email
      try {
        await emailService.sendAccountDeletionConfirmation(user.email, user.first_name, deletionLink);
      } catch (emailError) {
        console.error('Failed to send deletion confirmation email:', emailError.message);
        // Invalidate the token if email fails
        await AccountDeletionToken.cancel(tokenResult.data.id, 'Email sending failed');
        
        await AuditLog.logSecurityEvent(req, userId, 'patient', user.email, 'delete_account_request', 'failed', 'Email sending failed');
        return res.status(500).json({
          success: false,
          message: 'Failed to send confirmation email. Please try again.',
          error: emailError.message
        });
      }

      // Log the deletion request
      await AuditLog.logSecurityEvent(req, userId, 'patient', user.email, 'delete_account_request', 'success', 'Deletion confirmation email sent');

      res.status(200).json({
        success: true,
        message: 'Confirmation email sent! Please check your email to confirm account deletion.',
        details: {
          email: user.email,
          expiresAt: tokenResult.data.deletion_token_expires_at,
          note: 'Check your spam folder if you don\'t see the email'
        }
      });

    } catch (error) {
      console.error('Request account deletion error:', error);
      res.status(500).json({
        success: false,
        message: 'Error requesting account deletion',
        error: error.message
      });
    }
  }

  /**
   * Confirm Account Deletion
   * Called when user clicks link in confirmation email
   * Actually deletes the account
   */
  static async confirmAccountDeletion(req, res) {
    try {
      const { token } = req.query || req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Deletion token is required'
        });
      }

      // Verify deletion token
      const AccountDeletionToken = require('../models/AccountDeletionToken');
      const deletionTokenData = await AccountDeletionToken.findByToken(token);

      if (!deletionTokenData) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired deletion token. Please request deletion again.',
          code: 'INVALID_TOKEN'
        });
      }

      const userId = deletionTokenData.user_id;
      const userEmail = deletionTokenData.email;

      // Get user data before deletion for audit log
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      try {
        // Start deletion process
        console.log(`🗑️  Deleting account for user: ${userEmail}`);

        // 1. Invalidate all sessions
        await Session.invalidateUserSessions(userId, 'Account deletion');

        // 2. Delete related data (in order of foreign key dependencies)
        // Note: Adjust based on your actual database schema
        const { query } = require('../config/db');

        // Delete OTPs
        await query('DELETE FROM otps WHERE user_id = $1', [userId]);

        // Delete password reset tokens
        await query('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId]);

        // Delete account deletion tokens
        await AccountDeletionToken.invalidateAllUserTokens(userId, 'Account deleted');

        // Delete audit logs (if you want to keep history, you can skip this)
        // await query('DELETE FROM audit_logs WHERE user_id = $1', [userId]);

        // Delete patient profiles (if exists)
        await query('DELETE FROM patient_profiles WHERE user_id = $1', [userId]);

        // Delete the user account
        const deleteUserQuery = 'DELETE FROM patients WHERE id = $1 RETURNING *';
        const deleteResult = await query(deleteUserQuery, [userId]);

        if (deleteResult.rows.length === 0) {
          throw new Error('Failed to delete user');
        }

        // Mark deletion token as confirmed
        await AccountDeletionToken.markAsConfirmed(deletionTokenData.id);

        // Log the account deletion
        await AuditLog.logSecurityEvent(
          req,
          userId,
          'patient',
          userEmail,
          'account_deleted',
          'success',
          'Account permanently deleted via email confirmation'
        );

        // Clear user's cache if using cache service
        const cache = require('../services/cacheService');
        try {
          await cache.delete(`user:id:${userId}`);
          await cache.delete(`user:email:${userEmail}`);
        } catch (cacheError) {
          console.warn('Warning: Cache cleanup failed:', cacheError.message);
        }

        console.log(`✅ Account deleted successfully for: ${userEmail}`);

        res.status(200).json({
          success: true,
          message: 'Your account has been permanently deleted.',
          details: {
            email: userEmail,
            deletedAt: new Date().toISOString(),
            note: 'All your personal data and medical records have been removed from our system.'
          }
        });

      } catch (deletionError) {
        console.error('Error deleting account:', deletionError);
        
        await AuditLog.logSecurityEvent(
          req,
          userId,
          'patient',
          userEmail,
          'account_deleted',
          'failed',
          `Deletion failed: ${deletionError.message}`
        );

        throw deletionError;
      }

    } catch (error) {
      console.error('Confirm account deletion error:', error);
      res.status(500).json({
        success: false,
        message: 'Error confirming account deletion',
        error: error.message
      });
    }
  }

  /**
   * Cancel Account Deletion
   * User can cancel deletion request before confirmation
   */
  static async cancelAccountDeletion(req, res) {
    try {
      const userId = req.user?.id;
      const { token } = req.query || req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const AccountDeletionToken = require('../models/AccountDeletionToken');
      
      // If token is provided, anyone can cancel (for unauthenticated users)
      // If no token, only logged-in user can cancel their own deletion
      let deletionTokenData;
      
      if (token) {
        deletionTokenData = await AccountDeletionToken.findByToken(token);
      } else {
        deletionTokenData = await AccountDeletionToken.getActiveDeletionRequest(userId);
      }

      if (!deletionTokenData) {
        return res.status(404).json({
          success: false,
          message: 'No active deletion request found'
        });
      }

      // Verify ownership (if token not provided)
      if (!token && deletionTokenData.user_id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      // Cancel the deletion request
      await AccountDeletionToken.cancel(deletionTokenData.id, 'User cancelled deletion request');

      // Log cancellation
      const user = await User.findById(deletionTokenData.user_id);
      await AuditLog.logSecurityEvent(
        req,
        deletionTokenData.user_id,
        'patient',
        user.email,
        'delete_account_cancelled',
        'success',
        'User cancelled account deletion request'
      );

      res.status(200).json({
        success: true,
        message: 'Account deletion request has been cancelled. Your account is safe.',
        details: {
          email: deletionTokenData.email,
          status: 'Active',
          note: 'If you wish to delete your account in the future, you can request it anytime.'
        }
      });

    } catch (error) {
      console.error('Cancel account deletion error:', error);
      res.status(500).json({
        success: false,
        message: 'Error cancelling account deletion',
        error: error.message
      });
    }
  }

  /**
   * Verify Email (Account Activation)
   * Confirms the user owns the email address provided at signup.
   * On success, flips email_verified = true so login is permitted.
   */
  static async verifyEmail(req, res) {
    try {
      const { email, otp_code } = req.body;

      if (!email || !otp_code) {
        await AuditLog.logSecurityEvent(req, null, 'patient', email, 'email_verification', 'failed', 'Missing email or code');
        return res.status(400).json({
          success: false,
          message: 'Email and verification code are required'
        });
      }

      const user = await User.findByEmail(email);
      if (!user) {
        await AuditLog.logSecurityEvent(req, null, 'patient', email, 'email_verification', 'failed', 'User not found');
        // Generic response to prevent account enumeration
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired verification code'
        });
      }

      // Idempotent: already verified
      if (user.email_verified === true) {
        return res.status(200).json({
          success: true,
          message: 'Email is already verified. You can log in.',
          data: { email: user.email, alreadyVerified: true }
        });
      }

      const otpResult = await OTP.verify(user.id, otp_code, 'email_verification', 'patient');
      if (!otpResult || !otpResult.valid) {
        await AuditLog.logSecurityEvent(req, user.id, 'patient', email, 'email_verification', 'failed', 'Invalid or expired code');
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired verification code'
        });
      }

      await User.markEmailVerified(user.id);
      await AuditLog.logSecurityEvent(req, user.id, 'patient', email, 'email_verification', 'success');

      return res.status(200).json({
        success: true,
        message: 'Email verified successfully. You can now log in.',
        data: {
          email: user.email,
          email_verified: true
        }
      });
    } catch (error) {
      console.error('Verify email error:', error);
      res.status(500).json({
        success: false,
        message: 'Error verifying email',
        error: error.message
      });
    }
  }

  /**
   * Resend Email Verification Code
   * Generates a fresh OTP and emails it. Rate-limited to one request per 60 seconds
   * per account to prevent abuse. Returns generic responses to avoid account enumeration.
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

      const user = await User.findByEmail(email);

      // Don't reveal whether the account exists or its verification state
      if (!user || user.email_verified === true) {
        return res.status(200).json(genericResponse);
      }

      // Rate-limit: reject if a code was issued in the last 60 seconds
      const latest = await OTP.getLatest(user.id, 'email_verification', 'patient');
      if (latest) {
        const ageSeconds = (Date.now() - new Date(latest.created_at).getTime()) / 1000;
        if (ageSeconds < 60) {
          await AuditLog.logSecurityEvent(req, user.id, 'patient', email, 'email_verification_resend', 'failed', 'Rate limited');
          return res.status(429).json({
            success: false,
            message: `Please wait ${Math.ceil(60 - ageSeconds)} seconds before requesting another code.`
          });
        }
      }

      const otpRecord = await OTP.create(user.id, 'email_verification', 'patient', 15);
      await AuditLog.logSecurityEvent(req, user.id, 'patient', email, 'email_verification_resend', 'success');

      try {
        await emailService.sendVerificationOTP(user.email, otpRecord.otp_code, user.first_name);
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
      console.error('Resend verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Error resending verification code',
        error: error.message
      });
    }
  }

  /**
   * Google OAuth - Initiate Login/Signup
   * Redirects to Google OAuth consent screen
   */
  static googleAuth(req, res, next) {
    // Check if Google credentials are configured
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return res.status(503).json({
        success: false,
        message: 'Google OAuth is not configured',
        details: 'Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables'
      });
    }

    const passport = require('passport');
    passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
  }

  /**
   * Google OAuth - Callback Handler
   * Called after user approves OAuth permissions on Google
   */
  static async googleAuthCallback(req, res) {
    try {
      const passport = require('passport');
      
      // Use passport to authenticate
      passport.authenticate('google', async (err, user, info) => {
        if (err) {
          console.error('Google OAuth error:', err);
          return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=auth_failed`);
        }

        if (!user) {
          return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=auth_failed`);
        }

        // Check if user needs to complete profile
        const isProfileComplete = user.phone && user.id_passport_number && user.nationality;

        if (!isProfileComplete) {
          // Generate temporary token for profile completion
          const tempToken = jwt.sign(
            { 
              id: user.id, 
              email: user.email,
              temporary: true,
              type: 'oauth_profile_completion'
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
          );

          // Redirect to profile completion page
          return res.redirect(
            `${process.env.FRONTEND_URL || 'http://localhost:3000'}/complete-profile?token=${tempToken}&email=${encodeURIComponent(user.email)}`
          );
        }

        // User profile is complete, log them in
        const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
        const userAgent = req.headers['user-agent'];

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
        const session = await Session.create(
          user.id,
          'patient',
          tokenHash,
          ipAddress,
          userAgent,
          { userAgent, ipAddress, timestamp: new Date().toISOString() }
        );

        // Generate access token (8 hours - matches doctor session duration)
        const accessToken = jwt.sign(
          { 
            id: user.id, 
            email: user.email,
            type: 'user'
          },
          process.env.JWT_SECRET,
          { expiresIn: '8h' }
        );

        // Generate refresh token
        const refreshTokenData = await RefreshToken.create(user.id, 'patient', userAgent);

        // Log successful login
        await AuditLog.logSecurityEvent(req, user.id, 'patient', user.email, 'google_login', 'success');

        // Build redirect URL with tokens
        const redirectUrl = new URL(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth-callback`);
        redirectUrl.searchParams.append('accessToken', accessToken);
        redirectUrl.searchParams.append('refreshToken', refreshTokenData.token);
        redirectUrl.searchParams.append('userId', user.id);
        redirectUrl.searchParams.append('email', user.email);
        redirectUrl.searchParams.append('success', 'true');

        res.redirect(redirectUrl.toString());

      })(req, res);

    } catch (error) {
      console.error('Google OAuth callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=callback_failed`);
    }
  }

  /**
   * Complete OAuth Profile
   * New OAuth users must complete their profile with required fields
   * Phone, ID/Passport, and Nationality are required
   */
  static async completeOAuthProfile(req, res) {
    try {
      const userId = req.user.id;
      const { phone, id_passport_number, nationality } = req.body;

      // Validate required fields
      if (!phone || !id_passport_number || !nationality) {
        return res.status(400).json({
          success: false,
          message: 'Phone, ID/Passport number, and nationality are required',
          requiredFields: ['phone', 'id_passport_number', 'nationality']
        });
      }

      // Validate nationality
      const validNationalities = ['South African', 'Other'];
      if (!validNationalities.includes(nationality)) {
        return res.status(400).json({
          success: false,
          message: 'Nationality must be either "South African" or "Other"'
        });
      }

      // Check if ID/Passport already exists
      const existingUserByIdPassport = await User.findByIdPassport(id_passport_number);
      if (existingUserByIdPassport && existingUserByIdPassport.id !== userId) {
        return res.status(409).json({
          success: false,
          message: 'ID/Passport number already registered'
        });
      }

      // Update user profile
      const updatedUser = await User.update(userId, {
        phone,
        id_passport_number,
        nationality
      });

      if (!updatedUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Log profile completion
      await AuditLog.logSecurityEvent(req, userId, 'patient', updatedUser.email, 'oauth_profile_completed', 'success');

      delete updatedUser.password_hash;

      res.status(200).json({
        success: true,
        message: 'Profile completed successfully',
        data: {
          user: updatedUser,
          message: 'Your profile is now complete. You can now access all features.'
        }
      });

    } catch (error) {
      console.error('Complete OAuth profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Error completing profile',
        error: error.message
      });
    }
  }
}

module.exports = UserController;
