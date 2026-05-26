# 💊 Pharmacy Operations Tests

## Overview
Test suite for pharmacy operations and prescription management.

## Tests Included

### 1. **01-login.js** - Pharmacy Login
- Authenticates pharmacy staff
- Sends OTP to registered pharmacy email
- Enables pharmacy operations

```bash
node 01-login.js pharmacy@example.com secure123
```

---

## 🔄 Workflow

```bash
# 1. Pharmacy Login
node 01-login.js pharmacy@example.com

# 2. Verify OTP (check email)
# [Use OTP verification from another test flow]
```

---

## 📊 Pharmacy Operations

```
Pharmacy Login (Email)
    ↓
Verify OTP
    ↓
Pharmacy Access Granted
    ├─ View Prescriptions
    ├─ Manage Inventory
    ├─ Process Orders
    └─ Update Status
```

---

## 💾 Saved Data

Location: `../.test-data-pharmacy.json`

```json
{
  "email": "pharmacy@example.com",
  "role": "pharmacy",
  "loginTime": "2026-05-26T10:00:00Z"
}
```

---

## ⏱️ Timing

- **Login:** 1 minute
- **OTP Verification:** 1 minute

---

## 🔑 Key Features Tested

✅ Pharmacy Authentication  
✅ OTP Verification  
✅ Pharmacy Access Control  

---

## 📝 Notes

- Pharmacy credentials required
- OTP sent to registered email
- Valid for 10 minutes
- Token expires after 15 minutes

---

## 🚀 Quick Help

```bash
# Get help
node 01-login.js --help
```

---

## 📂 File References

All tests reference the original implementation:
- Actual test files: `../test-pharmacy-*.js`
- This folder provides organized shortcuts
- Both locations work identically

To run from root:
```bash
node test-pharmacy-01-login.js
```

To run from pharmacy folder:
```bash
cd pharmacy
node 01-login.js
```

---

**Category:** Pharmacy Operations  
**Tests:** 1  
**Status:** ✅ Complete
