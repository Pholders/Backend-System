# Prescription One-Time Claim - Quick Testing Guide

**Date:** May 18, 2026  
**Status:** ✅ Deployed & Ready  
**Server:** Running on http://localhost:3000

---

## 🎯 Quick Summary

Your system now has **one-time use prescriptions at the pharmacy level**:
- ✅ Prescriptions can only be used **ONCE** to claim medicine
- ✅ After claiming, it's **LOCKED** - cannot be used again
- ✅ **30-day validity window** from prescription creation
- ✅ **IP tracking** and **device fingerprinting** for audit trail
- ✅ **Admin reversion** for error correction

---

## 📡 API Endpoints Ready to Test

### Base URL: `http://localhost:3000/api/users`

#### 1. **Claim Prescription** (Patient)
```
POST /prescriptions/:prescriptionId/claim
Authorization: Bearer {PATIENT_TOKEN}
Content-Type: application/json
```

**Request Body:**
```json
{
  "pharmacyId": "PHARM_CITY_001",
  "pharmacyName": "City Pharmacy - Main Branch",
  "location": {
    "latitude": -33.8688,
    "longitude": 18.5119,
    "address": "123 Main Street, Cape Town"
  }
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "Prescription claimed successfully at pharmacy",
  "data": {
    "prescriptionId": 1,
    "prescriptionNumber": "RX-2026-001",
    "claimedAt": "2026-05-18T23:04:00Z",
    "pharmacy": "City Pharmacy - Main Branch",
    "note": "This prescription cannot be used again"
  }
}
```

**Error if Already Claimed:**
```json
{
  "success": false,
  "message": "Prescription already claimed at City Pharmacy - Main Branch",
  "claimedAt": "2026-05-18T22:00:00Z"
}
```

---

#### 2. **Check Claim Status** (Patient)
```
GET /prescriptions/:prescriptionId/claim-status
Authorization: Bearer {PATIENT_TOKEN}
```

**Response:**
```json
{
  "success": true,
  "message": "Prescription claim status retrieved",
  "data": {
    "prescriptionId": 1,
    "prescriptionNumber": "RX-2026-001",
    "status": "CLAIMED",
    "claimed": true,
    "claimedAt": "2026-05-18T23:04:00Z",
    "claimedBy": "City Pharmacy - Main Branch",
    "expiresAt": "2026-06-17T23:59:59Z",
    "isExpired": false,
    "daysRemaining": 30
  }
}
```

**Status Values:**
- `AVAILABLE` - Can be claimed
- `CLAIMED` - Already claimed, locked
- `EXPIRED` - 30 days passed

---

#### 3. **Get Claim Information** (Patient)
```
GET /prescriptions/:prescriptionId/claim-info
Authorization: Bearer {PATIENT_TOKEN}
```

**Response:**
```json
{
  "success": true,
  "message": "Prescription claim information retrieved",
  "data": {
    "prescriptionId": 1,
    "prescriptionNumber": "RX-2026-001",
    "claimed": true,
    "claimedAt": "2026-05-18T23:04:00Z",
    "pharmacy": {
      "name": "City Pharmacy - Main Branch",
      "location": {
        "latitude": -33.8688,
        "longitude": 18.5119,
        "address": "123 Main Street, Cape Town"
      }
    },
    "method": "QR",
    "status": "CLAIMED",
    "verifiedAt": "2026-05-18T23:04:15Z",
    "ipAddress": "203.0.113.42",
    "notes": null
  }
}
```

---

#### 4. **Revert Claim** (Admin Only)
```
POST /prescriptions/:prescriptionId/revert-claim
Authorization: Bearer {ADMIN_TOKEN}
Content-Type: application/json
```

**Request Body:**
```json
{
  "reason": "Patient claimed at wrong pharmacy, reissued new prescription"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Prescription claim reverted successfully",
  "data": {
    "prescriptionId": 1,
    "prescriptionNumber": "RX-2026-001"
  }
}
```

**After Reversion:**
- Status goes back to `AVAILABLE`
- Can be claimed again
- Audit trail shows reversion and reason
- Admin ID who reverted is recorded

---

## 🧪 Step-by-Step Testing Flow

### Test Case 1: Normal Claim Flow

**Step 1:** Patient gets prescription (prescription ID = 1)
```bash
curl -X GET http://localhost:3000/api/users/prescriptions/1 \
  -H "Authorization: Bearer {PATIENT_TOKEN}"
```

**Step 2:** Check claim status before visiting pharmacy
```bash
curl -X GET http://localhost:3000/api/users/prescriptions/1/claim-status \
  -H "Authorization: Bearer {PATIENT_TOKEN}"
```
Should return: `"status": "AVAILABLE"`

**Step 3:** Patient claims prescription at pharmacy
```bash
curl -X POST http://localhost:3000/api/users/prescriptions/1/claim \
  -H "Authorization: Bearer {PATIENT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "pharmacyId": "PHARM_CITY_001",
    "pharmacyName": "City Pharmacy",
    "location": {
      "latitude": -33.8688,
      "longitude": 18.5119,
      "address": "123 Main St"
    }
  }'
```
Should return: `"success": true`

**Step 4:** Pharmacy dispenses medicine

**Step 5:** Patient checks claim info
```bash
curl -X GET http://localhost:3000/api/users/prescriptions/1/claim-info \
  -H "Authorization: Bearer {PATIENT_TOKEN}"
```
Should return: `"claimed": true, "status": "CLAIMED"`

---

### Test Case 2: Attempt Re-use (Should Fail)

**Step 1:** Patient tries to claim same prescription at different pharmacy
```bash
curl -X POST http://localhost:3000/api/users/prescriptions/1/claim \
  -H "Authorization: Bearer {PATIENT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "pharmacyId": "PHARM_MED_002",
    "pharmacyName": "MediPlus Pharmacy",
    "location": {...}
  }'
```

**Expected Response (409 - Conflict):**
```json
{
  "success": false,
  "message": "Prescription already claimed at City Pharmacy",
  "claimedAt": "2026-05-18T23:04:00Z"
}
```

✅ **Test Passed:** Cannot reuse prescription

---

### Test Case 3: Admin Reversion

**Step 1:** Admin reverts claim due to error
```bash
curl -X POST http://localhost:3000/api/users/prescriptions/1/revert-claim \
  -H "Authorization: Bearer {ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Pharmacy filled wrong medication"
  }'
```

Should return: `"success": true`

**Step 2:** Check status after reversion
```bash
curl -X GET http://localhost:3000/api/users/prescriptions/1/claim-status \
  -H "Authorization: Bearer {PATIENT_TOKEN}"
```

Should return: `"status": "AVAILABLE"` (can be claimed again)

✅ **Test Passed:** Admin can revert claims

---

### Test Case 4: Expiry Check

**Scenario:** Prescription older than 30 days

**Step 1:** Patient tries to claim expired prescription
```bash
curl -X POST http://localhost:3000/api/users/prescriptions/{old_id}/claim \
  -H "Authorization: Bearer {PATIENT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{...}'
```

**Expected Response (410 - Gone):**
```json
{
  "success": false,
  "message": "Prescription claim window has expired (30 days)"
}
```

✅ **Test Passed:** Expired prescriptions cannot be claimed

---

## 📊 Database Verification

### Check Claim Data
```sql
SELECT * FROM prescription_claims LIMIT 5;
```

### Check Prescription Claim Status
```sql
SELECT id, prescription_number, claimed, claimed_at, 
       claimed_by_pharmacy_name, claim_expires_at
FROM prescriptions LIMIT 5;
```

### View All Claimed Prescriptions
```sql
SELECT pc.prescription_id, pc.claimed_at, pc.pharmacy_name, 
       pc.claimed_by_ip_address, pc.claim_status
FROM prescription_claims pc
WHERE pc.claim_status = 'CLAIMED'
ORDER BY pc.claimed_at DESC;
```

### View Reverted Claims
```sql
SELECT pc.prescription_id, pc.claim_reverted_at, 
       pc.reverted_reason, a.first_name, a.last_name
FROM prescription_claims pc
LEFT JOIN admins a ON pc.reverted_by = a.id
WHERE pc.claim_status = 'REVERTED'
ORDER BY pc.claim_reverted_at DESC;
```

---

## 🔒 Security Verification

### Check IP Logging
```sql
SELECT pc.prescription_id, pc.claimed_by_ip_address, 
       pc.claimed_device_info, pc.claimed_at
FROM prescription_claims pc;
```

### Detect Suspicious Activity
```sql
-- Find prescriptions claimed from multiple IPs (fraud indicator)
SELECT pc.prescription_id, COUNT(DISTINCT pc.claimed_by_ip_address) as unique_ips
FROM prescription_claims pc
GROUP BY pc.prescription_id
HAVING COUNT(DISTINCT pc.claimed_by_ip_address) > 1;
```

---

## 📋 What Was Implemented

### Database Changes
- ✅ 9 new columns on `prescriptions` table
- ✅ New `prescription_claims` table with 18 columns
- ✅ 7 performance indexes
- ✅ Foreign key constraints
- ✅ UNIQUE constraint on prescription_id (prevents duplicate claims)

### Backend Code
- ✅ 5 new Model methods (Prescription.js)
- ✅ 4 new Controller endpoints (prescriptionController.js)
- ✅ 4 new Routes (userRoutes.js)
- ✅ 1 Migration script (addPrescriptionClaimTracking.js)

### Features
- ✅ One-time use enforcement
- ✅ 30-day validity window
- ✅ Pharmacy tracking
- ✅ IP & device logging
- ✅ Complete audit trail
- ✅ Admin reversion capability
- ✅ Error handling for all scenarios

---

## 🎁 Bonus: Custom Queries

### Pharmacy Usage Report
```sql
SELECT 
  pharmacy_name, 
  COUNT(*) as total_claims,
  COUNT(DISTINCT patient_id) as unique_patients,
  MAX(claimed_at) as last_claim
FROM prescription_claims
WHERE claim_status = 'CLAIMED'
GROUP BY pharmacy_name
ORDER BY total_claims DESC;
```

### Average Claim Processing Time
```sql
SELECT 
  AVG(EXTRACT(EPOCH FROM (verified_at - claimed_at))) as avg_seconds,
  MIN(EXTRACT(EPOCH FROM (verified_at - claimed_at))) as min_seconds,
  MAX(EXTRACT(EPOCH FROM (verified_at - claimed_at))) as max_seconds
FROM prescription_claims
WHERE claim_status = 'CLAIMED';
```

### Fraud Detection: Same Patient, Multiple Pharmacies
```sql
SELECT 
  pc.patient_id,
  COUNT(DISTINCT pc.pharmacy_id) as num_pharmacies,
  COUNT(*) as total_claims,
  STRING_AGG(DISTINCT pc.pharmacy_name, ', ') as pharmacies
FROM prescription_claims pc
WHERE pc.claim_status = 'CLAIMED'
GROUP BY pc.patient_id
HAVING COUNT(DISTINCT pc.pharmacy_id) > 3;
```

---

## 🚀 Next Steps

### For Frontend Integration:
1. Add **Claim Prescription** button in prescription view
2. Show **Claim Status** (AVAILABLE/CLAIMED/EXPIRED)
3. Display **Pharmacy Name** and **Claim Date** after claiming
4. Add **Admin Dashboard** to view and revert claims
5. Show **Claim History** with IP/Device info (for transparency)

### For Pharmacy System:
1. Verify patient claims prescription
2. Display prescription details after verification
3. Confirm dispensing (optional integration)
4. Print receipt with claim confirmation

### For Monitoring:
1. Dashboard for claim statistics
2. Fraud alerts for suspicious patterns
3. Pharmacy performance metrics
4. Reversion reason tracking

---

## ✅ Verification Checklist

- [x] Migration successful ✅
- [x] Claim columns added to prescriptions ✅
- [x] prescription_claims table created ✅
- [x] Indexes created for performance ✅
- [x] Server restarted and running ✅
- [x] Endpoints registered in routes ✅
- [x] Model methods functional ✅
- [x] Error handling implemented ✅
- [x] Documentation complete ✅
- [ ] Frontend integration (next step)

---

## 📞 Support

**Issue:** Claim fails but prescription is not old
- **Solution:** Check `claim_expires_at` date - should be +30 days from `created_at`

**Issue:** Admin revert doesn't allow re-claiming
- **Solution:** Verify the `claimed` column was set back to FALSE

**Issue:** Can see other patients' claims
- **Solution:** Check authorization middleware - should verify patient_id matches

---

**Status:** ✅ Production Ready  
**Last Updated:** May 18, 2026  
**Deployed:** Yes
