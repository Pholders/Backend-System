# API Quick Reference

## Authentication

### Headers Required
```
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

---

## Patient Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/users/signup` | ❌ | Register new patient |
| POST | `/api/users/login` | ❌ | Send OTP to email |
| POST | `/api/users/verify-login-otp` | ❌ | Verify OTP and login |
| GET | `/api/users/patient-profile` | ✅ | Get patient profile |
| PUT | `/api/users/patient-profile` | ✅ | Update patient profile |

---

## Doctor Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/doctors/register` | ❌ | Register doctor |
| POST | `/api/doctors/verify-otp` | ❌ | Verify registration OTP |
| GET | `/api/doctors` | ❌ | List available doctors |
| GET | `/api/doctors/:doctorId` | ❌ | Get doctor profile |
| PUT | `/api/doctors/availability` | ✅ | Update availability |
| GET | `/api/doctors/:doctorId/slots` | ❌ | Get available time slots |

---

## Pharmacy Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/pharmacies/register` | ❌ | Register pharmacy |
| POST | `/api/pharmacies/verify-otp` | ❌ | Verify registration |
| GET | `/api/pharmacies/:pharmacyId` | ❌ | Get pharmacy profile |
| GET | `/api/users/pharmacy/current-tier` | ✅ | Get current tier |
| POST | `/api/users/pharmacy/upgrade-tier` | ✅ | Upgrade tier |

---

## Appointment Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/appointments/book` | ✅ | Book appointment |
| GET | `/api/appointments` | ✅ | List appointments |
| GET | `/api/appointments/:appointmentId` | ✅ | Get appointment details |
| PUT | `/api/appointments/:appointmentId/reschedule` | ✅ | Reschedule appointment |
| DELETE | `/api/appointments/:appointmentId` | ✅ | Cancel appointment |
| POST | `/api/appointments/:appointmentId/complete` | ✅ | Mark as completed |

---

## Prescription Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/prescriptions/create` | ✅ | Create prescription |
| GET | `/api/prescriptions/:prescriptionId` | ✅ | Get prescription details |
| POST | `/api/prescriptions/:prescriptionId/sign` | ✅ | Sign prescription (OTP) |
| POST | `/api/prescriptions/:prescriptionId/dispense` | ✅ | Dispense prescription |
| GET | `/api/prescriptions` | ✅ | List prescriptions |

---

## Payment Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/payments/initialize` | ✅ | Initialize payment |
| GET | `/api/payments/:paymentId` | ✅ | Get payment status |
| GET | `/api/payments/appointment/:appointmentId` | ✅ | Get appointment payment |

---

## Health Records (PHR) Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/phr/summary` | ✅ | Get health summary |
| POST | `/api/phr/vitals` | ✅ | Record health vitals |
| GET | `/api/phr/vitals` | ✅ | Get vital history |
| POST | `/api/phr/documents` | ✅ | Upload document |
| GET | `/api/phr/documents` | ✅ | List documents |

---

## Review Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/reviews/doctor` | ✅ | Create doctor review |
| GET | `/api/reviews/doctor/:doctorId` | ❌ | Get doctor reviews |

---

## Common Response Format

### Success (200-201)
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { /* response data */ }
}
```

### Error (4xx-5xx)
```json
{
  "success": false,
  "message": "Error description",
  "error": {
    "code": "ERROR_CODE"
  }
}
```

---

## Tier System

### Pharmacy Tiers

**Basic (Default)**
- 5% Commission
- Features: prescription_dispensing, patient_records, basic_analytics

**Premium**
- 3.5% Commission
- Features: + multi_location, priority_support, bulk_ordering

**Enterprise**
- 2% Commission
- Features: + api_access, custom_integration, dedicated_support

---

## Payment Methods

| Method | Status | Description |
|--------|--------|-------------|
| stripe | `completed` | Credit/Debit card |
| cash_on_arrival | `pending` → `completed` | Pay at clinic |
| medical_aid | `pending` | Insurance/Medical aid |

---

## Status Values

### Appointments
- `scheduled` → `completed` or `cancelled` or `rescheduled`

### Prescriptions
- `created` → `signed` → `dispensed`

### Payments
- `pending` → `completed` or `failed` or `cancelled`

### Users
- `pending` → `active` or `inactive`

---

## Prescription Claim Window

- **Duration**: 30 days from creation
- **Auto-set**: Yes (CURRENT_TIMESTAMP + 30 days)
- **Expires**: After 30 days, pharmacy cannot claim

---

## Important Notes

⚠️ **Payment Lifecycle**:
1. Appointment booked (no payment yet)
2. Appointment completed by doctor
3. Payment status updated to `completed`
4. Prescription created → auto-finalizes cash payments

⚠️ **Pharmacy Auto-Assignment**:
- New pharmacies registered → automatically assigned to **Basic Tier**
- Can self-upgrade anytime via `/pharmacy/upgrade-tier` endpoint
- Cannot downgrade without admin approval

⚠️ **OTP Expiry**:
- 10 minutes from generation
- 5 attempts per hour limit

⚠️ **Token Expiry**:
- 8 hours
- Automatically refreshed with each request

---

**Version**: 1.0.0  
**Last Updated**: June 2026
