# 👨‍💼 Admin Operations Tests

## Overview
Test suite for system administration and user management functions.

## Tests Included

### 1. **01-login.js** - Admin Login
- Authenticates admin user
- Sends OTP to admin email
- Enables admin operations

```bash
node 01-login.js admin@example.com secure123
```

### 2. **02-verify-otp.js** - OTP Verification
- Verifies admin OTP code
- Generates admin session token
- Enables system access

```bash
node 02-verify-otp.js 123456
```

### 3. **03-view-users.js** - View All Users
- Lists all system users
- Groups users by role
- Shows user statistics
- Displays verification status

```bash
node 03-view-users.js
```

---

## 🔄 Complete Workflow

```bash
# 1. Admin Login
node 01-login.js admin@example.com

# 2. Verify OTP
node 02-verify-otp.js YOUR_OTP_CODE

# 3. View system users
node 03-view-users.js
```

---

## 📊 Admin Operations

```
Admin Login (Email)
    ↓
Verify OTP (Token)
    ↓
System Access Granted
    ├─ View All Users
    ├─ User Statistics
    ├─ Role Distribution
    └─ Verification Status
```

---

## 💾 Saved Data

Location: `../.test-data-admin.json`

```json
{
  "email": "admin@example.com",
  "role": "admin",
  "token": "JWT_TOKEN",
  "tokenTimestamp": "2026-05-26T10:00:00Z"
}
```

---

## 👥 User Roles

- **Patient** - Regular users booking appointments
- **Doctor** - Medical professionals creating prescriptions
- **Pharmacist** - Pharmacy staff managing prescriptions
- **Admin** - System administrators

---

## 📊 User Information

When viewing users, displays:

- **Patients Count**
  - Email
  - Verification Status
  - Registration Date

- **Doctors Count**
  - Full Name
  - Specialization
  - License Number
  - Rating

- **Pharmacists Count**
  - Full Name
  - Pharmacy Name
  - License

- **Admins Count**
  - Email
  - Access Level

---

## ⏱️ Timing

- **Complete Flow:** 5 minutes
- **Login:** 1 minute
- **Verification:** 1 minute
- **View Users:** 1 minute

---

## 🔑 Key Features Tested

✅ Admin Authentication  
✅ OTP Verification  
✅ User Listing  
✅ Role-Based Grouping  
✅ User Statistics  
✅ Verification Status  
✅ System Overview  

---

## 📝 Notes

- Admin credentials required
- OTP valid for 10 minutes
- Token expires after 15 minutes
- All user data is returned
- No sensitive data (passwords) displayed

---

## 🚀 Quick Help

```bash
# Get help for any test
node 01-login.js --help
node 03-view-users.js --help
```

---

## 📂 File References

All tests reference the original implementation:
- Actual test files: `../test-admin-*.js`
- This folder provides organized shortcuts
- Both locations work identically

To run from root:
```bash
node test-admin-01-login.js
```

To run from admin folder:
```bash
cd admin
node 01-login.js
```

---

**Category:** System Administration  
**Tests:** 3  
**Status:** ✅ Complete
