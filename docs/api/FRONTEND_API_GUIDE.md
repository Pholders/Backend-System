# Backend API Documentation
**Version**: 1.0.0 | **Date**: June 2026 | **Status**: Production Ready

---

## Table of Contents
1. [Authentication](#authentication)
2. [Patient APIs](#patient-apis)
3. [Doctor APIs](#doctor-apis)
4. [Pharmacy APIs](#pharmacy-apis)
5. [Appointments](#appointments)
6. [Prescriptions](#prescriptions)
7. [Payments](#payments)
8. [Health Records (PHR)](#health-records)
9. [Reviews](#reviews)
10. [Error Handling](#error-handling)

---

## Authentication

### Base URL
```
http://localhost:3000/api
```

### Authentication Header
All authenticated endpoints require:
```
Authorization: Bearer {token}
```

### Token Details
- **Type**: JWT
- **Expiry**: 8 hours
- **Refresh**: Token automatically renewed with each request
- **Stored in**: `RefreshTokens` table for persistent sessions

---

## Patient APIs

### 1. Patient Signup
**Endpoint**: `POST /users/signup`

**Description**: Register a new patient account

**Request Body**:
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "email": "john.doe@example.com",
  "phone": "+27701234567",
  "id_passport_number": "AB123456",
  "nationality": "South African",
  "password": "SecurePass123!"
}
```

**Success Response** (201):
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "id": 1,
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user_type": "patient"
  }
}
```

**Validation Rules**:
- Email must be unique
- ID/Passport must be unique
- Password: minimum 6 characters
- Phone: required format
- Nationality: "South African" or "Other"

---

### 2. Patient Login
**Endpoint**: `POST /users/login`

**Description**: Authenticate patient and send OTP to email

**Request Body**:
```json
{
  "email": "john.doe@example.com",
  "password": "SecurePass123!"
}
```

**Success Response** (200):
```json
{
  "success": true,
  "message": "OTP sent to your email. Please verify to complete login.",
  "data": {
    "email": "john.doe@example.com",
    "expiresIn": "10 minutes"
  }
}
```

---

### 3. Verify Login OTP
**Endpoint**: `POST /users/verify-login-otp`

**Description**: Verify OTP and complete login

**Request Body**:
```json
{
  "email": "john.doe@example.com",
  "otp": "123456"
}
```

**Success Response** (200):
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "id": 1,
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user_type": "patient",
    "refreshToken": "refresh_token_here"
  }
}
```

---

### 4. Get Patient Profile
**Endpoint**: `GET /users/patient-profile`

**Auth Required**: ✅ Yes (Bearer token)

**Description**: Retrieve current patient's profile

**Success Response** (200):
```json
{
  "success": true,
  "data": {
    "id": 1,
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com",
    "phone": "+27701234567",
    "nationality": "South African",
    "id_passport_number": "AB123456",
    "profile_picture": "url_or_null",
    "status": "active",
    "created_at": "2026-05-15T10:30:00Z"
  }
}
```

---

### 5. Update Patient Profile
**Endpoint**: `PUT /users/patient-profile`

**Auth Required**: ✅ Yes

**Request Body** (all fields optional):
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+27701234567",
  "nationality": "South African"
}
```

**Success Response** (200):
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "id": 1,
    "first_name": "John",
    "updated_at": "2026-06-17T14:20:00Z"
  }
}
```

---

## Doctor APIs

### 1. Doctor Registration
**Endpoint**: `POST /doctors/register`

**Request Body**:
```json
{
  "first_name": "Jane",
  "last_name": "Smith",
  "email": "jane.smith@example.com",
  "phone": "+27701234567",
  "id_number": "ID123456",
  "nationality": "South African",
  "password": "SecurePass123!",
  "specialization": "General Practitioner",
  "license_number": "LIC123456",
  "years_experience": 8,
  "registration_council": "HPCSA",
  "bio": "Experienced GP with focus on family medicine"
}
```

**Success Response** (201):
```json
{
  "success": true,
  "message": "Doctor registered successfully. OTP sent to email.",
  "data": {
    "id": 1,
    "first_name": "Jane",
    "email": "jane.smith@example.com",
    "user_type": "doctor"
  }
}
```

---

### 2. Doctor Verify OTP
**Endpoint**: `POST /doctors/verify-otp`

**Request Body**:
```json
{
  "email": "jane.smith@example.com",
  "otp": "123456"
}
```

**Success Response** (200):
```json
{
  "success": true,
  "message": "Doctor registration verified successfully",
  "data": {
    "id": 1,
    "first_name": "Jane",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user_type": "doctor",
    "status": "active"
  }
}
```

---

### 3. Get Doctor Profile
**Endpoint**: `GET /doctors/:doctorId`

**Description**: Get public or authenticated doctor profile

**Success Response** (200):
```json
{
  "success": true,
  "data": {
    "id": 1,
    "first_name": "Jane",
    "last_name": "Smith",
    "specialization": "General Practitioner",
    "license_number": "LIC123456",
    "years_experience": 8,
    "rating": 4.8,
    "total_reviews": 42,
    "consultation_fee": 500,
    "bio": "Experienced GP with focus on family medicine",
    "availability": {
      "monday": "09:00-17:00",
      "tuesday": "09:00-17:00",
      "wednesday": "09:00-17:00"
    }
  }
}
```

---

### 4. Update Doctor Availability
**Endpoint**: `PUT /doctors/availability`

**Auth Required**: ✅ Yes (Doctor)

**Request Body**:
```json
{
  "availability": {
    "monday": "09:00-17:00",
    "tuesday": "09:00-17:00",
    "wednesday": "09:00-17:00",
    "thursday": "09:00-17:00",
    "friday": "09:00-17:00",
    "saturday": null,
    "sunday": null
  }
}
```

**Success Response** (200):
```json
{
  "success": true,
  "message": "Availability updated successfully",
  "data": { "updated": true }
}
```

---

### 5. List Available Doctors
**Endpoint**: `GET /doctors?specialization=GP&date=2026-06-20`

**Query Parameters**:
- `specialization` (optional): Filter by specialization
- `date` (optional): Filter by availability date (YYYY-MM-DD)
- `page` (optional): Pagination (default: 1)
- `limit` (optional): Results per page (default: 10)

**Success Response** (200):
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "first_name": "Jane",
      "specialization": "General Practitioner",
      "rating": 4.8,
      "consultation_fee": 500,
      "available_slots": ["09:00", "09:30", "10:00"]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25
  }
}
```

---

## Pharmacy APIs

### 1. Pharmacy Registration
**Endpoint**: `POST /pharmacies/register`

**Request Body**:
```json
{
  "pharmacy_name": "Central City Pharmacy",
  "email": "info@centralpharmacy.com",
  "phone": "+27701234567",
  "location": "123 Main Street, Johannesburg",
  "license_number": "PHARM123456",
  "registration_council": "SAPC",
  "password": "SecurePass123!",
  "operating_hours": {
    "monday": "08:00-18:00",
    "tuesday": "08:00-18:00",
    "wednesday": "08:00-18:00",
    "thursday": "08:00-18:00",
    "friday": "08:00-18:00",
    "saturday": "09:00-13:00",
    "sunday": null
  }
}
```

**Success Response** (201):
```json
{
  "success": true,
  "message": "Pharmacy registered successfully. OTP sent to email.",
  "data": {
    "id": 15,
    "pharmacy_name": "Central City Pharmacy",
    "email": "info@centralpharmacy.com",
    "user_type": "pharmacy"
  }
}
```

---

### 2. Pharmacy Verify OTP
**Endpoint**: `POST /pharmacies/verify-otp`

**Request Body**:
```json
{
  "email": "info@centralpharmacy.com",
  "otp": "123456"
}
```

**Success Response** (200):
```json
{
  "success": true,
  "message": "Pharmacy registration verified successfully",
  "data": {
    "id": 15,
    "pharmacy_name": "Central City Pharmacy",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user_type": "pharmacy",
    "tier": "Basic",
    "status": "active"
  }
}
```

**Auto-Assignment**: Pharmacy automatically assigned to **Basic Tier** (5% commission)

---

### 3. Get Pharmacy Profile
**Endpoint**: `GET /pharmacies/:pharmacyId`

**Success Response** (200):
```json
{
  "success": true,
  "data": {
    "id": 15,
    "pharmacy_name": "Central City Pharmacy",
    "email": "info@centralpharmacy.com",
    "phone": "+27701234567",
    "location": "123 Main Street, Johannesburg",
    "tier": "Basic",
    "commission_rate": 5.0,
    "status": "active",
    "operating_hours": {
      "monday": "08:00-18:00",
      "tuesday": "08:00-18:00"
    },
    "created_at": "2026-05-20T14:30:00Z"
  }
}
```

---

### 4. Get Current Pharmacy Tier
**Endpoint**: `GET /users/pharmacy/current-tier`

**Auth Required**: ✅ Yes (Pharmacy)

**Success Response** (200):
```json
{
  "success": true,
  "data": {
    "currentTier": "basic",
    "groupName": "Basic",
    "description": "Default tier for newly registered pharmacies",
    "features": [
      "prescription_dispensing",
      "patient_records",
      "basic_analytics"
    ],
    "commissionRate": 5.0,
    "joinedAt": "2026-06-17T18:54:00Z"
  }
}
```

---

### 5. Upgrade Pharmacy Tier
**Endpoint**: `POST /users/pharmacy/upgrade-tier`

**Auth Required**: ✅ Yes (Pharmacy)

**Request Body**:
```json
{
  "toTier": "premium"
}
```

**Valid Tier Progression**:
- Basic (5%) → Premium (3.5%) → Enterprise (2%)
- Downgrades not allowed via API (admin-only)

**Success Response** (200):
```json
{
  "success": true,
  "message": "Pharmacy upgraded successfully",
  "data": {
    "previousTier": "basic",
    "newTier": "premium",
    "features": [
      "prescription_dispensing",
      "patient_records",
      "advanced_analytics",
      "multi_location",
      "priority_support",
      "bulk_ordering"
    ],
    "commissionRate": 3.5,
    "upgradedAt": "2026-06-17T19:20:00Z"
  }
}
```

**Error** (400):
```json
{
  "success": false,
  "message": "Cannot downgrade from enterprise to premium. Contact admin."
}
```

---

## Appointments

### 1. Book Appointment
**Endpoint**: `POST /appointments/book`

**Auth Required**: ✅ Yes (Patient)

**Request Body**:
```json
{
  "doctor_id": 1,
  "appointment_date": "2026-06-20",
  "appointment_time": "14:30",
  "reason_for_visit": "Regular checkup",
  "symptoms": "None",
  "medical_history": "No known allergies"
}
```

**Success Response** (201):
```json
{
  "success": true,
  "message": "Appointment booked successfully",
  "data": {
    "id": 42,
    "patient_id": 1,
    "doctor_id": 1,
    "appointment_date": "2026-06-20",
    "appointment_time": "14:30",
    "status": "scheduled",
    "doctor_name": "Dr. Jane Smith",
    "consultation_fee": 500,
    "created_at": "2026-06-17T10:30:00Z"
  }
}
```

---

### 2. Complete Appointment (Doctor)
**Endpoint**: `POST /appointments/:appointmentId/complete`

**Auth Required**: ✅ Yes (Doctor)

**Description**: Doctor marks appointment as completed and triggers payment finalization

**Success Response** (200):
```json
{
  "success": true,
  "message": "Appointment completed successfully",
  "data": {
    "appointmentId": 42,
    "status": "completed",
    "completedAt": "2026-06-20T14:45:00Z",
    "patientName": "John Doe",
    "consultationFee": 500,
    "paymentUpdated": true,
    "paymentStatus": "completed"
  }
}
```

---

### 3. Get Appointments
**Endpoint**: `GET /appointments`

**Auth Required**: ✅ Yes

**Query Parameters**:
- `status` (optional): scheduled, completed, cancelled
- `date` (optional): YYYY-MM-DD
- `page` (optional): Default 1

**Success Response** (200):
```json
{
  "success": true,
  "data": [
    {
      "id": 42,
      "doctor_name": "Dr. Jane Smith",
      "patient_name": "John Doe",
      "appointment_date": "2026-06-20",
      "appointment_time": "14:30",
      "status": "completed",
      "reason_for_visit": "Regular checkup",
      "consultation_fee": 500,
      "payment_status": "completed"
    }
  ]
}
```

---

### 4. Reschedule Appointment
**Endpoint**: `PUT /appointments/:appointmentId/reschedule`

**Auth Required**: ✅ Yes (Patient)

**Request Body**:
```json
{
  "new_date": "2026-06-22",
  "new_time": "15:00",
  "reason": "Scheduling conflict"
}
```

**Success Response** (200):
```json
{
  "success": true,
  "message": "Appointment rescheduled successfully",
  "data": {
    "id": 42,
    "appointment_date": "2026-06-22",
    "appointment_time": "15:00",
    "status": "rescheduled"
  }
}
```

---

### 5. Cancel Appointment
**Endpoint**: `DELETE /appointments/:appointmentId`

**Auth Required**: ✅ Yes

**Query Parameters**:
- `reason` (optional): Cancellation reason

**Success Response** (200):
```json
{
  "success": true,
  "message": "Appointment cancelled successfully",
  "data": {
    "id": 42,
    "status": "cancelled",
    "cancelledAt": "2026-06-17T11:00:00Z"
  }
}
```

---

## Prescriptions

### 1. Create Prescription
**Endpoint**: `POST /prescriptions/create`

**Auth Required**: ✅ Yes (Doctor)

**Description**: Create prescription after appointment. Auto-finalizes cash payments.

**Request Body**:
```json
{
  "appointment_id": 42,
  "patient_id": 1,
  "items": [
    {
      "drug_name": "Aspirin",
      "dosage": "500mg",
      "frequency": "Twice daily",
      "duration": "7 days",
      "quantity": 14,
      "instructions": "Take with food"
    },
    {
      "drug_name": "Paracetamol",
      "dosage": "1000mg",
      "frequency": "As needed",
      "duration": "7 days",
      "quantity": 7,
      "instructions": "Do not exceed 3 doses per day"
    }
  ],
  "notes": "Patient has no known allergies"
}
```

**Success Response** (201):
```json
{
  "success": true,
  "message": "Prescription created successfully",
  "data": {
    "prescription_id": "RX-1781710852537-C62380DA",
    "patient_id": 1,
    "appointment_id": 42,
    "items": [
      {
        "drug_name": "Aspirin",
        "dosage": "500mg",
        "frequency": "Twice daily"
      }
    ],
    "created_at": "2026-06-20T14:50:00Z",
    "claim_expires_at": "2026-07-20T14:50:00Z",
    "paymentFinalized": true,
    "payment_status": "completed"
  }
}
```

**Auto-Payment**: If payment method is "cash_on_arrival" and status is "pending", automatically updates to "completed"

---

### 2. Sign Prescription (Patient)
**Endpoint**: `POST /prescriptions/:prescriptionId/sign`

**Auth Required**: ✅ Yes (Patient)

**Request Body**:
```json
{
  "otp": "123456"
}
```

**Description**: Sign prescription using OTP-based digital signature

**Success Response** (200):
```json
{
  "success": true,
  "message": "Prescription signed successfully",
  "data": {
    "prescription_id": "RX-1781710852537-C62380DA",
    "status": "signed",
    "signed_at": "2026-06-20T15:00:00Z",
    "digital_signature": "sig_hash_here"
  }
}
```

---

### 3. Dispense Prescription (Pharmacy)
**Endpoint**: `POST /prescriptions/:prescriptionId/dispense`

**Auth Required**: ✅ Yes (Pharmacy)

**Request Body**:
```json
{
  "items_dispensed": [
    {
      "prescription_item_id": 1,
      "quantity_dispensed": 14
    }
  ],
  "total_amount_paid": 250.00,
  "payment_method": "cash"
}
```

**Success Response** (200):
```json
{
  "success": true,
  "message": "Prescription dispensed successfully",
  "data": {
    "prescription_id": "RX-1781710852537-C62380DA",
    "status": "dispensed",
    "dispensed_at": "2026-06-20T16:30:00Z",
    "items_dispensed": 2,
    "total_amount": 250.00
  }
}
```

---

### 4. Get Prescription
**Endpoint**: `GET /prescriptions/:prescriptionId`

**Auth Required**: ✅ Yes

**Success Response** (200):
```json
{
  "success": true,
  "data": {
    "prescription_id": "RX-1781710852537-C62380DA",
    "patient_id": 1,
    "doctor_id": 1,
    "status": "dispensed",
    "items": [
      {
        "drug_name": "Aspirin",
        "dosage": "500mg",
        "frequency": "Twice daily",
        "quantity": 14
      }
    ],
    "claim_expires_at": "2026-07-20T14:50:00Z",
    "created_at": "2026-06-20T14:50:00Z",
    "dispensed_at": "2026-06-20T16:30:00Z"
  }
}
```

---

## Payments

### 1. Initialize Payment
**Endpoint**: `POST /payments/initialize`

**Auth Required**: ✅ Yes (Patient)

**Request Body**:
```json
{
  "appointment_id": 42,
  "payment_method": "stripe",
  "amount": 500
}
```

**Payment Methods**:
- `stripe` - Credit/Debit card
- `cash_on_arrival` - Pay at clinic
- `medical_aid` - Insurance/Medical aid

**Success Response** (200):
```json
{
  "success": true,
  "message": "Payment initialized successfully",
  "data": {
    "payment_id": 1,
    "appointment_id": 42,
    "amount": 500,
    "currency": "ZAR",
    "payment_method": "stripe",
    "status": "pending",
    "stripe_client_secret": "pi_3L5L5L5L5L5L5L5L_secret_5L5L5L5L5L5L5L5L",
    "created_at": "2026-06-20T14:35:00Z"
  }
}
```

---

### 2. Get Payment Status
**Endpoint**: `GET /payments/:paymentId`

**Auth Required**: ✅ Yes

**Success Response** (200):
```json
{
  "success": true,
  "data": {
    "payment_id": 1,
    "appointment_id": 42,
    "amount": 500,
    "payment_method": "stripe",
    "payment_status": "completed",
    "transaction_reference": "txn_1L5L5L5L5L5L5L5L",
    "created_at": "2026-06-20T14:35:00Z",
    "completed_at": "2026-06-20T14:40:00Z"
  }
}
```

---

### 3. Payment Status Options
| Status | Description |
|--------|------------|
| `pending` | Payment awaiting completion |
| `completed` | Payment successful |
| `failed` | Payment transaction failed |
| `cancelled` | Payment cancelled by user |

---

## Health Records

### 1. Get PHR Summary
**Endpoint**: `GET /phr/summary`

**Auth Required**: ✅ Yes (Patient)

**Success Response** (200):
```json
{
  "success": true,
  "data": {
    "patient_id": 1,
    "total_appointments": 15,
    "total_prescriptions": 8,
    "active_prescriptions": 2,
    "health_vitals": {
      "last_recorded": "2026-06-17T10:30:00Z",
      "blood_pressure": "120/80",
      "heart_rate": 72,
      "temperature": 36.5
    },
    "documents": {
      "lab_reports": 3,
      "imaging": 1,
      "other": 2
    }
  }
}
```

---

### 2. Record Health Vitals
**Endpoint**: `POST /phr/vitals`

**Auth Required**: ✅ Yes (Patient)

**Request Body**:
```json
{
  "blood_pressure": "120/80",
  "heart_rate": 72,
  "temperature": 36.5,
  "weight": 75.5,
  "height": 175,
  "notes": "Feeling good"
}
```

**Success Response** (201):
```json
{
  "success": true,
  "message": "Health vitals recorded successfully",
  "data": {
    "vital_id": 1,
    "patient_id": 1,
    "recorded_at": "2026-06-17T10:30:00Z"
  }
}
```

---

## Reviews

### 1. Create Doctor Review
**Endpoint**: `POST /reviews/doctor`

**Auth Required**: ✅ Yes (Patient)

**Request Body**:
```json
{
  "doctor_id": 1,
  "appointment_id": 42,
  "rating": 5,
  "title": "Excellent Service",
  "comment": "Dr. Smith was very professional and thorough"
}
```

**Rating**: 1-5 stars

**Success Response** (201):
```json
{
  "success": true,
  "message": "Review submitted successfully",
  "data": {
    "review_id": 1,
    "doctor_id": 1,
    "rating": 5,
    "created_at": "2026-06-20T17:00:00Z"
  }
}
```

---

### 2. Get Doctor Reviews
**Endpoint**: `GET /reviews/doctor/:doctorId`

**Query Parameters**:
- `page` (optional): Default 1
- `limit` (optional): Default 10

**Success Response** (200):
```json
{
  "success": true,
  "data": {
    "doctor_id": 1,
    "average_rating": 4.8,
    "total_reviews": 42,
    "reviews": [
      {
        "review_id": 1,
        "patient_name": "John Doe",
        "rating": 5,
        "title": "Excellent Service",
        "comment": "Dr. Smith was very professional",
        "created_at": "2026-06-20T17:00:00Z"
      }
    ]
  }
}
```

---

## Error Handling

### Standard Error Response
```json
{
  "success": false,
  "message": "Error description",
  "error": {
    "code": "ERROR_CODE",
    "details": "Additional error details"
  }
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (invalid token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 500 | Server Error |

### Common Error Codes

| Code | Description |
|------|------------|
| `INVALID_EMAIL` | Email format invalid |
| `EMAIL_EXISTS` | Email already registered |
| `INVALID_PASSWORD` | Password doesn't meet requirements |
| `INVALID_OTP` | OTP incorrect or expired |
| `UNAUTHORIZED` | Invalid or missing token |
| `ROLE_REQUIRED` | User doesn't have required role |
| `NOT_FOUND` | Resource not found |
| `APPOINTMENT_CONFLICT` | Doctor has conflict at that time |
| `PAYMENT_FAILED` | Payment processing failed |
| `PRESCRIPTION_EXPIRED` | Prescription claim window expired |

---

## Rate Limiting

- **Requests per minute**: 100
- **OTP verification**: 5 attempts per hour
- **Login attempts**: 10 attempts per hour

---

## Security Notes

✅ **Implemented**:
- JWT authentication with 8-hour expiry
- Passwords hashed with bcrypt (10 salt rounds)
- OTP-based email verification
- Role-based access control (RBAC)
- Digital signatures for prescriptions
- Audit logging of all sensitive operations
- SQL injection prevention via parameterized queries
- CORS protection
- Rate limiting

✅ **Best Practices**:
- Always use HTTPS in production
- Store tokens securely (HTTP-only cookies recommended)
- Never log sensitive data
- Validate all inputs server-side
- Implement request timeout (default: 30 seconds)

---

## Environment Variables

```
DATABASE_URL=postgresql://user:password@localhost:5432/healthcare_db
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRY=8h
OTP_EXPIRY=10m
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
REDIS_URL=redis://localhost:6379
NODE_ENV=production
```

---

**Last Updated**: June 2026  
**Next Review**: September 2026  
**Contact**: backend-team@example.com
