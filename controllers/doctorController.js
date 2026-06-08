const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query, pool } = require('../config/db');
const Doctor = require('../models/Doctor');
const OTP = require('../models/OTP');
const Session = require('../models/Session');
const AuditLog = require('../models/AuditLog');
const PasswordValidator = require('../utils/passwordValidator');
const emailService = require('../services/emailService');
const GeolocationService = require('../services/geolocationService');
const GeocodingService = require('../services/geocodingService');

/**
 * Build a display-ready doctor name with the "Dr" title prefix.
 * Every row in the doctors table is a doctor, so the prefix is implicit
 * and we don't store it in the database.
 */
function buildDisplayName(doctor) {
  const first = (doctor.first_name || '').trim();
  const last = (doctor.last_name || '').trim();
  const full = `${first} ${last}`.trim();
  return full ? `Dr ${full}` : null;
}

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
      const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'] || 'unknown';
      const deviceId = req.headers['x-device-id'] || crypto.randomBytes(16).toString('hex');
      const deviceFingerprint = req.headers['x-device-fingerprint'] || crypto.randomBytes(32).toString('hex');

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

      // ✅ Generate JWT token for authentication (24 hours)
      const token = jwt.sign(
        {
          id: doctor.id,
          email: doctor.email,
          role: 'doctor',
          firstName: doctor.first_name,
          lastName: doctor.last_name
        },
        process.env.JWT_SECRET || 'jwtSecret',
        { expiresIn: '24h' }
      );

      // ✅ Create session with token hash
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
        message: 'Login successful. You can now sign prescriptions.',
        data: {
          token,
          doctorId: doctor.id,
          firstName: doctor.first_name,
          lastName: doctor.last_name,
          email: doctor.email,
          hpcsaNumber: doctor.hpcsa_number,
          sessionInfo: {
            expiresIn: '8 hours',
            canSignPrescriptions: true,
            createdAt: new Date().toISOString()
          }
        }
      });

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
      const sessionId = req.authSession?.id;

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

  /**
   * GET /doctors
   *
   * Public doctor listing for the patient "Find doctors near you" screen.
   * Patient sends their current GPS coordinates as query params and we
   * return active doctors sorted by distance, with optional specialty,
   * max-fee and radius filters plus pagination.
   *
   * Query params:
   *   lat         (required, number)  - patient latitude
   *   lng         (required, number)  - patient longitude
   *   radius_km   (optional, number)  - default 5, max 100
   *   specialty   (optional, string)  - matches doctors.specialization
   *   max_fee     (optional, number)  - max consultation_fee (inclusive)
   *   page        (optional, int)     - default 1
   *   limit       (optional, int)     - default 20, max 100
   */
  static async listDoctors(req, res) {
    try {
      const lat = parseFloat(req.query.lat);
      const lng = parseFloat(req.query.lng);
      const radiusKm = req.query.radius_km !== undefined ? parseFloat(req.query.radius_km) : 5;
      const specialty = req.query.specialty ? String(req.query.specialty).trim() : null;
      const maxFee = req.query.max_fee !== undefined ? parseFloat(req.query.max_fee) : null;
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

      // Validate coordinates
      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        return res.status(400).json({
          success: false,
          message: 'lat and lng query parameters are required and must be numbers'
        });
      }
      if (lat < -90 || lat > 90) {
        return res.status(400).json({
          success: false,
          message: 'lat must be between -90 and 90'
        });
      }
      if (lng < -180 || lng > 180) {
        return res.status(400).json({
          success: false,
          message: 'lng must be between -180 and 180'
        });
      }
      if (Number.isNaN(radiusKm) || radiusKm < 1 || radiusKm > 100) {
        return res.status(400).json({
          success: false,
          message: 'radius_km must be a number between 1 and 100'
        });
      }
      if (maxFee !== null && (Number.isNaN(maxFee) || maxFee < 0)) {
        return res.status(400).json({
          success: false,
          message: 'max_fee must be a non-negative number'
        });
      }

      // Fetch a generous batch of active doctors with location data and
      // filter/sort in memory. We do not enable PostGIS so distance must be
      // computed in app code via the Haversine formula. The DB-side
      // specialty/fee filter keeps the working set small.
      const params = ['active'];
      let whereSql = `WHERE status = $1
        AND latitude IS NOT NULL
        AND longitude IS NOT NULL`;

      if (specialty) {
        params.push(specialty);
        whereSql += ` AND specialization ILIKE $${params.length}`;
      }
      if (maxFee !== null) {
        params.push(maxFee);
        whereSql += ` AND consultation_fee IS NOT NULL AND consultation_fee <= $${params.length}`;
      }

      const result = await query(
        `SELECT * FROM doctors ${whereSql} ORDER BY created_at DESC`,
        params
      );

      // Compute distance and apply radius filter
      const withinRadius = [];
      for (const doctor of result.rows) {
        const distance = GeolocationService.calculateDistance(
          lat,
          lng,
          parseFloat(doctor.latitude),
          parseFloat(doctor.longitude)
        );
        if (distance <= radiusKm) {
          delete doctor.password_hash;
          withinRadius.push({
            ...doctor,
            display_name: buildDisplayName(doctor),
            distance_km: parseFloat(distance.toFixed(2))
          });
        }
      }

      // Sort by distance (closest first)
      withinRadius.sort((a, b) => a.distance_km - b.distance_km);

      // Paginate
      const total = withinRadius.length;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const offset = (page - 1) * limit;
      const pageItems = withinRadius.slice(offset, offset + limit);

      res.status(200).json({
        success: true,
        data: {
          doctors: pageItems,
          pagination: {
            page,
            limit,
            total,
            total_pages: totalPages,
            has_next: page < totalPages,
            has_prev: page > 1
          },
          filters: {
            lat,
            lng,
            radius_km: radiusKm,
            specialty: specialty || null,
            max_fee: maxFee
          }
        }
      });
    } catch (error) {
      console.error('List doctors error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching doctors',
        error: error.message
      });
    }
  }

  /**
   * GET /doctors/:id
   *
   * Returns the full public profile for a single doctor, used by the
   * Doctor Details screen. No location math; the patient already picked
   * this doctor from the list.
   */
  static async getDoctorById(req, res) {
    try {
      const { id } = req.params;
      const doctorId = parseInt(id, 10);

      if (!doctorId || Number.isNaN(doctorId)) {
        return res.status(400).json({
          success: false,
          message: 'Valid doctor id is required'
        });
      }

      const doctor = await Doctor.findById(doctorId);
      if (!doctor || doctor.status !== 'active') {
        return res.status(404).json({
          success: false,
          message: 'Doctor not found'
        });
      }

      delete doctor.password_hash;
      doctor.display_name = buildDisplayName(doctor);

      res.status(200).json({
        success: true,
        data: doctor
      });
    } catch (error) {
      console.error('Get doctor by id error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching doctor',
        error: error.message
      });
    }
  }

  /**
   * Verify OTP for Email Verification (Account Activation)
   * Doctor-specific OTP verification endpoint
   */
  static async verifyEmail(req, res) {
    try {
      const { email, otp_code } = req.body;

      if (!email || !otp_code) {
        await AuditLog.logSecurityEvent(req, null, 'doctor', email, 'email_verification', 'failed', 'Missing email or code');
        return res.status(400).json({
          success: false,
          message: 'Email and verification code are required'
        });
      }

      const doctor = await Doctor.findByEmail(email);
      if (!doctor) {
        await AuditLog.logSecurityEvent(req, null, 'doctor', email, 'email_verification', 'failed', 'Doctor not found');
        // Generic response to prevent account enumeration
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired verification code'
        });
      }

      // Idempotent: already verified
      if (doctor.email_verified === true) {
        return res.status(200).json({
          success: true,
          message: 'Email is already verified. You can log in.',
          data: { email: doctor.email, alreadyVerified: true }
        });
      }

      const otpResult = await OTP.verify(doctor.id, otp_code, 'email_verification', 'doctor');
      if (!otpResult || !otpResult.valid) {
        await AuditLog.logSecurityEvent(req, doctor.id, 'doctor', email, 'email_verification', 'failed', 'Invalid or expired code');
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired verification code'
        });
      }

      await Doctor.markEmailVerified(doctor.id);
      await AuditLog.logSecurityEvent(req, doctor.id, 'doctor', email, 'email_verification', 'success');

      return res.status(200).json({
        success: true,
        message: 'Email verified successfully. You can now log in.',
        data: {
          email: doctor.email,
          email_verified: true
        }
      });
    } catch (error) {
      console.error('Doctor verify email error:', error);
      res.status(500).json({
        success: false,
        message: 'Error verifying email',
        error: error.message
      });
    }
  }

  /**
   * Resend Email Verification Code (OTP)
   * Doctor-specific resend verification endpoint
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

      const doctor = await Doctor.findByEmail(email);

      // Don't reveal whether the account exists or its verification state
      if (!doctor || doctor.email_verified === true) {
        return res.status(200).json(genericResponse);
      }

      // Rate-limit: reject if a code was issued in the last 60 seconds
      const latest = await OTP.getLatest(doctor.id, 'email_verification', 'doctor');
      if (latest) {
        const ageSeconds = (Date.now() - new Date(latest.created_at).getTime()) / 1000;
        if (ageSeconds < 60) {
          await AuditLog.logSecurityEvent(req, doctor.id, 'doctor', email, 'email_verification_resend', 'failed', 'Rate limited');
          return res.status(429).json({
            success: false,
            message: `Please wait ${Math.ceil(60 - ageSeconds)} seconds before requesting another code.`
          });
        }
      }

      const otpRecord = await OTP.create(doctor.id, 'email_verification', 'doctor', 15);
      await AuditLog.logSecurityEvent(req, doctor.id, 'doctor', email, 'email_verification_resend', 'success');

      try {
        await emailService.sendVerificationOTP(doctor.email, otpRecord.otp_code, doctor.first_name);
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
      console.error('Doctor resend verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Error resending verification code',
        error: error.message
      });
    }
  }

  /**
   * Get doctor availability time slots for a specific date
   * GET /doctors/:doctorId/availability?date=YYYY-MM-DD
   */
  static async getAvailability(req, res) {
    try {
      const { doctorId } = req.params;
      const { date } = req.query;

      // Validate required parameters
      if (!doctorId || !date) {
        return res.status(400).json({
          success: false,
          message: 'Missing required parameters: doctorId (path), date (query)',
          required: { doctorId: 'integer', date: 'YYYY-MM-DD' }
        });
      }

      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format. Use YYYY-MM-DD'
        });
      }

      // Validate date is today or in the future
      const selectedDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (selectedDate < today) {
        return res.status(400).json({
          success: false,
          message: 'Cannot check appointments for past dates'
        });
      }

      // Verify doctor exists and is active
      const doctor = await Doctor.findById(parseInt(doctorId));
      if (!doctor) {
        return res.status(404).json({
          success: false,
          message: 'Doctor not found'
        });
      }

      if (doctor.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: 'Doctor is not available'
        });
      }

      // Get availability for all time periods
      const Appointment = require('../models/Appointment');
      const availability = await Appointment.getDayAvailability(doctorId, date);

      res.json({
        success: true,
        message: 'Doctor availability retrieved successfully',
        data: {
          doctorId: parseInt(doctorId),
          doctorName: `Dr ${doctor.first_name} ${doctor.last_name}`,
          date,
          availability,
          summary: {
            periodStatus: Object.entries(availability).map(([period, data]) => ({
              period: period.charAt(0).toUpperCase() + period.slice(1),
              available: !data.isFullyBooked,
              availableSlots: data.availableSlots,
              totalSlots: data.totalSlots
            }))
          }
        }
      });
    } catch (error) {
      console.error('Error getting doctor availability:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving doctor availability',
        error: error.message
      });
    }
  }
}

module.exports = DoctorController;
