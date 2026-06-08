# Personal Health Record (PHR) System - Complete Documentation

## Overview

The PHR system is a comprehensive medical records solution that aggregates all patient health data into a single, secure, and accessible platform. It includes:

- **Personal Health Card** - Patient identity, blood type, emergency contacts, medical AID
- **Medical Records** - Conditions, allergies, medications, prescriptions
- **Health Monitoring** - Blood pressure, heart rate, weight, glucose levels, O2 saturation, temperature, BMI
- **Appointment History** - Upcoming and completed appointments
- **Health Documents** - Medical reports, lab results, imaging, discharge summaries
- **Secure Access Control** - Patient controls who (doctors) can access their PHR
- **Audit Trail** - Complete logging of all PHR access and modifications

---

## Architecture Overview

### Core Components

#### 1. Database Tables (5 main tables)

```
health_vitals
├─ patient_id, measured_at
├─ systolic_bp, diastolic_bp (Blood Pressure)
├─ heart_rate
├─ weight_kg, blood_glucose
├─ oxygen_saturation, temperature_c, bmi
└─ Created indexes: patient_id, measured_at

phr_documents
├─ patient_id, document_name, document_type
├─ file_path, uploaded_at, document_date
├─ description, related_condition
└─ Created indexes: patient_id, uploaded_at, document_type

phr_access
├─ patient_id, doctor_id (UNIQUE composite key)
├─ access_type ('view' only)
├─ granted_at, expires_at, revoked_at
└─ Created indexes for fast access checks

phr_access_requests
├─ patient_id, doctor_id
├─ reason, status ('pending', 'approved', 'denied')
├─ requested_at, approved_at
└─ Created indexes for query optimization

phr_access_logs (Audit Trail)
├─ patient_id, doctor_id
├─ access_type ('view', 'download', 'print', 'share')
├─ accessed_at, ip_address, user_agent
└─ Complete audit trail for compliance
```

#### 2. Models

**PHR.js** - Main PHR model with methods:
- `getCompletePHR()` - Get entire patient health record
- `getPersonalCard()` - Get critical patient info
- `getActivePrescriptions()` - Get current prescriptions
- `getCurrentMedications()` - Get active medications
- `getAllergies()` - Get allergy list
- `getMedicalConditions()` - Get diagnoses
- `getUpcomingAppointments()` - Get future appointments
- `getHealthHistory()` - Get past records
- `getRecentHealthVitals()` - Get vital measurements
- `recordHealthVital()` - Record new vital
- `uploadDocument()` - Add medical document
- `getHealthVitalsRange()` - Get vitals for date range
- `updatePersonalHealthDetails()` - Update blood type, medical aid

**PHRAccess.js** - Access control model with methods:
- `grantAccess()` - Patient grants doctor access
- `revokeAccess()` - Patient revokes access
- `hasAccess()` - Check if doctor has access
- `getAccessList()` - Get all doctors with access
- `requestAccess()` - Doctor requests access
- `getPendingRequests()` - Get access requests
- `approveAccessRequest()` - Patient approves request
- `denyAccessRequest()` - Patient denies request
- `logAccess()` - Log access for audit trail
- `getAccessLogs()` - Get audit trail

#### 3. Controller

**phrController.js** with 30+ endpoints:
- Patient PHR viewing and management
- Doctor access requests and viewing
- Health vital recording
- Document management
- Access control management

---

## Data Model: Personal Card

The patient personal card contains critical health information:

```json
{
  "id": 1,
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@example.com",
  "phone_number": "+27123456789",
  "date_of_birth": "1985-05-15",
  "gender": "male",
  "blood_type": "O+",
  "medical_aid_type": "Private",
  "emergency_contact_name": "Jane Doe",
  "emergency_contact_phone": "+27987654321",
  "emergency_contact_relationship": "Spouse"
}
```

### Blood Types Supported
- O+, O-
- A+, A-
- B+, B-
- AB+, AB-
- Unknown

### Medical AID Types
- Government
- Private
- NGO
- Self-Pay
- Insurance
- None
- Other

---

## Health Vitals Tracking

Each vital measurement includes:

```json
{
  "id": 1,
  "patient_id": 1,
  "measured_at": "2026-05-26T14:30:00Z",
  "systolic_bp": 120,
  "diastolic_bp": 80,
  "heart_rate": 72,
  "weight_kg": 75.5,
  "blood_glucose": 110,
  "oxygen_saturation": 98,
  "temperature_c": 37.0,
  "bmi": 24.5,
  "notes": "After exercise"
}
```

### Vital Types Tracked
- **Blood Pressure** - Systolic & Diastolic (mmHg)
- **Heart Rate** - BPM (beats per minute)
- **Weight** - Kilograms
- **Blood Glucose** - mg/dL
- **Oxygen Saturation** - Percentage (%)
- **Temperature** - Celsius
- **BMI** - Body Mass Index

---

## Document Management

Supported document types:

```json
{
  "id": 1,
  "patient_id": 1,
  "document_name": "Lab Results - CBC",
  "document_type": "lab_report",
  "file_path": "/uploads/documents/lab_2026_05_26.pdf",
  "uploaded_at": "2026-05-26T10:00:00Z",
  "document_date": "2026-05-26",
  "description": "Complete blood count test",
  "related_condition": "Annual checkup",
  "notes": "All values within normal range"
}
```

### Document Types
- lab_report - Lab test results
- x_ray - X-ray imaging
- ct_scan - CT scan images
- ultrasound - Ultrasound images
- ecg - ECG reports
- medical_certificate - Medical certificates
- discharge_summary - Hospital discharge
- operation_report - Surgery reports
- vaccination_record - Vaccine certificates
- other - Generic documents

---

## Access Control System

### Two-Way Access Management

#### 1. Patient-Initiated (Direct Grant)
Patient goes to settings → Add Doctor → Grant access

```json
{
  "doctor_id": 5,
  "access_type": "view",
  "expires_at": "2027-05-26T00:00:00Z"
}
```

#### 2. Doctor-Initiated (Request)
Doctor requests access → Patient receives notification → Patient approves/denies

```json
{
  "doctor_id": 5,
  "reason": "Continuing patient care for hypertension",
  "status": "pending"
}
```

### Access Request Workflow

```
Doctor Requests
      ↓
Patient Gets Notification
      ↓
Patient Approves ────→ Access Granted with optional expiry
      ↓
Patient Denies  ────→ Access Denied (can be requested again later)
```

### Access Status Types
- **active** - Currently accessible
- **expired** - Auto-expired after end date
- **revoked** - Patient revoked access

---

## API Endpoints

### Patient Endpoints (View Own PHR)

#### Get Complete PHR
```
GET /api/users/phr/complete
Authorization: Bearer <JWT_TOKEN>
Response: Full PHR with all sections
```

#### Get Personal Card
```
GET /api/users/phr/personal-card
Authorization: Bearer <JWT_TOKEN>
Response: Patient identity and critical health info
```

#### Update Personal Card
```
PUT /api/users/phr/personal-card
Authorization: Bearer <JWT_TOKEN>
Body: {
  "blood_type": "O+",
  "medical_aid_type": "Private"
}
```

#### Get Medical Summary
```
GET /api/users/phr/medical-summary
Response: Counts of conditions, allergies, medications, etc.
```

#### Get Active Prescriptions
```
GET /api/users/phr/prescriptions
Response: List of signed, non-revoked prescriptions
```

#### Get Current Medications
```
GET /api/users/phr/medications
Response: List of active medications
```

#### Get Allergies
```
GET /api/users/phr/allergies
Response: List of allergies with severity
```

#### Get Medical Conditions
```
GET /api/users/phr/conditions
Response: List of diagnoses and chronic conditions
```

#### Get Upcoming Appointments
```
GET /api/users/phr/appointments
Response: Upcoming scheduled appointments
```

#### Get Health History
```
GET /api/users/phr/history
Response: Past appointments, prescriptions, treatments
```

#### Get Recent Health Vitals
```
GET /api/users/phr/vitals?limit=30
Response: Recent vital measurements (default: 30, max: 365)
```

#### Record Health Vital
```
POST /api/users/phr/vitals
Body: {
  "systolic_bp": 120,
  "diastolic_bp": 80,
  "heart_rate": 72,
  "weight_kg": 75.5,
  "blood_glucose": 110,
  "oxygen_saturation": 98,
  "temperature_c": 37.0,
  "bmi": 24.5,
  "notes": "After exercise"
}
Response: Recorded vital measurement
```

#### Get Vitals for Date Range
```
GET /api/users/phr/vitals/range?startDate=2026-05-01&endDate=2026-05-31
Response: All vitals within date range
```

#### Get PHR Documents
```
GET /api/users/phr/documents
Response: List of uploaded medical documents
```

#### Upload Document
```
POST /api/users/phr/documents
Body: {
  "document_name": "Lab Results",
  "document_type": "lab_report",
  "file_path": "/uploads/lab_2026_05.pdf",
  "document_date": "2026-05-26",
  "description": "Blood work results",
  "related_condition": "Diabetes monitoring"
}
Response: Uploaded document details
```

### Access Control (Patient)

#### Get Access List
```
GET /api/users/phr/access
Response: All doctors with current access
```

#### Grant Access to Doctor
```
POST /api/users/phr/access
Body: {
  "doctor_id": 5,
  "access_type": "view",
  "expires_at": "2027-05-26T00:00:00Z"
}
```

#### Revoke Doctor Access
```
DELETE /api/users/phr/access/:doctorId
```

#### Get Pending Access Requests
```
GET /api/users/phr/access/requests
Response: Doctors requesting access
```

#### Approve Access Request
```
POST /api/users/phr/access/requests/:requestId/approve
Body: {
  "expires_at": "2027-05-26T00:00:00Z"  // Optional
}
```

#### Deny Access Request
```
POST /api/users/phr/access/requests/:requestId/deny
Body: {
  "reason": "Not comfortable sharing data"  // Optional
}
```

#### Get Access Logs (Audit Trail)
```
GET /api/users/phr/access-logs?limit=100
Response: Who accessed PHR, when, and what they viewed
```

### Doctor Endpoints

#### Request Patient PHR Access
```
POST /api/users/phr/:patientId/access-request
Authorization: Bearer <DOCTOR_JWT>
Body: {
  "reason": "Continuing patient care for hypertension"
}
```

#### View Patient Complete PHR
```
GET /api/users/phr/:patientId
Authorization: Bearer <DOCTOR_JWT>
Requirement: Must have access granted
Response: Complete patient PHR
```

#### View Patient Personal Card
```
GET /api/users/phr/:patientId/personal-card
Authorization: Bearer <DOCTOR_JWT>
Response: Patient identity and critical info
```

#### View Patient Health Vitals
```
GET /api/users/phr/:patientId/vitals?limit=30
Authorization: Bearer <DOCTOR_JWT>
Response: Patient's health measurements
```

#### View Patient Medications
```
GET /api/users/phr/:patientId/medications
Authorization: Bearer <DOCTOR_JWT>
Response: Patient's current medications
```

---

## Database Migration

### Step 1: Add Migration to initDb.js

```javascript
// In config/initDb.js, add:
const createPHRTables = require('./createPHRTables');

async function initializeDatabase() {
  try {
    // ... existing migrations ...
    await createPHRTables();
    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}
```

### Step 2: Run Migration

```bash
npm run dev
# The migration will run automatically on server start
```

### Step 3: Verify

Check PostgreSQL:
```sql
\dt
-- Should see:
-- health_vitals
-- phr_documents
-- phr_access
-- phr_access_requests
-- phr_access_logs

-- Verify columns in patient_personal_details:
\d patient_personal_details
-- Should see: blood_type, medical_aid_type
```

---

## Security Features

### 1. Authentication & Authorization
- ✅ JWT-based authentication required
- ✅ Role-based access control (patient/doctor only)
- ✅ Patients can only access their own PHR
- ✅ Doctors need explicit permission

### 2. Access Control
- ✅ Patient controls all access
- ✅ Two-way access management (direct or request-based)
- ✅ Time-limited access (expires_at field)
- ✅ Instant revocation capability

### 3. Audit Trail
- ✅ All PHR access logged with:
  - Doctor ID
  - Access type (view, download, print, share)
  - Timestamp
  - IP address
  - User agent
- ✅ Complete compliance audit trail
- ✅ Cannot be altered or deleted

### 4. Data Privacy
- ✅ Encrypted at rest (using PostgreSQL encryption)
- ✅ Encrypted in transit (HTTPS only)
- ✅ Patient data isolated by patient_id
- ✅ Doctor data isolated by doctor_id

---

## Integration with Existing Systems

### 1. Prescription System
The PHR automatically pulls:
- Active prescriptions (status = 'signed', not revoked)
- Medicine details
- Digital signatures
- Prescription history

No additional integration needed!

### 2. Appointment System
The PHR automatically includes:
- Upcoming appointments
- Completed appointments
- Cancelled appointments
- Doctor information
- Appointment notes

No additional integration needed!

### 3. Patient Profile System
The PHR references:
- Medical conditions
- Allergies
- Medications
- Vaccinations
- Lifestyle data
- Test results

All shared seamlessly!

---

## Usage Examples

### Example 1: Patient Checking Their PHR

```bash
# Get complete PHR
curl -X GET http://localhost:3000/api/users/phr/complete \
  -H "Authorization: Bearer eyJ..."

# Response includes:
{
  "success": true,
  "data": {
    "personalCard": { /* patient identity */ },
    "medicalSummary": { /* counts */ },
    "activePrescriptions": [ /* prescriptions */ ],
    "currentMedications": [ /* medications */ ],
    "allergies": [ /* allergies */ ],
    "medicalConditions": [ /* conditions */ ],
    "upcomingAppointments": [ /* appointments */ ],
    "healthHistory": [ /* past records */ ],
    "healthVitals": [ /* vital measurements */ ],
    "emergencyContacts": [ /* emergency info */ ],
    "documents": [ /* uploaded documents */ ]
  }
}
```

### Example 2: Patient Recording Health Vitals

```bash
curl -X POST http://localhost:3000/api/users/phr/vitals \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "systolic_bp": 120,
    "diastolic_bp": 80,
    "heart_rate": 72,
    "weight_kg": 75.5,
    "blood_glucose": 110,
    "oxygen_saturation": 98,
    "temperature_c": 37.0,
    "bmi": 24.5,
    "notes": "After morning exercise"
  }'
```

### Example 3: Patient Granting Doctor Access

```bash
# Direct grant
curl -X POST http://localhost:3000/api/users/phr/access \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "doctor_id": 5,
    "access_type": "view",
    "expires_at": "2027-05-26T00:00:00Z"
  }'
```

### Example 4: Doctor Requesting Access

```bash
curl -X POST http://localhost:3000/api/users/phr/12/access-request \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Continuing care for chronic hypertension"
  }'
```

### Example 5: Patient Approving Access Request

```bash
curl -X POST http://localhost:3000/api/users/phr/access/requests/42/approve \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "expires_at": "2027-05-26T00:00:00Z"
  }'
```

### Example 6: Doctor Viewing Patient PHR

```bash
curl -X GET http://localhost:3000/api/users/phr/12 \
  -H "Authorization: Bearer eyJ..."

# Requires: Doctor has access (either granted directly or via approved request)
# Logs: Access event with IP and timestamp
# Returns: Complete patient PHR
```

---

## Performance Considerations

### Database Indexes
All queries benefit from indexes on:
- `health_vitals.patient_id`
- `health_vitals.measured_at DESC`
- `phr_documents.patient_id`
- `phr_documents.uploaded_at DESC`
- `phr_access.patient_id, doctor_id`
- `phr_access_requests.patient_id, status`

### Query Optimization
- PHR aggregates data from multiple existing tables
- Uses efficient JOINs
- Limits returned records (default: 30 vitals, 50 documents, 100 logs)
- Consider caching frequently accessed data

### Scaling
- Add Redis caching for common queries
- Archive old vitals and documents to separate tables
- Use database partitioning for large patient bases

---

## Troubleshooting

### Issue: Doctor can't see patient PHR

**Cause:** No access granted
**Solution:**
1. Patient must grant access: `POST /api/users/phr/access`
2. OR Doctor requests access: `POST /api/users/phr/:patientId/access-request`
3. Patient must approve: `POST /api/users/phr/access/requests/:requestId/approve`

### Issue: Health vitals not showing

**Cause:** No vitals recorded yet
**Solution:** Record vitals using `POST /api/users/phr/vitals`

### Issue: Old access still showing as active

**Cause:** Expiry date hasn't passed or wasn't set
**Solution:** Revoke explicitly: `DELETE /api/users/phr/access/:doctorId`

### Issue: Prescriptions not appearing in PHR

**Cause:** Prescription not signed or revoked
**Solution:** Ensure prescription has `status = 'signed'` and `revoked_at IS NULL`

---

## Future Enhancements

1. **Sharing with Family** - Allow patients to share read-only PHR with family members
2. **Export to PDF** - Generate complete PHR report as PDF
3. **Third-party Integration** - Export data to health apps (Apple Health, Google Health)
4. **Analytics** - Health trends and patterns (BP over time, weight tracking, etc.)
5. **AI Insights** - Health recommendations based on vitals and history
6. **Mobile App** - Native mobile app for vital tracking
7. **Wearable Integration** - Auto-import from fitness trackers
8. **Pharmacy Access** - Limited access for pharmacies (medications only)
9. **Emergency Access** - Emergency contacts can access in case of emergency
10. **Data Portability** - Patient can download all data in standard format

---

## Compliance & Standards

The PHR system is designed to comply with:
- ✅ HIPAA (Health Insurance Portability and Accountability Act)
- ✅ GDPR (General Data Protection Regulation)
- ✅ POPIA (Protection of Personal Information Act - South Africa)
- ✅ HL7/FHIR standards for health data
- ✅ Local healthcare regulations

Audit trails support compliance audits and investigations.

---

## Support

For issues, questions, or feature requests, please refer to the system documentation or contact the development team.

---

## Version History

- **v1.0.0** - May 26, 2026 - Initial release
  - Complete PHR aggregation
  - Two-way access control
  - Health vital tracking
  - Document management
  - Audit trail
  - Full API implementation

