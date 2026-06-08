const { HTTP_STATUS, ERROR_CODES } = require('./httpStatus');

/**
 * Standardized API Response Formatter
 * Ensures consistent response format across all endpoints
 */

class ResponseFormatter {
  /**
   * Format success response
   */
  static success(data = null, message = 'Request successful', statusCode = 200) {
    return {
      success: true,
      statusCode,
      message,
      data,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Format error response
   */
  static error(
    message = 'An error occurred',
    code = ERROR_CODES.INTERNAL_ERROR,
    statusCode = 500,
    details = null,
    errors = null
  ) {
    const response = {
      success: false,
      statusCode,
      code,
      message,
      timestamp: new Date().toISOString()
    };

    if (details) {
      response.details = details;
    }

    if (errors && Array.isArray(errors) && errors.length > 0) {
      response.errors = errors;
    }

    return response;
  }

  /**
   * Format paginated response
   */
  static paginated(items, total, page, limit, message = 'Items retrieved successfully') {
    const totalPages = Math.ceil(total / limit);
    
    return {
      success: true,
      statusCode: 200,
      message,
      data: {
        items,
        pagination: {
          total,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Format file upload response
   */
  static fileUpload(fileData, message = 'File uploaded successfully') {
    return {
      success: true,
      statusCode: 201,
      message,
      data: fileData,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Format list response
   */
  static list(items, count, message = 'Items retrieved successfully') {
    return {
      success: true,
      statusCode: 200,
      message,
      data: {
        items,
        count
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Format single item response
   */
  static item(item, message = 'Item retrieved successfully') {
    return {
      success: true,
      statusCode: 200,
      message,
      data: item,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Format created response
   */
  static created(item, message = 'Item created successfully') {
    return {
      success: true,
      statusCode: 201,
      message,
      data: item,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Format updated response
   */
  static updated(item, message = 'Item updated successfully') {
    return {
      success: true,
      statusCode: 200,
      message,
      data: item,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Format deleted response
   */
  static deleted(message = 'Item deleted successfully') {
    return {
      success: true,
      statusCode: 200,
      message,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Format validation error response
   */
  static validationError(errors, message = 'Validation failed') {
    return {
      success: false,
      statusCode: 422,
      code: ERROR_CODES.VALIDATION_ERROR,
      message,
      errors: Array.isArray(errors) ? errors : [errors],
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Format unauthorized response
   */
  static unauthorized(message = 'Unauthorized access') {
    return {
      success: false,
      statusCode: 401,
      code: ERROR_CODES.UNAUTHORIZED,
      message,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Format forbidden response
   */
  static forbidden(message = 'Access forbidden') {
    return {
      success: false,
      statusCode: 403,
      code: ERROR_CODES.FORBIDDEN,
      message,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Format not found response
   */
  static notFound(message = 'Resource not found') {
    return {
      success: false,
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
      message,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Format conflict response
   */
  static conflict(message = 'Resource conflict') {
    return {
      success: false,
      statusCode: 409,
      code: ERROR_CODES.RESOURCE_ALREADY_EXISTS,
      message,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Format rate limited response
   */
  static rateLimited(message = 'Too many requests. Please try again later.', retryAfter = null) {
    const response = {
      success: false,
      statusCode: 429,
      code: ERROR_CODES.RATE_LIMITED,
      message,
      timestamp: new Date().toISOString()
    };

    if (retryAfter) {
      response.retryAfter = retryAfter;
    }

    return response;
  }
}

module.exports = ResponseFormatter;
