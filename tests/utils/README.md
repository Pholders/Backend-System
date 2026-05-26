# 🛠️ Test Utilities & Setup

## Overview
Utility scripts and setup tools for test infrastructure.

## Utilities Included

### 1. **seed-test-doctors.js** - Create Test Doctors
Populates database with test doctor accounts:

```bash
node seed-test-doctors.js
```

**Creates 5 test doctors:**
1. Sam Smith - General Practitioner
2. Lerato Moloi - Paediatrician
3. Thabo Ndlela - Cardiologist
4. Naledi Khumalo - Dermatologist
5. Kobus van der Merwe - Orthopedic Surgeon

**Features:**
- ✅ Idempotent (safe to run multiple times)
- ✅ Default password: secure123
- ✅ Realistic specializations
- ✅ Different consultation fees
- ✅ Profile ratings

---

### 2. **seed-test-pharmacies.js** - Create Test Pharmacies
Populates database with test pharmacy accounts:

```bash
node seed-test-pharmacies.js
```

**Creates 3 test pharmacies:**
1. MediCare Pharmacy - Bryanston
2. HealthFirst Pharmacy - Sandton
3. Care Plus Pharmacy - Midrand

**Features:**
- ✅ Idempotent (safe to run multiple times)
- ✅ Default password: secure123
- ✅ Different locations
- ✅ Operating hours
- ✅ Contact information

---

### 3. **refresh-token.js** - Refresh Expired Tokens
Extends expired authentication tokens without re-login:

```bash
# Auto-detect and refresh recent token
node refresh-token.js

# Refresh specific user type
node refresh-token.js --patient
node refresh-token.js --doctor
node refresh-token.js --admin
```

**Usage:**
- Token expires after 15 minutes
- Use this to extend without re-login
- Automatically updates .test-data*.json files
- No manual re-authentication needed

---

## 🔄 Setup Sequence

### First Time Setup
```bash
# 1. Create test doctors
node seed-test-doctors.js

# 2. Create test pharmacies
node seed-test-pharmacies.js

# 3. Ready for testing!
```

### During Testing
```bash
# Token about to expire?
node refresh-token.js

# Continue testing with new token
```

---

## 📊 Test Data

### Doctor Credentials
```
Email: [doctor_email]@example.com
Password: secure123
```

**Available Doctors:**
- sam.smith@example.com
- lerato.moloi@example.com
- thabo.ndlela@example.com
- naledi.khumalo@example.com
- kobus.vdm@example.com

### Pharmacy Credentials
```
Email: [pharmacy_email]@example.com
Password: secure123
```

---

## 💾 Test Data Files

### Created by Tests

- `.test-data.json` - Patient test data
- `.test-data-doctor.json` - Doctor test data
- `.test-data-admin.json` - Admin test data
- `.test-data-pharmacy.json` - Pharmacy test data
- `.test-data-new-user.json` - New user registration

### Location
All files saved in root tests/ directory

---

## ⏱️ Timing

- **Seed Doctors:** 2 minutes
- **Seed Pharmacies:** 1 minute
- **Refresh Token:** 1 minute

---

## 🔑 Key Features

✅ Database Seeding  
✅ Test Data Generation  
✅ Token Refresh  
✅ Idempotent Operations  
✅ Automatic File Updates  
✅ Error Handling  

---

## 📝 Notes

- **Idempotent:** Safe to run multiple times
- **No Conflicts:** Same users don't duplicate
- **Clean Output:** Clear status messages
- **Fast:** Completes in seconds
- **Reversible:** Can delete test data manually

---

## 🚀 Quick Help

```bash
# Get help for any utility
node seed-test-doctors.js --help
node seed-test-pharmacies.js --help
node refresh-token.js --help
```

---

## 🔄 Common Workflows

### Complete Fresh Start
```bash
# 1. Clear old test data (optional)
rm .test-data*.json

# 2. Seed new test data
node seed-test-doctors.js
node seed-test-pharmacies.js

# 3. Start testing
cd ../appointments
node 01-login.js
```

### During Long Testing Session
```bash
# 1. Token about to expire?
node refresh-token.js

# 2. Continue testing
node ../test-apt-06-view-appointments.js
```

### Reset Everything
```bash
# 1. Remove all test data files
rm .test-data*.json

# 2. Reseed from scratch
node seed-test-doctors.js
node seed-test-pharmacies.js

# 3. Delete old records (if needed - manual DB operation)
```

---

## 📂 File References

All utilities reference the original implementation:
- Actual utility files: `../[utility-name].js`
- This folder provides organized shortcuts
- Both locations work identically

To run from root:
```bash
node seed-test-doctors.js
```

To run from utils folder:
```bash
cd utils
node seed-test-doctors.js
```

---

## 🐛 Troubleshooting

### Seeds Already Exist
```bash
# Existing data is skipped (idempotent)
# Safe to run again
node seed-test-doctors.js
```

### Token Refresh Not Working
```bash
# Check if test data file exists
ls .test-data.json

# Manual refresh with specific type
node refresh-token.js --patient
```

### Can't Find Test Data
```bash
# Ensure you're in tests directory
cd tests/

# Check what files exist
ls .test-data*.json
```

---

**Category:** Test Infrastructure  
**Utilities:** 3  
**Status:** ✅ Complete
