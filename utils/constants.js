/**
 * Application Constants
 * Centralized constants for the entire application
 */

const CONSTANTS = {
  // Pagination
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
    MIN_LIMIT: 1
  },

  // Password
  PASSWORD: {
    MIN_LENGTH: 8,
    SALT_ROUNDS: 10,
    REGEX: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/
  },

  // OTP
  OTP: {
    LENGTH: 6,
    EXPIRY_MINUTES: 15,
    MAX_ATTEMPTS: 5,
    RATE_LIMIT_SECONDS: 60
  },

  // JWT
  JWT: {
    ACCESS_TOKEN_EXPIRY: '24h',
    REFRESH_TOKEN_EXPIRY: '30d',
    TEMP_TOKEN_EXPIRY: '24h'
  },

  // Sessions
  SESSION: {
    MAX_AGE_MS: 24 * 60 * 60 * 1000, // 24 hours
    ACTIVITY_TIMEOUT_MS: 30 * 60 * 1000 // 30 minutes
  },

  // Cache
  CACHE: {
    DEFAULT_TTL: 1800, // 30 minutes
    USER_TTL: 1800,
    SESSION_TTL: 86400, // 24 hours
    OTP_TTL: 900 // 15 minutes
  },

  // Rate Limits
  RATE_LIMIT: {
    LOGIN_ATTEMPTS: 5,
    LOGIN_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    OTP_REQUESTS: 3,
    OTP_WINDOW_MS: 60 * 60 * 1000, // 1 hour
    API_REQUESTS_PER_MINUTE: 60,
    FILE_UPLOAD_SIZE_MB: 10,
    FILE_UPLOAD_SIZE_BYTES: 10 * 1024 * 1024
  },

  // User Roles
  ROLES: {
    PATIENT: 'patient',
    DOCTOR: 'doctor',
    PHARMACY: 'pharmacy',
    ADMIN: 'admin'
  },

  // User Status
  USER_STATUS: {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    SUSPENDED: 'suspended',
    DELETED: 'deleted',
    PENDING: 'pending'
  },

  // Appointment Status
  APPOINTMENT_STATUS: {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    RESCHEDULED: 'rescheduled',
    ACCEPTED: 'accepted',
    DECLINED: 'declined'
  },

  // Payment Status
  PAYMENT_STATUS: {
    PENDING: 'pending',
    COMPLETED: 'completed',
    FAILED: 'failed',
    REFUNDED: 'refunded',
    CANCELLED: 'cancelled'
  },

  // Prescription Status
  PRESCRIPTION_STATUS: {
    PENDING: 'pending',
    DISPENSED: 'dispensed',
    EXPIRED: 'expired',
    CANCELLED: 'cancelled'
  },

  // Audit Actions
  AUDIT_ACTIONS: {
    LOGIN: 'login',
    LOGOUT: 'logout',
    SIGNUP: 'signup',
    PASSWORD_RESET: 'password_reset',
    EMAIL_VERIFIED: 'email_verified',
    PROFILE_UPDATED: 'profile_updated',
    ACCOUNT_DELETED: 'account_deleted',
    APPOINTMENT_CREATED: 'appointment_created',
    APPOINTMENT_UPDATED: 'appointment_updated',
    APPOINTMENT_CANCELLED: 'appointment_cancelled',
    PAYMENT_CREATED: 'payment_created',
    PRESCRIPTION_DISPENSED: 'prescription_dispensed'
  },

  // File Types
  FILE_TYPES: {
    ALLOWED_DOCUMENTS: ['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
    ALLOWED_IMAGES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    DOCUMENT_MIME: 'application/pdf'
  },

  // Email Templates
  EMAIL_TEMPLATES: {
    VERIFICATION_OTP: 'verification_otp',
    PASSWORD_RESET: 'password_reset',
    APPOINTMENT_CONFIRMED: 'appointment_confirmed',
    APPOINTMENT_REMINDER: 'appointment_reminder',
    PAYMENT_RECEIPT: 'payment_receipt',
    PRESCRIPTION_READY: 'prescription_ready'
  },

  // Geolocation
  GEOLOCATION: {
    DEFAULT_RADIUS_KM: 15,
    MAX_RADIUS_KM: 50,
    TIMEZONE_OFFSET_HOURS: 2 // UTC+2 for South Africa
  },

  // Security
  SECURITY: {
    BCRYPT_ROUNDS: 10,
    TOKEN_LENGTH: 32,
    SESSION_ID_LENGTH: 32,
    MAX_LOGIN_ATTEMPTS: 5,
    LOCKOUT_DURATION_MS: 15 * 60 * 1000 // 15 minutes
  },

  // HTTP
  HTTP: {
    TIMEOUT_MS: 30000, // 30 seconds
    MAX_RETRIES: 3
  },

  // Database
  DATABASE: {
    POOL_SIZE: 20,
    IDLE_TIMEOUT_MS: 30000,
    CONNECTION_TIMEOUT_MS: 10000
  },

  // Notifications
  NOTIFICATION: {
    TYPES: {
      EMAIL: 'email',
      SMS: 'sms',
      PUSH: 'push',
      IN_APP: 'in_app'
    },
    STATUS: {
      PENDING: 'pending',
      SENT: 'sent',
      FAILED: 'failed'
    }
  }
};

module.exports = CONSTANTS;
