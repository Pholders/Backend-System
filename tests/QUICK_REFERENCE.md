# 📋 Test Files Quick Reference

## 🎯 All Test Files at a Glance

### **NEW: Appointment Management (8 tests)**
| File | Purpose | Params | Output |
|------|---------|--------|--------|
| `test-apt-01-login.js` | Patient login | None | Email in .test-data.json |
| `test-apt-02-verify-otp.js` | Verify OTP | OTP code | Token in .test-data.json |
| `test-apt-03-get-doctors.js` | List doctors | None | Doctor ID in .test-data.json |
| `test-apt-04-get-time-slots.js` | Get slots | [DATE] [TIME] | Slot info in .test-data.json |
| `test-apt-05-book-appointment.js` | Book apt | [SYMPTOMS] | Appointment ID in .test-data.json |
| `test-apt-06-view-appointments.js` | View apts | None | All appointments |
| **`test-apt-07-cancel-appointment.js`** | **Cancel apt** | **None** | **Cancellation confirmed** |
| **`test-apt-08-reschedule-appointment.js`** | **Reschedule apt** | **[DATE] [TIME]** | **New slot confirmed** |

### **NEW: Prescription Workflow - Doctor (6 tests)**
| File | Purpose | Params | Output |
|------|---------|--------|--------|
| `test-pres-01-doctor-login.js` | Doctor login | [EMAIL] | Email in .test-data-doctor.json |
| `test-pres-02-verify-otp.js` | Verify OTP | OTP code | Token in .test-data-doctor.json |
| `test-pres-03-pending-appointments.js` | View pending apts | None | Appointment ID saved |
| `test-pres-04-create-prescription.js` | Create prescription | None | Prescription ID saved |
| `test-pres-05-add-medicines.js` | Add medicines | [NUM_MEDICINES] | Medicines added & saved |
| `test-pres-06-sign-prescription.js` | Sign prescription | [OTP] | Signed & QR generated |

### **NEW: Patient Operations (3 tests)**
| File | Purpose | Params | Output |
|------|---------|--------|--------|
| `test-patient-01-view-prescriptions.js` | List prescriptions | None | All prescriptions |
| `test-patient-02-prescription-details.js` | View details | [PRES_ID] | Full prescription details |
| **`test-patient-03-rate-doctor.js`** | **Rate doctor** | **[RATING] [REVIEW]** | **Rating saved** |

### **NEW: Admin Operations (3 tests)**
| File | Purpose | Params | Output |
|------|---------|--------|--------|
| `test-admin-01-login.js` | Admin login | [EMAIL] [PWD] | Email in .test-data-admin.json |
| `test-admin-02-verify-otp.js` | Verify OTP | OTP code | Token in .test-data-admin.json |
| `test-admin-03-view-users.js` | View all users | None | User count by role |

### **NEW: Pharmacy Operations (1 test)**
| File | Purpose | Params | Output |
|------|---------|--------|--------|
| `test-pharmacy-01-login.js` | Pharmacy login | [EMAIL] [PWD] | Email in .test-data-pharmacy.json |

### **NEW: Error Handling Tests (2 tests)**
| File | Purpose | Tests |
|------|---------|-------|
| **`test-errors-01-invalid-tokens.js`** | **Token validation** | **No token, Invalid token, Malformed headers, Invalid endpoint** |
| **`test-errors-02-invalid-inputs.js`** | **Input validation** | **Missing fields, Invalid email, Empty values, Invalid format** |

### **NEW: User Management Flows (2 tests)**
| File | Purpose | Params | Output |
|------|---------|--------|--------|
| **`test-flow-01-password-reset.js`** | **Password reset** | **[EMAIL] [TOKEN] [NEW_PWD]** | **Password updated** |
| **`test-flow-02-user-registration.js`** | **User registration** | **[EMAIL] [NAME] [PHONE]** | **Account created, .test-data-new-user.json** |

### **Existing: Setup & Utilities (3 files)**
| File | Purpose | Output |
|------|---------|--------|
| `seed-test-doctors.js` | Create test doctors | 5 doctors in database |
| `seed-test-pharmacies.js` | Create test pharmacies | 3 pharmacies in database |
| `refresh-token.js` | Refresh expired tokens | New token in .test-data*.json |

### **Existing: Password Reset (1 file)**
| File | Purpose | Output |
|------|---------|--------|
| `password-reset/test-password-reset.js` | Full password reset flow | Password reset demo |

---

## 🚀 Quick Command Reference

### Login Tests
```bash
# Appointment patient
node tests/test-apt-01-login.js

# Doctor
node tests/test-pres-01-doctor-login.js sam.smith@example.com

# Admin
node tests/test-admin-01-login.js admin@example.com secure123

# Pharmacy
node tests/test-pharmacy-01-login.js pharmacy@example.com secure123
```

### Verify OTP
```bash
# Patient
node tests/test-apt-02-verify-otp.js 123456

# Doctor
node tests/test-pres-02-verify-otp.js 123456

# Admin
node tests/test-admin-02-verify-otp.js 123456
```

### Appointment Operations
```bash
# Book
node tests/test-apt-05-book-appointment.js "Fever and cough"

# Cancel
node tests/test-apt-07-cancel-appointment.js

# Reschedule
node tests/test-apt-08-reschedule-appointment.js 2026-05-28 evening
```

### Prescription Operations
```bash
# Create
node tests/test-pres-04-create-prescription.js

# Add medicines
node tests/test-pres-05-add-medicines.js 2

# Sign (step 1: request OTP)
node tests/test-pres-06-sign-prescription.js

# Sign (step 2: verify with OTP)
node tests/test-pres-06-sign-prescription.js 123456
```

### Patient Operations
```bash
# View all
node tests/test-patient-01-view-prescriptions.js

# View details
node tests/test-patient-02-prescription-details.js abc123

# Rate doctor
node tests/test-patient-03-rate-doctor.js 5 "Excellent care!"
```

### Admin Operations
```bash
# View users
node tests/test-admin-03-view-users.js
```

### Error Handling
```bash
# Test invalid tokens
node tests/test-errors-01-invalid-tokens.js

# Test invalid inputs
node tests/test-errors-02-invalid-inputs.js
```

### User Management
```bash
# Password reset
node tests/test-flow-01-password-reset.js user@example.com

# Registration
node tests/test-flow-02-user-registration.js john@example.com John Doe +27123456789
```

### Utilities
```bash
# Setup test data
node tests/seed-test-doctors.js
node tests/seed-test-pharmacies.js

# Refresh token
node tests/refresh-token.js
```

---

## 📊 Test Count Summary

| Category | Count | Status |
|----------|-------|--------|
| Appointments | 8 | ✅ NEW |
| Prescriptions (Doctor) | 6 | ✅ NEW |
| Patient Operations | 3 | ✅ NEW (1 existing) |
| Admin Operations | 3 | ✅ NEW |
| Pharmacy Operations | 1 | ✅ NEW |
| Error Handling | 2 | ✅ NEW |
| User Management | 2 | ✅ NEW |
| Setup & Utilities | 3 | ✅ Existing |
| Password Reset | 1 | ✅ Existing |
| **TOTAL** | **29** | **✅ COMPREHENSIVE** |

---

## 🎯 Typical Test Execution Paths

### Path 1: Full Appointment + Prescription (45 min)
```
Seed Data → Patient Login → OTP → Doctors → Slots → Book
  ↓
Doctor Login → OTP → Pending → Create Prescription
  ↓
Add Medicines → Sign Prescription → Patient Views
  ↓
Rate Doctor
```

### Path 2: Quick Appointment Test (10 min)
```
Patient Login → OTP → Doctors → Book → View → Cancel
```

### Path 3: Admin Verification (5 min)
```
Admin Login → OTP → View Users
```

### Path 4: Error Handling (5 min)
```
Invalid Tokens Test → Invalid Inputs Test
```

### Path 5: New User Flow (15 min)
```
Registration → Password Reset → Login → Browse
```

---

## 📂 Data Files Reference

| File | Created By | Contains | Used By |
|------|-----------|----------|---------|
| `.test-data.json` | Login | Email, Token, Doctor ID, Apt ID | Appointment tests |
| `.test-data-doctor.json` | Doctor Login | Email, Token, Apt ID, Pres ID | Prescription tests |
| `.test-data-admin.json` | Admin Login | Email, Token | Admin tests |
| `.test-data-pharmacy.json` | Pharmacy Login | Email, Token | Pharmacy tests |
| `.test-data-new-user.json` | Registration | Email, Password, Name | User mgmt tests |

---

## ✨ Features Tested

✅ User Authentication (Login, OTP, Tokens)  
✅ Appointment Booking (Create, View, Cancel, Reschedule)  
✅ Prescription Management (Create, Add Medicines, Sign)  
✅ Digital Signatures (RSA-SHA256)  
✅ Doctor Ratings & Reviews  
✅ Admin Functions (View Users)  
✅ Pharmacy Operations (Login, OTP)  
✅ Error Handling (Invalid tokens, Invalid inputs)  
✅ User Registration & Password Reset  
✅ Token Refresh & Expiration  
✅ Input Validation  
✅ Authorization Checks  

---

## 🔍 Help & Documentation

```bash
# Get help for any test
node tests/test-apt-01-login.js --help
node tests/test-pres-05-add-medicines.js --help
node tests/test-patient-03-rate-doctor.js --help
# etc...
```

---

**Version:** 1.0  
**Created:** May 26, 2026  
**Test Files:** 29 total (13 NEW)  
**Coverage:** Comprehensive end-to-end testing
