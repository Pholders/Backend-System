# Account Activation - OTP-Based Endpoints

## Overview
Each user role (Patient, Doctor, Pharmacy) has separate OTP-based account activation endpoints with full RBAC (Role-Based Access Control). After registration, users must verify their email using an OTP code to activate their account before login.

## Endpoints by User Role

### Patient Account Activation Endpoints

#### 1. Verify Email (OTP)
**Endpoint:** `POST /api/verify-email`  
**Authentication:** Not required  
**Role:** Patient  

**Request Body:**
```json
{
  "email": "patient@example.com",
  "otp_code": "123456"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Email verified successfully. You can now log in.",
  "data": {
    "email": "patient@example.com",
    "email_verified": true
  }
}
```

**Response (Already Verified - 200):**
```json
{
  "success": true,
  "message": "Email is already verified. You can log in.",
  "data": {
    "email": "patient@example.com",
    "alreadyVerified": true
  }
}
```

**Error Responses:**
- `400`: Invalid or expired verification code
- `500`: Server error

---

#### 2. Resend Verification Email
**Endpoint:** `POST /api/resend-verification`  
**Authentication:** Not required  
**Role:** Patient  

**Request Body:**
```json
{
  "email": "patient@example.com"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "If an unverified account exists for this email, a new verification code has been sent."
}
```

**Note:** In development mode, includes OTP code:
```json
{
  "success": true,
  "message": "If an unverified account exists for this email, a new verification code has been sent.",
  "data": {
    "verification_code": "123456",
    "dev_note": "Verification code included in response (development mode only)"
  }
}
```

**Error Responses:**
- `429`: Rate limited (max 1 request per 60 seconds)
- `500`: Server error

---

### Doctor Account Activation Endpoints

#### 1. Verify Email (OTP)
**Endpoint:** `POST /api/doctor/verify-email`  
**Authentication:** Not required  
**Role:** Doctor  

**Request Body:**
```json
{
  "email": "doctor@example.com",
  "otp_code": "123456"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Email verified successfully. You can now log in.",
  "data": {
    "email": "doctor@example.com",
    "email_verified": true
  }
}
```

**Error Responses:**
- `400`: Invalid or expired verification code
- `500`: Server error

---

#### 2. Resend Verification Email
**Endpoint:** `POST /api/doctor/resend-verification`  
**Authentication:** Not required  
**Role:** Doctor  

**Request Body:**
```json
{
  "email": "doctor@example.com"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "If an unverified account exists for this email, a new verification code has been sent."
}
```

**Error Responses:**
- `429`: Rate limited (max 1 request per 60 seconds)
- `500`: Server error

---

### Pharmacy Account Activation Endpoints

#### 1. Verify Email (OTP)
**Endpoint:** `POST /api/pharmacy/verify-email`  
**Authentication:** Not required  
**Role:** Pharmacy  

**Request Body:**
```json
{
  "email": "pharmacy@example.com",
  "otp_code": "123456"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Email verified successfully. You can now log in.",
  "data": {
    "email": "pharmacy@example.com",
    "email_verified": true
  }
}
```

**Error Responses:**
- `400`: Invalid or expired verification code
- `500`: Server error

---

#### 2. Resend Verification Email
**Endpoint:** `POST /api/pharmacy/resend-verification`  
**Authentication:** Not required  
**Role:** Pharmacy  

**Request Body:**
```json
{
  "email": "pharmacy@example.com"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "If an unverified account exists for this email, a new verification code has been sent."
}
```

**Error Responses:**
- `429`: Rate limited (max 1 request per 60 seconds)
- `500`: Server error

---

## Complete Activation Flow

### Step 1: User Registration (POST /api/signup | /api/doctor/signup | /api/pharmacy/signup)
User registers with email, password, and other required fields.

**Response includes:**
- User account is created with `email_verified = false`
- OTP is generated and sent to email
- User receives 6-digit code

---

### Step 2: Verify Email with OTP (POST /api/verify-email | /api/doctor/verify-email | /api/pharmacy/verify-email)
User receives OTP in email and submits it.

**On Success:**
- `email_verified` is set to `true`
- `email_verified_at` is stamped with current timestamp
- User can now login
- All other OTP tokens for this user are invalidated

---

### Step 3: Login (POST /api/login | /api/doctor/login | /api/pharmacy/login)
User can now login with their credentials and receive session tokens.

---

## OTP Specifications

| Property | Value |
|----------|-------|
| Length | 6 digits |
| Expiry | 15 minutes (default) |
| Format | `[0-9]{6}` |
| Purpose | `email_verification` |
| Rate Limit | 1 request per 60 seconds per email |
| Hash Algorithm | bcrypt (10 rounds) |

---

## Security Features

### Email Verification Gate
- Prevents login without verified email
- Protects against spam account registration
- Ensures user owns the email address

### Rate Limiting
- Max 1 OTP request per 60 seconds per email
- Prevents OTP brute force attacks
- Returns `429` status on rate limit breach

### OTP Hashing
- OTPs are bcrypt-hashed in database
- Plain OTP only visible at creation time
- Cannot retrieve plain OTP from database

### Audit Logging
- All verification attempts logged
- Success and failure logged separately
- IP address and user agent captured

### Account Enumeration Prevention
- Same response for non-existent accounts
- No disclosure of email verification status
- Generic error messages used

---

## Database Schema Updates Required

Run these migrations to add email verification fields:

```bash
npm run migrate:email-verification-doctors
npm run migrate:email-verification-pharmacies
```

Or manually:

```sql
-- Add to doctors table
ALTER TABLE doctors
ADD COLUMN email_verified BOOLEAN DEFAULT false,
ADD COLUMN email_verified_at TIMESTAMP;

-- Add to pharmacies table
ALTER TABLE pharmacies
ADD COLUMN email_verified BOOLEAN DEFAULT false,
ADD COLUMN email_verified_at TIMESTAMP;
```

---

## Environment Configuration

No additional environment variables required. Uses existing:
- `JWT_SECRET` - For session tokens
- `FRONTEND_URL` - For email links (optional)
- `NODE_ENV` - For development mode OTP display

---

## Error Codes & Meanings

| HTTP Status | Error Code | Meaning |
|------------|-----------|---------|
| 400 | INVALID_OTP | OTP code is invalid or expired |
| 400 | INVALID_EMAIL | Email format is invalid |
| 400 | MISSING_FIELDS | Required fields are missing |
| 429 | RATE_LIMITED | Too many requests, wait 60 seconds |
| 404 | USER_NOT_FOUND | User account does not exist |
| 500 | SERVER_ERROR | Internal server error |

---

## Testing with cURL

### Patient Email Verification
```bash
curl -X POST http://localhost:3000/api/verify-email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "patient@example.com",
    "otp_code": "123456"
  }'
```

### Doctor Email Verification
```bash
curl -X POST http://localhost:3000/api/doctor/verify-email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "doctor@example.com",
    "otp_code": "123456"
  }'
```

### Pharmacy Email Verification
```bash
curl -X POST http://localhost:3000/api/pharmacy/verify-email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "pharmacy@example.com",
    "otp_code": "123456"
  }'
```

### Resend OTP
```bash
curl -X POST http://localhost:3000/api/resend-verification \
  -H "Content-Type: application/json" \
  -d '{"email": "patient@example.com"}'
```

---

## Related Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/signup` | Patient registration |
| `POST /api/doctor/signup` | Doctor registration |
| `POST /api/pharmacy/signup` | Pharmacy registration |
| `POST /api/login` | Patient login |
| `POST /api/doctor/login` | Doctor login |
| `POST /api/pharmacy/login` | Pharmacy login |

---

## Notes

- OTP verification is **required** before login
- Users cannot login without `email_verified = true`
- Each user type has **completely separate** endpoints and data
- RBAC is enforced at the route level
- Audit logs track all verification attempts
- In development mode, OTP codes are visible in response for testing
