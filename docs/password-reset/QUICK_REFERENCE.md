# 🔐 Password Reset Feature - Quick Reference Guide

## Quick Setup (5 minutes)

### 1. Create Database Table
```bash
npm run migrate:password-reset
```

### 2. Verify Environment Variables
```env
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
```

### 3. Test the Endpoints

---

## API Endpoints Summary

### Request Password Reset
```
POST /api/auth/forgot-password
Content-Type: application/json

{
  "email": "patient@example.com"
}

Response: 200 OK
{
  "success": true,
  "message": "Password reset link has been sent to your email..."
}
```

### Reset Password
```
POST /api/auth/reset-password
Content-Type: application/json

{
  "token": "reset-token-from-email",
  "new_password": "NewPassword123!",
  "confirm_password": "NewPassword123!"
}

Response: 200 OK
{
  "success": true,
  "message": "Password has been reset successfully..."
}
```

---

## Password Requirements

✅ Minimum 8 characters
✅ At least 1 uppercase letter (A-Z)
✅ At least 1 lowercase letter (a-z)
✅ At least 1 number (0-9)
✅ At least 1 special character (!@#$%^&*)

### Valid Examples:
- `MyPassword123!`
- `Reset@2024Pwd`
- `Secure#Pass99`

---

## Testing in Development

### Get Reset Token from Logs
When you call `/forgot-password` in development, check the server logs:
```
🔐 Development Reset Token: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
🔗 Development Reset Link: http://localhost:3000/reset-password?token=a1b2c3d4...
```

### Quick Test with cURL

```bash
# 1. Request reset
curl -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Check logs for token, then:

# 2. Reset password
curl -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "YOUR_TOKEN_HERE",
    "new_password": "NewPassword123!",
    "confirm_password": "NewPassword123!"
  }'
```

---

## Security Features

🔒 **Token Security**
- Cryptographically secure random tokens (32 bytes)
- 24-hour expiration
- Single-use only
- Unique constraint in database

🔒 **Password Security**
- bcrypt hashing (10 rounds)
- Strength validation required
- Session invalidation after reset

🔒 **Account Protection**
- All sessions revoked after password reset
- Audit logging of all attempts
- IP address and user agent recorded
- Email enumeration prevention

🔒 **Email Security**
- Non-revealing responses
- HTML + Plain text templates
- Security warnings in email

---

## Frontend Implementation Checklist

- [ ] Create "Forgot Password" page (`/forgot-password`)
- [ ] Create "Reset Password" page (`/reset-password`)
- [ ] Extract token from URL: `?token=TOKEN`
- [ ] Show email input on forgot password page
- [ ] Show password input on reset password page
- [ ] Display password validation requirements
- [ ] Show success/error messages
- [ ] Redirect to login after successful reset
- [ ] Add forgot password link on login page

---

## Common Issues & Solutions

### ❌ Email Not Sending
- ✅ Verify `.env` credentials
- ✅ Check spam folder
- ✅ Verify `FRONTEND_URL` is correct
- ✅ Check server logs for errors

### ❌ "Invalid Token" Error
- ✅ Token expired? Request a new one
- ✅ Already used? Request a new one
- ✅ Copied correctly? Check for extra spaces
- ✅ In development? Check server logs for token

### ❌ "Password Does Not Meet Requirements"
- ✅ At least 8 characters?
- ✅ Includes uppercase? (A-Z)
- ✅ Includes lowercase? (a-z)
- ✅ Includes number? (0-9)
- ✅ Includes special char? (!@#$%^&*)

---

## Database Queries

### View Reset Tokens
```sql
SELECT id, user_id, email, used, expires_at, created_at 
FROM password_reset_tokens 
ORDER BY created_at DESC 
LIMIT 10;
```

### View Failed Attempts
```sql
SELECT * FROM audit_logs 
WHERE event_type = 'forgot_password' AND status = 'failed' 
ORDER BY created_at DESC 
LIMIT 20;
```

### Clean Expired Tokens
```sql
DELETE FROM password_reset_tokens 
WHERE reset_token_expires_at < CURRENT_TIMESTAMP 
AND used = FALSE;
```

---

## Files Created/Modified

### Created:
- `config/addPasswordReset.js` - Migration script
- `models/PasswordResetToken.js` - Token model
- `docs/password-reset/` - Documentation folder
- `tests/password-reset/` - Testing folder

### Modified:
- `services/emailService.js` - Added email methods
- `controllers/userController.js` - Added endpoints
- `routes/userRoutes.js` - Added routes
- `models/Session.js` - Added session invalidation
- `package.json` - Added migration script

---

## Next Steps

1. ✅ Run migration: `npm run migrate:password-reset`
2. ✅ Test endpoints with cURL or Postman
3. ✅ Implement frontend pages
4. ✅ Add email validation
5. ✅ Test with real email
6. ✅ Deploy to production

---

**Need more help?** Check the other documentation files in this folder.
