# 📅 Appointment Tests

## Overview
Complete test suite for appointment booking, viewing, cancellation, and rescheduling.

## Tests Included

### 1. **01-login.js** - Patient Login
- Logs in a patient with email/password
- Sends OTP to registered email
- Saves email to `.test-data.json`

```bash
node 01-login.js
```

### 2. **02-verify-otp.js** - OTP Verification
- Verifies the OTP code received via email
- Saves authentication token for subsequent requests

```bash
node 02-verify-otp.js 123456
```

### 3. **03-get-doctors.js** - Browse Doctors
- Lists all available doctors in the system
- Shows doctor names, specializations, ratings
- Saves first doctor ID for time slot checking

```bash
node 03-get-doctors.js
```

### 4. **04-get-time-slots.js** - Check Availability
- Gets available time slots for a selected doctor
- Supports date and time period selection
- Shows all available slots for booking

```bash
# Default: tomorrow, morning
node 04-get-time-slots.js

# Custom date and time period
node 04-get-time-slots.js 2026-05-28 afternoon
```

### 5. **05-book-appointment.js** - Book Appointment
- Books an appointment for the patient
- Includes reason for visit/symptoms
- Saves appointment ID for future reference

```bash
# Default symptoms
node 05-book-appointment.js

# Custom symptoms
node 05-book-appointment.js "Fever and cough"
```

### 6. **06-view-appointments.js** - View Appointments
- Shows all booked appointments
- Displays date, time, doctor, reason
- Shows appointment status

```bash
node 06-view-appointments.js
```

### 7. **07-cancel-appointment.js** - Cancel Appointment
- Cancels a previously booked appointment
- Provides cancellation confirmation
- Updates appointment status

```bash
node 07-cancel-appointment.js
```

### 8. **08-reschedule-appointment.js** - Reschedule Appointment
- Reschedules appointment to different date/time
- Optional date and time period parameters
- Updates appointment details

```bash
# Default: 3 days from now, afternoon
node 08-reschedule-appointment.js

# Custom date and time
node 08-reschedule-appointment.js 2026-05-29 evening
```

---

## 🔄 Complete Workflow

```bash
# 1. Login
node 01-login.js

# 2. Verify OTP (check email for code)
node 02-verify-otp.js YOUR_OTP_CODE

# 3. Browse doctors
node 03-get-doctors.js

# 4. Check availability
node 04-get-time-slots.js

# 5. Book appointment
node 05-book-appointment.js

# 6. View appointments
node 06-view-appointments.js

# 7. Optional: Reschedule
node 08-reschedule-appointment.js 2026-05-28 evening

# 8. Optional: Cancel
node 07-cancel-appointment.js
```

---

## 📊 Data Flow

```
Login (Email)
    ↓
Verify OTP (Token)
    ↓
Get Doctors (Doctor ID)
    ↓
Get Time Slots (Date, Time)
    ↓
Book Appointment (Appointment ID)
    ↓
View / Manage Appointments
    ├─ View Appointments
    ├─ Reschedule
    └─ Cancel
```

---

## 💾 Saved Data

Location: `../.test-data.json`

```json
{
  "email": "patient@example.com",
  "token": "JWT_TOKEN",
  "doctorId": "doctor_uuid",
  "appointmentId": "apt_uuid",
  "date": "2026-05-28",
  "timePeriod": "morning",
  "timeSlot": "09:00"
}
```

---

## ⏱️ Timing

- **Complete Flow:** 20 minutes
- **Setup:** 2 minutes
- **Each Test:** 1-2 minutes
- **Token Duration:** 15 minutes

---

## 🔑 Key Features Tested

✅ Patient Authentication  
✅ OTP Verification  
✅ Doctor Listing  
✅ Slot Availability  
✅ Appointment Booking  
✅ Appointment Viewing  
✅ Appointment Cancellation  
✅ Appointment Rescheduling  
✅ Token Refresh  
✅ Error Handling  

---

## 📝 Notes

- Tokens expire after 15 minutes
- Use `../refresh-token.js` to refresh expired tokens
- OTP valid for 10 minutes
- Appointments can be booked 90 days in advance
- Time slots are 30-minute intervals

---

## 🚀 Quick Help

```bash
# Get help for any test
node 01-login.js --help
node 05-book-appointment.js --help
```

---

## 📂 File References

All tests reference the original implementation in the root `tests/` directory:
- Actual test files: `../test-apt-*.js`
- This folder provides organized shortcuts
- Both locations work identically

To run from root:
```bash
node test-apt-01-login.js
```

To run from appointments folder:
```bash
cd appointments
node 01-login.js
```

---

**Category:** Appointment Booking System  
**Tests:** 8  
**Status:** ✅ Complete
