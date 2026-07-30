# API Documentation Index

## 📚 Documentation Files

### 1. **DOCUMENTATION.md** - Overview & Status
   - Project overview and status
   - Key features and modules
   - Security implementation details
   - Payment system explanation
   - Pharmacy tier system
   - Important workflows
   - **Best for**: Getting oriented with the system

### 2. **QUICK_REFERENCE.md** - Fast Lookup
   - All endpoints at a glance
   - HTTP methods, authentication, purpose
   - Response format
   - Status values and tier system
   - Important notes and warnings
   - **Best for**: Quick endpoint lookup during development

### 3. **FRONTEND_API_GUIDE.md** - Complete Reference
   - Detailed endpoint documentation
   - Full request/response examples
   - All required fields and parameters
   - Error codes and handling
   - Security notes and best practices
   - Rate limiting info
   - Environment variables
   - **Best for**: Integration implementation and reference

### 4. **FRONTEND_INTEGRATION_GUIDE.md** - Developer Guide
   - Step-by-step integration instructions
   - Authentication flow walkthrough
   - Code examples (fetch, axios, React)
   - API utility function patterns
   - State management examples
   - Error handling patterns
   - Common patterns and best practices
   - Deployment checklist
   - Performance optimization tips
   - **Best for**: Frontend developers implementing the API

---

## 🎯 How to Use These Docs

### I'm a Frontend Developer - Where Do I Start?

1. **First Time?** 
   - Read: `DOCUMENTATION.md` (5 min overview)
   - Then: `FRONTEND_INTEGRATION_GUIDE.md` (setup and auth)

2. **Need to Implement a Feature?**
   - Quick lookup: `QUICK_REFERENCE.md` (find endpoint)
   - Details: `FRONTEND_API_GUIDE.md` (request/response)
   - Implementation: `FRONTEND_INTEGRATION_GUIDE.md` (code examples)

3. **Looking for Specific Endpoint?**
   - Quick: `QUICK_REFERENCE.md` (table lookup)
   - Details: `FRONTEND_API_GUIDE.md` (full documentation)

4. **Need Error Handling?**
   - Check: `FRONTEND_API_GUIDE.md` → Error Handling section
   - Or: `FRONTEND_INTEGRATION_GUIDE.md` → Error Handling section

5. **Deploying to Production?**
   - Check: `FRONTEND_INTEGRATION_GUIDE.md` → Deployment Checklist

---

## 🔑 Key Information At a Glance

### Base URL
```
Development: http://localhost:3000/api
Production: https://api.healthcare.com/api
```

### Authentication
```
Authorization: Bearer {jwt_token}
Token Expiry: 8 hours
OTP Expiry: 10 minutes
```

### Main User Roles
- `patient` - Can book appointments, view prescriptions
- `doctor` - Can create prescriptions, complete appointments
- `pharmacy` - Can dispense prescriptions, manage tier
- `admin` - Full system access

### Payment Status Progression
```
pending → completed (after appointment completion)
       → failed (if payment failed)
       → cancelled (if user cancels)
```

### Prescription Claim Window
```
Duration: 30 days from creation
Auto-set: Yes (CURRENT_TIMESTAMP + 30 days)
After expiry: Cannot be claimed by pharmacy
```

### Pharmacy Tier Progression
```
Basic (5%) → Premium (3.5%) → Enterprise (2%)
Auto-assigned to Basic on registration
Downgrade requires admin approval
```

---

## 📋 Endpoint Quick Access

### Authentication
- POST `/users/signup` - Register patient
- POST `/users/login` - Login (sends OTP)
- POST `/users/verify-login-otp` - Verify and complete login

### Patients
- GET `/users/patient-profile` - Get profile
- PUT `/users/patient-profile` - Update profile
- POST `/appointments/book` - Book appointment
- GET `/appointments` - List appointments

### Doctors
- POST `/doctors/register` - Register doctor
- POST `/doctors/verify-otp` - Verify registration
- GET `/doctors` - List doctors
- PUT `/doctors/availability` - Update availability

### Appointments
- POST `/appointments/book` - Book
- PUT `/appointments/:id/reschedule` - Reschedule
- DELETE `/appointments/:id` - Cancel
- POST `/appointments/:id/complete` - Mark complete (auto-finalizes payment)

### Prescriptions
- POST `/prescriptions/create` - Create (auto-finalizes cash payment)
- GET `/prescriptions/:id` - Get details
- POST `/prescriptions/:id/sign` - Sign with OTP
- POST `/prescriptions/:id/dispense` - Dispense

### Pharmacies
- POST `/pharmacies/register` - Register
- POST `/pharmacies/verify-otp` - Verify (auto-assign Basic tier)
- GET `/users/pharmacy/current-tier` - Get tier info
- POST `/users/pharmacy/upgrade-tier` - Upgrade tier

### Payments
- POST `/payments/initialize` - Initialize payment
- GET `/payments/:id` - Get status

### Health Records
- GET `/phr/summary` - Get health summary
- POST `/phr/vitals` - Record vitals
- GET `/phr/vitals` - Get vitals history

### Reviews
- POST `/reviews/doctor` - Create review
- GET `/reviews/doctor/:id` - Get reviews

---

## 🔐 Security Features

✅ **Authentication**
- JWT tokens (8-hour expiry)
- OTP email verification (10-minute expiry)
- Automatic token refresh
- Role-based access control (RBAC)

✅ **Data Protection**
- Parameterized queries (SQL injection prevention)
- Input validation on all endpoints
- Password hashing (bcrypt, 10 salt rounds)
- Audit logging of sensitive operations

✅ **API Security**
- CORS protection
- Rate limiting (100 req/min, 5 OTP attempts/hour)
- HTTPS required in production
- Request timeouts (30 seconds default)

---

## 🚀 Common Workflows

### Patient Booking Appointment
```
1. Patient signup → verification email OTP
2. Login → email OTP verification
3. Browse doctors (GET /doctors)
4. Book appointment (POST /appointments/book)
5. Initialize payment (POST /payments/initialize)
6. Complete payment (Stripe/cash/medical_aid)
7. Wait for appointment date
8. After appointment: payment auto-finalized
9. Doctor creates prescription
10. Patient signs prescription (OTP)
11. Share prescription with pharmacy (QR code)
12. Pharmacy dispenses
13. Patient reviews doctor
```

### Doctor Creating Prescription
```
1. Doctor logs in with email OTP
2. View scheduled appointments
3. Complete appointment (POST /appointments/:id/complete)
   - Triggers payment status update to 'completed'
4. Create prescription (POST /prescriptions/create)
   - Auto-finalizes cash payments
   - Sets claim expiry to 30 days from now
5. Prescription available for patient to sign
```

### Pharmacy Dispensing Prescription
```
1. Pharmacy registers → auto-assigned to Basic tier (5%)
2. Login with email OTP
3. Receive prescription from patient (QR code or ID)
4. Verify prescription (not expired, not already dispensed)
5. Dispense prescription (POST /prescriptions/:id/dispense)
6. Record items dispensed and payment
7. Can upgrade tier anytime (POST /pharmacy/upgrade-tier)
```

---

## ⚠️ Important Notes for Developers

### Payment Lifecycle
- Payment records created during `POST /payments/initialize`
- Cash payment status changes to `completed` when:
  - Doctor marks appointment complete, OR
  - Prescription created
- Stripe payments require client-side confirmation
- Medical aid requires insurance verification

### Prescription Claim Window
- Automatically calculated: current time + 30 days
- Stored in `claim_expires_at` column
- After expiry, pharmacy cannot claim
- Display expiry countdown in UI

### Pharmacy Tiers
- New pharmacies: automatically assigned to Basic
- Tier affects features available in system
- Lower tier = higher commission rate (5% → 2%)
- Each tier has specific features (features array in response)
- Downgrades not allowed via API

### OTP Verification
- Always happens after login/registration
- 10 minutes expiry (show countdown)
- 5 attempts per hour limit
- Resend available
- Used for: signup, login, prescription signing

### Error Responses
- All errors include `error.code` for programmatic handling
- `message` is human-readable
- Check status codes for rate limiting (429)
- 401 = token expired (redirect to login)

---

## 📞 Support

### Questions About...
- **Implementation**: See `FRONTEND_INTEGRATION_GUIDE.md`
- **Specific Endpoint**: See `QUICK_REFERENCE.md` then `FRONTEND_API_GUIDE.md`
- **Errors**: Check error code in `FRONTEND_API_GUIDE.md` → Error Handling
- **Authentication**: See `FRONTEND_INTEGRATION_GUIDE.md` → Authentication Flow
- **Payments**: See `DOCUMENTATION.md` → Payment System
- **Pharmacy Tiers**: See `DOCUMENTATION.md` → Pharmacy Tier System

### Contact
- **Backend Team**: backend-team@example.com
- **Issues**: Create GitHub issue with reproduction steps
- **Feature Requests**: Email with details

---

## 📊 Documentation Stats

| Document | Size | Topics | Examples |
|----------|------|--------|----------|
| DOCUMENTATION.md | ~4KB | Overview, workflows, status codes | 10+ |
| QUICK_REFERENCE.md | ~3KB | Endpoints, statuses, tiers | 20+ endpoints |
| FRONTEND_API_GUIDE.md | ~25KB | All endpoints, requests, responses | 50+ |
| FRONTEND_INTEGRATION_GUIDE.md | ~15KB | Implementation, state management, patterns | 30+ code examples |

**Total Coverage**: 50+ endpoints, 100+ code examples, 80+ error codes

---

## 🎓 Learning Path

### Beginner
1. Read: `DOCUMENTATION.md` (understand system)
2. Read: `FRONTEND_INTEGRATION_GUIDE.md` (auth flow)
3. Code: Simple login form with OTP verification

### Intermediate
1. Implement: Patient profile management
2. Implement: Doctor listing and booking
3. Implement: Payment initialization
4. Reference: `QUICK_REFERENCE.md` and `FRONTEND_API_GUIDE.md`

### Advanced
1. Implement: Full appointment workflow
2. Implement: Prescription lifecycle
3. Implement: Pharmacy tier management
4. Add: Error handling and validation
5. Add: State management (Redux, Context)
6. Prepare: Deployment checklist

---

## ✅ Before Going to Production

- [ ] Read: Deployment Checklist in `FRONTEND_INTEGRATION_GUIDE.md`
- [ ] Configure: API_BASE_URL to production
- [ ] Enable: HTTPS only
- [ ] Implement: JWT refresh logic
- [ ] Add: Comprehensive error handling
- [ ] Test: All payment flows
- [ ] Test: OTP flows with timeouts
- [ ] Test: Prescription expiry handling
- [ ] Test: Role-based access
- [ ] Monitor: API rate limits
- [ ] Setup: Error tracking (Sentry, etc.)
- [ ] Document: Any custom modifications

---

**Documentation Version**: 1.0.0  
**Last Updated**: June 2026  
**Status**: ✅ Production Ready

---

**Need Help?** Start here based on your task:
- **First time?** → `DOCUMENTATION.md`
- **Quick lookup?** → `QUICK_REFERENCE.md`
- **Implementation?** → `FRONTEND_INTEGRATION_GUIDE.md`
- **Details?** → `FRONTEND_API_GUIDE.md`
