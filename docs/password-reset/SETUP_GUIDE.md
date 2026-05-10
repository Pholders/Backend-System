# Password Reset Feature - Setup Guide

## Step-by-Step Installation (10 minutes)

### Prerequisites
- Node.js installed
- PostgreSQL database running
- Environment variables configured (see below)

---

## Step 1: Configure Environment Variables

Edit your `.env` file with:

```env
# Email Configuration
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

# Frontend URL (for reset links in emails)
FRONTEND_URL=http://localhost:3000

# JWT Configuration
JWT_SECRET=your-secret-key

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_db_password
DB_NAME=pholders

# Node Environment
NODE_ENV=development
```

### Email Service Configuration

#### Gmail
1. Enable 2-factor authentication
2. Generate App Password: https://myaccount.google.com/apppasswords
3. Use the generated password in `EMAIL_PASSWORD`

#### SendGrid
1. Create account at https://sendgrid.com
2. Generate API key
3. Set `EMAIL_SERVICE=sendgrid`
4. Use API key as `EMAIL_PASSWORD`

#### Other Services
- Modify `services/emailService.js` configuration as needed

---

## Step 2: Run Database Migration

The migration creates the `password_reset_tokens` table with necessary indices:

```bash
npm run migrate:password-reset
```

Or manually:
```bash
node config/addPasswordReset.js
```

**Verify the table was created:**
```bash
psql -U postgres -d pholders -c "\dt password_reset_tokens"
```

Expected output:
```
           List of relations
 Schema |        Name         | Type  | Owner
--------+---------------------+-------+-------
 public | password_reset_tokens | table | postgres
```

---

## Step 3: Verify Dependencies

Ensure all required packages are installed:

```bash
npm install
```

Required packages (should already be installed):
- `bcrypt` - Password hashing
- `nodemailer` - Email sending
- `jsonwebtoken` - JWT tokens
- `pg` - PostgreSQL client

---

## Step 4: Start the Server

### Development Mode
```bash
npm run dev
```

Or:
```bash
nodemon server.js
```

### Production Mode
```bash
npm start
```

Expected console output:
```
✅ Server running on port 3000
✅ Email service is ready
✅ Database connected
```

---

## Step 5: Test the Feature

### Interactive Testing
```bash
node tests/password-reset/test-password-reset.js
```

Menu options:
1. Request password reset
2. Reset password with token
3. Test invalid email
4. Test weak password
5. Test password mismatch
6. Test invalid token
7. Run all tests
0. Exit

### Quick Test with cURL

**Test 1: Request password reset**
```bash
curl -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

Expected response:
```json
{
  "success": true,
  "message": "Password reset link has been sent to your email...",
  "dev_token": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "dev_link": "http://localhost:3000/reset-password?token=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
}
```

**Test 2: Reset password (use token from Test 1)**
```bash
curl -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
    "new_password": "NewPassword123!",
    "confirm_password": "NewPassword123!"
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "Password has been reset successfully. You can now log in with your new password."
}
```

---

## Step 6: Implement Frontend

Create two new pages in your frontend:

### Forgot Password Page (`/forgot-password`)

```html
<form id="forgotPasswordForm">
  <input 
    type="email" 
    id="email" 
    placeholder="Enter your email" 
    required
  />
  <button type="submit">Send Reset Link</button>
  <div id="message"></div>
</form>

<script>
document.getElementById('forgotPasswordForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('email').value;
  
  const response = await fetch('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  
  const data = await response.json();
  document.getElementById('message').textContent = data.message;
});
</script>
```

### Reset Password Page (`/reset-password?token=TOKEN`)

```html
<form id="resetPasswordForm">
  <input 
    type="password" 
    id="password" 
    placeholder="New password" 
    required
  />
  <input 
    type="password" 
    id="confirmPassword" 
    placeholder="Confirm password" 
    required
  />
  <button type="submit">Reset Password</button>
  <div id="message"></div>
  <div id="requirements">
    <p>Password must contain:</p>
    <ul>
      <li>At least 8 characters</li>
      <li>One uppercase letter (A-Z)</li>
      <li>One lowercase letter (a-z)</li>
      <li>One number (0-9)</li>
      <li>One special character (!@#$%^&*)</li>
    </ul>
  </div>
</form>

<script>
document.getElementById('resetPasswordForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  
  const response = await fetch('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token,
      new_password: password,
      confirm_password: confirmPassword
    })
  });
  
  const data = await response.json();
  
  if (data.success) {
    document.getElementById('message').textContent = 'Password reset successful! Redirecting to login...';
    setTimeout(() => {
      window.location.href = '/login';
    }, 2000);
  } else {
    document.getElementById('message').textContent = data.message;
    if (data.errors) {
      console.log('Validation errors:', data.errors);
    }
  }
});
</script>
```

### Add Link to Login Page

On your login page, add:
```html
<a href="/forgot-password">Forgot Password?</a>
```

---

## Step 7: Test End-to-End

1. Navigate to `/forgot-password`
2. Enter your email
3. Check your email for reset link (or check server logs in dev mode)
4. Click the reset link
5. Enter new password
6. Submit form
7. Should see success message
8. Go to login page
9. Log in with new password

---

## Troubleshooting

### Database Migration Failed
```bash
# Check if table exists
psql -U postgres -d pholders -c "\dt password_reset_tokens"

# Check for errors in migration script
node config/addPasswordReset.js
```

### Email Not Sending
```bash
# Check environment variables
echo $EMAIL_SERVICE
echo $EMAIL_USER

# Check server logs for email errors
# The logs should show email sending attempts
```

### Token Issues
- Tokens expire after 24 hours
- Tokens can only be used once
- Check server logs in development mode for token values

### Password Validation Errors
- Password must be 8+ characters
- Must include uppercase (A-Z), lowercase (a-z), number, and special character

---

## Monitoring & Maintenance

### View Password Reset Attempts
```bash
psql -U postgres -d pholders -c "
  SELECT user_id, email, status, created_at 
  FROM audit_logs 
  WHERE event_type IN ('forgot_password', 'reset_password')
  ORDER BY created_at DESC 
  LIMIT 20;
"
```

### Clean Expired Tokens
```bash
psql -U postgres -d pholders -c "
  DELETE FROM password_reset_tokens 
  WHERE reset_token_expires_at < CURRENT_TIMESTAMP 
  AND used = FALSE;
"
```

---

## Security Checklist

- [ ] Environment variables configured
- [ ] Database migration ran successfully
- [ ] Email service tested and working
- [ ] Frontend forgot password page created
- [ ] Frontend reset password page created
- [ ] Login page has "Forgot Password" link
- [ ] Tested with valid email
- [ ] Tested with invalid email
- [ ] Tested with weak password
- [ ] Tested password reset flow end-to-end
- [ ] HTTPS enabled in production
- [ ] Audit logs reviewed
- [ ] Error messages are user-friendly

---

## Deployment to Production

1. **Environment Variables**
   - Update `.env` with production email service
   - Use production frontend URL
   - Use strong JWT secret

2. **Database**
   - Run migration on production database
   - Verify `password_reset_tokens` table exists

3. **Testing**
   - Test forgot password endpoint
   - Test reset password endpoint
   - Verify emails are delivered

4. **Monitoring**
   - Set up monitoring for email failures
   - Monitor audit logs
   - Monitor failed login attempts

5. **Rate Limiting** (Optional)
   - Consider adding rate limiting to forgot-password endpoint
   - Prevent email spam

---

## Support

For issues, see the troubleshooting section in:
- `/docs/password-reset/API_REFERENCE.md`
- `/docs/password-reset/QUICK_REFERENCE.md`

---

**Last Updated**: April 28, 2026  
**Version**: 1.0.0  
**Status**: ✅ Production Ready
