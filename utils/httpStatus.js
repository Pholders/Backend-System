/**
 * HTTP Status Codes and Messages
 * Centralized HTTP status definitions
 */

const HTTP_STATUS = {
  // 2xx Success
  OK: { code: 200, message: 'OK' },
  CREATED: { code: 201, message: 'Created' },
  ACCEPTED: { code: 202, message: 'Accepted' },
  NO_CONTENT: { code: 204, message: 'No Content' },

  // 3xx Redirection
  MOVED_PERMANENTLY: { code: 301, message: 'Moved Permanently' },
  FOUND: { code: 302, message: 'Found' },
  NOT_MODIFIED: { code: 304, message: 'Not Modified' },

  // 4xx Client Error
  BAD_REQUEST: { code: 400, message: 'Bad Request' },
  UNAUTHORIZED: { code: 401, message: 'Unauthorized' },
  FORBIDDEN: { code: 403, message: 'Forbidden' },
  NOT_FOUND: { code: 404, message: 'Not Found' },
  CONFLICT: { code: 409, message: 'Conflict' },
  UNPROCESSABLE_ENTITY: { code: 422, message: 'Unprocessable Entity' },
  TOO_MANY_REQUESTS: { code: 429, message: 'Too Many Requests' },

  // 5xx Server Error
  INTERNAL_SERVER_ERROR: { code: 500, message: 'Internal Server Error' },
  NOT_IMPLEMENTED: { code: 501, message: 'Not Implemented' },
  SERVICE_UNAVAILABLE: { code: 503, message: 'Service Unavailable' },
  GATEWAY_TIMEOUT: { code: 504, message: 'Gateway Timeout' }
};

const ERROR_CODES = {
  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_EMAIL: 'INVALID_EMAIL',
  INVALID_PASSWORD: 'INVALID_PASSWORD',
  MISSING_FIELDS: 'MISSING_FIELDS',
  INVALID_FORMAT: 'INVALID_FORMAT',

  // Authentication errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  SESSION_EXPIRED: 'SESSION_EXPIRED',

  // Authorization errors
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  ROLE_REQUIRED: 'ROLE_REQUIRED',

  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  RESOURCE_ALREADY_EXISTS: 'RESOURCE_ALREADY_EXISTS',
  RESOURCE_DELETED: 'RESOURCE_DELETED',
  INVALID_ID: 'INVALID_ID',

  // Business logic errors
  INVALID_STATE: 'INVALID_STATE',
  OPERATION_NOT_ALLOWED: 'OPERATION_NOT_ALLOWED',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  RATE_LIMITED: 'RATE_LIMITED',

  // Database errors
  DATABASE_ERROR: 'DATABASE_ERROR',
  QUERY_FAILED: 'QUERY_FAILED',
  CONNECTION_ERROR: 'CONNECTION_ERROR',

  // External service errors
  SERVICE_ERROR: 'SERVICE_ERROR',
  EMAIL_SERVICE_ERROR: 'EMAIL_SERVICE_ERROR',
  PAYMENT_SERVICE_ERROR: 'PAYMENT_SERVICE_ERROR',
  EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',

  // Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR'
};

module.exports = {
  HTTP_STATUS,
  ERROR_CODES
};
