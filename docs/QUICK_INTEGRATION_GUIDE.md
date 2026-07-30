# Quick Integration Guide - Using Centralized Error Handling

## Quick Reference

### Import at Top of Controller

```javascript
const { asyncHandler } = require('../middleware/errorHandler');
const ResponseFormatter = require('../utils/responseFormatter');
const Validator = require('../utils/validator');
const logger = require('../services/loggerService');
const CONSTANTS = require('../utils/constants');
const {
  ValidationError,
  NotFoundError,
  ConflictError,
  AuthenticationError,
  RateLimitError,
  DatabaseError
} = require('../utils/errorHandler');
```

### Basic Pattern for Every Route Handler

```javascript
// ❌ BEFORE (Old style - lots of try-catch, inconsistent responses)
static async signup(req, res) {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password required'
      });
    }
    
    const user = await User.create({ email, password });
    
    res.status(201).json({
      success: true,
      message: 'User created',
      data: user
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating user',
      error: error.message
    });
  }
}

// ✅ AFTER (New style - cleaner, centralized)
static signup = asyncHandler(async (req, res) => {
  // Validate
  Validator.required(req.body, ['email', 'password']);
  const email = Validator.email(req.body.email);
  const password = Validator.password(req.body.password);

  // Check exists
  const existing = await User.findByEmail(email);
  if (existing) {
    throw new ConflictError('Email already registered');
  }

  // Create
  const user = await User.create({ email, password });
  
  // Respond
  res.status(201).json(ResponseFormatter.created(user, 'User created'));
});
```

## Before & After Examples

### Example 1: Validate Required Fields

```javascript
// ❌ Before
if (!email || !password || !name) {
  return res.status(400).json({
    success: false,
    message: 'Missing required fields'
  });
}

// ✅ After
Validator.required(req.body, ['email', 'password', 'name']);
```

### Example 2: Validate Email Format

```javascript
// ❌ Before
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  return res.status(400).json({
    success: false,
    message: 'Invalid email format'
  });
}

// ✅ After
const email = Validator.email(req.body.email); // Throws ValidationError if invalid
```

### Example 3: Check Resource Exists

```javascript
// ❌ Before
const user = await User.findById(userId);
if (!user) {
  return res.status(404).json({
    success: false,
    message: 'User not found'
  });
}

// ✅ After
const user = await User.findById(userId);
if (!user) {
  throw new NotFoundError('User not found');
}
```

### Example 4: Check Duplicate Resource

```javascript
// ❌ Before
const existing = await User.findByEmail(email);
if (existing) {
  return res.status(409).json({
    success: false,
    message: 'Email already registered'
  });
}

// ✅ After
const existing = await User.findByEmail(email);
if (existing) {
  throw new ConflictError('Email already registered');
}
```

### Example 5: Paginated List

```javascript
// ❌ Before
const page = parseInt(req.query.page) || 1;
const limit = parseInt(req.query.limit) || 20;

if (page < 1 || limit < 1 || limit > 100) {
  return res.status(400).json({
    success: false,
    message: 'Invalid pagination parameters'
  });
}

const users = await User.findAll(limit, (page - 1) * limit);
const total = await User.count();

res.json({
  success: true,
  data: {
    items: users,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  }
});

// ✅ After
const { page, limit } = Validator.pagination(
  req.query.page || 1,
  req.query.limit || 20
);

const users = await User.findAll(limit, (page - 1) * limit);
const total = await User.count();

res.json(ResponseFormatter.paginated(users, total, page, limit));
```

### Example 6: Logging

```javascript
// ❌ Before
console.log('User created:', user.id);
console.error('Database error:', error);

// ✅ After
logger.info('User created', { userId: user.id, email: user.email });
logger.error('Database error', error, { operation: 'create_user' });
logger.logSecurity('suspicious_login_attempt', { userId, ip, attempts: 5 });
```

### Example 7: Authentication/Authorization

```javascript
// ❌ Before
if (!req.user) {
  return res.status(401).json({
    success: false,
    message: 'Unauthorized'
  });
}

if (req.user.role !== 'doctor') {
  return res.status(403).json({
    success: false,
    message: 'Access forbidden'
  });
}

// ✅ After
if (!req.user) {
  throw new AuthenticationError('Unauthorized access');
}

if (req.user.role !== CONSTANTS.ROLES.DOCTOR) {
  throw new AuthorizationError('Doctor access required');
}
```

### Example 8: Rate Limiting

```javascript
// ❌ Before
const key = `login_attempts_${email}`;
const attempts = await cache.get(key);

if (attempts && attempts >= 5) {
  return res.status(429).json({
    success: false,
    message: 'Too many login attempts. Try again in 15 minutes.'
  });
}

// ✅ After
const attempts = await cache.get(`login_attempts_${email}`);
if (attempts >= CONSTANTS.RATE_LIMIT.LOGIN_ATTEMPTS) {
  throw new RateLimitError('Too many login attempts', 900); // 15 mins
}
```

### Example 9: File Validation

```javascript
// ❌ Before
if (!req.file) {
  return res.status(400).json({
    success: false,
    message: 'File is required'
  });
}

if (req.file.size > 10 * 1024 * 1024) {
  return res.status(400).json({
    success: false,
    message: 'File too large'
  });
}

// ✅ After
Validator.file(req.file, CONSTANTS.FILE_TYPES.ALLOWED_IMAGES);
```

### Example 10: Data Sanitization

```javascript
// ❌ Before
const name = req.body.name.replace(/[<>]/g, '').trim();

// ✅ After
const name = Validator.sanitize(req.body.name);
const data = Validator.sanitizeObject(req.body);
```

## Migration Checklist

When converting a controller to use the new system:

- [ ] Add `asyncHandler` wrapper to all route handlers
- [ ] Replace `try-catch` with error throwing
- [ ] Use `Validator` for all input validation
- [ ] Use custom error classes for different error types
- [ ] Replace response objects with `ResponseFormatter` methods
- [ ] Replace `console.log/error` with `logger` methods
- [ ] Use `CONSTANTS` instead of hardcoded values
- [ ] Remove manual error response handling (error middleware handles it)
- [ ] Test that errors are being caught and formatted correctly
- [ ] Verify that error responses have consistent format

## Common Patterns

### Pattern 1: CRUD Operations

```javascript
// CREATE
static create = asyncHandler(async (req, res) => {
  Validator.required(req.body, ['field1', 'field2']);
  
  const item = await Model.create(req.body);
  logger.info('Item created', { id: item.id });
  
  res.status(201).json(ResponseFormatter.created(item));
});

// READ
static getById = asyncHandler(async (req, res) => {
  const id = Validator.positiveInteger(req.params.id);
  const item = await Model.findById(id);
  
  if (!item) {
    throw new NotFoundError('Item not found');
  }
  
  res.json(ResponseFormatter.item(item));
});

// UPDATE
static update = asyncHandler(async (req, res) => {
  const id = Validator.positiveInteger(req.params.id);
  const item = await Model.update(id, req.body);
  
  if (!item) {
    throw new NotFoundError('Item not found');
  }
  
  logger.info('Item updated', { id });
  res.json(ResponseFormatter.updated(item));
});

// DELETE
static delete = asyncHandler(async (req, res) => {
  const id = Validator.positiveInteger(req.params.id);
  const deleted = await Model.delete(id);
  
  if (!deleted) {
    throw new NotFoundError('Item not found');
  }
  
  logger.info('Item deleted', { id });
  res.json(ResponseFormatter.deleted());
});

// LIST
static list = asyncHandler(async (req, res) => {
  const { page, limit } = Validator.pagination(req.query.page, req.query.limit);
  
  const items = await Model.findAll(limit, (page - 1) * limit);
  const total = await Model.count();
  
  res.json(ResponseFormatter.paginated(items, total, page, limit));
});
```

### Pattern 2: Authentication Flow

```javascript
static login = asyncHandler(async (req, res) => {
  // Validate
  Validator.required(req.body, ['email', 'password']);
  const email = Validator.email(req.body.email);

  // Check rate limit
  const attempts = await cache.get(`login_${email}`);
  if (attempts >= CONSTANTS.RATE_LIMIT.LOGIN_ATTEMPTS) {
    throw new RateLimitError('Too many login attempts');
  }

  // Find user
  const user = await User.findByEmail(email);
  if (!user) {
    throw new AuthenticationError('Invalid credentials');
  }

  // Verify password
  const isValid = await user.verifyPassword(req.body.password);
  if (!isValid) {
    await cache.increment(`login_${email}`);
    throw new AuthenticationError('Invalid credentials');
  }

  // Clear attempts
  await cache.delete(`login_${email}`);

  // Create session
  const token = createToken(user);
  logger.info('User logged in', { userId: user.id });

  res.json(ResponseFormatter.success(
    { token, user },
    'Login successful'
  ));
});
```

## Debugging Tips

1. **Check error is being thrown**
   ```javascript
   throw new ValidationError('Test error');
   ```

2. **Check asyncHandler is wrapping the function**
   ```javascript
   static myHandler = asyncHandler(async (req, res) => {
     // Inside asyncHandler
   });
   ```

3. **Check logs are being written**
   ```bash
   tail -f logs/app-$(date +%Y-%m-%d).log
   ```

4. **Check error response format**
   ```bash
   curl http://localhost:3000/api/test/invalid | jq .
   ```

5. **Enable debug logging**
   ```bash
   DEBUG=true npm start
   ```
