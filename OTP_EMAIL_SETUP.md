# OTP Email Authentication Setup Guide

## Overview
The login system now uses OTP (One-Time Password) authentication via email for enhanced security.

## How It Works

### Login Flow:
1. User submits email and password to `/api/users/login`
2. System validates credentials and sends 6-digit OTP to user's email
3. User receives OTP email (valid for 10 minutes)
4. User submits email and OTP to `/api/users/verify-otp`
5. System validates OTP and returns JWT token

---

## Email Configuration

### Option 1: Gmail (Recommended)

#### Step 1: Enable 2-Factor Authentication
1. Go to your Google Account: https://myaccount.google.com
2. Navigate to **Security** → **2-Step Verification**
3. Follow the prompts to enable 2FA

#### Step 2: Generate App Password
1. Go to: https://myaccount.google.com/apppasswords
2. Select **Mail** as the app
3. Select **Other (Custom name)** as the device
4. Enter "Pholders Healthcare" as the name
5. Click **Generate**
6. Copy the 16-character password (remove spaces)

#### Step 3: Update .env File
```env
EMAIL_SERVICE=gmail
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASSWORD=xxxx xxxx xxxx xxxx  # The app password from step 2
```

### Option 2: Other Email Providers

#### SendGrid:
```env
EMAIL_SERVICE=
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASSWORD=your-sendgrid-api-key
```

#### Outlook/Office365:
```env
EMAIL_SERVICE=
EMAIL_HOST=smtp-mail.outlook.com
EMAIL_PORT=587
EMAIL_USER=your-email@outlook.com
EMAIL_PASSWORD=your-password
```

---

## Testing the OTP System

### 1. Test Email Connection
Create a test file `test-email.js`:
```javascript
require('dotenv').config();
const emailService = require('./services/emailService');

async function testEmail() {
  try {
    const isConnected = await emailService.verifyConnection();
    if (isConnected) {
      console.log('✅ Email service is configured correctly');
      
      // Send test OTP
      await emailService.sendOTP('test@example.com', '123456', 'Test User');
      console.log('✅ Test email sent successfully');
    } else {
      console.log('❌ Email configuration error');
    }
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testEmail();
```

Run: `node test-email.js`

### 2. Test Login Flow

#### Step 1: Login (Get OTP)
```bash
POST http://localhost:3000/api/users/login
Content-Type: application/json

{
  "email": "princengwakomashumu@gmail.com",
  "password": "secure123"
}

Response:
{
  "success": true,
  "message": "OTP sent to your email. Please verify to complete login.",
  "data": {
    "email": "princengwakomashumu@gmail.com",
    "expiresIn": "10 minutes"
  }
}
```

#### Step 2: Check Email
Look for an email from your configured EMAIL_USER with subject "Your Login OTP Code"

#### Step 3: Verify OTP
```bash
POST http://localhost:3000/api/users/verify-otp
Content-Type: application/json

{
  "email": "princengwakomashumu@gmail.com",
  "otp_code": "123456"
}

Response:
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {...},
    "token": "eyJhbGc..."
  }
}
```

---

## API Endpoints

### POST /api/users/login
**Request:**
```json
{
  "email": "user@example.com",
  "password": "yourpassword"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "OTP sent to your email. Please verify to complete login.",
  "data": {
    "email": "user@example.com",
    "expiresIn": "10 minutes"
  }
}
```

**Error Responses:**
- `400`: Missing email or password
- `401`: Invalid credentials
- `403`: Account inactive
- `500`: Failed to send OTP email

---

### POST /api/users/verify-otp
**Request:**
```json
{
  "email": "user@example.com",
  "otp_code": "123456"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "first_name": "Prince",
      "last_name": "Mashumu",
      "email": "princengwakomashumu@gmail.com",
      "phone": "0123456789",
      "id_passport_number": "1234567890",
      "nationality": "South African"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Responses:**
- `400`: Missing email or OTP code
- `401`: Invalid or expired OTP
- `500`: Server error

---

## Security Features

✅ OTP expires after 10 minutes
✅ OTP can only be used once
✅ Old OTPs are automatically invalidated when new one is generated
✅ Passwords are hashed with bcrypt
✅ JWT tokens expire after 7 days
✅ HTML email template prevents phishing

---

## Troubleshooting

### Email Not Sending
1. **Check .env file**: Ensure EMAIL_USER and EMAIL_PASSWORD are correct
2. **Gmail App Password**: Make sure you're using app password, not regular password
3. **2FA Enabled**: Gmail requires 2-factor authentication for app passwords
4. **Firewall/Antivirus**: Some security software blocks SMTP connections
5. **Check Console**: Look for error messages in terminal

### OTP Not Valid
1. **Check Expiration**: OTP expires after 10 minutes
2. **Case Sensitive**: Ensure exact 6-digit code
3. **Already Used**: Each OTP can only be used once
4. **Database**: Verify OTP record exists in database

### Quick Check:
```sql
-- Check OTP records
SELECT * FROM otps WHERE user_id = 1 ORDER BY created_at DESC;

-- Clean expired OTPs
DELETE FROM otps WHERE expires_at < NOW();
```

---

## Next Steps

1. ✅ Configure email credentials in `.env`
2. ✅ Test email connection with `test-email.js`
3. ✅ Test complete login flow
4. 📝 Update frontend to handle two-step login
5. 📝 Add OTP resend endpoint (optional)
6. 📝 Add rate limiting to prevent OTP spam (optional)

---

## Files Modified

- `services/emailService.js` - Email sending service
- `models/OTP.js` - OTP generation and verification
- `controllers/userController.js` - Login and verify-otp methods
- `routes/userRoutes.js` - Added /verify-otp endpoint
- `.env` - Added email configuration
- Database: Created `otps` table

---

## Environment Variables Summary

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=Prince@082
DB_NAME=pholders

# Server
PORT=3000

# JWT
JWT_SECRET=your-secret-key

# Email (Gmail)
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
```
