const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Doctor = require('../models/Doctor');
const OTP = require('../models/OTP');
const emailService = require('../services/emailService');

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
        province
      } = req.body;

      // Validate required fields
      if (!first_name || !last_name || !email || !phone || !password || !hpcsa_number || !specialization || !experience || !clinic_name || !city || !province) {
        return res.status(400).json({
          success: false,
          message: 'All fields are required: first_name, last_name, email, phone, password, hpcsa_number, specialization, experience, clinic_name, city, province'
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
      const existingDoctor = await Doctor.findByEmail(email);
      if (existingDoctor) {
        return res.status(409).json({
          success: false,
          message: 'Email already registered'
        });
      }

      // Check if HPCSA number already exists
      const existingHpcsa = await Doctor.findByHpcsaNumber(hpcsa_number);
      if (existingHpcsa) {
        return res.status(409).json({
          success: false,
          message: 'HPCSA number already registered'
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
        password_hash
      });

      delete newDoctor.password_hash;

      res.status(201).json({
        success: true,
        message: 'Doctor registered successfully',
        data: { doctor: newDoctor }
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
        return res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
      }

      const doctor = await Doctor.findByEmail(email);
      if (!doctor) {
        return res.status(403).json({
          success: false,
          message: 'No doctor account found with this email. Please use the correct login page.'
        });
      }

      if (doctor.status !== 'active') {
        return res.status(403).json({
          success: false,
          message: 'Account is inactive. Please contact support.'
        });
      }

      const isPasswordValid = await bcrypt.compare(password, doctor.password_hash);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Generate and send OTP
      const otpRecord = await OTP.create(doctor.id, 'login', 'doctor');

      const isDevelopment = process.env.NODE_ENV === 'development';
      let emailSent = false;

      try {
        await emailService.sendOTP(doctor.email, otpRecord.otp_code, doctor.first_name);
        emailSent = true;
        console.log('✅ OTP email sent to doctor successfully');
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

      if (!email || !otp_code) {
        return res.status(400).json({
          success: false,
          message: 'Email and OTP code are required'
        });
      }

      const doctor = await Doctor.findByEmail(email);
      if (!doctor) {
        return res.status(403).json({
          success: false,
          message: 'No doctor account found with this email. Please use the correct login page.'
        });
      }

      const otpResult = await OTP.verify(doctor.id, otp_code, 'login', 'doctor');
      if (!otpResult.valid) {
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

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: { doctor, token }
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

      // Remove fields that shouldn't be updated directly
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
}

module.exports = DoctorController;
