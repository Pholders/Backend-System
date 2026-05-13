const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Doctor = require('../models/Doctor');
const OTP = require('../models/OTP');
const Session = require('../models/Session');
const AuditLog = require('../models/AuditLog');
const PasswordValidator = require('../utils/passwordValidator');
const emailService = require('../services/emailService');
const GeolocationService = require('../services/geolocationService');
const GeocodingService = require('../services/geocodingService');

/**
 * Doctor Controller
 * Handles doctor authentication and profile management
 */

class DoctorController {
  /**
   * Doctor Signup/Registration
   */
  static async signup(req, res) {
    try {
      const {
        first_name,
        last_name,
        email,
        phone,
        password,
        hpcsa_number,
        specialization,
        experience,
        clinic_name,
        city,
        province,
        clinic_address,
        bio
      } = req.body;

      // Validate required fields
      if (!first_name || !last_name || !email || !phone || !password || !hpcsa_number || !specialization || !experience || !clinic_name || !city || !province || !clinic_address) {
        await AuditLog.logSecurityEvent(req, null, 'doctor', email, 'signup', 'failed', 'Missing required fields');
        return res.status(400).json({
          success: false,
          message: 'All fields are required: first_name, last_name, email, phone, password, hpcsa_number, specialization, experience, clinic_name, city, province, clinic_address'
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        await AuditLog.logSecurityEvent(req, null, 'doctor', email, 'signup', 'failed', 'Invalid email format');
        return res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
      }

      // Validate password strength
      const passwordValidation = PasswordValidator.validate(password);
      if (!passwordValidation.valid) {
        await AuditLog.logSecurityEvent(req, null, 'doctor', email, 'signup', 'failed', `Weak password: ${passwordValidation.errors.join(', ')}`);
        return res.status(400).json({
          success: false,
          message: 'Password does not meet security requirements',
          errors: passwordValidation.errors,
          strength: PasswordValidator.getStrengthDescription(PasswordValidator.getStrength(password))
        });
      }

      // Check if email already exists
      const existingDoctor = await Doctor.findByEmail(email);
      if (existingDoctor) {
        await AuditLog.logSecurityEvent(req, null, 'doctor', email, 'signup', 'failed', 'Email already registered');
        return res.status(409).json({
          success: false,
          message: 'Email already registered'
        });
      }

      // Check if HPCSA number already exists
      const existingHpcsa = await Doctor.findByHpcsaNumber(hpcsa_number);
      if (existingHpcsa) {
        await AuditLog.logSecurityEvent(req, null, 'doctor', email, 'signup', 'failed', 'HPCSA number already registered');
        return res.status(409).json({
          success: false,
          message: 'HPCSA number already registered'
        });
      }

      // Process location data - convert address to coordinates
      let finalLatitude = null;
      let finalLongitude = null;
      let finalClinicAddress = clinic_address;

      try {
        const locationResult = await GeocodingService.processLocation({
          clinic_address
        });

        if (!locationResult.success) {
          await AuditLog.logSecurityEvent(req, null, 'doctor', email, 'signup', 'failed', `Geocoding error: ${locationResult.error}`);
          return res.status(400).json({
            success: false,
            message: `Unable to geocode clinic address: ${locationResult.error}`,
            hint: 'Please provide a valid clinic address (e.g., "123 Medical Street, Johannesburg, South Africa")'
          });
        }

        finalLatitude = locationResult.latitude;
        finalLongitude = locationResult.longitude;
        finalClinicAddress = locationResult.formatted_address;
      } catch (geoError) {
        console.error('Geocoding error:', geoError);
        await AuditLog.logSecurityEvent(req, null, 'doctor', email, 'signup', 'failed', `Geocoding service error: ${geoError.message}`);
        return res.status(500).json({
          success: false,
          message: 'Error processing clinic address location',
          hint: 'Please ensure your clinic address is complete and valid'
        });
      }

      // Hash password
      const saltRounds = 10;
      const password_hash = await bcrypt.hash(password, saltRounds);

      // Create new doctor
      const newDoctor = await Doctor.create({
        first_name,
        last_name,
        email,
        phone,
        hpcsa_number,
        specialization,
        experience,
        clinic_name,
        city,
        province,
        latitude: finalLatitude,
        longitude: finalLongitude,
        clinic_address: finalClinicAddress,
        password_hash,
        bio
      });

      // Log successful signup
      await AuditLog.logSecurityEvent(req, newDoctor.id, 'doctor', email, 'signup', 'success');

      delete newDoctor.password_hash;

      res.status(201).json({
        success: true,
        message: 'Doctor registered successfully. Please log in.',
        data: { 
          doctor: newDoctor,
          location_info: {
            latitude: finalLatitude,
            longitude: finalLongitude,
            clinic_address: finalClinicAddress
          }
        }
      });

    } catch (error) {
      console.error('Doctor signup error:', error);
      res.status(500).json({
        success: false,
        message: 'Error registering doctor',
        error: error.message
      });
    }
  }

  /**
   * Doctor Login - initiates OTP flow
   */
  static async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        await AuditLog.logSecurityEvent(req, null, 'doctor', email, 'login', 'failed', 'Missing email or password');
        return res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
      }

      // Check for suspicious activity
      const failedAttempts = await AuditLog.getFailedLoginAttempts(email, 1);
      if (failedAttempts >= 5) {
        await AuditLog.logSecurityEvent(req, null, 'doctor', email, 'login_failed', 'failed', `Too many failed attempts: ${failedAttempts}`);
        return res.status(429).json({
          success: false,
          message: 'Too many failed login attempts. Please try again later or contact support.'
        });
      }

      const doctor = await Doctor.findByEmail(email);
      if (!doctor) {
        await AuditLog.logSecurityEvent(req, null, 'doctor', email, 'login', 'failed', 'Doctor not found');
        return res.status(403).json({
          success: false,
          message: 'No doctor account found with this email. Please use the correct login page.'
        });
      }

      if (doctor.status !== 'active') {
        await AuditLog.logSecurityEvent(req, doctor.id, 'doctor', email, 'login', 'failed', 'Account inactive');
        return res.status(403).json({
          success: false,
          message: 'Account is inactive. Please contact support.'
        });
      }

      const isPasswordValid = await bcrypt.compare(password, doctor.password_hash);
      if (!isPasswordValid) {
        await AuditLog.logSecurityEvent(req, doctor.id, 'doctor', email, 'login_failed', 'failed', 'Invalid password');
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Generate and send OTP
      const otpRecord = await OTP.create(doctor.id, 'login', 'doctor');

      // Log OTP generation
      await AuditLog.logSecurityEvent(req, doctor.id, 'doctor', email, 'otp_generated', 'success');

      const isDevelopment = process.env.NODE_ENV === 'development';
      let emailSent = false;

      try {
        await emailService.sendOTP(doctor.email, otpRecord.otp_code, doctor.first_name);
        emailSent = true;
        console.log('✅ OTP email sent to doctor successfully');
      } catch (emailError) {
        console.error('❌ Failed to send OTP email:', emailError.message);

        if (!isDevelopment) {
          await AuditLog.logSecurityEvent(req, doctor.id, 'doctor', email, 'otp_generated', 'failed', `Email error: ${emailError.message}`);
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
          email: doctor.email,
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
      console.error('Doctor login error:', error);
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
        await AuditLog.logSecurityEvent(req, null, 'doctor', email, 'otp_verified', 'failed', 'Missing email or OTP');
        return res.status(400).json({
          success: false,
          message: 'Email and OTP code are required'
        });
      }

      const doctor = await Doctor.findByEmail(email);
      if (!doctor) {
        await AuditLog.logSecurityEvent(req, null, 'doctor', email, 'otp_verified', 'failed', 'Doctor not found');
        return res.status(403).json({
          success: false,
          message: 'No doctor account found with this email. Please use the correct login page.'
        });
      }

      const otpResult = await OTP.verify(doctor.id, otp_code, 'login', 'doctor');
      if (!otpResult.valid) {
        await AuditLog.logSecurityEvent(req, doctor.id, 'doctor', email, 'otp_failed', 'failed', 'Invalid or expired OTP');
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired OTP code'
        });
      }

      delete doctor.password_hash;

      const token = jwt.sign(
        {
          id: doctor.id,
          email: doctor.email,
          role: 'doctor',
          type: 'doctor'
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
        doctor.id,
        'doctor',
        tokenHash,
        ipAddress,
        userAgent,
        deviceInfo
      );

      // Log successful login
      await AuditLog.logSecurityEvent(req, doctor.id, 'doctor', email, 'login', 'success');

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          doctor,
          token,
          session: {
            id: session.id,
            expiresAt: session.expires_at
          }
        }
      });

    } catch (error) {
      console.error('Doctor verify OTP error:', error);
      res.status(500).json({
        success: false,
        message: 'Error verifying OTP',
        error: error.message
      });
    }
  }

  /**
   * Doctor Logout
   */
  static async logout(req, res) {
    try {
      const doctorId = req.user.id;
      const sessionId = req.session?.id;

      if (sessionId) {
        await Session.revoke(sessionId, 'User logout');
        await AuditLog.logSecurityEvent(req, doctorId, 'doctor', req.user.email, 'logout', 'success');
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
      const doctorId = req.user.id;

      const sessions = await Session.getUserActiveSessions(doctorId);

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
      const doctorId = req.user.id;
      const limit = parseInt(req.query.limit) || 50;

      const activityLog = await AuditLog.getUserActivity(doctorId, limit);

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
   * Get Doctor Profile
   */
  static async getProfile(req, res) {
    try {
      const doctorId = req.user.id;

      const doctor = await Doctor.findById(doctorId);
      if (!doctor) {
        return res.status(404).json({
          success: false,
          message: 'Doctor not found'
        });
      }

      delete doctor.password_hash;

      res.status(200).json({
        success: true,
        data: doctor
      });

    } catch (error) {
      console.error('Get doctor profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching profile',
        error: error.message
      });
    }
  }

  /**
   * Update Doctor Profile
   */
  static async updateProfile(req, res) {
    try {
      const doctorId = req.user.id;
      const updateData = req.body;

      delete updateData.id;
      delete updateData.password_hash;
      delete updateData.email;
      delete updateData.hpcsa_number;
      delete updateData.created_at;

      const updatedDoctor = await Doctor.update(doctorId, updateData);
      if (!updatedDoctor) {
        return res.status(404).json({
          success: false,
          message: 'Doctor not found'
        });
      }

      delete updatedDoctor.password_hash;

      await AuditLog.logSecurityEvent(req, doctorId, 'doctor', updatedDoctor.email, 'profile_updated', 'success');

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: updatedDoctor
      });

    } catch (error) {
      console.error('Update doctor profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating profile',
        error: error.message
      });
    }
  }

  /**
   * Get nearby doctors by user location
   * Filters doctors within specified radius
   */
  static async getNearbyDoctors(req, res) {
    try {
      const { latitude, longitude, radius = 15 } = req.body;
      const userId = req.user ? req.user.id : null;

      // Validate required location parameters
      if (latitude === undefined || longitude === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Latitude and longitude are required'
        });
      }

      // Validate that coordinates are valid numbers
      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        return res.status(400).json({
          success: false,
          message: 'Latitude and longitude must be valid numbers'
        });
      }

      // Validate latitude range
      if (latitude < -90 || latitude > 90) {
        return res.status(400).json({
          success: false,
          message: 'Latitude must be between -90 and 90'
        });
      }

      // Validate longitude range
      if (longitude < -180 || longitude > 180) {
        return res.status(400).json({
          success: false,
          message: 'Longitude must be between -180 and 180'
        });
      }

      // Validate radius
      if (radius < 1 || radius > 100) {
        return res.status(400).json({
          success: false,
          message: 'Radius must be between 1 and 100 km'
        });
      }

      // Get all active doctors
      const allDoctors = await Doctor.findAll(1000, 0);

      // Filter and calculate distances
      const nearbyDoctors = [];

      for (const doctor of allDoctors) {
        // Skip doctors without location data
        if (!doctor.latitude || !doctor.longitude) {
          continue;
        }

        // Calculate distance using Haversine formula
        const distance = GeolocationService.calculateDistance(
          latitude,
          longitude,
          doctor.latitude,
          doctor.longitude
        );

        // Include if within radius
        if (distance <= radius) {
          nearbyDoctors.push({
            ...doctor,
            distance_km: parseFloat(distance.toFixed(2))
          });
        }
      }

      // Sort by distance (closest first)
      nearbyDoctors.sort((a, b) => a.distance_km - b.distance_km);

      // Remove password hashes
      nearbyDoctors.forEach(doc => {
        delete doc.password_hash;
      });

      // Log search for analytics
      if (userId) {
        await AuditLog.logSecurityEvent(
          req,
          userId,
          'patient',
          req.user.email,
          'nearby_doctors_search',
          'success',
          `Found ${nearbyDoctors.length} doctors within ${radius}km`
        );
      }

      res.status(200).json({
        success: true,
        message: `Found ${nearbyDoctors.length} doctors within ${radius}km`,
        data: {
          user_location: {
            latitude,
            longitude
          },
          radius_km: radius,
          doctors_count: nearbyDoctors.length,
          doctors: nearbyDoctors
        }
      });

    } catch (error) {
      console.error('Get nearby doctors error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching nearby doctors',
        error: error.message
      });
    }
  }
}

module.exports = DoctorController;
