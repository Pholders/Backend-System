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
EMAIL_PASSWORD=xxxx xxxx xxxx xxxx
```

### Option 2: Other Email Providers

#### SendGrid:
```env
EMAIL_SERVICE=sendgrid
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASSWORD=your-sendgrid-api-key
```

#### Outlook/Office365:
```env
EMAIL_SERVICE=outlook
EMAIL_HOST=smtp-mail.outlook.com
EMAIL_PORT=587
EMAIL_USER=your-email@outlook.com
EMAIL_PASSWORD=your-password
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
      "email": "user@example.com"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

## Security Features

✅ OTP expires after 10 minutes
✅ OTP can only be used once
✅ Old OTPs are automatically invalidated when new one is generated
✅ Passwords are hashed with bcrypt
✅ JWT tokens expire after 7 days
✅ HTML email template prevents phishing

---

## Testing

### Test Email Connection
```bash
node test-email.js
```

### Test Login Flow
1. Login (Get OTP): `POST /api/users/login`
2. Check Email for OTP
3. Verify OTP: `POST /api/users/verify-otp`

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

---

**Status**: ✅ Production Ready
