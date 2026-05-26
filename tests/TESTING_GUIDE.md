═════════════════════════════════════════════════════════════════════════════════
                     🏥 COMPLETE COMPREHENSIVE TESTING GUIDE
              APPOINTMENTS | PRESCRIPTIONS | ADMIN | PHARMACY | ERROR HANDLING
═════════════════════════════════════════════════════════════════════════════════

**Last Updated:** May 26, 2026
**Test Coverage:** 25+ comprehensive test scenarios

## 📋 SETUP: Seed Test Data

Before running the appointment flow, seed the database with test doctors and pharmacies:

### 1. Seed Test Doctors (5 doctors with various specializations)
```bash
node tests/seed-test-doctors.js
```
Creates:
- Sam Smith (General Practitioner)
- Lerato Moloi (Paediatrician)
- Thabo Ndlela (Cardiologist)
- Naledi Khumalo (Dermatologist)
- Kobus van der Merwe (Orthopedic Surgeon)

### 2. Seed Test Pharmacies (3 pharmacies)
```bash
node tests/seed-test-pharmacies.js
```
Creates:
- MediCare Pharmacy (Bryanston)
- HealthFirst Pharmacy (Sandton)
- Care Plus Pharmacy (Midrand)

✅ Both scripts are idempotent - safe to run multiple times!

═════════════════════════════════════════════════════════════════════════════════

## ⏱️ IMPORTANT: Token Expiration

**Tokens expire after 15 minutes**

If you get error: `"Session expired or revoked. Please login again."`

### 🔄 Refresh Your Token (No Re-login!)
```bash
# For Patient tests
node tests/refresh-token.js --patient

# For Doctor tests
node tests/refresh-token.js --doctor

# Auto-detect (uses most recent)
node tests/refresh-token.js
```

✅ Your token will be updated automatically - no need to re-login!

═════════════════════════════════════════════════════════════════════════════════

## 📋 PATIENT APPOINTMENT BOOKING FLOW

### 1️⃣ STEP 1: Patient Login
```bash
node tests/test-apt-01-login.js
```
✅ Saves: email to .test-data.json
📧 Action: Check email for OTP code

---

### 2️⃣ STEP 2: Verify OTP
⚠️  **Replace 123456 with your OTP from email**
```bash
node tests/test-apt-02-verify-otp.js 123456
```
✅ Saves: authentication token to .test-data.json
✅ Ready for next step

---

### 3️⃣ STEP 3: View Available Doctors
```bash
node tests/test-apt-03-get-doctors.js
```
✅ Saves: first doctor ID to .test-data.json
✅ Shows: list of doctors with ratings

---

### 4️⃣ STEP 4: Get Available Time Slots
Optional parameters: [DATE] [TIME_PERIOD]
```bash
# Default: tomorrow, morning
node tests/test-apt-04-get-time-slots.js

# With date (YYYY-MM-DD)
node tests/test-apt-04-get-time-slots.js 2026-05-21

# With date and time period (morning/afternoon/evening/night)
node tests/test-apt-04-get-time-slots.js 2026-05-21 afternoon
```
✅ Saves: date and time slot to .test-data.json
✅ Shows: available slots for doctor

---

### 5️⃣ STEP 5: Book Appointment
Optional: [SYMPTOMS]
```bash
# Default symptoms: "General checkup"
node tests/test-apt-05-book-appointment.js

# With custom symptoms
node tests/test-apt-05-book-appointment.js "Fever and cough"
```
✅ Saves: appointment ID to .test-data.json
✅ Confirms: booking successful

---

### 6️⃣ STEP 6: View Your Appointments
```bash
node tests/test-apt-06-view-appointments.js
```
✅ Shows: all your booked appointments

---

### 7️⃣ STEP 7: Cancel Appointment
```bash
node tests/test-apt-07-cancel-appointment.js
```
✅ Cancels: the booked appointment
✅ Saves: cancellation confirmation

---

### 8️⃣ STEP 8: Reschedule Appointment
Optional parameters: [DATE] [TIME_PERIOD]
```bash
# Default: 3 days from now, afternoon
node tests/test-apt-08-reschedule-appointment.js

# With specific date and time
node tests/test-apt-08-reschedule-appointment.js 2026-05-28 evening
```
✅ Reschedules: appointment to new date/time
✅ Saves: updated appointment details

═════════════════════════════════════════════════════════════════════════════════

## 👨‍⚕️ DOCTOR PRESCRIPTION CREATION FLOW

### 1️⃣ STEP 1: Doctor Login
```bash
node tests/test-pres-01-doctor-login.js [EMAIL]
```
✅ Saves: email to .test-data-doctor.json
📧 Action: Check email for OTP code

Example:
```bash
node tests/test-pres-01-doctor-login.js sam.smith@example.com
```

---

### 2️⃣ STEP 2: Verify OTP
⚠️  **Replace 123456 with your OTP from email**
```bash
node tests/test-pres-02-verify-otp.js 123456
```
✅ Saves: authentication token to .test-data-doctor.json

---

### 3️⃣ STEP 3: View Pending Appointments
```bash
node tests/test-pres-03-pending-appointments.js
```
✅ Saves: first pending appointment to .test-data-doctor.json
✅ Shows: list of patients waiting

---

### 4️⃣ STEP 4: Create Prescription
```bash
node tests/test-pres-04-create-prescription.js
```
✅ Saves: prescription ID to .test-data-doctor.json
✅ Shows: prescription number and status

---

### 5️⃣ STEP 5: Add Medicines
Optional: [NUMBER_OF_MEDICINES]
```bash
# Add all 3 pre-configured medicines
node tests/test-pres-05-add-medicines.js

# Add only the first medicine
node tests/test-pres-05-add-medicines.js 1

# Add first 2 medicines
node tests/test-pres-05-add-medicines.js 2
```
✅ Saves: medicine details to .test-data-doctor.json
✅ Displays: all medicines added

---

### 6️⃣ STEP 6: Sign Prescription (with OTP)
```bash
# Step 1: Request OTP (sends email)
node tests/test-pres-06-sign-prescription.js

# Step 2: Sign with OTP code (replace 123456)
node tests/test-pres-06-sign-prescription.js 123456
```
✅ Requests: signature OTP
✅ Signs: prescription digitally (RSA-SHA256)
✅ Generates: QR code for patient

═════════════════════════════════════════════════════════════════════════════════

## 👤 PATIENT PRESCRIPTION OPERATIONS

### 1️⃣ View All Prescriptions
```bash
node tests/test-patient-01-view-prescriptions.js
```
✅ Shows: all signed and pending prescriptions
✅ Displays: doctor, diagnosis, medicines
✅ Saves: latest prescription ID

---

### 2️⃣ View Prescription Details
Optional: [PRESCRIPTION_ID]
```bash
# View latest prescription
node tests/test-patient-02-prescription-details.js

# View specific prescription
node tests/test-patient-02-prescription-details.js 123abc456
```
✅ Displays: complete prescription details
✅ Shows: all medicines and dosages
✅ Displays: digital signature info

---

### 3️⃣ Rate Doctor
Optional: [RATING] [REVIEW]
```bash
# Rate 5 stars with default message
node tests/test-patient-03-rate-doctor.js

# Rate 4 stars with custom review
node tests/test-patient-03-rate-doctor.js 4 "Professional and caring doctor"
```
✅ Saves: rating and review
✅ Updates: doctor rating

═════════════════════════════════════════════════════════════════════════════════

## 👨‍💼 ADMIN OPERATIONS

### 1️⃣ STEP 1: Admin Login
```bash
node tests/test-admin-01-login.js [EMAIL] [PASSWORD]
```
✅ Saves: email to .test-data-admin.json
📧 Action: Check email for OTP

Default: admin@example.com / secure123

---

### 2️⃣ STEP 2: Verify OTP
```bash
node tests/test-admin-02-verify-otp.js 123456
```
✅ Saves: admin token to .test-data-admin.json

---

### 3️⃣ STEP 3: View All Users
```bash
node tests/test-admin-03-view-users.js
```
✅ Shows: all patients, doctors, pharmacists, admins
✅ Displays: user count by role
✅ Shows: verification status

═════════════════════════════════════════════════════════════════════════════════

## 💊 PHARMACY OPERATIONS

### 1️⃣ Pharmacy Login
```bash
node tests/test-pharmacy-01-login.js [EMAIL] [PASSWORD]
```
✅ Saves: email to .test-data-pharmacy.json
📧 Action: Check email for OTP

Default: pharmacy@example.com / secure123

═════════════════════════════════════════════════════════════════════════════════

═════════════════════════════════════════════════════════════════════════════════

## 🧪 ERROR HANDLING TESTS

### 1️⃣ Test Invalid Tokens
```bash
node tests/test-errors-01-invalid-tokens.js
```
✅ Tests: missing token, invalid token, malformed headers
✅ Verifies: proper error responses (401/403)
✅ Checks: API security

---

### 2️⃣ Test Invalid Inputs
```bash
node tests/test-errors-02-invalid-inputs.js
```
✅ Tests: missing required fields, invalid formats
✅ Verifies: input validation
✅ Checks: error messages

═════════════════════════════════════════════════════════════════════════════════

## 🔄 USER MANAGEMENT FLOWS

### 1️⃣ Password Reset Flow
```bash
# Step 1: Request reset
node tests/test-flow-01-password-reset.js user@example.com

# Step 2: Reset with token from email
node tests/test-flow-01-password-reset.js user@example.com TOKEN newPassword123
```
✅ Sends: password reset email
✅ Validates: reset token
✅ Updates: user password

---

### 2️⃣ User Registration
```bash
# Quick registration
node tests/test-flow-02-user-registration.js

# With custom details
node tests/test-flow-02-user-registration.js john@example.com John Doe +27123456789
```
✅ Creates: new patient account
✅ Sends: verification email
✅ Saves: credentials to .test-data-new-user.json

═════════════════════════════════════════════════════════════════════════════════

## 💾 DATA FILES SAVED

### Patient Testing (.test-data.json)
```json
{
  "email": "patient@example.com",
  "token": "JWT_TOKEN_HERE",
  "refreshToken": "REFRESH_TOKEN_HERE",
  "doctorId": "doctor_uuid",
  "doctorName": "Dr. Name",
  "appointmentId": "apt_uuid",
  "date": "2026-05-28",
  "timePeriod": "morning",
  "timeSlot": "09:00",
  "latestPrescriptionId": "pres_uuid",
  "reviewId": "review_uuid"
}
```

### Doctor Testing (.test-data-doctor.json)
```json
{
  "email": "doctor@example.com",
  "token": "JWT_TOKEN_HERE",
  "appointmentId": "apt_uuid",
  "patientId": "patient_uuid",
  "patientName": "Patient Name",
  "prescriptionId": "pres_uuid",
  "prescriptionNumber": "RX-2026-001",
  "prescriptionStatus": "pending",
  "medicinesAdded": [
    {"name": "Medicine 1", "dosage": "500mg", "frequency": "3x daily"}
  ],
  "prescriptionSigned": true
}
```

### Admin Testing (.test-data-admin.json)
```json
{
  "email": "admin@example.com",
  "role": "admin",
  "token": "JWT_TOKEN_HERE"
}
```

### Pharmacy Testing (.test-data-pharmacy.json)
```json
{
  "email": "pharmacy@example.com",
  "role": "pharmacy",
  "token": "JWT_TOKEN_HERE"
}
```

### New User Registration (.test-data-new-user.json)
```json
{
  "email": "new.user@example.com",
  "password": "TestPassword123!",
  "firstName": "Test",
  "lastName": "Patient",
  "registeredAt": "2026-05-26T10:30:00.000Z"
}
```
- signed: Boolean - if prescription is signed

═════════════════════════════════════════════════════════════════════════════════

## 🔧 TROUBLESHOOTING

### "Session expired or revoked" error
→ Token expired! Use refresh script:
```bash
node tests/refresh-token.js --patient    # or --doctor
```
✅ This gets a new token without re-login!

### "OTP expired" error
→ Run Step 1 again to get a fresh OTP

### "Token not found"
→ Run Step 2 (OTP verification) first

### "Appointment not found"
→ Make sure you completed Step 5 (Book Appointment) first

### "No pending appointments"
→ A patient needs to book an appointment first

### Server connection issues
→ Ensure backend server is running: npm run dev
→ Check server is on port 3000: netstat -ano | findstr :3000

### Token keeps expiring
→ Tokens only last 15 minutes
→ Use refresh script between tests:
```bash
node tests/refresh-token.js
```

═════════════════════════════════════════════════════════════════════════════════

## 📊 QUICK WORKFLOW EXAMPLES

### Full Patient Journey (All steps)
```bash
node tests/test-apt-01-login.js
# ↓ Get OTP from email
node tests/test-apt-02-verify-otp.js YOUR_OTP
node tests/test-apt-03-get-doctors.js
node tests/test-apt-04-get-time-slots.js
node tests/test-apt-05-book-appointment.js "My symptoms"
node tests/test-apt-06-view-appointments.js
```

### Full Doctor Journey (All steps)
```bash
node tests/test-doc-01-login.js
# ↓ Get OTP from email
node tests/test-doc-02-verify-otp.js YOUR_OTP
node tests/test-doc-03-pending-appointments.js
node tests/test-doc-04-accept-appointment.js
node tests/test-doc-05-create-prescription.js "Diagnosis" "Notes"
node tests/test-doc-06-add-medicine.js
node tests/test-doc-07-check-interactions.js
node tests/test-doc-08-request-signature-otp.js
# ↓ Get Signature OTP from email
node tests/test-doc-09-sign-prescription.js SIGNATURE_OTP
node tests/test-doc-10-view-prescription.js
```

═════════════════════════════════════════════════════════════════════════════════
                          🎉 HAPPY TESTING! 🎉
═════════════════════════════════════════════════════════════════════════════════
