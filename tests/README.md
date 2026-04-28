# 🧪 Test Scripts

This folder contains test and integration scripts for testing the backend system endpoints and functionality.

## 📋 Test Files

### test-email.js
**Purpose**: Test email configuration and OTP delivery  
**What it does**:
- Verifies email service is configured correctly
- Tests connection to email provider (Gmail, SendGrid, Outlook)
- Sends a test OTP email to verify email templates work
- Displays email configuration status

**Usage**:
```bash
node test-email.js
```

**Requirements**:
- `.env` file with EMAIL_USER and EMAIL_PASSWORD set
- Gmail: App Password (not regular password)
- Database connection active

**Output**:
- ✅ Email service status
- ✅ Test email sent confirmation
- ⚠️ Configuration issues if any

---

### test-login.js
**Purpose**: Test user login endpoint  
**What it does**:
- Sends a POST request to `/api/users/login`
- Tests authentication flow
- Verifies OTP is generated and sent
- Shows response from server

**Usage**:
```bash
node test-login.js
```

**Default Test User**:
- Email: `princengwakomashumu@gmail.com`
- Password: `secure123`

**Requirements**:
- Server running on `localhost:3000`
- Database has test user
- Email service configured

**Output**:
- Response status and data
- Success/failure message
- OTP sent confirmation

---

### test-verify-otp.js
**Purpose**: Test OTP verification endpoint  
**What it does**:
- Sends POST request to `/api/users/verify-otp`
- Verifies OTP code
- Tests JWT token generation
- Shows authentication response

**Usage**:
```bash
node test-verify-otp.js
```

**Requirements**:
- Valid OTP code (from login test)
- Email address of test user
- Server running on `localhost:3000`

**Output**:
- Verification status
- JWT token (if successful)
- Session information

---

## 🚀 How to Run Tests

### Step 1: Verify Setup
```bash
# Check if server is running
# Check if database is connected
# Check if email is configured
```

### Step 2: Run Email Test First
```bash
node test-email.js
```
✅ Email must work before other tests

### Step 3: Run Login Test
```bash
node test-login.js
```
✅ Check for OTP in email

### Step 4: Get Latest OTP
```bash
node ../scripts/get-otp.js
```
✅ Find valid OTP code to use

### Step 5: Update test-verify-otp.js
Replace the test email/OTP with values from step 4, then:
```bash
node test-verify-otp.js
```
✅ Verify authentication works

---

## 📋 Test Order & Dependencies

```
1. test-email.js          (No dependencies)
   ↓
2. test-login.js          (Requires email working)
   ↓
3. get-otp.js            (Requires login OTP created)
   ↓
4. test-verify-otp.js    (Requires valid OTP)
```

---

## 🔧 Troubleshooting

### Email Test Fails
- Check `.env` file has EMAIL_USER and EMAIL_PASSWORD
- Gmail users: Use App Password, not regular password
- Check 2FA is enabled on Gmail account
- See: [GMAIL_SETUP_GUIDE.md](../docs/setup/GMAIL.md)

### Login Test Fails
- Ensure server is running on port 3000
- Check test user exists in database
- Verify email service is working (run test-email.js first)

### OTP Verification Fails
- OTP codes expire after 10 minutes
- Generate new OTP with: `node test-login.js`
- Get latest OTP with: `node ../scripts/get-otp.js`
- Make sure you're using the correct email

### Database Connection Issues
- Check `.env` file has DATABASE_URL set correctly
- Verify PostgreSQL is running
- Check connection credentials

---

## 📚 Related Documentation

- [API Documentation](../docs/api/DOCUMENTATION.md)
- [OTP Setup](../docs/features/otp/SETUP.md)
- [Email Configuration](../docs/setup/EMAIL.md)
- [Getting Started](../docs/GETTING_STARTED.md)

---

## ✨ Quick Reference

| File | Purpose | Command | Depends On |
|------|---------|---------|-----------|
| test-email.js | Test email config | `node test-email.js` | .env, Database |
| test-login.js | Test login flow | `node test-login.js` | Server running |
| test-verify-otp.js | Test OTP verification | `node test-verify-otp.js` | Valid OTP |
| get-otp.js | Get latest OTP | `node ../scripts/get-otp.js` | Database |

---

## 📝 Notes

- Test files use hardcoded test user (update as needed)
- OTP codes expire after 10 minutes
- Each login generates a new OTP
- Database must be populated with test users
- Email service must be configured for full testing
