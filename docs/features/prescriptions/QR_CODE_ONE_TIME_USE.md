# One-Time Use QR Code Feature

**Date Implemented:** May 18, 2026  
**Feature Version:** 2.0

---

## 📋 Overview

Enhanced QR code feature that allows patients to generate **view-once QR codes** for their prescriptions. Each QR code can only be scanned/accessed once. After the first access, it becomes permanently invalid.

### Key Features

✅ **One-Time Use** - QR code valid only for single access  
✅ **Automatic Invalidation** - After first access, becomes unusable  
✅ **Access Tracking** - Records who accessed, when, from what IP/device  
✅ **Secure Tokens** - SHA-256 hashed tokens  
✅ **Audit Trail** - Complete logging of all access attempts  
✅ **IP Logging** - Tracks IP address of accessor  
✅ **Device Tracking** - Records User-Agent and device info  
✅ **Status Checking** - Can check if QR has been used before accessing  
✅ **Expiry Management** - QR codes expire after 90 days  

---

## 🔄 How It Works

### Workflow

```
1. PATIENT GENERATES QR CODE
   ├─ POST /prescriptions/{id}/qrcode
   ├─ System creates unique QR token
   ├─ Stores in prescription_qr_access table
   ├─ Status: VALID (not accessed)
   └─ QR code provided to patient

2. PATIENT SHARES QR CODE
   ├─ Via scan, email, or link
   └─ Recipient receives one-time-use code

3. FIRST ACCESS (QR CODE SCANNED)
   ├─ GET /qr/{qrToken}
   ├─ System verifies token validity
   ├─ Records: IP, device, timestamp
   ├─ Marks as accessed
   ├─ Returns prescription details
   └─ Status: USED

4. SECOND ACCESS ATTEMPT
   ├─ GET /qr/{qrToken}
   ├─ System detects already accessed
   ├─ Returns: "QR code has already been used"
   ├─ Access DENIED
   └─ Status: DENIED

5. AFTER EXPIRY (90 DAYS)
   ├─ GET /qr/{qrToken}
   ├─ System detects expired
   ├─ Returns: "QR code has expired"
   └─ Access DENIED
```

---

## 📊 Database Changes

### New Table: prescription_qr_access

```sql
CREATE TABLE prescription_qr_access (
  id SERIAL PRIMARY KEY,
  prescription_id INTEGER (FK),
  qr_token VARCHAR(255) UNIQUE,          -- One-time access token
  accessed BOOLEAN DEFAULT FALSE,         -- Has it been used?
  accessed_at TIMESTAMP,                  -- When was it accessed
  accessed_by_ip VARCHAR(50),            -- IP of accessor
  access_device_info TEXT,               -- User-Agent / Device info
  expires_at TIMESTAMP,                  -- 90 days from creation
  max_access_count INTEGER DEFAULT 1,    -- Maximum allowed accesses
  access_count INTEGER DEFAULT 0,        -- How many times accessed
  is_active BOOLEAN DEFAULT TRUE,        -- Can be scanned
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

Indexes:
- idx_qr_access_prescription
- idx_qr_access_token
- idx_qr_access_accessed
- idx_qr_access_active
```

### Updated Table: prescriptions

New columns added:
```sql
qr_code_token VARCHAR(255)          -- Reference to QR token
qr_code_one_time_use BOOLEAN        -- Is it one-time use?
qr_code_accessed BOOLEAN            -- Has QR been used?
qr_code_accessed_at TIMESTAMP       -- When was it accessed?
qr_code_expires_at TIMESTAMP        -- When does it expire?

Indexes:
- idx_prescriptions_qr_token
- idx_prescriptions_qr_accessed
```

---

## 🔑 API Endpoints

### 1. Generate One-Time Use QR Code
```http
GET /api/users/prescriptions/:prescriptionId/qrcode
Authorization: Bearer {patient_token}

RESPONSE (200):
{
  "success": true,
  "message": "QR code generated successfully",
  "data": {
    "prescriptionId": 1,
    "qrCode": "PRESCRIPTION_ONE_TIME_USE|1|a1b2c3d4e5f6...|1715967891234",
    "accessLink": "https://app.healthcare.local/prescriptions/qr/a1b2c3d4e5f6...",
    "expiresIn": "90 days",
    "validUntil": "2026-08-16T10:40:00Z",
    "oneTimeUse": true,
    "warning": "This QR code can only be scanned once. After first access, it will be invalid."
  }
}
```

### 2. Check QR Code Status (Optional)
```http
GET /api/users/qr/{qrToken}/status

RESPONSE (200):
{
  "success": true,
  "message": "QR code status retrieved",
  "data": {
    "exists": true,
    "prescriptionId": 1,
    "used": false,
    "usedAt": null,
    "expires": "2026-08-16T10:40:00Z",
    "isActive": true,
    "isExpired": false,
    "status": "VALID"
  }
}
```

### 3. Access Prescription via QR Code (One-Time Use)
```http
GET /api/users/qr/{qrToken}

RESPONSE (200) - FIRST ACCESS:
{
  "success": true,
  "message": "Prescription accessed successfully via QR code (one-time use)",
  "data": {
    "prescription": {
      "id": 1,
      "prescriptionNumber": "RX-1715967891234-A1B2C3D4",
      "prescriber": {...},
      "patient": {...},
      "diagnosis": "Hypertension",
      "medicines": [...],
      "signature": {...},
      "createdAt": "2026-05-18T10:30:00Z"
    },
    "accessInfo": {
      "accessedAt": "2026-05-18T11:30:00Z",
      "accessedFrom": "203.0.113.45",
      "device": "Mozilla/5.0...",
      "status": "ONE_TIME_ACCESS_COMPLETE",
      "note": "This QR code has been used and cannot be accessed again"
    }
  }
}

RESPONSE (403) - SECOND ACCESS:
{
  "success": false,
  "message": "QR code has already been used",
  "status": "DENIED"
}

RESPONSE (403) - EXPIRED:
{
  "success": false,
  "message": "QR code has expired",
  "status": "DENIED"
}
```

### 4. Get QR Code Access History
```http
GET /api/users/prescriptions/:prescriptionId/qrcode-history
Authorization: Bearer {patient_token}

RESPONSE (200):
{
  "success": true,
  "message": "QR code access history retrieved",
  "data": {
    "prescriptionId": 1,
    "totalQRCodesGenerated": 3,
    "qrAccesses": [
      {
        "qrToken": "a1b2c3d4e5f6...",
        "status": "USED",
        "accessed": true,
        "accessedAt": "2026-05-18T11:30:00Z",
        "accessedFromIP": "203.0.113.45",
        "device": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "expiresAt": "2026-08-16T10:40:00Z",
        "createdAt": "2026-05-18T10:40:00Z"
      },
      {
        "qrToken": "b2c3d4e5f6g7...",
        "status": "VALID",
        "accessed": false,
        "accessedAt": null,
        "accessedFromIP": null,
        "device": null,
        "expiresAt": "2026-08-17T10:41:00Z",
        "createdAt": "2026-05-18T10:41:00Z"
      }
    ]
  }
}
```

---

## 🚀 Implementation Steps

### Step 1: Run Migration
```bash
npm run migrate:qr-one-time-use
```

Expected output:
```
✅ QR access tracking table created successfully
✅ QR tracking columns added to prescriptions table
```

### Step 2: Restart Backend
```bash
npm run dev
```

### Step 3: Test the Feature

#### Generate QR Code
```bash
curl -X GET http://localhost:5000/api/users/prescriptions/1/qrcode \
  -H "Authorization: Bearer {PATIENT_TOKEN}"
```

#### Check Status Before Access
```bash
curl -X GET "http://localhost:5000/api/users/qr/{qrToken}/status"
```

#### Access Prescription (First Time - Success)
```bash
curl -X GET "http://localhost:5000/api/users/qr/{qrToken}"
```

#### Try Access Again (Second Time - Denied)
```bash
curl -X GET "http://localhost:5000/api/users/qr/{qrToken}"
# Returns: "QR code has already been used"
```

---

## 🔐 Security Features

### 1. Token Generation
- SHA-256 hashing with random salt
- Unique per prescription and per generation
- 256-bit entropy minimum

### 2. Access Tracking
- IP address of accessor
- Device/User-Agent information
- Exact timestamp of access
- Complete audit trail

### 3. One-Time Use Enforcement
- Marked as `accessed=TRUE` on first access
- Subsequent attempts immediately rejected
- Cannot be reactivated or reset
- Cannot be accessed after expiry

### 4. Data Integrity
- Token stored as UNIQUE in database
- Access count tracked
- Status validated before each access
- Expiry checked automatically

### 5. Audit Logging
- All access attempts recorded
- Failed attempts logged
- IP and device tracking
- Integration with prescription share audit

---

## 📝 Use Cases

### Use Case 1: Pharmacy Access
```
1. Patient generates QR code for prescription
2. Patient shows QR code to pharmacist
3. Pharmacist scans QR code once
4. Gets prescription details directly
5. QR code becomes invalid
6. Patient still has their own access via patient portal
```

### Use Case 2: Secure Email Sharing
```
1. Patient generates QR code
2. Patient emails QR code image to healthcare provider
3. Provider scans/accesses once
4. QR code immediately becomes invalid
5. Prevents accidental sharing of used code
```

### Use Case 3: Doctor-to-Doctor Consultation
```
1. Patient generates QR code
2. Patient shares with consulting doctor
3. Doctor accesses prescription once
4. Doctor gets all medicine details
5. QR code expires, cannot be reused
```

---

## ⚙️ Configuration

### Expiry Settings
- Default: 90 days
- Configurable in `QRCodeService.generateQRCodeData()`
- Can be customized per prescription

### Max Access Count
- Default: 1 (one-time use)
- Can be extended to allow multiple accesses if needed
- Set in `prescription_qr_access` table

### IP/Device Tracking
- Automatically captures from request
- Stored in database for audit trail
- Optional - can be used for fraud detection

---

## 🐛 Error Handling

### Already Used
```json
{
  "success": false,
  "message": "QR code has already been used",
  "status": "DENIED"
}
```

### Expired
```json
{
  "success": false,
  "message": "QR code has expired",
  "status": "DENIED"
}
```

### Invalid Token
```json
{
  "success": false,
  "message": "Invalid or expired QR code",
  "status": "DENIED"
}
```

### Not Found
```json
{
  "success": false,
  "message": "Prescription not found",
  "status": "DENIED"
}
```

---

## 📊 Monitoring & Analytics

### Queries for Analytics

Count QR accesses:
```sql
SELECT COUNT(*) FROM prescription_qr_access WHERE accessed = TRUE;
```

Most accessed prescriptions:
```sql
SELECT prescription_id, COUNT(*) as access_count 
FROM prescription_qr_access 
WHERE accessed = TRUE 
GROUP BY prescription_id 
ORDER BY access_count DESC;
```

Unused QR codes:
```sql
SELECT prescription_id, qr_token, expires_at 
FROM prescription_qr_access 
WHERE accessed = FALSE AND is_active = TRUE;
```

Access patterns by IP:
```sql
SELECT accessed_by_ip, COUNT(*) as access_count 
FROM prescription_qr_access 
WHERE accessed = TRUE 
GROUP BY accessed_by_ip;
```

---

## 🎯 Benefits

✅ **Enhanced Security** - QR codes can't be reused  
✅ **Audit Trail** - Complete tracking of who accessed what  
✅ **Fraud Prevention** - IP and device tracking helps detect abuse  
✅ **Patient Control** - Patients control who gets access and when  
✅ **Compliance** - Supports regulatory requirements for access control  
✅ **Simple UX** - One scan and done - no complicated sharing  
✅ **Flexible** - Can generate new QR codes as needed  

---

## 🔄 Migration Path

### Before (Original QR Feature)
- QR codes reusable indefinitely
- No access tracking
- No IP logging
- No expiry after use

### After (One-Time Use Feature)
- QR codes valid once only
- Detailed access tracking
- IP and device logging
- Automatic expiry after use
- Full audit trail

### Backward Compatibility
- Existing QR codes still work (if accessed before migration)
- New QR codes will be one-time use
- Patient can generate multiple QR codes
- Each one has its own tracking

---

## ✅ Verification Checklist

After setup:
```bash
# 1. Check new table exists
psql -U {DB_USER} -d {DB_NAME} -c "SELECT COUNT(*) FROM prescription_qr_access;"
# Should return: count = 0

# 2. Check columns added to prescriptions
psql -U {DB_USER} -d {DB_NAME} -c "\d prescriptions" | grep qr
# Should show: qr_code_token, qr_code_one_time_use, qr_code_accessed, etc.

# 3. Test endpoint
curl -X GET http://localhost:5000/api/users/prescriptions/1/qrcode \
  -H "Authorization: Bearer {PATIENT_TOKEN}"
# Should return QR code with oneTimeUse=true

# 4. Check routes
grep "qr\|qrcode" routes/userRoutes.js
# Should show all new routes
```

---

## 📚 Related Documentation

- [E-Prescribing System](../prescriptions/E-PRESCRIBING_SYSTEM.md) - Complete prescription system
- [Quick Setup Guide](../prescriptions/QUICK_SETUP.md) - Setup instructions
- [QR Code Service](../../services/qrCodeService.js) - Implementation details

---

**Status:** ✅ Complete and Ready for Testing  
**Date:** May 18, 2026  
**Version:** 2.0
