# Centralized Error Handling & Backend Architecture

## Overview

This document describes the centralized error handling, logging, validation, and response formatting system for the backend API.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Express Application                      │
├─────────────────────────────────────────────────────────────┤
│  Request Logging Middleware (requestLogger)                 │
│  ├─ Logs all incoming requests                              │
│  ├─ Tracks response time                                    │
│  └─ Records user/IP information                             │
├─────────────────────────────────────────────────────────────┤
│  Routes & Controllers (asyncHandler wraps handlers)         │
│  ├─ Async errors caught automatically                       │
│  └─ Validation errors thrown as needed                      │
├─────────────────────────────────────────────────────────────┤
│  404 Not Found Handler (notFoundHandler)                    │
│  └─ Catches all unmatched routes                            │
├─────────────────────────────────────────────────────────────┤
│  Global Error Handler (errorHandler) [LAST]                 │
│  ├─ Catches all errors from above                           │
│  ├─ Formats response consistently                           │
│  ├─ Logs errors with context                                │
│  └─ Sends response to client                                │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. HTTP Status & Error Codes (`utils/httpStatus.js`)

Centralized HTTP status codes and error code definitions.

```javascript
const { HTTP_STATUS, ERROR_CODES } = require('./utils/httpStatus');

// Status codes
HTTP_STATUS.OK // { code: 200, message: 'OK' }
HTTP_STATUS.CREATED // { code: 201, message: 'Created' }
HTTP_STATUS.BAD_REQUEST // { code: 400, message: 'Bad Request' }
HTTP_STATUS.UNAUTHORIZED // { code: 401, message: 'Unauthorized' }
HTTP_STATUS.NOT_FOUND // { code: 404, message: 'Not Found' }

// Error codes
ERROR_CODES.VALIDATION_ERROR
ERROR_CODES.UNAUTHORIZED
ERROR_CODES.NOT_FOUND
ERROR_CODES.RESOURCE_ALREADY_EXISTS
ERROR_CODES.DATABASE_ERROR
```

### 2. Response Formatter (`utils/responseFormatter.js`)

Standardizes all API responses with consistent format.

#### Success Response

```javascript
const ResponseFormatter = require('./utils/responseFormatter');

// Get single item
res.status(200).json(ResponseFormatter.item(user, 'User retrieved'));
// Output:
{
  success: true,
  statusCode: 200,
  message: 'User retrieved',
  data: { id: 1, email: 'user@example.com', ... },
  timestamp: '2026-06-02T10:30:00.000Z'
}
```

#### Paginated Response

```javascript
const total = 100;
const page = 1;
const limit = 20;
const items = [...];

res.status(200).json(ResponseFormatter.paginated(
  items,
  total,
  page,
  limit,
  'Users retrieved'
));
```

#### Error Response

```javascript
res.status(404).json(ResponseFormatter.notFound('User not found'));
// Output:
{
  success: false,
  statusCode: 404,
  code: 'NOT_FOUND',
  message: 'User not found',
  timestamp: '2026-06-02T10:30:00.000Z'
}
```

#### Validation Error

```javascript
res.status(422).json(ResponseFormatter.validationError([
  { field: 'email', message: 'Invalid email format' },
  { field: 'password', message: 'Password too short' }
]));
```

### 3. Error Classes (`utils/errorHandler.js`)

Custom error classes for different error scenarios.

```javascript
const {
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
} = require('./utils/errorHandler');

// Throw validation error
throw new ValidationError('Invalid input');

// Throw authentication error
throw new AuthenticationError('Invalid credentials');

// Throw not found error
throw new NotFoundError('User not found');

// Throw conflict error
throw new ConflictError('Email already registered');

// Throw rate limit error
throw new RateLimitError('Too many requests', 60);

// Throw database error
throw new DatabaseError('Query failed', originalError);

// Throw external service error
throw new ExternalServiceError('Email service unavailable', 'EmailService');

// Throw custom error
throw new AppError('Custom error message', 500, 'CUSTOM_CODE');
```

### 4. Logger Service (`services/loggerService.js`)

Centralized logging system with file and console output.

```javascript
const logger = require('./services/loggerService');

// Basic logging
logger.info('User created', { userId: 1, email: 'user@example.com' });
logger.warn('Deprecated API used', { endpoint: '/api/old' });
logger.error('Database error', dbError);
logger.debug('Debug information', { data: someData });
logger.success('Operation completed', { result: 'success' });

// Specialized logging
logger.logRequest(req, res); // Log HTTP request/response
logger.logSecurity('login_attempt', { userId: 1, ip: '192.168.1.1' }); // Security event
logger.logDatabase('SELECT', query, duration); // Database operation
logger.logExternalApi('StripeAPI', 'POST', url, statusCode, duration); // API call

// Retrieve logs
const logs = logger.getLogs(); // Get today's logs (100 lines)
const oldLogs = logger.getLogs('2026-05-01'); // Get specific date
logger.clearOldLogs(7); // Delete logs older than 7 days
```

### 5. Middleware (`middleware/errorHandler.js`)

Global error handling, request logging, and async handler wrapper.

```javascript
const {
  errorHandler,      // Global error handler (must be last)
  notFoundHandler,   // 404 handler (before error handler)
  requestLogger,     // Request/response logging
  asyncHandler,      // Wrap async route handlers
  validateInput      // Input validation middleware
} = require('./middleware/errorHandler');

// In server.js
app.use(requestLogger);
app.use('/api', routes);
app.use(notFoundHandler);
app.use(errorHandler); // Must be last
```

### 6. Validator (`utils/validator.js`)

Centralized input validation utilities.

```javascript
const Validator = require('./utils/validator');

// Validate email
Validator.email('user@example.com'); // Returns lowercase email or throws

// Validate password strength
Validator.password('SecurePass123!');

// Validate string length
Validator.string(name, 1, 100, 'name');

// Validate number range
Validator.number(age, 0, 120, 'age');

// Validate positive integer
Validator.positiveInteger(id, 'id');

// Validate phone
Validator.phone('+1 (555) 123-4567');

// Validate URL
Validator.url('https://example.com');

// Validate date
Validator.date('2026-06-02', 'appointmentDate');

// Validate future date
Validator.futureDate('2026-07-02', 'appointmentDate');

// Validate enum
Validator.enum(status, ['active', 'inactive'], 'status');

// Validate role
Validator.role('doctor'); // Validates against CONSTANTS.ROLES

// Validate required fields
Validator.required(data, ['email', 'password', 'name']);

// Validate pagination
const { page, limit } = Validator.pagination(req.query.page, req.query.limit);

// Validate file
Validator.file(req.file, CONSTANTS.FILE_TYPES.ALLOWED_IMAGES);

// Sanitize string
const clean = Validator.sanitize(userInput);

// Sanitize object
const cleanData = Validator.sanitizeObject(req.body);
```

### 7. Constants (`utils/constants.js`)

Application-wide constants and configuration values.

```javascript
const CONSTANTS = require('./utils/constants');

// Pagination
CONSTANTS.PAGINATION.DEFAULT_LIMIT // 20
CONSTANTS.PAGINATION.MAX_LIMIT // 100

// Password
CONSTANTS.PASSWORD.MIN_LENGTH // 8
CONSTANTS.PASSWORD.SALT_ROUNDS // 10

// OTP
CONSTANTS.OTP.LENGTH // 6
CONSTANTS.OTP.EXPIRY_MINUTES // 15
CONSTANTS.OTP.RATE_LIMIT_SECONDS // 60

// JWT
CONSTANTS.JWT.ACCESS_TOKEN_EXPIRY // '8h'
CONSTANTS.JWT.REFRESH_TOKEN_EXPIRY // '7d'

// User Roles
CONSTANTS.ROLES.PATIENT // 'patient'
CONSTANTS.ROLES.DOCTOR // 'doctor'
CONSTANTS.ROLES.PHARMACY // 'pharmacy'

// Appointment Status
CONSTANTS.APPOINTMENT_STATUS.PENDING // 'pending'
CONSTANTS.APPOINTMENT_STATUS.COMPLETED // 'completed'

// Rate Limits
CONSTANTS.RATE_LIMIT.LOGIN_ATTEMPTS // 5
CONSTANTS.RATE_LIMIT.OTP_REQUESTS // 3

// File Types
CONSTANTS.FILE_TYPES.ALLOWED_DOCUMENTS
CONSTANTS.FILE_TYPES.ALLOWED_IMAGES
```

## Usage Examples

### Example 1: Basic Controller with Error Handling

```javascript
const { asyncHandler } = require('../middleware/errorHandler');
const ResponseFormatter = require('../utils/responseFormatter');
const Validator = require('../utils/validator');
const { NotFoundError, ConflictError } = require('../utils/errorHandler');
const User = require('../models/User');

class UserController {
  // Wrap with asyncHandler to catch async errors
  static getUser = asyncHandler(async (req, res) => {
    // Validate input
    const userId = Validator.positiveInteger(req.params.id, 'userId');

    // Get user
    const user = await User.findById(userId);
    
    // Check if exists
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Return success response
    res.json(ResponseFormatter.item(user, 'User retrieved'));
  });

  static createUser = asyncHandler(async (req, res) => {
    // Validate required fields
    Validator.required(req.body, ['email', 'password', 'name']);

    // Validate individual fields
    const email = Validator.email(req.body.email);
    const password = Validator.password(req.body.password);
    const name = Validator.string(req.body.name, 1, 100, 'name');

    // Check if already exists
    const existing = await User.findByEmail(email);
    if (existing) {
      throw new ConflictError('Email already registered');
    }

    // Create user
    const user = await User.create({ email, password, name });

    // Return created response
    res.status(201).json(ResponseFormatter.created(user, 'User created'));
  });

  static listUsers = asyncHandler(async (req, res) => {
    // Validate pagination
    const { page, limit } = Validator.pagination(
      req.query.page || 1,
      req.query.limit || 20
    );

    // Fetch users
    const result = await User.findAll(limit, (page - 1) * limit);
    const total = await User.count();

    // Return paginated response
    res.json(ResponseFormatter.paginated(
      result,
      total,
      page,
      limit,
      'Users retrieved'
    ));
  });
}

module.exports = UserController;
```

### Example 2: Using Custom Errors

```javascript
const {
  ValidationError,
  AuthenticationError,
  RateLimitError
} = require('../utils/errorHandler');

// Validation error
if (!email || !password) {
  throw new ValidationError('Email and password required', [
    { field: 'email', message: 'Email is required' },
    { field: 'password', message: 'Password is required' }
  ]);
}

// Authentication error
if (!isValidPassword) {
  throw new AuthenticationError('Invalid credentials');
}

// Rate limit error with retry-after
const attemptCount = await getRateLimitAttempts(email);
if (attemptCount > 5) {
  throw new RateLimitError('Too many login attempts', 300); // Retry after 5 minutes
}
```

### Example 3: Structured Error Handling

```javascript
try {
  await complexOperation();
} catch (error) {
  if (error instanceof ValidationError) {
    // Handle validation error
    res.status(error.statusCode).json(error.toJSON());
  } else if (error instanceof NotFoundError) {
    // Handle not found
    res.status(404).json(ResponseFormatter.notFound(error.message));
  } else if (error instanceof DatabaseError) {
    // Handle database error
    logger.error('Database operation failed', error);
    res.status(500).json(ResponseFormatter.error('Database error'));
  } else {
    // Handle unexpected error
    logger.error('Unexpected error', error);
    res.status(500).json(ResponseFormatter.error('Internal server error'));
  }
}
```

## Error Handling Flow

```
┌─ Client sends request
│
├─ Request passes through middleware
│  ├─ Request logger logs the request
│  ├─ Session/Auth middleware processes
│  └─ Route handler executes
│
├─ Handler (wrapped with asyncHandler)
│  ├─ Input validation
│  │  ├─ Success → Continue
│  │  └─ Failure → Throw ValidationError
│  │
│  ├─ Business logic
│  │  ├─ Success → Send response
│  │  ├─ Not found → Throw NotFoundError
│  │  ├─ Conflict → Throw ConflictError
│  │  └─ Other error → Throw AppError or catch
│  │
│  └─ Error caught by asyncHandler
│     └─ Pass to error middleware
│
├─ Error Middleware
│  ├─ Log error with context
│  ├─ Determine status code & message
│  ├─ Format response
│  └─ Send to client
│
└─ Client receives response
```

## Security Best Practices

1. **Input Validation**: Always validate and sanitize user input
   ```javascript
   const clean = Validator.sanitize(userInput);
   Validator.required(data, requiredFields);
   ```

2. **Error Messages**: Don't expose sensitive information
   ```javascript
   // Development
   if (isDevelopment) {
     response.error = error.message;
     response.stack = error.stack;
   }
   
   // Production
   response.error = 'Internal server error';
   ```

3. **Audit Logging**: Log security-related events
   ```javascript
   logger.logSecurity('login_attempt', { userId: 1, ip, success: false });
   ```

4. **Rate Limiting**: Prevent abuse
   ```javascript
   throw new RateLimitError('Too many requests', 60);
   ```

## Testing Error Handling

```bash
# Test validation error
curl -X POST http://localhost:3000/api/users/create \
  -H "Content-Type: application/json" \
  -d '{"email": "invalid"}'
# Returns 422 with validation errors

# Test not found
curl http://localhost:3000/api/users/999999
# Returns 404 with NOT_FOUND code

# Test internal error
curl http://localhost:3000/api/users/abc
# Returns 400 or 422 with validation errors

# Check health
curl http://localhost:3000/api/health
# Returns 200 with server status

# Check logs
curl http://localhost:3000/api/system/logs?lines=50
# Returns recent logs
```

## File Structure

```
backend-system/
├── middleware/
│   └── errorHandler.js          ← Global error & request handlers
├── services/
│   └── loggerService.js         ← Centralized logging
├── utils/
│   ├── constants.js             ← App-wide constants
│   ├── errorHandler.js          ← Custom error classes
│   ├── httpStatus.js            ← HTTP status codes
│   ├── responseFormatter.js     ← Response formatting
│   ├── validator.js             ← Input validation
│   └── passwordValidator.js     ← Password validation
├── controllers/
│   └── *.js                     ← Wrapped with asyncHandler
├── logs/                        ← Auto-generated log files
│   ├── app-2026-06-02.log
│   ├── app-2026-06-01.log
│   └── ...
└── server.js                    ← Updated with new middleware
```

## Environment Variables

```env
# Logging
LOG_TO_FILE=true              # Enable file logging
DEBUG=true                    # Enable debug logs
NODE_ENV=development          # or production

# Server
PORT=3000
FRONTEND_URL=http://localhost:3000

# Database & Cache
DATABASE_URL=...
REDIS_URL=...
```

## Related Documentation

- See [ACCOUNT_ACTIVATION_OTP.md](./ACCOUNT_ACTIVATION_OTP.md) for OTP handling
- See [SECURITY_SETUP_COMPLETE.md](../SECURITY_SETUP_COMPLETE.md) for security features
- See individual controller files for usage examples
