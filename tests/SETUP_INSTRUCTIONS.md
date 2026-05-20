═════════════════════════════════════════════════════════════════════════════════
                       ⚙️  SETUP INSTRUCTIONS
═════════════════════════════════════════════════════════════════════════════════

## 1️⃣ START THE BACKEND SERVER

Open a **NEW terminal** and run:
```bash
npm run dev
```

Wait for output like:
```
✅ Server running on http://localhost:3000
✅ Database connection established
```

**Keep this terminal open!** The server must stay running during tests.

═════════════════════════════════════════════════════════════════════════════════

## 2️⃣ SEED TEST DATA (new terminal)

In a different terminal, seed doctors and pharmacies:

```bash
# Seed 5 test doctors
node tests/seed-test-doctors.js

# Seed 3 test pharmacies
node tests/seed-test-pharmacies.js
```

═════════════════════════════════════════════════════════════════════════════════

## 3️⃣ RUN APPOINTMENT BOOKING FLOW

### Step 1: Patient Login
```bash
node tests/test-apt-01-login.js
```
✅ Check email for OTP code

### Step 2: Verify OTP
```bash
node tests/test-apt-02-verify-otp.js YOUR_OTP_CODE
```
✅ Token saved to .test-data.json

### Step 3: Get Available Doctors
```bash
node tests/test-apt-03-get-doctors.js
```
✅ Shows list of 5 seeded doctors

### Step 4: Get Time Slots (optional parameters)
```bash
# Basic usage
node tests/test-apt-04-get-time-slots.js

# With date (YYYY-MM-DD format)
node tests/test-apt-04-get-time-slots.js 2026-05-25

# With time period
node tests/test-apt-04-get-time-slots.js 2026-05-25 morning
```
✅ Shows available time slots

### Step 5: Book Appointment (optional symptoms)
```bash
# Basic booking
node tests/test-apt-05-book-appointment.js

# With symptoms
node tests/test-apt-05-book-appointment.js "headache and fever"
```
✅ Appointment booked and saved

### Step 6: View Your Appointments
```bash
node tests/test-apt-06-view-appointments.js
```
✅ Shows all your booked appointments

═════════════════════════════════════════════════════════════════════════════════

## 🔄 TOKEN REFRESH

Tokens expire after 15 minutes. If you get "Session expired" error:
```bash
# Auto-detect (patient or doctor)
node tests/refresh-token.js

# Explicit (patient)
node tests/refresh-token.js --patient

# Explicit (doctor)
node tests/refresh-token.js --doctor
```

═════════════════════════════════════════════════════════════════════════════════

## 📊 TEST CREDENTIALS

**Patient Account (for appointment booking):**
- Email: princengwakomashumi@gmail.com
- Password: secure123

**Test Doctors (use for direct login if needed):**
- Email: seed.doc1@seed.test through seed.doc5@seed.test
- Password: doctorpass123

**Test Pharmacies (use for pharmacy testing):**
- Email: seed.pharma1@seed.test through seed.pharma3@seed.test
- Password: pharmacypass123

═════════════════════════════════════════════════════════════════════════════════

## ⚠️  IMPORTANT

- ✅ Backend server MUST be running (Terminal 1)
- ✅ Seed data first before running flow (Terminal 2)
- ✅ Run test steps in order (Terminal 3 or later)
- ✅ Refresh token if you get 401 error
- ✅ Token expires every 15 minutes

═════════════════════════════════════════════════════════════════════════════════
