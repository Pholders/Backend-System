# 🧪 Test Scripts

This folder contains test and integration scripts for testing the backend system endpoints and functionality.

## 📋 Test Files

### test-email.js
**Purpose**: Test email configuration and OTP delivery  
**What it does**:
- Verifies email service is configured correctly
- Tests connection to email provider (Gmail, SendGrid, Outlook)
- Sends a test OTP email to verify email templates work
- Displays email configuration status

**Usage**:
```bash
node test-email.js
```

**Requirements**:
- `.env` file with EMAIL_USER and EMAIL_PASSWORD set
- Gmail: App Password (not regular password)
- Database connection active

**Output**:
- ✅ Email service status
- ✅ Test email sent confirmation
- ⚠️ Configuration issues if any

---

### test-login.js
**Purpose**: Test user login endpoint  
**What it does**:
- Sends a POST request to `/api/users/login`
- Tests authentication flow
- Verifies OTP is generated and sent
- Shows response from server

**Usage**:
```bash
node test-login.js
```

**Default Test User**:
- Email: `princengwakomashumu@gmail.com`
- Password: `secure123`

**Requirements**:
- Server running on `localhost:3000`
- Database has test user
- Email service configured

**Output**:
- Response status and data
- Success/failure message
- OTP sent confirmation

---

### test-verify-otp.js
**Purpose**: Test OTP verification endpoint  
**What it does**:
- Sends POST request to `/api/users/verify-otp`
- Verifies OTP code
- Tests JWT token generation
- Shows authentication response

**Usage**:
```bash
node test-verify-otp.js
```

**Requirements**:
- Valid OTP code (from login test)
- Email address of test user
- Server running on `localhost:3000`

**Output**:
- Verification status
- JWT token (if successful)
- Session information

---

### test-appointment-booking.js ⭐ NEW
**Purpose**: Test complete appointment booking flow for patients  
**What it does**:
- Patient login with OTP verification
- Retrieve list of available doctors with ratings & reviews
- Get available time slots for selected doctor
- Book an appointment with symptoms
- Retrieve patient's appointments

**Usage**:
```bash
node test-appointment-booking.js
```

**Test Flow Steps**:
1. Patient login
2. Verify OTP (get code from email)
3. Get available doctors
4. Get available time slots
5. Book appointment
6. Retrieve booked appointments

**Requirements**:
- Server running on `localhost:3000`
- Patient account exists
- At least one active doctor in database
- Email service working for OTP

**Test Credentials**:
- Email: `princengwakomashumu@gmail.com`
- Password: `secure123`

**Output**:
- ✅ Doctor list with ratings
- ✅ Available time slots
- ✅ Confirmation of booking
- ✅ List of patient's appointments

**Example Run**:
```bash
# 1. Run the test
node test-appointment-booking.js

# 2. Check email for OTP

# 3. Edit the file and uncomment the verifyOTP section with your OTP

# 4. Run again:
node test-appointment-booking.js

# 5. Complete remaining steps (book appointment, view appointments)
```

---

### test-doctor-prescription.js ⭐ NEW
**Purpose**: Test complete prescription creation and management flow for doctors  
**What it does**:
- Doctor login with OTP verification
- Retrieve pending appointments
- Accept appointment
- Create prescription with diagnosis
- Add medicines to prescription (multiple)
- Check for drug interactions
- Request signature OTP
- Sign prescription digitally
- Get prescription details

**Usage**:
```bash
node test-doctor-prescription.js
```

**Test Flow Steps**:
1. Doctor login
2. Verify OTP
3. Get pending appointments
4. Accept appointment
5. Create prescription
6. Add medicine(s)
7. Check drug interactions
8. Request signature OTP
9. Sign prescription with OTP
10. View prescription details

**Requirements**:
- Server running on `localhost:3000`
- Doctor account exists and verified
- Patient has booked appointment with this doctor
- Appointment must be pending/ready for acceptance
- Email service working for OTP

**Test Credentials**:
- Email: `doctor@example.com`
- Password: `doctorpass123`

**Output**:
- ✅ Pending appointments list
- ✅ Prescription creation confirmation
- ✅ Medicine added to prescription
- ✅ Drug interaction report
- ✅ Prescription signed with digital signature
- ✅ QR code generated
- ✅ Full prescription details

**Medicines You Can Test With**:
- Amoxicillin 500mg - 3 times daily - 7 days
- Ibuprofen 400mg - 2 times daily - 5 days
- Cough Syrup 10ml - 2 times daily - 5 days

**Example Run**:
```bash
# 1. Run the test
node test-doctor-prescription.js

# 2. Check email for first OTP

# 3. Edit file and add OTP, then uncomment the steps

# 4. Get pending appointment ID from step 3 output

# 5. After accepting appointment and creating prescription, 
#    you'll receive signature OTP in email

# 6. Add signature OTP and uncomment sign prescription step

# 7. Run again to complete flow
```

---

## 🚀 How to Run Tests

### Step 1: Verify Setup
```bash
# Check if server is running
# Check if database is connected
# Check if email is configured
```

### Step 2: Run Email Test First
```bash
node test-email.js
```
✅ Email must work before other tests

### Step 3: Run Login Test
```bash
node test-login.js
```
✅ Check for OTP in email

### Step 4: Get Latest OTP
```bash
node ../scripts/get-otp.js
```
✅ Find valid OTP code to use

### Step 5: Update test-verify-otp.js
Replace the test email/OTP with values from step 4, then:
```bash
node test-verify-otp.js
```
✅ Verify authentication works

---

## 📋 Test Order & Dependencies

```
1. test-email.js          (No dependencies)
   ↓
2. test-login.js          (Requires email working)
   ↓
3. get-otp.js            (Requires login OTP created)
   ↓
4. test-verify-otp.js    (Requires valid OTP)
   ↓
5. test-appointment-booking.js    (Requires patient auth)
   ├─ Get doctors list
   ├─ Get time slots
   └─ Book appointment
   ↓
6. test-doctor-prescription.js    (Requires doctor auth + appointment)
   ├─ Accept appointment
   ├─ Create prescription
   ├─ Add medicines
   ├─ Check interactions
   └─ Sign prescription
```

---

## 🎯 Complete Testing Workflow

### Phase 1: Setup & Authentication (30 mins)
```bash
# 1. Test email configuration
node test-email.js

# 2. Test patient login
node test-login.js
# → Check email for OTP code

# 3. Verify OTP and get token
node test-verify-otp.js
```

### Phase 2: Patient Appointment Flow (20 mins) - MODULAR APPROACH ⭐
Each script runs independently! Persist data to .test-data.json

**Step-by-step workflow:**
```bash
# Step 1: Login
node test-apt-01-login.js
# Saves email to .test-data.json

# Step 2: Verify OTP (get code from email)
node test-apt-02-verify-otp.js 252296
# Saves token to .test-data.json

# Step 3: View Available Doctors
node test-apt-03-get-doctors.js
# Saves selected doctor ID to .test-data.json

# Step 4: Get Available Time Slots
node test-apt-04-get-time-slots.js
# Optional: specify date and time period
# node test-apt-04-get-time-slots.js 2026-05-21 afternoon
# Saves slot info to .test-data.json

# Step 5: Book Appointment
node test-apt-05-book-appointment.js "Fever and cough"
# Optional: specify symptoms (default: "General checkup")
# Saves appointment ID to .test-data.json

# Step 6: View My Appointments
node test-apt-06-view-appointments.js
# Shows all booked appointments
```

### Phase 3: Doctor Prescription Flow (30 mins) - MODULAR APPROACH ⭐
Each script runs independently! Persist data to .test-data-doctor.json

**Step-by-step workflow:**
```bash
# Step 1: Doctor Login
node test-doc-01-login.js
# Saves email to .test-data-doctor.json

# Step 2: Verify OTP (get code from email)
node test-doc-02-verify-otp.js 252296
# Saves token to .test-data-doctor.json

# Step 3: View Pending Appointments
node test-doc-03-pending-appointments.js
# Saves first appointment to .test-data-doctor.json

# Step 4: Accept Appointment
node test-doc-04-accept-appointment.js
# Accepts the appointment

# Step 5: Create Prescription
node test-doc-05-create-prescription.js "Bronchitis" "Patient has cough for 3 days"
# Optional: specify diagnosis and notes
# Saves prescription ID to .test-data-doctor.json

# Step 6: Add Medicine
node test-doc-06-add-medicine.js Amoxicillin 500mg "3x daily" "7 days" 21
# Optional: specify medicine details
# Can run multiple times to add different medicines

# Step 7: Check Drug Interactions
node test-doc-07-check-interactions.js
# Checks for interactions between medicines

# Step 8: Request Signature OTP
node test-doc-08-request-signature-otp.js
# Sends OTP to email for digital signature

# Step 9: Sign Prescription
node test-doc-09-sign-prescription.js 252296
# Replace 252296 with signature OTP from email

# Step 10: View Prescription Details
node test-doc-10-view-prescription.js
# Shows full prescription with medicines
```

---

## 📊 New Modular Test Scripts

### Patient Appointment Tests (Persistent Data)
| Script | Purpose | Status |
|--------|---------|--------|
| `test-apt-01-login.js` | Patient login | Saves email |
| `test-apt-02-verify-otp.js <OTP>` | Verify OTP | Saves token |
| `test-apt-03-get-doctors.js` | List doctors | Saves doctor ID |
| `test-apt-04-get-time-slots.js [DATE] [TIME]` | List time slots | Saves slot |
| `test-apt-05-book-appointment.js [SYMPTOMS]` | Book appointment | Saves apt ID |
| `test-apt-06-view-appointments.js` | View all appointments | Read-only |

### Doctor Prescription Tests (Persistent Data)
| Script | Purpose | Status |
|--------|---------|--------|
| `test-doc-01-login.js` | Doctor login | Saves email |
| `test-doc-02-verify-otp.js <OTP>` | Verify OTP | Saves token |
| `test-doc-03-pending-appointments.js` | List pending | Saves apt ID |
| `test-doc-04-accept-appointment.js` | Accept apt | Confirms |
| `test-doc-05-create-prescription.js [DIAG] [NOTES]` | Create Rx | Saves Rx ID |
| `test-doc-06-add-medicine.js [NAME] [DOSE] [FREQ] [DUR] [QTY]` | Add medicine | Repeatable |
| `test-doc-07-check-interactions.js` | Check interactions | Read-only |
| `test-doc-08-request-signature-otp.js` | Request OTP | Sends email |
| `test-doc-09-sign-prescription.js <OTP>` | Sign Rx | Applies signature |
| `test-doc-10-view-prescription.js` | View Rx details | Read-only |

---

## 💾 Persistent Data Files

### Patient Tests - `.test-data.json`
```json
{
  "email": "princengwakomashumu@gmail.com",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "selectedDoctorId": 123,
  "selectedDoctorName": "Dr. John Smith",
  "selectedDate": "2026-05-21",
  "selectedTimePeriod": "morning",
  "selectedTimeSlot": "09:00 AM",
  "appointmentId": 456
}
```

### Doctor Tests - `.test-data-doctor.json`
```json
{
  "email": "doctor@example.com",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "selectedAppointmentId": 789,
  "patientName": "Jane Doe",
  "prescriptionId": 321,
  "prescriptionNumber": "RX-2026-05-001",
  "medicines": ["Amoxicillin", "Ibuprofen"],
  "signed": true
}
```

---

## 🚀 Testing Benefits

✅ **Run individual steps** - No need to re-run entire flow  
✅ **Persistent data** - Token saved for reuse  
✅ **Easy debugging** - Test specific endpoints  
✅ **Flexible parameters** - Optional command-line arguments  
✅ **Clear progress tracking** - Each step updates data file  
✅ **Separation of concerns** - Each script is independent  

---

## 📋 Quick Reference

**Patient Flow:**
```bash
node test-apt-01-login.js
node test-apt-02-verify-otp.js YOUR_OTP
node test-apt-03-get-doctors.js
node test-apt-04-get-time-slots.js
node test-apt-05-book-appointment.js
node test-apt-06-view-appointments.js
```

**Doctor Flow:**
```bash
node test-doc-01-login.js
node test-doc-02-verify-otp.js YOUR_OTP
node test-doc-03-pending-appointments.js
node test-doc-04-accept-appointment.js
node test-doc-05-create-prescription.js
node test-doc-06-add-medicine.js
node test-doc-07-check-interactions.js
node test-doc-08-request-signature-otp.js
node test-doc-09-sign-prescription.js SIGNATURE_OTP
node test-doc-10-view-prescription.js
```

---

## 🔧 Troubleshooting

### Email Test Fails
- Check `.env` file has EMAIL_USER and EMAIL_PASSWORD
- Gmail users: Use App Password, not regular password
- Check 2FA is enabled on Gmail account
- See: [GMAIL_SETUP_GUIDE.md](../docs/setup/GMAIL.md)

### Login Test Fails
- Ensure server is running on port 3000
- Check test user exists in database
- Verify email service is working (run test-email.js first)

### OTP Verification Fails
- OTP codes expire after 10 minutes
- Generate new OTP with: `node test-login.js`
- Get latest OTP with: `node ../scripts/get-otp.js`
- Make sure you're using the correct email

### Database Connection Issues
- Check `.env` file has DATABASE_URL set correctly
- Verify PostgreSQL is running
- Check connection credentials

---

## 📚 Related Documentation

- [API Documentation](../docs/api/DOCUMENTATION.md)
- [OTP Setup](../docs/features/otp/SETUP.md)
- [Email Configuration](../docs/setup/EMAIL.md)
- [Getting Started](../docs/GETTING_STARTED.md)

---

## ✨ Quick Reference

| File | Purpose | Command | Depends On |
|------|---------|---------|-----------|
| test-email.js | Test email config | `node test-email.js` | .env, Database |
| test-login.js | Test login flow | `node test-login.js` | Server running |
| test-verify-otp.js | Test OTP verification | `node test-verify-otp.js` | Valid OTP |
| test-appointment-booking.js | Test appointment booking | `node test-appointment-booking.js` | Patient account, Doctors in DB |
| test-doctor-prescription.js | Test prescription flow | `node test-doctor-prescription.js` | Doctor account, Appointments |
| get-otp.js | Get latest OTP | `node ../scripts/get-otp.js` | Database |

---

## 📝 Notes

- Test files use hardcoded test user (update as needed)
- OTP codes expire after 10 minutes
- Each login generates a new OTP
- Database must be populated with test users
- Email service must be configured for full testing
