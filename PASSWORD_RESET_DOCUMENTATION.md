# Password Reset Feature Documentation

## Overview

The password reset feature allows patients to securely reset their forgotten passwords via email without requiring authentication. This is a critical security feature that enables account recovery.

## Features

✅ **Email-based Password Reset** - Secure token-based password reset via email
✅ **No Authentication Required** - Users can reset password without logging in
✅ **Token Expiration** - Reset tokens expire after 24 hours
✅ **Security Logging** - All password reset attempts are logged for audit trails
✅ **Session Invalidation** - All existing sessions are invalidated after password reset
✅ **Email Confirmations** - Users receive confirmation emails for security awareness
✅ **Rate Limiting Ready** - Architecture supports adding rate limiting
✅ **Development Mode** - Token and links available in development for testing

## Database Schema

### Password Reset Tokens Table

```sql
CREATE TABLE password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  reset_token VARCHAR(500) UNIQUE NOT NULL,
  reset_token_expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indices:**
- `idx_password_reset_tokens_user_id` - For user lookups
- `idx_password_reset_tokens_email` - For email lookups
- `idx_password_reset_tokens_token` - For token validation
- `idx_password_reset_tokens_expires_at` - For cleanup queries
- `idx_password_reset_tokens_used` - For tracking used tokens

## API Endpoints

### 1. Request Password Reset

**Endpoint:** `POST /api/auth/forgot-password`

**Authentication:** Not required

**Request Body:**
```json
{
  "email": "patient@example.com"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Password reset link has been sent to your email. The link will expire in 24 hours."
}
```

**Development Mode Response:**
```json
{
  "success": true,
  "message": "Password reset token generated. Check server logs (development mode only).",
  "dev_token": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "dev_link": "http://localhost:3000/reset-password?token=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "dev_note": "Token and link included in response (development mode only)"
}
```

**Error Responses:**

400 - Missing Email:
```json
{
  "success": false,
  "message": "Email is required"
}
```

400 - Invalid Email Format:
```json
{
  "success": false,
  "message": "Invalid email format"
}
```

500 - Server Error:
```json
{
  "success": false,
  "message": "Error processing password reset request",
  "error": "Error message details"
}
```

**Security Notes:**
- Returns 200 even if email doesn't exist (for security - prevents email enumeration)
- IP address and user agent are logged
- Token is cryptographically generated (32 random bytes)
- Tokens are stored with expiration time (24 hours)

---

### 2. Reset Password with Token

**Endpoint:** `POST /api/auth/reset-password`

**Authentication:** Not required

**Request Body:**
```json
{
  "token": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "new_password": "SecurePassword123!",
  "confirm_password": "SecurePassword123!"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Password has been reset successfully. You can now log in with your new password."
}
```

**Error Responses:**

400 - Missing Fields:
```json
{
  "success": false,
  "message": "Token, new password, and password confirmation are required"
}
```

400 - Passwords Don't Match:
```json
{
  "success": false,
  "message": "Passwords do not match"
}
```

400 - Weak Password:
```json
{
  "success": false,
  "message": "Password does not meet security requirements",
  "errors": [
    "Password must be at least 8 characters long",
    "Password must contain at least one uppercase letter"
  ],
  "strength": "weak"
}
```

401 - Invalid or Expired Token:
```json
{
  "success": false,
  "message": "Invalid or expired password reset token. Please request a new one."
}
```

404 - User Not Found:
```json
{
  "success": false,
  "message": "User not found"
}
```

500 - Server Error:
```json
{
  "success": false,
  "message": "Error resetting password",
  "error": "Error message details"
}
```

**Password Requirements:**
- Minimum 8 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one number (0-9)
- At least one special character (!@#$%^&*)

---

## Flow Diagram

```
User Request
    |
    v
POST /forgot-password (email)
    |
    ├─ Validate email format
    ├─ Check if user exists
    ├─ Generate reset token (32 random bytes)
    ├─ Create password_reset_tokens record
    ├─ Send email with reset link
    └─ Log attempt (security audit)
    |
    v
User receives email with reset link
    |
    v
User clicks link: /reset-password?token=TOKEN
    |
    v
User submits new password
    |
    v
POST /reset-password (token, new_password)
    |
    ├─ Validate token format
    ├─ Find valid, non-expired token
    ├─ Validate password strength
    ├─ Hash new password (bcrypt, 10 rounds)
    ├─ Update user password
    ├─ Mark token as used
    ├─ Invalidate all other reset tokens for user
    ├─ Invalidate all sessions (force re-login)
    ├─ Send confirmation email
    └─ Log success (security audit)
    |
    v
Password reset complete
User can now log in with new password
```

---

## Security Implementation

### 1. Token Generation
- Uses `crypto.randomBytes(32)` - cryptographically secure
- Tokens are hexadecimal strings (64 characters)
- Each token is unique and database-constrained

### 2. Token Storage
- Tokens stored in separate table (not in users table)
- Each token includes:
  - User ID (linked via foreign key)
  - Email (for audit)
  - Expiration time (24 hours)
  - Used flag (prevents reuse)
  - IP address and user agent (audit trail)
  - Created/Updated timestamps

### 3. Password Security
- Passwords hashed with bcrypt (10 salt rounds)
- Password strength validation enforced
- Old password not required (can help account takeover recovery)

### 4. Session Management
- All sessions invalidated after password reset
- Users forced to re-login with new password
- Prevents session fixation attacks

### 5. Audit Logging
Every password reset operation is logged:
```javascript
await AuditLog.logSecurityEvent(
  req, 
  userId, 
  'patient', 
  email, 
  'forgot_password|reset_password', 
  'success|failed', 
  details
);
```

Logged information:
- User ID
- Email address
- IP address
- User agent (browser info)
- Timestamp
- Success/failure status
- Failure reasons

### 6. Email Security
- Non-revealing responses (same message whether user exists or not)
- Prevents email enumeration attacks
- HTML and plain text email templates
- 24-hour token expiration
- Clear security warnings in email

### 7. Rate Limiting (Ready for Implementation)
The architecture is designed to support rate limiting:
```javascript
// Future implementation example
const rateLimit = require('express-rate-limit');

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per windowMs
  message: 'Too many password reset requests, please try again later'
});

router.post('/forgot-password', forgotPasswordLimiter, UserController.forgotPassword);
```

---

## Setup Instructions

### 1. Run Migration
```bash
npm run migrate:password-reset
```

Or manually:
```bash
node config/addPasswordReset.js
```

### 2. Environment Variables Required
```env
# Email Configuration
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

# Frontend URL (for reset link)
FRONTEND_URL=http://localhost:3000

# JWT Secret
JWT_SECRET=your-secret-key

# Node Environment
NODE_ENV=development|production
```

### 3. Verify Setup
Check PostgreSQL table creation:
```sql
\dt password_reset_tokens
\d password_reset_tokens
```

### 4. Update Frontend
The frontend should:
1. Create a "Forgot Password" page at `/forgot-password`
2. Create a "Reset Password" page at `/reset-password?token=TOKEN`
3. Extract token from URL query parameter
4. Submit reset form to `/api/auth/reset-password`

---

## Testing Guide

### Using cURL

**Test 1: Request Password Reset**
```bash
curl -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"patient@example.com"}'
```

**Test 2: Reset Password (Development Mode)**
```bash
# 1. Check server logs for dev_token
# 2. Use that token:

curl -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
    "new_password": "NewSecurePassword123!",
    "confirm_password": "NewSecurePassword123!"
  }'
```

### Using Postman

**Collection Setup:**

1. Create POST request to `{{base_url}}/auth/forgot-password`
   - Body: `{"email":"patient@example.com"}`

2. Create POST request to `{{base_url}}/auth/reset-password`
   - Body:
     ```json
     {
       "token": "{{reset_token}}",
       "new_password": "TestPassword123!",
       "confirm_password": "TestPassword123!"
     }
     ```

### Manual Testing Checklist

- [ ] Request reset for valid email - receives confirmation message
- [ ] Request reset for invalid email - receives confirmation message (doesn't reveal)
- [ ] Check email inbox for reset link
- [ ] Click reset link and see reset form
- [ ] Try weak password - validation error
- [ ] Reset with mismatched passwords - error message
- [ ] Successfully reset password
- [ ] Try to use same token again - token expired error
- [ ] Receive confirmation email
- [ ] Can login with new password
- [ ] Previous sessions are invalidated
- [ ] Check security audit log

---

## Cleanup and Maintenance

### Automatic Token Cleanup
Expired tokens are cleaned up automatically. You can manually run cleanup:

```bash
# Add this to your cron job (daily recommended)
node -e "
  const PasswordResetToken = require('./models/PasswordResetToken');
  PasswordResetToken.cleanupExpiredTokens();
"
```

### View Token History
```javascript
const PasswordResetToken = require('./models/PasswordResetToken');
const history = await PasswordResetToken.getUserTokenHistory(userId, 10);
console.log(history);
```

---

## Troubleshooting

### Emails Not Sending

**Problem:** Password reset email not received

**Solutions:**
1. Verify email configuration in `.env`
2. Check email service credentials
3. Check spam/junk folder
4. Verify frontend URL in `FRONTEND_URL` env var
5. Check server logs for email errors
6. Run: `npm test` (if test script available)

### Token Issues

**Problem:** "Invalid or expired token" error

**Causes:**
- Token has expired (24 hours)
- Token was already used
- Token is malformed
- Wrong token format

**Solutions:**
1. Request a new reset email
2. Ensure you copied the complete token
3. Check token immediately (don't wait 24 hours)

### Password Validation Errors

**Problem:** "Password does not meet security requirements"

**Requirements:**
- At least 8 characters
- At least 1 uppercase (A-Z)
- At least 1 lowercase (a-z)
- At least 1 number (0-9)
- At least 1 special character (!@#$%^&*)

**Example Valid Passwords:**
- `MyPassword123!`
- `Secure@Pass2024`
- `Reset#Password1`

---

## API Integration Examples

### JavaScript/Node.js

```javascript
// Request password reset
async function requestPasswordReset(email) {
  try {
    const response = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    
    const data = await response.json();
    if (data.success) {
      console.log('Check your email for reset link');
    } else {
      console.error(data.message);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Reset password
async function resetPassword(token, newPassword) {
  try {
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        new_password: newPassword,
        confirm_password: newPassword
      })
    });
    
    const data = await response.json();
    if (data.success) {
      console.log('Password reset successful! You can now login.');
      window.location.href = '/login';
    } else {
      console.error(data.message);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Usage
requestPasswordReset('patient@example.com');

// After user clicks reset link and submits form:
const token = new URLSearchParams(window.location.search).get('token');
resetPassword(token, 'NewPassword123!');
```

### React Example

```jsx
import React, { useState } from 'react';

function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      const data = await response.json();
      setMessage(data.message);
    } catch (error) {
      setMessage('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter your email"
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Sending...' : 'Send Reset Link'}
      </button>
      {message && <p>{message}</p>}
    </form>
  );
}

export default ForgotPasswordForm;
```

---

## Files Modified/Created

### New Files:
- `config/addPasswordReset.js` - Database migration
- `models/PasswordResetToken.js` - Token model
- `PASSWORD_RESET_DOCUMENTATION.md` - This file

### Modified Files:
- `services/emailService.js` - Added password reset email methods
- `controllers/userController.js` - Added password reset endpoints
- `routes/userRoutes.js` - Added password reset routes
- `models/Session.js` - Added session invalidation method
- `package.json` - Added migration script

---

## Future Enhancements

Potential improvements:
- [ ] Rate limiting on forgot-password endpoint
- [ ] SMS-based password reset (alternative to email)
- [ ] Security questions as additional verification
- [ ] Device fingerprinting for reset verification
- [ ] Require old password confirmation for authenticated users
- [ ] Admin dashboard for monitoring password resets
- [ ] Analytics on password reset usage
- [ ] Multi-step verification process
- [ ] TOTP/2FA for password reset
- [ ] Reset token delivery via alternative methods

---

## Support

For issues or questions:
1. Check the Troubleshooting section
2. Review audit logs: `SELECT * FROM audit_logs WHERE event_type LIKE '%password%'`
3. Check email service logs
4. Verify .env configuration

---

*Last Updated: April 28, 2026*
*Version: 1.0.0*
