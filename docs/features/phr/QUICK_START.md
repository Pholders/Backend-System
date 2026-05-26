# PHR System - Quick Start Guide

## 5-Minute Setup

### Step 1: Verify Installation

Check that the following files exist:
```
✓ models/PHR.js
✓ models/PHRAccess.js
✓ controllers/phrController.js
✓ config/createPHRTables.js
✓ routes/userRoutes.js (updated with PHR routes)
✓ docs/features/phr/PHR_SYSTEM.md
```

### Step 2: Run Database Migration

The migration runs automatically on server start. To verify:

```bash
# Start your server
npm run dev

# Watch terminal for:
# ✅ Created health_vitals table
# ✅ Created phr_documents table
# ✅ Created phr_access table
# ✅ Created phr_access_requests table
# ✅ Created phr_access_logs table
# ✅ Updated patient_personal_details table
# ✅ PHR tables migration completed successfully!
```

### Step 3: Test with cURL

#### Patient Views Their PHR
```bash
curl -X GET http://localhost:3000/api/users/phr/complete \
  -H "Authorization: Bearer YOUR_PATIENT_JWT"
```

#### Patient Records Health Vital
```bash
curl -X POST http://localhost:3000/api/users/phr/vitals \
  -H "Authorization: Bearer YOUR_PATIENT_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "systolic_bp": 120,
    "diastolic_bp": 80,
    "heart_rate": 72,
    "weight_kg": 75.5,
    "blood_glucose": 110,
    "oxygen_saturation": 98,
    "temperature_c": 37.0,
    "notes": "Morning measurement"
  }'
```

#### Patient Grants Doctor Access
```bash
curl -X POST http://localhost:3000/api/users/phr/access \
  -H "Authorization: Bearer YOUR_PATIENT_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "doctor_id": 1,
    "access_type": "view",
    "expires_at": "2027-05-26"
  }'
```

#### Doctor Requests Access
```bash
curl -X POST http://localhost:3000/api/users/phr/3/access-request \
  -H "Authorization: Bearer YOUR_DOCTOR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Continuing patient care"
  }'
```

#### Patient Approves Request
```bash
curl -X POST http://localhost:3000/api/users/phr/access/requests/1/approve \
  -H "Authorization: Bearer YOUR_PATIENT_JWT"
```

#### Doctor Views Patient PHR
```bash
curl -X GET http://localhost:3000/api/users/phr/3 \
  -H "Authorization: Bearer YOUR_DOCTOR_JWT"
```

---

## Key Endpoints Quick Reference

### Patient Viewing Own PHR
- `GET /api/users/phr/complete` - Complete PHR
- `GET /api/users/phr/personal-card` - Patient identity
- `GET /api/users/phr/vitals` - Health measurements
- `GET /api/users/phr/medications` - Current medications
- `GET /api/users/phr/allergies` - Allergies
- `GET /api/users/phr/conditions` - Medical conditions
- `GET /api/users/phr/prescriptions` - Active prescriptions
- `GET /api/users/phr/appointments` - Upcoming appointments
- `GET /api/users/phr/history` - Health history
- `GET /api/users/phr/documents` - Medical documents

### Patient Recording Data
- `POST /api/users/phr/vitals` - Record vital measurement
- `POST /api/users/phr/documents` - Upload medical document
- `PUT /api/users/phr/personal-card` - Update blood type/medical aid

### Patient Access Control
- `POST /api/users/phr/access` - Grant doctor access
- `GET /api/users/phr/access` - View doctors with access
- `DELETE /api/users/phr/access/:doctorId` - Revoke access
- `GET /api/users/phr/access/requests` - View pending requests
- `POST /api/users/phr/access/requests/:requestId/approve` - Approve request
- `POST /api/users/phr/access/requests/:requestId/deny` - Deny request
- `GET /api/users/phr/access-logs` - View audit trail

### Doctor Access
- `POST /api/users/phr/:patientId/access-request` - Request access
- `GET /api/users/phr/:patientId` - View patient PHR
- `GET /api/users/phr/:patientId/personal-card` - View patient ID card
- `GET /api/users/phr/:patientId/vitals` - View patient vitals
- `GET /api/users/phr/:patientId/medications` - View patient medications

---

## Common Workflows

### Workflow 1: Patient Checking Their Health Record

```
1. Patient logs in
2. GET /api/users/phr/complete
3. Receives complete PHR with all sections
4. Can view prescriptions, medications, allergies, conditions, vitals, history
```

### Workflow 2: Patient Recording Daily Vitals

```
1. Patient opens vitals recording
2. POST /api/users/phr/vitals with BP, HR, weight, glucose, etc.
3. Vital recorded with timestamp
4. GET /api/users/phr/vitals to see trend
```

### Workflow 3: Doctor Gets Patient Permission (2-step)

**Option A: Patient Grants Directly**
```
1. Patient goes to "Grant Doctor Access"
2. Enters doctor ID or email
3. POST /api/users/phr/access with doctor_id
4. Doctor can now access patient PHR immediately
5. GET /api/users/phr/:patientId by doctor
```

**Option B: Doctor Requests, Patient Approves**
```
1. Doctor finds patient
2. POST /api/users/phr/:patientId/access-request
3. Patient gets notification
4. Patient views pending request: GET /api/users/phr/access/requests
5. Patient approves: POST /api/users/phr/access/requests/:requestId/approve
6. Doctor can now access PHR
7. GET /api/users/phr/:patientId by doctor
```

### Workflow 4: Patient Revokes Doctor Access

```
1. Patient views current access: GET /api/users/phr/access
2. Finds doctor to revoke
3. DELETE /api/users/phr/access/:doctorId
4. Doctor can no longer access PHR
```

### Workflow 5: Checking Access Logs (Audit Trail)

```
1. Patient wants to see who accessed their PHR
2. GET /api/users/phr/access-logs
3. See all access events: who, when, what they viewed, IP address
4. Useful for privacy and security verification
```

---

## Response Examples

### Complete PHR Response
```json
{
  "success": true,
  "data": {
    "personalCard": {
      "id": 1,
      "first_name": "John",
      "last_name": "Doe",
      "blood_type": "O+",
      "medical_aid_type": "Private",
      "emergency_contact_name": "Jane Doe",
      "emergency_contact_phone": "+27123456789"
    },
    "medicalSummary": {
      "active_conditions": 2,
      "allergy_count": 1,
      "total_prescriptions": 5,
      "upcoming_appointments": 1,
      "active_medications": 3
    },
    "activePrescriptions": [
      {
        "id": 1,
        "prescription_number": "RX20260526001",
        "created_at": "2026-05-26",
        "diagnosis": "Hypertension",
        "doctor_first_name": "James",
        "doctor_last_name": "Smith",
        "specialization": "Cardiology",
        "medicine_count": 2
      }
    ],
    "currentMedications": [
      {
        "id": 1,
        "medication_name": "Lisinopril",
        "dosage": "10mg",
        "frequency": "Once daily",
        "start_date": "2026-01-15",
        "status": "active"
      }
    ],
    "allergies": [
      {
        "id": 1,
        "allergen": "Penicillin",
        "reaction": "Rash",
        "severity": "moderate"
      }
    ],
    "medicalConditions": [
      {
        "id": 1,
        "condition_name": "Hypertension",
        "diagnosis_date": "2024-03-10",
        "status": "active",
        "severity": "moderate"
      }
    ],
    "upcomingAppointments": [
      {
        "id": 1,
        "appointment_date": "2026-06-02",
        "time_period": "morning",
        "time_slot": "09:00",
        "status": "scheduled",
        "doctor_first_name": "James",
        "doctor_last_name": "Smith"
      }
    ],
    "healthHistory": [
      {
        "id": 1,
        "appointment_date": "2026-05-19",
        "status": "completed",
        "record_type": "appointment",
        "provider_name": "Dr. Smith",
        "specialization": "Cardiology"
      }
    ],
    "healthVitals": [
      {
        "id": 1,
        "measured_at": "2026-05-26T14:30:00Z",
        "systolic_bp": 120,
        "diastolic_bp": 80,
        "heart_rate": 72,
        "weight_kg": 75.5,
        "blood_glucose": 110,
        "oxygen_saturation": 98,
        "temperature_c": 37.0,
        "bmi": 24.5
      }
    ],
    "emergencyContacts": [
      {
        "id": 1,
        "emergency_contact_name": "Jane Doe",
        "emergency_contact_phone": "+27987654321",
        "emergency_contact_relationship": "Spouse",
        "priority": 1
      }
    ],
    "documents": [
      {
        "id": 1,
        "document_name": "Lab Results - CBC",
        "document_type": "lab_report",
        "uploaded_at": "2026-05-26T10:00:00Z",
        "description": "Complete blood count"
      }
    ]
  }
}
```

### Access List Response
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "doctor_id": 5,
      "first_name": "James",
      "last_name": "Smith",
      "specialization": "Cardiology",
      "clinic_name": "City Medical",
      "access_type": "view",
      "granted_at": "2026-05-20T10:00:00Z",
      "expires_at": "2027-05-20",
      "access_status": "active"
    }
  ]
}
```

### Access Logs Response
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "doctor_id": 5,
      "first_name": "James",
      "last_name": "Smith",
      "specialization": "Cardiology",
      "access_type": "view",
      "accessed_at": "2026-05-26T14:30:00Z",
      "ip_address": "192.168.1.100"
    }
  ]
}
```

---

## Data Types

### Blood Type Enum
- O+, O-
- A+, A-
- B+, B-
- AB+, AB-
- Unknown

### Medical AID Type Enum
- Government
- Private
- NGO
- Self-Pay
- Insurance
- None
- Other

### Document Types
- lab_report
- x_ray
- ct_scan
- ultrasound
- ecg
- medical_certificate
- discharge_summary
- operation_report
- vaccination_record
- other

### Access Types
- view (read-only access to PHR)
- view_and_note (future: can add notes)

### Access Status
- active (currently accessible)
- expired (expiry date passed)
- revoked (patient revoked)

### Access Log Types
- view (viewed PHR)
- download (downloaded PHR)
- print (printed PHR)
- share (shared PHR)
- view_personal_card (viewed patient info)
- view_vitals (viewed vital measurements)
- view_medications (viewed medications)

---

## Testing Checklist

- [ ] Database migration ran successfully
- [ ] Patient can get their complete PHR
- [ ] Patient can get personal card
- [ ] Patient can update blood type and medical aid
- [ ] Patient can record health vital
- [ ] Patient can view health vitals
- [ ] Patient can upload document
- [ ] Patient can get document list
- [ ] Patient can grant doctor access
- [ ] Patient can see doctors with access
- [ ] Patient can revoke doctor access
- [ ] Doctor can request access
- [ ] Patient can see pending requests
- [ ] Patient can approve request
- [ ] Patient can deny request
- [ ] Doctor can view patient PHR
- [ ] Doctor can view patient personal card
- [ ] Doctor can view patient vitals
- [ ] Doctor can view patient medications
- [ ] Access logs show all access events
- [ ] Expired access no longer grants permission
- [ ] Revoked access no longer grants permission

---

## Troubleshooting

### Issue: Migration didn't run

**Solution:**
1. Check server logs for errors
2. Manually verify tables: `psql -d <dbname> -c "\dt"`
3. If missing, run in db.js directly:
   ```javascript
   const createPHRTables = require('./config/createPHRTables');
   await createPHRTables();
   ```

### Issue: Doctor gets "You do not have access" error

**Solution:**
1. Patient must grant access first
2. Verify: `SELECT * FROM phr_access WHERE doctor_id = X AND patient_id = Y`
3. Check if access is revoked: `revoked_at IS NULL`
4. Check if expired: `expires_at > CURRENT_TIMESTAMP OR expires_at IS NULL`

### Issue: Health vitals not showing up

**Solution:**
1. Verify vital was inserted: `SELECT * FROM health_vitals WHERE patient_id = X`
2. Check for error response from POST
3. Ensure at least one vital value is provided

### Issue: CORS error when accessing from frontend

**Solution:**
- Ensure your frontend is calling correct API URL
- Check CORS headers in backend
- Use proper authorization header: `Authorization: Bearer <JWT_TOKEN>`

---

## Performance Tips

1. **Limit vitals query** - Default 30, max 365 records
2. **Archive old records** - Move vitals older than 2 years to archive table
3. **Cache frequently accessed data** - Use Redis for personal card
4. **Index optimization** - Queries use optimized indexes
5. **Batch operations** - Upload multiple documents together

---

## Next Steps

1. ✅ Database migration complete
2. ✅ API endpoints ready
3. **Frontend Integration** - Build UI for PHR viewing
4. **Mobile App** - Create mobile client
5. **Analytics** - Add health trend charts
6. **Notifications** - Email alerts for access requests
7. **Export** - PDF report generation

---

## Support Resources

- **Full Documentation**: See `docs/features/phr/PHR_SYSTEM.md`
- **API Endpoints**: See endpoint list above
- **Database Schema**: Check `config/createPHRTables.js`
- **Models**: See `models/PHR.js` and `models/PHRAccess.js`
- **Controller**: See `controllers/phrController.js`

---

## Version

**v1.0.0** - May 26, 2026

