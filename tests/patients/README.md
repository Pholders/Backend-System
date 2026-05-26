# 👤 Patient Operations Tests

## Overview
Test suite for patient operations including prescription viewing and doctor ratings.

## Tests Included

### 1. **01-view-prescriptions.js** - View All Prescriptions
- Lists all prescriptions for patient
- Shows signed and pending prescriptions
- Displays doctor name, diagnosis, medicines

```bash
node 01-view-prescriptions.js
```

### 2. **02-prescription-details.js** - View Prescription Details
- Shows complete prescription information
- Displays all medicines with dosages
- Shows digital signature details
- Optional: View specific prescription by ID

```bash
# View latest prescription
node 02-prescription-details.js

# View specific prescription
node 02-prescription-details.js abc123def456
```

### 3. **03-rate-doctor.js** - Rate Doctor
- Submits rating and review for doctor
- Rating scale: 1-5 stars
- Optional review text

```bash
# Default: 5 stars
node 03-rate-doctor.js

# Custom rating and review
node 03-rate-doctor.js 5 "Excellent doctor, very professional!"
```

---

## 🔄 Typical Workflow

```bash
# 1. View all prescriptions
node 01-view-prescriptions.js

# 2. View prescription details
node 02-prescription-details.js

# 3. Rate the doctor
node 03-rate-doctor.js 5 "Great experience!"
```

---

## 📊 Operations Sequence

```
Patient Authenticated
    ↓
View All Prescriptions
    ↓
Select/View Prescription Details
    ├─ Doctor Information
    ├─ Medicines
    ├─ Digital Signature
    └─ Clinical Notes
    ↓
Submit Doctor Rating
```

---

## 💾 Saved Data

Location: `../.test-data.json`

```json
{
  "email": "patient@example.com",
  "token": "JWT_TOKEN",
  "latestPrescriptionId": "pres_uuid",
  "reviewId": "review_uuid",
  "ratedDoctor": true
}
```

---

## ⏱️ Timing

- **Complete Flow:** 10 minutes
- **Each Test:** 1-2 minutes

---

## 🔑 Key Features Tested

✅ Prescription Retrieval  
✅ Prescription Details  
✅ Medicine Information  
✅ Doctor Information  
✅ Digital Signature Verification  
✅ Doctor Rating  
✅ Review Submission  
✅ Error Handling  

---

## 📋 Prescription Information Displayed

When viewing prescription details:

- **Header Info**
  - Prescription ID
  - Prescription Number
  - Status (signed/pending)
  - Date Issued

- **Doctor Info**
  - Name
  - Specialization
  - License Number

- **Clinical Info**
  - Diagnosis
  - Clinical Notes

- **Medicines**
  - Name
  - Dosage
  - Frequency
  - Route
  - Form
  - Schedule
  - Instructions
  - Interactions/Warnings

- **Digital Signature**
  - Signature Status
  - Signing Method
  - Date/Time

---

## ⭐ Rating System

**Scale:** 1-5 stars

- **5 Stars:** Excellent
- **4 Stars:** Very Good
- **3 Stars:** Good
- **2 Stars:** Fair
- **1 Star:** Poor

---

## 📝 Notes

- Patient must be authenticated (use appointment tests first)
- Prescriptions must be created by doctor
- Prescriptions must be signed to view
- Ratings are permanent and contribute to doctor profile
- Multiple ratings allowed per doctor

---

## 🚀 Quick Help

```bash
# Get help for any test
node 01-view-prescriptions.js --help
node 02-prescription-details.js --help
node 03-rate-doctor.js --help
```

---

## 📂 File References

All tests reference the original implementation:
- Actual test files: `../test-patient-*.js`
- This folder provides organized shortcuts
- Both locations work identically

To run from root:
```bash
node test-patient-01-view-prescriptions.js
```

To run from patients folder:
```bash
cd patients
node 01-view-prescriptions.js
```

---

**Category:** Patient Operations  
**Tests:** 3  
**Status:** ✅ Complete
