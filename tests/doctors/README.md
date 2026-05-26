# 👨‍⚕️ Doctor Prescription Tests

## Overview
Complete test suite for doctors to create and manage prescriptions with digital signatures.

## Tests Included

### 1. **01-login.js** - Doctor Login
- Authenticates doctor with email/password
- Sends OTP to doctor's registered email
- Saves doctor credentials for session

```bash
node 01-login.js sam.smith@example.com
```

### 2. **02-verify-otp.js** - OTP Verification
- Verifies OTP code from email
- Generates authentication token
- Enables prescription operations

```bash
node 02-verify-otp.js 123456
```

### 3. **03-pending-appointments.js** - View Pending
- Shows all pending appointments for doctor
- Displays patient information
- Selects first appointment for prescription

```bash
node 03-pending-appointments.js
```

### 4. **04-create-prescription.js** - Create Prescription
- Creates new prescription from appointment
- Adds diagnosis and clinical notes
- Initializes prescription for medicine entry

```bash
node 04-create-prescription.js
```

### 5. **05-add-medicines.js** - Add Medicines
- Adds multiple medicines to prescription
- Specifies dosage, frequency, route
- Allows medicine interactions checking

```bash
# Add all medicines
node 05-add-medicines.js

# Add specific number
node 05-add-medicines.js 2
```

### 6. **06-sign-prescription.js** - Digital Signature
- Two-step signing process with OTP
- Step 1: Request signature OTP

```bash
node 06-sign-prescription.js
```

- Step 2: Sign with OTP code

```bash
node 06-sign-prescription.js 654321
```

---

## 🔄 Complete Workflow

```bash
# 1. Doctor Login
node 01-login.js sam.smith@example.com

# 2. Verify OTP
node 02-verify-otp.js YOUR_OTP_CODE

# 3. View pending appointments
node 03-pending-appointments.js

# 4. Create prescription
node 04-create-prescription.js

# 5. Add medicines
node 05-add-medicines.js 3

# 6. Sign prescription (request OTP)
node 06-sign-prescription.js

# 7. Sign prescription (with OTP)
node 06-sign-prescription.js YOUR_SIGNATURE_OTP
```

---

## 📊 Data Flow

```
Doctor Login (Email)
    ↓
Verify OTP (Token)
    ↓
View Pending Appointments (Appointment ID)
    ↓
Create Prescription (Prescription ID)
    ↓
Add Medicines (Medicine Details)
    ↓
Request Signature OTP
    ↓
Sign Prescription (RSA-SHA256)
    ↓
Prescription Ready for Patient
```

---

## 💾 Saved Data

Location: `../.test-data-doctor.json`

```json
{
  "email": "doctor@example.com",
  "token": "JWT_TOKEN",
  "appointmentId": "apt_uuid",
  "patientId": "patient_uuid",
  "prescriptionId": "pres_uuid",
  "prescriptionNumber": "RX-2026-001",
  "medicinesAdded": [
    {"name": "Medicine 1", "dosage": "500mg"}
  ],
  "prescriptionSigned": true
}
```

---

## ⏱️ Timing

- **Complete Flow:** 25 minutes
- **Setup:** 2 minutes
- **Each Step:** 2-3 minutes
- **Token Duration:** 15 minutes
- **Signature OTP Duration:** 10 minutes

---

## 🔑 Key Features Tested

✅ Doctor Authentication  
✅ OTP Verification  
✅ Pending Appointments  
✅ Prescription Creation  
✅ Medicine Addition  
✅ Drug Interaction Checking  
✅ Digital Signatures (RSA-SHA256)  
✅ Signature OTP  
✅ QR Code Generation  
✅ Error Handling  

---

## 💊 Pre-configured Medicines

The test includes these medicines:

1. **Atorvastatin** - 20mg, Once daily, Oral tablet
2. **Lisinopril** - 10mg, Once daily, Oral tablet
3. **Metformin** - 500mg, Twice daily, Oral tablet

---

## 🔐 Digital Signature Details

- **Algorithm:** RSA-SHA256
- **Standard:** AES (Advanced Electronic Signature)
- **Legally Binding:** Yes
- **Audit Trail:** Complete
- **Revocation Support:** Yes

---

## 👨‍⚕️ Available Test Doctors

From seed data:

1. **Sam Smith** - sam.smith@example.com - General Practitioner
2. **Lerato Moloi** - lerato.moloi@example.com - Paediatrician
3. **Thabo Ndlela** - thabo.ndlela@example.com - Cardiologist
4. **Naledi Khumalo** - naledi.khumalo@example.com - Dermatologist
5. **Kobus van der Merwe** - kobus.vdm@example.com - Orthopedic Surgeon

---

## 📝 Notes

- Doctors must be seeded first: `../seed-test-doctors.js`
- Patients must have booked appointments
- Signature OTP valid for 10 minutes
- Prescriptions can be viewed/edited before signing
- Once signed, prescriptions become legally binding

---

## 🚀 Quick Help

```bash
# Get help for any test
node 01-login.js --help
node 05-add-medicines.js --help
node 06-sign-prescription.js --help
```

---

## 📂 File References

All tests reference the original implementation:
- Actual test files: `../test-pres-*.js`
- This folder provides organized shortcuts
- Both locations work identically

To run from root:
```bash
node test-pres-01-doctor-login.js
```

To run from doctors folder:
```bash
cd doctors
node 01-login.js
```

---

**Category:** Prescription Management  
**Tests:** 6  
**Status:** ✅ Complete
