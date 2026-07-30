const ResponseFormatter = require('../utils/responseFormatter');
const { ErrorHandler } = require('../utils/errorHandler');
const logger = require('../services/loggerService');

/**
 * Global Error Handling Middleware
 * Catches all errors and formats responses consistently
 */

const errorHandler = (err, req, res, next) => {
  // Log the error
  logger.error('Unhandled Error', err, {
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id,
    userType: req.user?.type
  });

  // Handle the error
  const { statusCode, body } = ErrorHandler.handle(err, req);

  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Send response
  res.status(statusCode).json(body);
};

/**
 * 404 Not Found Middleware
 * Must be placed at the end of all routes
 */

const notFoundHandler = (req, res) => {
  logger.warn('Route Not Found', {
    method: req.method,
    path: req.path,
    ip: req.ip
  });

  res.status(404).json(ResponseFormatter.notFound(
    `Route ${req.method} ${req.path} not found`
  ));
};

/**
 * Request Logging Middleware
 * Logs all incoming requests
 */

const requestLogger = (req, res, next) => {
  const start = Date.now();

  // Capture response end
  const originalSend = res.send;
  res.send = function (data) {
    const duration = Date.now() - start;
    res.setHeader('X-Response-Time', `${duration}ms`);

    logger.info('HTTP Response', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userId: req.user?.id
    });

    return originalSend.call(this, data);
  };

  next();
};

/**
 * Async Handler Wrapper
 * Automatically catches errors in async route handlers
 */

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Input Validation Middleware Factory
 */

const validateInput = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        type: detail.type
      }));

      return res.status(422).json(ResponseFormatter.validationError(
        errors,
        'Input validation failed'
      ));
    }

    req.validatedBody = value;
    next();
  };
};

module.exports = {
  errorHandler,
  notFoundHandler,
  requestLogger,
  asyncHandler,
  validateInput
};
