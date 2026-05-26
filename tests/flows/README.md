# 🔄 User Management Flows

## Overview
Test suite for user management operations including registration and password recovery.

## Tests Included

### 1. **01-password-reset.js** - Password Reset Flow
Complete password reset process with email verification:

```bash
# Step 1: Request Password Reset
node 01-password-reset.js user@example.com

# Step 2: Reset with Token from Email
node 01-password-reset.js user@example.com TOKEN newPassword123
```

**Process:**
1. Request password reset with email
2. Receive reset link in email
3. Extract token from reset link
4. Run command with token and new password
5. Password updated successfully

---

### 2. **02-user-registration.js** - New User Registration
Create new patient account:

```bash
# Quick registration (auto-generated email)
node 02-user-registration.js

# With custom details
node 02-user-registration.js john@example.com John Doe +27123456789
```

**Process:**
1. Create new patient account
2. Receive verification email
3. Verify email address
4. Account ready for use

---

## 🔄 Complete Workflows

### Password Reset Flow
```bash
# 1. Request reset
node 01-password-reset.js princengwakomashumu@gmail.com

# 2. Check email for reset link
# 3. Extract token from link: https://app.com/reset?token=abc123

# 4. Reset password with token
node 01-password-reset.js princengwakomashumu@gmail.com abc123 newPassword456
```

### User Registration Flow
```bash
# 1. Register new user
node 02-user-registration.js

# 2. Check email for verification
# 3. Verify email address
# 4. Login with new credentials
# 5. Complete profile setup
```

---

## 📊 User Management Operations

```
User Registration
├─ Create Account
├─ Send Verification Email
├─ Verify Email
└─ Account Active

Password Reset
├─ Request Reset
├─ Receive Reset Email
├─ Extract Token
├─ Reset Password
└─ Updated Password
```

---

## 💾 Saved Data

### Registration (.test-data-new-user.json)
```json
{
  "email": "new.user@example.com",
  "password": "TestPassword123!",
  "firstName": "John",
  "lastName": "Doe",
  "registeredAt": "2026-05-26T10:00:00Z"
}
```

### Reset
No permanent storage (security)

---

## ⏱️ Timing

- **Password Reset:** 10 minutes
  - Request: 1 minute
  - Email check: 2 minutes
  - Reset: 2 minutes

- **Registration:** 5 minutes
  - Registration: 1 minute
  - Email verification: 2 minutes
  - Ready to use: 2 minutes

---

## 🔑 Key Features Tested

✅ User Registration  
✅ Email Verification  
✅ Password Reset  
✅ Email Validation  
✅ Token Generation  
✅ Account Activation  
✅ Credential Management  
✅ Security Verification  

---

## 📋 Registration Details

**Default Values (if not specified):**
- Email: Auto-generated (patient_TIMESTAMP@example.com)
- First Name: Test
- Last Name: Patient
- Phone: +27123456789
- Password: TestPassword123!

---

## 📝 Notes

- Emails must be unique
- Registration emails sent to configured email provider
- Reset tokens expire in 24 hours
- Passwords must meet security requirements
- All data persists in database

---

## 🚀 Quick Help

```bash
# Get help for any test
node 01-password-reset.js --help
node 02-user-registration.js --help
```

---

## 📚 Email-Based Workflows

Both flows require email verification:

1. **Email Sent** → Check registered email inbox
2. **Look for Code/Link** → Find OTP or reset link
3. **Copy/Extract** → Get code or token value
4. **Complete Flow** → Run command with code/token

**Note:** Check spam/junk folders if email not in inbox

---

## 📂 File References

All tests reference the original implementation:
- Actual test files: `../test-flow-*.js`
- This folder provides organized shortcuts
- Both locations work identically

To run from root:
```bash
node test-flow-01-password-reset.js
```

To run from flows folder:
```bash
cd flows
node 01-password-reset.js
```

---

**Category:** User Management  
**Tests:** 2  
**Status:** ✅ Complete
