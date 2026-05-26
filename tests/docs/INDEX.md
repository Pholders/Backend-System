# 📚 Test Documentation Index

## Complete Documentation Guide

### 📋 Main Guides

1. **[README_COMPREHENSIVE.md](../README_COMPREHENSIVE.md)** - Start Here!
   - Complete overview of all 29 tests
   - Setup instructions
   - Workflow examples
   - Troubleshooting guide

2. **[TESTING_GUIDE.md](../TESTING_GUIDE.md)** - Detailed Step-by-Step
   - Each test explained in detail
   - Appointment booking flow
   - Prescription workflow
   - Admin operations
   - Error handling

3. **[TEST_SUITE_SUMMARY.md](../TEST_SUITE_SUMMARY.md)** - Architecture & Patterns
   - System overview
   - Test organization
   - Common patterns
   - File references
   - Coverage matrix

4. **[QUICK_REFERENCE.md](../QUICK_REFERENCE.md)** - Command Quick Reference
   - All test files at a glance
   - Command examples
   - Parameter reference
   - Data files reference

---

## 📂 Category Documentation

### Appointments (8 tests)
See: [appointments/README.md](../appointments/README.md)
- Patient login & OTP
- Browse doctors
- Check availability
- Book, view, cancel, reschedule appointments

### Prescriptions - Doctors (6 tests)
See: [doctors/README.md](../doctors/README.md)
- Doctor login & OTP
- View pending appointments
- Create prescriptions
- Add medicines
- Digital signatures

### Patient Operations (3 tests)
See: [patients/README.md](../patients/README.md)
- View prescriptions
- View prescription details
- Rate doctors

### Admin Operations (3 tests)
See: [admin/README.md](../admin/README.md)
- Admin login
- OTP verification
- View system users

### Pharmacy Operations (1 test)
See: [pharmacy/README.md](../pharmacy/README.md)
- Pharmacy login & OTP

### Error Handling (2 tests)
See: [errors/README.md](../errors/README.md)
- Invalid tokens
- Invalid inputs

### User Flows (2 tests)
See: [flows/README.md](../flows/README.md)
- Password reset
- User registration

### Utilities (3 tools)
See: [utils/README.md](../utils/README.md)
- Seed test doctors
- Seed test pharmacies
- Refresh tokens

---

## 🚀 Getting Started

### For First Time Users
1. Read: [README_COMPREHENSIVE.md](../README_COMPREHENSIVE.md)
2. Check: [appointments/README.md](../appointments/README.md)
3. Run: First appointment test
4. Reference: [QUICK_REFERENCE.md](../QUICK_REFERENCE.md) as needed

### For Specific Features
- **Appointments?** → [appointments/README.md](../appointments/README.md)
- **Prescriptions?** → [doctors/README.md](../doctors/README.md)
- **Patient operations?** → [patients/README.md](../patients/README.md)
- **Admin tasks?** → [admin/README.md](../admin/README.md)
- **Help with commands?** → [QUICK_REFERENCE.md](../QUICK_REFERENCE.md)
- **Errors or issues?** → [errors/README.md](../errors/README.md)

### For Detailed Information
- **Complete system design** → [TEST_SUITE_SUMMARY.md](../TEST_SUITE_SUMMARY.md)
- **Step-by-step guide** → [TESTING_GUIDE.md](../TESTING_GUIDE.md)

---

## 📊 Documentation Map

```
Documentation/
├── README_COMPREHENSIVE.md (Overview & Getting Started)
├── TESTING_GUIDE.md (Detailed Workflows)
├── TEST_SUITE_SUMMARY.md (Architecture)
├── QUICK_REFERENCE.md (Commands)
└── docs/INDEX.md (This file)

Test Categories/
├── appointments/README.md
├── doctors/README.md
├── patients/README.md
├── admin/README.md
├── pharmacy/README.md
├── errors/README.md
├── flows/README.md
└── utils/README.md
```

---

## 🎯 Common Tasks

### "I want to test appointments"
1. Read: [appointments/README.md](../appointments/README.md)
2. Run: `cd appointments && node 01-login.js`
3. Follow: On-screen instructions

### "I want to test prescriptions"
1. Read: [doctors/README.md](../doctors/README.md)
2. Run: `cd doctors && node 01-login.js sam.smith@example.com`
3. Follow: Workflow in README

### "I need a command reference"
1. Check: [QUICK_REFERENCE.md](../QUICK_REFERENCE.md)
2. Find: Your command
3. Run: With your parameters

### "I'm getting an error"
1. Read: [errors/README.md](../errors/README.md)
2. Check: Common issues
3. Review: [TESTING_GUIDE.md](../TESTING_GUIDE.md) troubleshooting

### "I need to set up test data"
1. Run: `cd utils && node seed-test-doctors.js`
2. Run: `node seed-test-pharmacies.js`
3. Continue: With your tests

---

## 📖 File Organization

### Quick Links to Tests

**Appointments:**
```bash
tests/appointments/01-login.js
tests/appointments/02-verify-otp.js
tests/appointments/03-get-doctors.js
tests/appointments/04-get-time-slots.js
tests/appointments/05-book-appointment.js
tests/appointments/06-view-appointments.js
tests/appointments/07-cancel-appointment.js
tests/appointments/08-reschedule-appointment.js
```

**Doctors:**
```bash
tests/doctors/01-login.js
tests/doctors/02-verify-otp.js
tests/doctors/03-pending-appointments.js
tests/doctors/04-create-prescription.js
tests/doctors/05-add-medicines.js
tests/doctors/06-sign-prescription.js
```

**Patients:**
```bash
tests/patients/01-view-prescriptions.js
tests/patients/02-prescription-details.js
tests/patients/03-rate-doctor.js
```

**Admin:**
```bash
tests/admin/01-login.js
tests/admin/02-verify-otp.js
tests/admin/03-view-users.js
```

**Other:**
```bash
tests/pharmacy/01-login.js
tests/errors/01-invalid-tokens.js
tests/errors/02-invalid-inputs.js
tests/flows/01-password-reset.js
tests/flows/02-user-registration.js
tests/utils/seed-test-doctors.js
tests/utils/seed-test-pharmacies.js
tests/utils/refresh-token.js
```

---

## 💡 Tips

1. **Always start with setup:** Run seed scripts first
2. **Use quick reference:** [QUICK_REFERENCE.md](../QUICK_REFERENCE.md) is your friend
3. **Follow workflows:** Each category has a recommended order
4. **Check emails:** OTP codes sent to configured email
5. **Token expires:** Use refresh utility if needed
6. **Test independently:** Each test can run on its own
7. **Save data:** Tests persist data in JSON files

---

## 📞 Support

### Need Help?

1. **Setup issues?** → See [utils/README.md](../utils/README.md)
2. **Command not working?** → Check [QUICK_REFERENCE.md](../QUICK_REFERENCE.md)
3. **Workflow questions?** → Read [TESTING_GUIDE.md](../TESTING_GUIDE.md)
4. **Architecture/design?** → See [TEST_SUITE_SUMMARY.md](../TEST_SUITE_SUMMARY.md)
5. **Specific category?** → Find category README

---

## ✅ Quick Checklist

Before testing:
- [ ] Backend server running (`localhost:3000`)
- [ ] Database configured and running
- [ ] Email service configured
- [ ] Seed data created (`seed-test-doctors.js`, `seed-test-pharmacies.js`)

During testing:
- [ ] Token not expired (check with `refresh-token.js`)
- [ ] Following recommended workflow order
- [ ] Saving test data files
- [ ] Checking emails for OTP codes

After testing:
- [ ] All tests passed
- [ ] No errors in console
- [ ] Database has expected data
- [ ] Ready for frontend integration

---

## 📝 Documentation Version

**Version:** 1.0  
**Last Updated:** May 26, 2026  
**Test Suite:** 29 comprehensive tests  
**Coverage:** Complete end-to-end system

---

**Start with:** [README_COMPREHENSIVE.md](../README_COMPREHENSIVE.md)  
**Quick Commands:** [QUICK_REFERENCE.md](../QUICK_REFERENCE.md)  
**Detailed Guide:** [TESTING_GUIDE.md](../TESTING_GUIDE.md)
