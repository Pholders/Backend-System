# 🧪 Test Suite

Organized test suite for the healthcare backend system. Tests are grouped by role/feature for easy navigation and maintenance.

## 📁 Folder Structure

```
tests/
├── appointments/          # Patient appointment booking tests
├── doctors/              # Doctor prescription management tests
├── patients/             # Patient view operations tests
├── admin/                # Admin dashboard tests
├── pharmacy/             # Pharmacy operations tests
├── errors/               # Error handling & edge cases
├── flows/                # Complete workflow tests
├── utils/                # Utility scripts (seeders, cleanup)
├── docs/                 # Documentation index
└── password-reset/       # Password reset flow tests
```

## 🚀 Quick Start

### 1. Appointments Workflow (Patient)
```bash
cd appointments
node 01-login.js                    # Login as patient
node 02-verify-otp.js <OTP_CODE>    # Verify OTP from email
node 03-get-doctors.js              # View available doctors
node 04-get-time-slots.js           # Get available time slots
node 05-book-appointment.js          # Book appointment
node 06-view-appointments.js        # View booked appointments
node 07-cancel-appointment.js       # Cancel appointment
node 08-reschedule-appointment.js   # Reschedule appointment
```

### 2. Doctors Workflow (Prescription)
```bash
cd doctors
node 01-login.js                    # Login as doctor
node 02-verify-otp.js <OTP_CODE>    # Verify OTP from email
node 03-pending-appointments.js     # View pending appointments
node 04-create-prescription.js      # Create new prescription
node 05-add-medicines.js            # Add medicines to prescription
node 06-sign-prescription.js        # Sign prescription digitally
```

### 3. Patient Operations
```bash
cd patients
node 01-view-prescriptions.js       # View my prescriptions
node 02-prescription-details.js     # View prescription details
node 03-rate-doctor.js              # Rate and review doctor
```

### 4. Admin Operations
```bash
cd admin
node 01-login.js                    # Admin login
node 02-verify-otp.js <OTP_CODE>    # Verify OTP
node 03-view-users.js               # View system users
```

### 5. Error Handling Tests
```bash
cd errors
node 01-invalid-tokens.js           # Test invalid token handling
node 02-invalid-inputs.js           # Test validation errors
```

### 6. Flow Tests
```bash
cd flows
node 01-password-reset.js           # Complete password reset flow
node 02-user-registration.js        # Complete user registration flow
```

## 🔧 Utilities

```bash
cd utils
node seed-test-doctors.js           # Seed test doctors to database
node seed-test-pharmacies.js        # Seed test pharmacies to database
node refresh-token.js               # Generate refresh token
node cleanup-doctors.js             # Remove test doctors
```

## 📝 Test Data

Tests use persistent JSON files for state management:
- .test-data.json - Patient/user test data
- .test-data-doctor.json - Doctor test data
- .test-data-admin.json - Admin test data
- .test-data-pharmacy.json - Pharmacy test data
- .test-data-new-user.json - New user registration data

## 📚 Documentation

- [TESTING_GUIDE.md](./TESTING_GUIDE.md) - Comprehensive testing guide
- [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) - Command reference
- [TEST_SUITE_SUMMARY.md](./TEST_SUITE_SUMMARY.md) - Detailed test info
- [docs/INDEX.md](./docs/INDEX.md) - Documentation index

See individual folder README.md files for detailed test descriptions.

## ✅ Test Requirements

- Node.js installed
- Server running on localhost:3000
- Database connected
- Email service configured
- .env file with credentials

## 🔍 Each Folder Has Detailed README

Each test folder contains a README.md with:
- Detailed test descriptions
- Prerequisites
- Example usage
- Expected outputs
- Troubleshooting tips

Start with the folder you're interested in and check its README!

---

**Quick Help**: Check individual folder README.md files for test-specific details and examples. For comprehensive testing guide, see [TESTING_GUIDE.md](./TESTING_GUIDE.md)
