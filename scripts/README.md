# 🛠️ Utility Scripts

This folder contains utility and helper scripts for database operations, maintenance, and development tasks.

## 📋 Script Files

### get-otp.js
**Purpose**: Retrieve and display the latest OTP codes from the database  
**What it does**:
- Queries database for 5 most recent OTP codes
- Shows OTP status (Valid, Used, Expired)
- Displays OTP details and expiration times
- Highlights the latest valid OTP for testing
- Provides curl command for testing OTP verification

**Usage**:
```bash
node get-otp.js
```

**Output**:
```
=== Latest OTP Codes ===

Recent OTP Codes:
────────────────────────────────────────────────────────────────────────────────

1. ✅ Valid
   Email: user@example.com
   Name: John
   OTP Code: 123456
   Purpose: login
   Expires: 4/28/2026, 11:30:45 AM
   Created: 4/28/2026, 11:20:45 AM

✅ VALID OTP FOR TESTING:
   Email: user@example.com
   Code: 123456

Test verify-otp with:
POST http://localhost:3000/api/users/verify-otp
{
  "email": "user@example.com",
  "otp_code": "123456"
}
```

**Requirements**:
- Database connection active
- `.env` file configured
- OTP table populated (from login tests)

**When to Use**:
- After running `test-login.js` to get the OTP code
- To verify OTP codes in the system
- To troubleshoot OTP issues
- To get test data for `test-verify-otp.js`

---

### updatePrinceEmail.js
**Purpose**: Update user email in database  
**Usage**:
```bash
node updatePrinceEmail.js
```

**Note**: This is a one-time migration script for updating a specific user's email.

---

## 🚀 Common Usage Patterns

### Pattern 1: Test Authentication Flow
```bash
# 1. Test email configuration
node ../tests/test-email.js

# 2. Trigger login (generates OTP)
node ../tests/test-login.js

# 3. Get the OTP code
node get-otp.js

# 4. Test OTP verification
node ../tests/test-verify-otp.js
```

### Pattern 2: Debug OTP Issues
```bash
# Check latest OTP codes
node get-otp.js

# Check email status
node ../tests/test-email.js

# Check login flow
node ../tests/test-login.js
```

### Pattern 3: Generate Test Data
```bash
# Create new OTP
node ../tests/test-login.js

# View generated OTP
node get-otp.js
```

---

## 🔧 Script Details

### get-otp.js Features

**Displays**:
- ✅ Valid codes (not used, not expired)
- ⏰ Expired codes
- ❌ Already used codes

**Shows**:
- Email and user name
- OTP code
- Purpose (login, password_reset, etc.)
- Expiration timestamp
- Creation timestamp

**Provides**:
- Quick copy/paste curl command
- Ready-to-use test data
- Status indicators

---

## 📚 Related Documentation

- [OTP Setup](../docs/features/otp/SETUP.md)
- [Email Configuration](../docs/setup/EMAIL.md)
- [API Documentation](../docs/api/DOCUMENTATION.md)
- [Getting Started](../docs/GETTING_STARTED.md)

---

## ✨ Quick Reference

| Script | Purpose | Command | When to Use |
|--------|---------|---------|------------|
| get-otp.js | Get latest OTP | `node get-otp.js` | After login test, for testing verification |
| updatePrinceEmail.js | Update email | `node updatePrinceEmail.js` | One-time migration |

---

## 📝 Notes

- All scripts require database connection
- Scripts use `.env` for configuration
- Error handling logs issues to console
- Output is formatted for easy reading
- Most scripts exit after completion
