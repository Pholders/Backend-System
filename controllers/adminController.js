const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Admin = require('../models/Admin');
const Pharmacy = require('../models/Pharmacy');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const AdminDashboard = require('../models/AdminDashboard');
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
  /**
   * Every pharmacy on the platform.
   *
   * Nothing listed pharmacies before, so the admin directory was assembled
   * from partnership group membership and a pharmacy belonging to no group
   * was invisible. Pharmacy.findAll already existed with nothing routed to
   * it.
   */
  static async listPharmacies(req, res) {
    try {
      const { limit = 100, offset = 0, status } = req.query;
      const pharmacies = await Pharmacy.findAll(parseInt(limit), parseInt(offset));

      const visible = status
        ? pharmacies.filter((p) => p.status === status)
        : pharmacies;

      visible.forEach((p) => { delete p.password_hash; });

      res.status(200).json({
        success: true,
        message: 'Pharmacies retrieved',
        data: { total: visible.length, pharmacies: visible }
      });
    } catch (error) {
      console.error('List pharmacies error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching pharmacies',
        error: error.message
      });
    }
  }

  /**
   * limit/offset/status from the query string, clamped so a bad or huge
   * value can't turn into an unbounded table scan.
   */
  static parseListQuery(q) {
    const limit = Math.min(Math.max(parseInt(q.limit, 10) || 50, 1), 200);
    const offset = Math.max(parseInt(q.offset, 10) || 0, 0);
    const status = typeof q.status === 'string' && q.status.trim() ? q.status.trim() : undefined;
    return { limit, offset, status };
  }

  /**
   * Patient directory. Before this nothing let an admin list patients — the
   * only patient list was GET /doctor/patients, scoped to one doctor — so
   * the admin app could only show sample rows. The model returns list-safe
   * columns only; see User.listForAdmin for what is deliberately left out.
   */
  static async listPatients(req, res) {
    try {
      const opts = AdminController.parseListQuery(req.query);
      const { total, patients } = await User.listForAdmin(opts);

      res.status(200).json({
        success: true,
        message: 'Patients retrieved',
        data: { total, limit: opts.limit, offset: opts.offset, patients }
      });
    } catch (error) {
      console.error('List patients error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching patients',
        error: error.message
      });
    }
  }

  /**
   * Doctor directory. GET /doctors only admits patients, so an admin token
   * was refused there.
   */
  static async listDoctors(req, res) {
    try {
      const opts = AdminController.parseListQuery(req.query);
      const { total, doctors } = await Doctor.listForAdmin(opts);

      res.status(200).json({
        success: true,
        message: 'Doctors retrieved',
        data: { total, limit: opts.limit, offset: opts.offset, doctors }
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
   * Admin dashboard: stat cards, distribution donut and alert tiles.
   * Definitions of each figure live on AdminDashboard.summary.
   */
  static async getDashboardSummary(req, res) {
    try {
      const data = await AdminDashboard.summary();
      res.status(200).json({ success: true, message: 'Dashboard summary retrieved', data });
    } catch (error) {
      console.error('Dashboard summary error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching dashboard summary',
        error: error.message
      });
    }
  }

  /**
   * Admin dashboard: prescriptions and orders per day / month / year.
   */
  static async getDashboardActivity(req, res) {
    const range = req.query.range || 'monthly';
    if (!AdminDashboard.RANGES.includes(range)) {
      return res.status(400).json({
        success: false,
        message: `range must be one of: ${AdminDashboard.RANGES.join(', ')}`
      });
    }

    try {
      const buckets = await AdminDashboard.activity(range);
      res.status(200).json({ success: true, message: 'Dashboard activity retrieved', data: { range, buckets } });
    } catch (error) {
      console.error('Dashboard activity error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching dashboard activity',
        error: error.message
      });
    }
  }

  /**
   * Newest sign-ups across patients, doctors and pharmacies.
   */
  static async getRecentUsers(req, res) {
    const role = req.query.role || 'all';
    if (role !== 'all' && !AdminDashboard.ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `role must be one of: all, ${AdminDashboard.ROLES.join(', ')}`
      });
    }
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);

    try {
      const users = await AdminDashboard.recentUsers({ role: role === 'all' ? undefined : role, limit });
      res.status(200).json({ success: true, message: 'Recent users retrieved', data: { role, users } });
    } catch (error) {
      console.error('Recent users error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching recent users',
        error: error.message
      });
    }
  }

  /**
   * Positive integer from a route param, or null.
   */
  static parseId(raw) {
    return /^[1-9]\d{0,9}$/.test(String(raw)) ? Number(raw) : null;
  }

  /**
   * Admin "View" on a patient. Every view is written to the audit log —
   * this is health-platform data, so who looked at whom should be on record
   * even though the clinical fields are not returned.
   */
  static async getPatient(req, res) {
    const id = AdminController.parseId(req.params.patientId);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid patient id' });

    try {
      const patient = await User.findByIdForAdmin(id);
      if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });

      await AuditLog.logSecurityEvent(
        req, req.user.id, 'admin', req.user.email,
        'patient_record_viewed', 'success', `Viewed patient ${id}`
      );

      res.status(200).json({ success: true, message: 'Patient retrieved', data: patient });
    } catch (error) {
      console.error('Get patient error:', error);
      res.status(500).json({ success: false, message: 'Error fetching patient', error: error.message });
    }
  }

  /**
   * Admin "View" on a doctor.
   */
  static async getDoctor(req, res) {
    const id = AdminController.parseId(req.params.doctorId);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid doctor id' });

    try {
      const doctor = await Doctor.findByIdForAdmin(id);
      if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });
      res.status(200).json({ success: true, message: 'Doctor retrieved', data: doctor });
    } catch (error) {
      console.error('Get doctor error:', error);
      res.status(500).json({ success: false, message: 'Error fetching doctor', error: error.message });
    }
  }

  /**
   * Shared body of the patient and doctor status setters (Verify / Reject /
   * suspend). Login already refuses any status but 'active'; on top of that,
   * moving an account off 'active' revokes its live sessions so the change
   * takes effect now rather than when its token expires.
   */
  static async setAccountStatus(req, res, { kind, idParam, model, findForAdmin }) {
    const ALLOWED = ['active', 'suspended', 'blocked', 'pending'];
    const id = AdminController.parseId(req.params[idParam]);
    const { status } = req.body || {};
    const label = kind.charAt(0).toUpperCase() + kind.slice(1);

    if (!id) return res.status(400).json({ success: false, message: `Invalid ${kind} id` });
    if (!ALLOWED.includes(status)) {
      return res.status(400).json({ success: false, message: `status must be one of: ${ALLOWED.join(', ')}` });
    }

    try {
      const before = await findForAdmin(id);
      if (!before) return res.status(404).json({ success: false, message: `${label} not found` });

      await model.update(id, { status });
      const sessionsRevoked = status === 'active'
        ? 0
        : await Session.revokeAllForUser(id, kind, `Account ${status} by admin`);

      await AuditLog.logSecurityEvent(
        req, req.user.id, 'admin', req.user.email,
        `${kind}_status_changed`, 'success',
        `${label} ${id} ${before.status} -> ${status}`
      );

      const updated = await findForAdmin(id);
      res.status(200).json({
        success: true,
        message: `${label} ${status}`,
        data: { ...updated, sessions_revoked: sessionsRevoked }
      });
    } catch (error) {
      console.error(`Set ${kind} status error:`, error);
      res.status(500).json({ success: false, message: `Error updating ${kind} status`, error: error.message });
    }
  }

  static async setPatientStatus(req, res) {
    return AdminController.setAccountStatus(req, res, {
      kind: 'patient',
      idParam: 'patientId',
      model: User,
      findForAdmin: (id) => User.findByIdForAdmin(id)
    });
  }

  static async setDoctorStatus(req, res) {
    return AdminController.setAccountStatus(req, res, {
      kind: 'doctor',
      idParam: 'doctorId',
      model: Doctor,
      findForAdmin: (id) => Doctor.findByIdForAdmin(id)
    });
  }

  /**
   * Approve, suspend or block a pharmacy.
   *
   * Phase 1 asks for a pharmacy partnership network, which means somebody has
   * to admit a pharmacy to it and remove one that misbehaves. Nothing wrote
   * pharmacies.status, so the controls were taken out of the admin app rather
   * than left decorative.
   */
  static async setPharmacyStatus(req, res) {
    const ALLOWED = ['active', 'suspended', 'blocked', 'pending'];
    try {
      const { pharmacyId } = req.params;
      const { status } = req.body;

      if (!ALLOWED.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `status must be one of: ${ALLOWED.join(', ')}`
        });
      }

      const pharmacy = await Pharmacy.findById(pharmacyId);
      if (!pharmacy) {
        return res.status(404).json({
          success: false,
          message: 'Pharmacy not found'
        });
      }

      const updated = await Pharmacy.update(pharmacyId, { status });
      if (updated) delete updated.password_hash;

      await AuditLog.logSecurityEvent(
        req,
        req.user.id,
        'admin',
        req.user.email,
        'pharmacy_status_changed',
        'success',
        `Pharmacy ${pharmacyId} ${pharmacy.status} -> ${status}`
      );

      res.status(200).json({
        success: true,
        message: `Pharmacy ${status}`,
        data: updated
      });
    } catch (error) {
      console.error('Set pharmacy status error:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating pharmacy status',
        error: error.message
      });
    }
  }

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
