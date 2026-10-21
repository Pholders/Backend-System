# Backend API Documentation
**Version**: 1.0.0 | **Date**: June 2026 | **Status**: Production Ready

---

## 📚 Documentation Files

### For Quick Lookup
👉 **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** - Fast endpoint reference with method, status codes, and purpose

### For Detailed Implementation
👉 **[FRONTEND_API_GUIDE.md](./FRONTEND_API_GUIDE.md)** - Complete guide with full request/response examples for all endpoints

---

## 🚀 Quick Start

### Base URL
```
http://localhost:3000/api
```

### Authentication
```
Authorization: Bearer {jwt_token}
```

### First Steps
1. **Patient Registration**: `POST /users/signup`
2. **Login**: `POST /users/login` → Verify OTP → `POST /users/verify-login-otp`
3. **Book Appointment**: `POST /appointments/book`
4. **Complete Appointment**: Doctor does `POST /appointments/:id/complete`
5. **Create Prescription**: `POST /prescriptions/create`
6. **Dispense**: `POST /prescriptions/:id/dispense`

---

## 📋 API Modules

### User & Authentication
- Patient Signup/Login
- Email OTP Verification
- Profile Management
- JWT Token Management

### Appointments
- Book appointment with doctor
- Reschedule appointment
- Cancel appointment
- Doctor acceptance/completion
- Auto-payment finalization on completion

### Prescriptions
- Create prescription (auto-finalizes cash payments)
- Sign with OTP digital signature
- Dispense at pharmacy
- 30-day claim window (auto-calculated)
- One-time use per pharmacy

### Payments
- Initialize payment (stripe, cash_on_arrival, medical_aid)
- Track payment status
- Auto-finalization on prescription creation (cash)
- Payment updates on appointment completion

### Pharmacy Management
- Pharmacy registration & verification
- Auto-assign to Basic Tier on signup
- Self-service tier upgrades (Basic → Premium → Enterprise)
- Tier-specific features and commissions
- Downgrade prevention

### Health Records (PHR)
- Record and track health vitals
- Document upload/storage
- Access control
- Medical history

### Reviews
- Doctor reviews with ratings
- Public review visibility
- Rating aggregation

---

## 🔐 Security Features

✅ **Authentication**
- JWT tokens (8-hour expiry)
- Automatic token refresh
- Role-based access control (RBAC)

✅ **Password Security**
- Bcrypt hashing (10 salt rounds)
- Minimum 6 characters required
- Password reset with email OTP

✅ **OTP Verification**
- Email-based OTP (10 minutes valid)
- 5 attempts per hour limit
- Used for signup, login, and prescription signing

✅ **Data Protection**
- Parameterized queries (SQL injection prevention)
- Input validation
- Output encoding
- CORS protection

✅ **Audit Logging**
- All sensitive operations logged
- Login/signup tracking
- Payment modifications
- Tier upgrades
- Role changes

---

## 💰 Payment System

### Methods
| Method | Workflow |
|--------|----------|
| **Stripe** | Online card payment → immediately completed |
| **Cash on Arrival** | Pending until appointment completion |
| **Medical Aid** | Pending until insurance verification |

### Statuses
- `pending` - Awaiting payment
- `completed` - Successfully paid
- `failed` - Transaction failed
- `cancelled` - User cancelled

### Auto-Finalization
Payment status automatically changes to `completed` when:
1. Doctor marks appointment as completed (`POST /appointments/:id/complete`)
2. Prescription created with cash payment method (`POST /prescriptions/create`)

---

## 🏥 Pharmacy Tier System

### Default Tiers

| Tier | Commission | Features | Upgrade Path |
|------|-----------|----------|--------------|
| **Basic** | 5% | prescription_dispensing, patient_records, basic_analytics | → Premium |
| **Premium** | 3.5% | + multi_location, priority_support, bulk_ordering | → Enterprise |
| **Enterprise** | 2% | + api_access, custom_integration, dedicated_support | (Top tier) |

### Workflow
1. **Registration**: Pharmacy signs up
2. **Verification**: OTP verification
3. **Auto-Assignment**: Automatically assigned to Basic Tier
4. **Upgrade**: Self-service via `POST /pharmacy/upgrade-tier`
5. **Downgrade**: Admin-only (contact support)

---

## 📅 Prescription Management

### Claim Window
- **Duration**: 30 days from creation
- **Auto-Set**: Yes - automatically calculated at creation
- **Formula**: `CURRENT_TIMESTAMP + INTERVAL '30 days'`
- **After Expiry**: Pharmacy cannot claim prescription

### Lifecycle
```
Created → Signed (Patient OTP) → Dispensed (Pharmacy) → Completed
```

### Features
- One-time use per pharmacy
- Digital signature with OTP
- QR code support
- Payment auto-finalization (cash only)
- Audit trail tracking

---

## 🔄 Key Workflows

### Appointment to Payment Flow
```
1. Patient books appointment
2. Doctor completes appointment
3. Payment status automatically updated to 'completed'
4. Doctor creates prescription
5. Prescription claim window set (30 days)
6. Pharmacy receives and dispenses
```

### Pharmacy Onboarding
```
1. Pharmacy registers with license info
2. Receives OTP via email
3. Verifies OTP
4. Automatically assigned to Basic Tier (5% commission)
5. Can immediately accept prescriptions
6. Can upgrade tier anytime
```

### Prescription Claim
```
1. Prescription created with 30-day expiry
2. Patient signs with OTP
3. Prescription shared with pharmacy via QR code
4. Pharmacy dispenses within 30-day window
5. After 30 days → prescription expires
```

---

## ⚠️ Important Notes

### Payment Rules
- Payment records created during `POST /payments/initialize`
- Cash payments auto-finalized on appointment completion
- Stripe payments require client confirmation
- Medical aid requires insurance verification

### Pharmacy Rules
- Cannot downgrade tiers (admin-only)
- Features unlocked based on tier
- Commission rate automatically applied
- All tiers can accept prescriptions

### Prescription Rules
- Claim expires after 30 days (auto-calculated)
- Can only be dispensed once
- Must be signed before dispensing
- Digital signature required (OTP-based)

### User Rules
- Email must be unique
- ID/Passport must be unique
- Password minimum 6 characters
- Phone must be in valid format

---

## 🛠️ Testing Guide

### With cURL

**Patient Signup**
```bash
curl -X POST http://localhost:3000/api/users/signup \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@example.com",
    "phone": "+27701234567",
    "id_passport_number": "AB123456",
    "nationality": "South African",
    "password": "SecurePass123!"
  }'
```

**Book Appointment**
```bash
curl -X POST http://localhost:3000/api/appointments/book \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "doctor_id": 1,
    "appointment_date": "2026-06-20",
    "appointment_time": "14:30",
    "reason_for_visit": "Regular checkup"
  }'
```

**Create Prescription**
```bash
curl -X POST http://localhost:3000/api/prescriptions/create \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "appointment_id": 42,
    "patient_id": 1,
    "items": [
      {
        "drug_name": "Aspirin",
        "dosage": "500mg",
        "frequency": "Twice daily",
        "duration": "7 days",
        "quantity": 14
      }
    ]
  }'
```

---

## 📊 Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request / Validation Error |
| 401 | Unauthorized / Invalid Token |
| 403 | Forbidden / Insufficient Permissions |
| 404 | Not Found |
| 500 | Server Error |

---

## 🔗 Related Documentation

- **Database Schema**: See `/docs/db/SCHEMA.md`
- **Installation**: See `../GETTING_STARTED.md`
- **Environment Setup**: See `../ENV_SETUP.md`
- **Error Handling**: See `../CENTRALIZED_ERROR_HANDLING.md`

---

## 📞 Support

- **Issues**: Check the Quick Reference and Frontend API Guide
- **Bug Reports**: Create issue with reproduction steps
- **Feature Requests**: Contact backend-team@example.com

---

**Last Updated**: June 2026  
**Next Review**: September 2026  
**Contact**: backend-team@example.com
