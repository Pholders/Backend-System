const ResponseFormatter = require('./responseFormatter');
const { ERROR_CODES, HTTP_STATUS } = require('./httpStatus');

/**
 * Custom Application Error Classes
 */

class AppError extends Error {
  constructor(message, statusCode = 500, code = ERROR_CODES.INTERNAL_ERROR, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      success: false,
      statusCode: this.statusCode,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp
    };
  }
}

class ValidationError extends AppError {
  constructor(message = 'Validation failed', errors = null) {
    super(message, 422, ERROR_CODES.VALIDATION_ERROR);
    this.errors = errors;
  }

  toJSON() {
    const response = super.toJSON();
    if (this.errors) {
      response.errors = Array.isArray(this.errors) ? this.errors : [this.errors];
    }
    return response;
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed', code = ERROR_CODES.INVALID_CREDENTIALS) {
    super(message, 401, code);
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Access denied', code = ERROR_CODES.INSUFFICIENT_PERMISSIONS) {
    super(message, 403, code);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found', resource = null) {
    super(message, 404, ERROR_CODES.NOT_FOUND);
    this.resource = resource;
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource conflict', code = ERROR_CODES.RESOURCE_ALREADY_EXISTS) {
    super(message, 409, code);
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Too many requests', retryAfter = 60) {
    super(message, 429, ERROR_CODES.RATE_LIMITED);
    this.retryAfter = retryAfter;
  }

  toJSON() {
    const response = super.toJSON();
    response.retryAfter = this.retryAfter;
    return response;
  }
}

class DatabaseError extends AppError {
  constructor(message = 'Database error', originalError = null) {
    super(message, 500, ERROR_CODES.DATABASE_ERROR);
    this.originalError = originalError;
  }
}

class ExternalServiceError extends AppError {
  constructor(message = 'External service error', service = null, statusCode = 503) {
    super(message, statusCode, ERROR_CODES.SERVICE_ERROR);
    this.service = service;
  }
}

class PaymentError extends AppError {
  constructor(message = 'Payment failed', code = ERROR_CODES.PAYMENT_SERVICE_ERROR) {
    super(message, 402, code);
  }
}

/**
 * Error Handler Utility
 */

class ErrorHandler {
  /**
   * Handle and format error
   */
  static handle(error, req = null, res = null) {
    console.error('❌ Error:', {
      message: error.message,
      code: error.code || 'UNKNOWN',
      statusCode: error.statusCode || 500,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      path: req?.path,
      method: req?.method,
      ip: req?.ip
    });

    // If it's already an AppError, use it as-is
    if (error instanceof AppError) {
      return {
        statusCode: error.statusCode,
        body: error.toJSON()
      };
    }

    // Handle specific error types
    if (error.name === 'ValidationError') {
      return {
        statusCode: 422,
        body: ResponseFormatter.validationError(error.message || 'Validation failed')
      };
    }

    if (error.name === 'JsonWebTokenError') {
      return {
        statusCode: 401,
        body: ResponseFormatter.error(
          'Invalid token',
          ERROR_CODES.INVALID_TOKEN,
          401
        )
      };
    }

    if (error.name === 'TokenExpiredError') {
      return {
        statusCode: 401,
        body: ResponseFormatter.error(
          'Token expired',
          ERROR_CODES.TOKEN_EXPIRED,
          401
        )
      };
    }

    if (error.code === 'ENOENT') {
      return {
        statusCode: 404,
        body: ResponseFormatter.notFound('File not found')
      };
    }

    if (error.code === 'EACCES') {
      return {
        statusCode: 403,
        body: ResponseFormatter.forbidden('Permission denied')
      };
    }

    // Database errors
    if (error.code === '23505') { // Unique violation
      return {
        statusCode: 409,
        body: ResponseFormatter.error(
          'Resource already exists',
          ERROR_CODES.RESOURCE_ALREADY_EXISTS,
          409
        )
      };
    }

    if (error.code === '23503') { // Foreign key violation
      return {
        statusCode: 409,
        body: ResponseFormatter.error(
          'Related resource not found',
          ERROR_CODES.CONFLICT,
          409
        )
      };
    }

    // Default to 500 internal server error
    return {
      statusCode: 500,
      body: ResponseFormatter.error(
        process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
        ERROR_CODES.INTERNAL_ERROR,
        500
      )
    };
  }

  /**
   * Wrap async route handler
   * Catches errors and passes to error middleware
   */
  static asyncHandler(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  /**
   * Validate required fields
   */
  static validateRequired(data, fields, customMessage = null) {
    const missing = fields.filter(field => !data[field]);
    
    if (missing.length > 0) {
      throw new ValidationError(
        customMessage || `Missing required fields: ${missing.join(', ')}`
      );
    }
  }

  /**
   * Validate email format
   */
  static validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ValidationError('Invalid email format', [{ field: 'email', message: 'Invalid email format' }]);
    }
  }

  /**
   * Validate password strength
   */
  static validatePassword(password, minLength = 8) {
    if (password.length < minLength) {
      throw new ValidationError('Password too short', [
        { field: 'password', message: `Password must be at least ${minLength} characters long` }
      ]);
    }
  }

  /**
   * Validate positive number
   */
  static validatePositive(value, fieldName = 'value') {
    const num = Number(value);
    if (isNaN(num) || num <= 0) {
      throw new ValidationError(`Invalid ${fieldName}`, [
        { field: fieldName, message: `${fieldName} must be a positive number` }
      ]);
    }
    return num;
  }

  /**
   * Validate ID (positive integer)
   */
  static validateId(id, fieldName = 'id') {
    const num = Number(id);
    if (!Number.isInteger(num) || num <= 0) {
      throw new NotFoundError(`Invalid ${fieldName}`);
    }
    return num;
  }
}

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  DatabaseError,
  ExternalServiceError,
  PaymentError,
  ErrorHandler
};
