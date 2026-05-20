═════════════════════════════════════════════════════════════════════════════════
                     🏥 COMPLETE TESTING GUIDE
                         APPOINTMENT + PRESCRIPTION
═════════════════════════════════════════════════════════════════════════════════

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

═════════════════════════════════════════════════════════════════════════════════

## 👨‍⚕️ DOCTOR PRESCRIPTION CREATION FLOW

### 1️⃣ STEP 1: Doctor Login
```bash
node tests/test-doc-01-login.js
```
✅ Saves: email to .test-data-doctor.json
📧 Action: Check email for OTP code

---

### 2️⃣ STEP 2: Verify OTP
⚠️  **Replace 123456 with your OTP from email**
```bash
node tests/test-doc-02-verify-otp.js 123456
```
✅ Saves: authentication token to .test-data-doctor.json

---

### 3️⃣ STEP 3: View Pending Appointments
```bash
node tests/test-doc-03-pending-appointments.js
```
✅ Saves: first pending appointment to .test-data-doctor.json
✅ Shows: list of patients waiting

---

### 4️⃣ STEP 4: Accept Appointment
```bash
node tests/test-doc-04-accept-appointment.js
```
✅ Accepts: the appointment
✅ Ready: for prescription

---

### 5️⃣ STEP 5: Create Prescription
Optional: [DIAGNOSIS] [NOTES]
```bash
# Default values
node tests/test-doc-05-create-prescription.js

# With custom diagnosis and notes
node tests/test-doc-05-create-prescription.js "Bronchitis" "Patient has cough for 3 days"
```
✅ Saves: prescription ID to .test-data-doctor.json
✅ Shows: prescription number and status

---

### 6️⃣ STEP 6: Add Medicine
Optional: [NAME] [DOSAGE] [FREQUENCY] [DURATION] [QUANTITY]
```bash
# Default: Amoxicillin 500mg 3x daily for 7 days
node tests/test-doc-06-add-medicine.js

# With custom medicine
node tests/test-doc-06-add-medicine.js Ibuprofen 400mg "2x daily" "5 days" 10

# Add multiple medicines (run multiple times)
node tests/test-doc-06-add-medicine.js Amoxicillin 500mg "3x daily" "7 days" 21
node tests/test-doc-06-add-medicine.js "Cough Syrup" 10ml "2x daily" "5 days" 1
```
✅ Saves: each medicine to .test-data-doctor.json
✅ Repeatable: add as many medicines as needed

---

### 7️⃣ STEP 7: Check Drug Interactions
```bash
node tests/test-doc-07-check-interactions.js
```
✅ Shows: any drug interactions found
✅ Displays: severity and description

---

### 8️⃣ STEP 8: Request Signature OTP
```bash
node tests/test-doc-08-request-signature-otp.js
```
✅ Sends: signature OTP to your email
📧 Action: Check email for signature OTP

---

### 9️⃣ STEP 9: Sign Prescription
⚠️  **Replace 123456 with Signature OTP from email**
```bash
node tests/test-doc-09-sign-prescription.js 123456
```
✅ Signs: prescription digitally
✅ Generates: QR code

---

### 🔟 STEP 10: View Prescription Details
```bash
node tests/test-doc-10-view-prescription.js
```
✅ Shows: complete prescription
✅ Displays: all medicines and details

═════════════════════════════════════════════════════════════════════════════════

## 💾 DATA FILES SAVED

### Patient Testing (.test-data.json)
- email: Patient email
- token: Authentication token
- selectedDoctorId: Selected doctor ID
- selectedDoctorName: Doctor name
- selectedDate: Selected appointment date
- selectedTimeSlot: Selected time slot
- appointmentId: Booked appointment ID

### Doctor Testing (.test-data-doctor.json)
- email: Doctor email
- token: Authentication token
- selectedAppointmentId: Appointment ID
- patientName: Patient name
- prescriptionId: Prescription ID
- prescriptionNumber: Rx number
- medicines: List of medicines added
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
