# e-Prescribing System - Quick Setup Guide

**Date:** May 18, 2026  
**Version:** 1.0.0

---

## ⚡ Quick Start (5 minutes)

### Step 1: Run Database Migrations

```bash
# Add doctor acceptance tracking to appointments
npm run migrate:doctor-acceptance

# Create prescription tables and related tables
npm run migrate:prescriptions
```

Expected output:
```
✅ Doctor acceptance columns added successfully
✅ All e-Prescribing tables created successfully!
```

### Step 2: Restart Backend

```bash
npm run dev
```

### Step 3: Test with Simple Appointment Flow

```bash
# 1. Doctor accepts appointment (after patient paid)
curl -X POST http://localhost:5000/api/users/appointments/1/accept \
  -H "Authorization: Bearer {DOCTOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"doctorNotes": "Ready to consult"}'

# 2. Doctor creates prescription
curl -X POST http://localhost:5000/api/users/prescriptions \
  -H "Authorization: Bearer {DOCTOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "appointmentId": 1,
    "diagnosis": "Hypertension",
    "clinicalNotes": "Patient needs BP management"
  }'

# 3. View it in database
psql -U {DB_USER} -d {DB_NAME} -c "SELECT id, prescription_number, status FROM prescriptions LIMIT 5;"
```

---

## 📊 Database Tables Created

```sql
-- Main prescription table
prescriptions
├─ Stores prescription headers with digital signatures
├─ Links to appointments and patients
└─ 16 columns including AES signature support

-- Medicine table
prescription_items
├─ Individual medicines per prescription
├─ Dosage, frequency, schedule classification
└─ Drug interaction warnings

-- Share audit table
prescription_shares
├─ Tracks all prescription sharing activities
├─ Email recipients, QR code accesses
└─ Audit trail for compliance
```

---

## 🔑 Core Endpoints Summary

### Doctor (After Appointment)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/appointments/{id}/accept` | POST | Accept appointment |
| `/prescriptions` | POST | Create new prescription |
| `/prescriptions/{id}/medicines` | POST | Add medicine |
| `/prescriptions/{id}/check-interactions` | POST | Check drug interactions |
| `/prescriptions/{id}/request-otp` | POST | Request signature OTP |
| `/prescriptions/{id}/sign` | POST | Sign with OTP |
| `/prescriptions/{id}/revoke` | POST | Revoke if needed |
| `/doctor/prescriptions` | GET | View issued prescriptions |

### Patient

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/prescriptions` | GET | List all prescriptions |
| `/prescriptions/{id}` | GET | View prescription details |
| `/prescriptions/{id}/download` | GET | Download as PDF |
| `/prescriptions/{id}/print` | GET | Get print-ready version |
| `/prescriptions/{id}/share-email` | POST | Share via email |
| `/prescriptions/{id}/qrcode` | GET | Generate QR code |
| `/prescriptions/{id}/share-history` | GET | View sharing audit |

---

## 🔐 Digital Signature Flow

```
1. Doctor finishes writing prescription
   └─ Status: "pending"

2. Doctor requests OTP
   └─ Email sent with 6-digit OTP (10 min validity)

3. Doctor enters OTP
   └─ Verified against stored hash

4. System generates signature
   └─ RSA-SHA256 algorithm
   └─ Includes prescription ID, medicines, timestamp
   └─ Status changes to "signed"

5. QR code generated
   └─ Can be scanned for easy sharing

6. Patient notified
   └─ Can view, download, share
```

---

## 🧪 Test Scenarios

### Scenario 1: Simple Prescription
```bash
# Patient books & pays → Appointment status "scheduled"
# Doctor accepts → Appointment flagged as doctor_accepted=TRUE
# Doctor creates prescription → Status "pending"
# Doctor adds medicine → Medicine added
# Doctor signs (with OTP) → Status "signed"
# Patient views → Can see all details
```

### Scenario 2: Drug Interaction Check
```bash
# When adding Warfarin + Aspirin
# System shows SEVERE warning
# "Contraindicated - DO NOT USE TOGETHER"
# Doctor must acknowledge or choose alternative
```

### Scenario 3: Prescription Sharing
```bash
# Patient chooses to share with pharmacist
# Email sent with secure link
# Pharmacist gets view-only access
# Share audit records who accessed when
```

---

## 🐛 Common Issues & Fixes

### Issue: OTP Not Received
**Solution:** 
- Verify email service is running
- Check doctor's email in database is correct
- Review email logs for errors

### Issue: "Cannot accept appointment"
**Solution:**
- Check appointment status is "scheduled"
- Verify doctor owns the appointment
- Ensure appointment date is not in past

### Issue: "Cannot modify signed prescription"
**Solution:**
- Cannot add medicines after signing
- Revoke and create new prescription if needed
- Ask doctor to create new prescription

### Issue: Drug interaction warnings too aggressive
**Solution:**
- Review warnings in `drugInteractionService.js`
- Can customize interaction levels
- Update DRUG_INTERACTIONS database

---

## 📱 Frontend Integration Checklist

- [ ] Import `prescriptionService`
- [ ] Create doctor prescription form
- [ ] Add medicine input fields (repeatable)
- [ ] Show drug interaction warnings
- [ ] Add OTP input for signature
- [ ] Create prescription viewer for patients
- [ ] Add download/print buttons
- [ ] Implement email sharing modal
- [ ] Add QR code scanner
- [ ] Show prescription history

---

## 🔄 Appointment + Prescription Workflow

```
APPOINTMENT BOOKING
    ↓
[Patient selects doctor, date, time, pays]
    ↓
Status: "scheduled"
    ↓
DOCTOR REVIEWS APPOINTMENT
    ↓
[Doctor views list, accepts one]
    ↓
Status: "scheduled" + doctor_accepted=TRUE
    ↓
PRESCRIPTION CREATION
    ↓
[Doctor creates prescription, adds medicines]
    ↓
Status: "pending"
    ↓
DRUG INTERACTION CHECK (optional)
    ↓
[System shows any warnings]
    ↓
DIGITAL SIGNATURE
    ↓
[Doctor requests OTP, enters it, prescription signed]
    ↓
Status: "signed" ✅
    ↓
PATIENT ACCESS
    ↓
[Patient views, downloads, shares, prints]
```

---

## 🎯 Key Features Enabled

After running migrations, you have:

✅ **Doctor Appointment Acceptance** - Track which appointments doctors have reviewed  
✅ **Prescription Creation** - Standardized digital prescription template  
✅ **Medicine Management** - Add/edit/view medicines with detailed info  
✅ **Drug Interactions** - Real-time warnings for dangerous combinations  
✅ **Digital Signatures** - OTP-verified legally binding signatures  
✅ **Patient Access** - View, download, print, share prescriptions  
✅ **QR Codes** - Easy prescription sharing via QR codes  
✅ **Email Sharing** - Secure sharing with audit trails  
✅ **Revocation** - Doctors can revoke prescriptions if needed  
✅ **Audit Logging** - Complete activity history  

---

## 📞 Need Help?

1. Read full documentation: `docs/features/prescriptions/E-PRESCRIBING_SYSTEM.md`
2. Check database: `\dt` in psql to see all tables
3. Review controller: `controllers/prescriptionController.js`
4. Check migrations ran: `SELECT COUNT(*) FROM prescriptions;`

---

## ✅ Verification Checklist

After setup:

```bash
# 1. Check tables exist
psql -U {DB_USER} -d {DB_NAME} -c "SELECT COUNT(*) FROM prescriptions;"
# Should return: count = 0

# 2. Check server runs
npm run dev
# Should see: "✅ Server running on port 5000"

# 3. Test endpoint
curl http://localhost:5000/api/users/appointments
# Should return appointments list

# 4. Check migrations in package.json
grep "migrate:prescriptions" package.json
# Should show the new migration script
```

---

## 🚀 Ready to Go!

Your e-prescribing system is now:
- ✅ Database tables created
- ✅ Backend routes configured
- ✅ Controllers ready
- ✅ Services implemented
- ✅ Documentation complete

**Next:** Follow the E-PRESCRIBING_SYSTEM.md guide for detailed integration!

---

**Setup Time:** ~5 minutes  
**Status:** Ready for Testing ✅  
**Date:** May 18, 2026
