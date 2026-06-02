const { ValidationError, ErrorHandler } = require('./errorHandler');
const CONSTANTS = require('./constants');

/**
 * Input Validation Utilities
 * Centralized validation logic
 */

class Validator {
  /**
   * Validate email
   */
  static email(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ValidationError('Invalid email format', [
        { field: 'email', message: 'Email must be a valid email address' }
      ]);
    }
    return email.toLowerCase();
  }

  /**
   * Validate password strength
   */
  static password(password) {
    const minLength = CONSTANTS.PASSWORD.MIN_LENGTH;
    const errors = [];

    if (password.length < minLength) {
      errors.push(`Password must be at least ${minLength} characters long`);
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain lowercase letters');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain uppercase letters');
    }
    if (!/\d/.test(password)) {
      errors.push('Password must contain numbers');
    }
    if (!/[@$!%*?&]/.test(password)) {
      errors.push('Password must contain special characters (@$!%*?&)');
    }

    if (errors.length > 0) {
      throw new ValidationError('Password does not meet security requirements', 
        errors.map((msg, idx) => ({ field: 'password', message: msg }))
      );
    }

    return password;
  }

  /**
   * Validate string length
   */
  static string(value, min = 1, max = 255, fieldName = 'field') {
    if (typeof value !== 'string') {
      throw new ValidationError(`${fieldName} must be a string`, [
        { field: fieldName, message: `${fieldName} must be a string` }
      ]);
    }

    if (value.trim().length < min) {
      throw new ValidationError(`${fieldName} is too short`, [
        { field: fieldName, message: `${fieldName} must be at least ${min} characters long` }
      ]);
    }

    if (value.length > max) {
      throw new ValidationError(`${fieldName} is too long`, [
        { field: fieldName, message: `${fieldName} must not exceed ${max} characters` }
      ]);
    }

    return value.trim();
  }

  /**
   * Validate number
   */
  static number(value, min = null, max = null, fieldName = 'field') {
    const num = Number(value);

    if (isNaN(num)) {
      throw new ValidationError(`${fieldName} must be a number`, [
        { field: fieldName, message: `${fieldName} must be a valid number` }
      ]);
    }

    if (min !== null && num < min) {
      throw new ValidationError(`${fieldName} is too small`, [
        { field: fieldName, message: `${fieldName} must be at least ${min}` }
      ]);
    }

    if (max !== null && num > max) {
      throw new ValidationError(`${fieldName} is too large`, [
        { field: fieldName, message: `${fieldName} must not exceed ${max}` }
      ]);
    }

    return num;
  }

  /**
   * Validate positive integer
   */
  static positiveInteger(value, fieldName = 'field') {
    const num = this.number(value, 1, Number.MAX_SAFE_INTEGER, fieldName);
    if (!Number.isInteger(num)) {
      throw new ValidationError(`${fieldName} must be an integer`, [
        { field: fieldName, message: `${fieldName} must be an integer` }
      ]);
    }
    return num;
  }

  /**
   * Validate phone number
   */
  static phone(phone) {
    const phoneRegex = /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/;
    if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
      throw new ValidationError('Invalid phone number format', [
        { field: 'phone', message: 'Please enter a valid phone number' }
      ]);
    }
    return phone;
  }

  /**
   * Validate URL
   */
  static url(url) {
    try {
      new URL(url);
      return url;
    } catch (error) {
      throw new ValidationError('Invalid URL format', [
        { field: 'url', message: 'URL must be valid' }
      ]);
    }
  }

  /**
   * Validate date
   */
  static date(dateString, fieldName = 'date') {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new ValidationError(`Invalid ${fieldName}`, [
        { field: fieldName, message: `${fieldName} must be a valid date` }
      ]);
    }
    return date;
  }

  /**
   * Validate future date
   */
  static futureDate(dateString, fieldName = 'date') {
    const date = this.date(dateString, fieldName);
    if (date <= new Date()) {
      throw new ValidationError(`${fieldName} must be in the future`, [
        { field: fieldName, message: `${fieldName} must be a future date` }
      ]);
    }
    return date;
  }

  /**
   * Validate array
   */
  static array(value, minLength = 0, maxLength = null, fieldName = 'field') {
    if (!Array.isArray(value)) {
      throw new ValidationError(`${fieldName} must be an array`, [
        { field: fieldName, message: `${fieldName} must be an array` }
      ]);
    }

    if (value.length < minLength) {
      throw new ValidationError(`${fieldName} has too few items`, [
        { field: fieldName, message: `${fieldName} must have at least ${minLength} items` }
      ]);
    }

    if (maxLength !== null && value.length > maxLength) {
      throw new ValidationError(`${fieldName} has too many items`, [
        { field: fieldName, message: `${fieldName} must not have more than ${maxLength} items` }
      ]);
    }

    return value;
  }

  /**
   * Validate enum/choice
   */
  static enum(value, allowedValues, fieldName = 'field') {
    if (!allowedValues.includes(value)) {
      throw new ValidationError(`Invalid ${fieldName}`, [
        { 
          field: fieldName, 
          message: `${fieldName} must be one of: ${allowedValues.join(', ')}` 
        }
      ]);
    }
    return value;
  }

  /**
   * Validate role
   */
  static role(value) {
    return this.enum(value, Object.values(CONSTANTS.ROLES), 'role');
  }

  /**
   * Validate appointment status
   */
  static appointmentStatus(value) {
    return this.enum(value, Object.values(CONSTANTS.APPOINTMENT_STATUS), 'status');
  }

  /**
   * Validate payment status
   */
  static paymentStatus(value) {
    return this.enum(value, Object.values(CONSTANTS.PAYMENT_STATUS), 'status');
  }

  /**
   * Validate required fields
   */
  static required(data, fields) {
    const missing = [];
    
    fields.forEach(field => {
      if (data[field] === undefined || data[field] === null || data[field] === '') {
        missing.push(field);
      }
    });

    if (missing.length > 0) {
      throw new ValidationError('Missing required fields', 
        missing.map(field => ({
          field,
          message: `${field} is required`
        }))
      );
    }
  }

  /**
   * Validate pagination parameters
   */
  static pagination(page, limit) {
    const p = this.positiveInteger(page, 'page');
    const l = this.positiveInteger(limit, 'limit');

    const maxLimit = CONSTANTS.PAGINATION.MAX_LIMIT;
    if (l > maxLimit) {
      throw new ValidationError('Limit exceeds maximum', [
        { field: 'limit', message: `Limit must not exceed ${maxLimit}` }
      ]);
    }

    return { page: p, limit: l };
  }

  /**
   * Validate file
   */
  static file(file, allowedTypes = null, maxSize = CONSTANTS.RATE_LIMIT.FILE_UPLOAD_SIZE_BYTES) {
    if (!file) {
      throw new ValidationError('File is required', [
        { field: 'file', message: 'File must be provided' }
      ]);
    }

    if (file.size > maxSize) {
      throw new ValidationError('File is too large', [
        { 
          field: 'file', 
          message: `File must not exceed ${Math.round(maxSize / 1024 / 1024)}MB` 
        }
      ]);
    }

    if (allowedTypes && !allowedTypes.includes(file.mimetype)) {
      throw new ValidationError('Invalid file type', [
        { 
          field: 'file', 
          message: `File type must be one of: ${allowedTypes.join(', ')}` 
        }
      ]);
    }

    return file;
  }

  /**
   * Sanitize string (remove dangerous characters)
   */
  static sanitize(value) {
    if (typeof value !== 'string') return value;
    return value
      .replace(/[<>]/g, '') // Remove < and >
      .trim();
  }

  /**
   * Sanitize object (sanitize all string properties)
   */
  static sanitizeObject(obj) {
    const sanitized = {};
    Object.keys(obj).forEach(key => {
      sanitized[key] = typeof obj[key] === 'string' ? this.sanitize(obj[key]) : obj[key];
    });
    return sanitized;
  }
}

module.exports = Validator;
