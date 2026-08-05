# Doctor Endpoint Documentation

**Role**: `doctor` | **Base URL**: `https://backend-system-u8s2.onrender.com/api` | **Auth**: `Bearer {jwt_token}`

---

## Authentication & Account

> **Signup flow**: `POST /doctor/signup` → `POST /doctor/verify-email` (account activated) → then login normally.
> **Login flow**: `POST /doctor/login` → `POST /doctor/verify-otp` (OTP challenge).

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/users/doctor/signup` | Public | Register a new doctor account |
| POST | `/users/doctor/verify-email` | Public | **Step 2 after signup** — activate account via email OTP |
| POST | `/users/doctor/resend-verification` | Public | Resend email activation OTP |
| POST | `/users/doctor/login` | Public | Login (returns OTP challenge) |
| POST | `/users/doctor/verify-otp` | Public | Verify login OTP |
| POST | `/users/refresh-token` | Public | Refresh access token |
| POST | `/users/doctor/logout` | Doctor | Logout current session |

### Request & Response Examples

#### POST `/users/doctor/signup`
**Request Body:**
```json
{
  "email": "doctor@example.com",
  "password": "SecurePassword123!",
  "firstName": "John",
  "lastName": "Smith",
  "licenseNumber": "LIC-MD-123456",
  "specialization": "General Practice",
  "hospitalAffiliation": "City Medical Center",
  "phone": "+1234567890",
  "yearsOfExperience": 15
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Signup successful. Please verify your email.",
  "doctorId": "doc_abc123def456",
  "email": "doctor@example.com"
}
```

---

#### POST `/users/doctor/verify-email`
**Request Body:**
```json
{
  "email": "doctor@example.com",
  "otp": "123456"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Email verified successfully. Account activated.",
  "doctorId": "doc_abc123def456"
}
```

---

#### POST `/users/doctor/login`
**Request Body:**
```json
{
  "email": "doctor@example.com",
  "password": "SecurePassword123!"
}
```

**Response (200 OK - OTP Challenge):**
```json
{
  "success": true,
  "message": "OTP sent to registered email",
  "sessionId": "sess_xyz789",
  "requiresOTP": true
}
```

---

#### POST `/users/doctor/verify-otp`
**Request Body:**
```json
{
  "sessionId": "sess_xyz789",
  "otp": "654321"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Login successful",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "ref_token_123456",
  "doctorId": "doc_abc123def456",
  "role": "doctor",
  "expiresIn": 3600
}
```

---

## Profile

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users/doctor/profile` | Doctor | Get doctor profile |
| PUT | `/users/doctor/profile` | Doctor | Update doctor profile |
| GET | `/users/doctor/sessions` | Doctor | List active sessions |
| GET | `/users/doctor/activity-log` | Doctor | View account activity log |

### Request & Response Examples

#### GET `/users/doctor/profile`
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "doctorId": "doc_abc123def456",
    "email": "doctor@example.com",
    "firstName": "John",
    "lastName": "Smith",
    "licenseNumber": "LIC-MD-123456",
    "specialization": "General Practice",
    "hospitalAffiliation": "City Medical Center",
    "phone": "+1234567890",
    "yearsOfExperience": 15,
    "profileImage": "https://cdn.example.com/profiles/doc_abc123def456.jpg",
    "isVerified": true,
    "createdAt": "2026-01-15T10:30:00Z"
  }
}
```

---

#### PUT `/users/doctor/profile`
**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Smith",
  "phone": "+1234567891",
  "hospitalAffiliation": "Premium Medical Center",
  "yearsOfExperience": 16
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "doctorId": "doc_abc123def456",
    "firstName": "John",
    "lastName": "Smith",
    "hospitalAffiliation": "Premium Medical Center"
  }
}
```

---

#### GET `/users/doctor/sessions`
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "activeSessions": [
      {
        "sessionId": "sess_xyz789",
        "loginTime": "2026-08-05T14:22:00Z",
        "lastActivity": "2026-08-05T15:30:45Z",
        "ipAddress": "192.168.1.100",
        "deviceType": "web",
        "location": "New York, USA"
      }
    ],
    "totalActive": 1
  }
}
```

---

## Appointments

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users/doctor/appointments` | Doctor | List all assigned appointments |
| POST | `/users/appointments/:appointmentId/accept` | Doctor | Accept an appointment (acknowledge before consultation) |
| POST | `/users/appointments/:appointmentId/complete` | Doctor | Mark appointment as completed after consultation |

> **Note**: Completing an appointment automatically finalizes cash payments and triggers prescription creation flow.

### Request & Response Examples

#### GET `/users/doctor/appointments`
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "appointments": [
      {
        "appointmentId": "apt_123456",
        "patientName": "Jane Doe",
        "patientId": "pat_999",
        "appointmentDate": "2026-08-05T14:30:00Z",
        "duration": 30,
        "status": "pending",
        "consultationType": "video_call",
        "reason": "General checkup",
        "createdAt": "2026-08-04T10:00:00Z"
      }
    ],
    "total": 1
  }
}
```

---

#### POST `/users/appointments/:appointmentId/accept`
**Request Body:**
```json
{
  "appointmentId": "apt_123456"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Appointment accepted",
  "data": {
    "appointmentId": "apt_123456",
    "status": "accepted",
    "acceptedAt": "2026-08-05T14:20:00Z",
    "consultationLink": "https://consultation.example.com/apt_123456"
  }
}
```

---

#### POST `/users/appointments/:appointmentId/complete`
**Request Body:**
```json
{
  "appointmentId": "apt_123456",
  "notes": "Patient presents with mild fever and cough. Prescribed antibiotics.",
  "diagnosis": "Upper respiratory infection",
  "prescriptionRequired": true
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Appointment completed successfully",
  "data": {
    "appointmentId": "apt_123456",
    "status": "completed",
    "completedAt": "2026-08-05T15:05:00Z",
    "paymentFinalized": true,
    "prescriptionCreated": true,
    "prescriptionId": "rx_123456"
  }
}
```

---

## Prescriptions (`/api/prescriptions`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/prescriptions` | Doctor | Create a new prescription |
| POST | `/prescriptions/:prescriptionId/medicines` | Doctor | Add medicine to prescription |
| POST | `/prescriptions/:prescriptionId/check-interactions` | Doctor | Check drug interactions |
| POST | `/prescriptions/:prescriptionId/sign` | Doctor | Digitally sign prescription with OTP |
| POST | `/prescriptions/:prescriptionId/revoke` | Doctor | Revoke a prescription |
| GET | `/prescriptions/doctor/all` | Doctor | List all prescriptions issued by this doctor |
| POST | `/prescriptions/doctor/signed` | Doctor | Get signed prescriptions (filtered) |

### Request & Response Examples

#### POST `/prescriptions`
**Request Body:**
```json
{
  "patientId": "pat_999",
  "appointmentId": "apt_123456",
  "diagnosis": "Upper respiratory infection",
  "prescriptionDate": "2026-08-05T15:05:00Z",
  "notes": "Patient advised on symptom management"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Prescription created successfully",
  "data": {
    "prescriptionId": "rx_123456",
    "patientId": "pat_999",
    "status": "draft",
    "createdAt": "2026-08-05T15:05:00Z"
  }
}
```

---

#### POST `/prescriptions/:prescriptionId/medicines`
**Request Body:**
```json
{
  "prescriptionId": "rx_123456",
  "medicines": [
    {
      "name": "Amoxicillin",
      "strength": "500mg",
      "quantity": 20,
      "daysSupply": 10,
      "instructions": "Take one tablet three times daily with food",
      "frequency": "3 times daily",
      "duration": "10 days"
    },
    {
      "name": "Acetaminophen",
      "strength": "500mg",
      "quantity": 30,
      "daysSupply": 15,
      "instructions": "Take one to two tablets every 4-6 hours as needed",
      "frequency": "As needed"
    }
  ]
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Medicines added to prescription",
  "data": {
    "prescriptionId": "rx_123456",
    "medicineCount": 2,
    "status": "draft"
  }
}
```

---

#### POST `/prescriptions/:prescriptionId/check-interactions`
**Request Body:**
```json
{
  "prescriptionId": "rx_123456"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "interactions": [],
    "hasCriticalInteractions": false,
    "hasModerateInteractions": false,
    "message": "No drug interactions detected"
  }
}
```

---

#### POST `/prescriptions/:prescriptionId/sign`
**Request Body:**
```json
{
  "prescriptionId": "rx_123456",
  "otp": "123456"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Prescription signed successfully",
  "data": {
    "prescriptionId": "rx_123456",
    "status": "signed",
    "signedAt": "2026-08-05T15:10:00Z",
    "qrToken": "qr_xyz789abc123",
    "expiryDate": "2026-09-05T15:10:00Z"
  }
}
```

---

#### GET `/prescriptions/doctor/all`
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "prescriptions": [
      {
        "prescriptionId": "rx_123456",
        "patientName": "Jane Doe",
        "patientId": "pat_999",
        "issuedDate": "2026-08-05T15:05:00Z",
        "status": "signed",
        "medicineCount": 2,
        "expiryDate": "2026-09-05T15:10:00Z"
      }
    ],
    "total": 1
  }
}
```

---

## Personal Health Records — Patient Access (`/api/users`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/users/phr/:patientId/access-request` | Doctor | Request access to patient's PHR |
| GET | `/users/phr/:patientId` | Doctor | View patient's complete PHR (requires access) |
| GET | `/users/phr/:patientId/personal-card` | Doctor | View patient's personal health card |
| GET | `/users/phr/:patientId/vitals` | Doctor | View patient's health vitals |
| GET | `/users/phr/:patientId/medications` | Doctor | View patient's current medications |

> **Access Flow**: Doctor requests access → Patient approves via `/phr/access/requests/:requestId/approve` → Doctor can view PHR.

### Request & Response Examples

#### POST `/users/phr/:patientId/access-request`
**Request Body:**
```json
{
  "patientId": "pat_999",
  "reason": "Follow-up consultation for respiratory infection"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Access request sent to patient",
  "data": {
    "requestId": "phr_req_123456",
    "patientId": "pat_999",
    "doctorId": "doc_abc123def456",
    "status": "pending",
    "requestedAt": "2026-08-05T15:15:00Z"
  }
}
```

---

#### GET `/users/phr/:patientId`
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "patientId": "pat_999",
    "patientName": "Jane Doe",
    "dateOfBirth": "1990-05-15",
    "bloodType": "O+",
    "allergies": [
      {
        "allergen": "Penicillin",
        "severity": "severe",
        "reaction": "Anaphylaxis"
      }
    ],
    "medicalHistory": [
      {
        "condition": "Hypertension",
        "diagnosedDate": "2020-03-10",
        "status": "active"
      }
    ],
    "currentMedications": [
      {
        "name": "Lisinopril",
        "strength": "10mg",
        "frequency": "Once daily"
      }
    ]
  }
}
```

---

#### GET `/users/phr/:patientId/vitals`
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "patientId": "pat_999",
    "lastRecorded": "2026-08-05T10:30:00Z",
    "vitals": {
      "bloodPressure": "120/80 mmHg",
      "heartRate": 72,
      "temperature": 36.5,
      "respiratoryRate": 16,
      "oxygenSaturation": 98,
      "weight": 70,
      "height": 175
    }
  }
}
```

---

## Public Endpoints (Available to Doctors)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users/appointments/booking-info` | Public | Get booking time periods and date ranges |
| GET | `/users/appointments/day-availability` | Public | Get full day availability |
| GET | `/prescriptions/qr/:qrToken` | Public | Access prescription via QR code |
| GET | `/prescriptions/qr/:qrToken/status` | Public | Check QR code status |
| GET | `/legal/terms` | Public | Terms of service |
| GET | `/legal/privacy` | Public | Privacy policy |

### Request & Response Examples

#### GET `/prescriptions/qr/:qrToken`
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "prescriptionId": "rx_qr_abc123",
    "patientName": "Jane Doe",
    "doctorName": "Dr. John Smith",
    "issuedDate": "2026-08-05T15:05:00Z",
    "medicines": [
      {
        "name": "Amoxicillin",
        "strength": "500mg",
        "quantity": 20,
        "daysSupply": 10,
        "instructions": "Take one tablet three times daily with food"
      },
      {
        "name": "Acetaminophen",
        "strength": "500mg",
        "quantity": 30,
        "instructions": "Take one to two tablets every 4-6 hours as needed"
      }
    ],
    "status": "active",
    "expiryDate": "2026-09-05T15:10:00Z"
  }
}
```

---

#### GET `/prescriptions/qr/:qrToken/status`
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "qrToken": "qr_xyz789abc",
    "prescriptionId": "rx_qr_abc123",
    "status": "active",
    "issuedDate": "2026-08-05T15:05:00Z",
    "expiryDate": "2026-09-05T15:10:00Z",
    "dispensingStatus": "not_dispensed",
    "scans": 2
  }
}
```

---

#### GET `/users/appointments/booking-info`
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "bookingPeriods": [
      {
        "dayOfWeek": "Monday",
        "startTime": "09:00",
        "endTime": "17:00",
        "slotDuration": 30
      }
    ],
    "dateRange": {
      "startDate": "2026-08-05",
      "endDate": "2026-12-31"
    }
  }
}
```

---

#### GET `/legal/privacy`
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "title": "Privacy Policy",
    "lastUpdated": "2026-01-01T00:00:00Z",
    "content": "Privacy policy content here..."
  }
}
```

---

## Error Responses

All endpoints may return error responses in the following format:

### Common Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

### HTTP Status Codes
- `200 OK` — Request succeeded
- `201 Created` — Resource created successfully
- `400 Bad Request` — Invalid request parameters
- `401 Unauthorized` — Missing or invalid authentication token
- `403 Forbidden` — Insufficient permissions
- `404 Not Found` — Resource not found
- `409 Conflict` — Request conflicts with current state
- `500 Internal Server Error` — Server-side error

### Example Error Response (401 Unauthorized)
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired authentication token"
  }
}
```
