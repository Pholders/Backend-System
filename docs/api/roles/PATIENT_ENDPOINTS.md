# Patient Endpoint Documentation

**Role**: `patient` | **Base URL**: `https://backend-system-u8s2.onrender.com/api` | **Auth**: `Bearer {jwt_token}`

---

## Authentication & Account

> **Signup flow**: `POST /signup` → `POST /verify-email` (account activated) → then login normally.
> **Login flow**: `POST /login` → tokens returned directly (OTP legacy via `POST /verify-otp`).

---

### POST `/users/signup`
Register a new patient account.

**Request Body**
```json
{
  "first_name": "Jane",
  "last_name": "Doe",
  "email": "jane@example.com",
  "phone": "0821234567",
  "id_passport_number": "9001015009087",
  "nationality": "South African",
  "password": "SecurePass123!"
}
```
> `nationality` must be `"South African"` or `"Other"`.

**Response `201`**
```json
{
  "success": true,
  "message": "Account created. Please check your email for a verification code to activate your account.",
  "data": {
    "user": { "id": 1, "first_name": "Jane", "last_name": "Doe", "email": "jane@example.com", "phone": "0821234567" },
    "requiresEmailVerification": true,
    "email": "jane@example.com",
    "expiresIn": "15 minutes"
  }
}
```

---

### POST `/users/verify-email`
Activate account with the OTP sent to email after signup.

**Request Body**
```json
{
  "email": "jane@example.com",
  "otp_code": "482913"
}
```

**Response `200`**
```json
{
  "success": true,
  "message": "Email verified successfully. You can now log in."
}
```

---

### POST `/users/resend-verification`
Resend the email activation OTP.

**Request Body**
```json
{
  "email": "jane@example.com"
}
```

**Response `200`**
```json
{
  "success": true,
  "message": "Verification code resent. Please check your email."
}
```

---

### POST `/users/login`
Login with email and password. Returns tokens directly.

**Request Body**
```json
{
  "email": "jane@example.com",
  "password": "SecurePass123!"
}
```

**Response `200`**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "first_name": "Jane",
      "last_name": "Doe",
      "email": "jane@example.com",
      "phone": "0821234567",
      "role": "patient",
      "status": "active",
      "email_verified": true
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4...",
      "expiresIn": 86400
    },
    "session": {
      "id": 42,
      "expiresAt": "2026-08-05T10:00:00.000Z"
    }
  }
}
```

---

### POST `/users/verify-otp`
Complete login via OTP challenge (legacy/2FA path). Returns enriched response with geolocation and nearby doctors.

**Request Body**
```json
{
  "email": "jane@example.com",
  "otp_code": "827461"
}
```

**Response `200`**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { "id": 1, "first_name": "Jane", "last_name": "Doe", "email": "jane@example.com" },
    "tokens": {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4...",
      "expiresIn": 28800
    },
    "session": { "id": 42, "expiresAt": "2026-08-05T18:00:00.000Z" },
    "location": {
      "city": "Cape Town",
      "country": "South Africa",
      "latitude": -33.9249,
      "longitude": 18.4241,
      "timezone": "Africa/Johannesburg"
    },
    "nearby_doctors": {
      "count": 3,
      "radius_km": 15,
      "doctors": [
        {
          "id": 5,
          "first_name": "Dr. John",
          "last_name": "Smith",
          "specialization": "General Practitioner",
          "clinic_name": "City Clinic",
          "phone": "0211234567",
          "distance_km": 2.3,
          "consultation_fee": 550
        }
      ]
    },
    "security": {
      "riskScore": 12,
      "alertsSent": false
    }
  }
}
```

---

### GET `/users/auth/google`
Redirects the browser to Google OAuth consent screen. No request body.

---

### GET `/users/auth/google/callback`
Google OAuth callback. Handled automatically — browser is redirected with tokens on success.

---

### POST `/users/auth/complete-profile`
Complete profile after OAuth signup (first-time Google login).

**Request Body**
```json
{
  "phone": "0821234567",
  "id_passport_number": "9001015009087",
  "nationality": "South African"
}
```

**Response `200`**
```json
{
  "success": true,
  "message": "Profile completed successfully.",
  "data": { "user": { "id": 1, "email": "jane@example.com", "phone": "0821234567" } }
}
```

---

### POST `/users/forgot-password`
Request a password reset email.

**Request Body**
```json
{
  "email": "jane@example.com"
}
```

**Response `200`**
```json
{
  "success": true,
  "message": "If an account with this email exists, a password reset link has been sent to your email. Please check your inbox and spam folder."
}
```

---

### POST `/users/reset-password`
Reset password using the token from the reset email.

**Request Body**
```json
{
  "token": "abc123resettoken",
  "newPassword": "NewSecurePass456!"
}
```

**Response `200`**
```json
{
  "success": true,
  "message": "Password reset successfully. You can now log in with your new password."
}
```

---

### POST `/users/refresh-token`
Refresh an expired access token.

**Request Body**
```json
{
  "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4..."
}
```

**Response `200`**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 86400
  }
}
```

---

### POST `/users/logout`
Logout and revoke the current session.

**Response `200`**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### POST `/users/request-account-deletion`
Request permanent account deletion. Send the exact phrase to confirm intent.

**Request Body**
```json
{
  "confirmPhrase": "Delete my account"
}
```

**Response `200`**
```json
{
  "success": true,
  "message": "Account deletion request submitted. A confirmation email has been sent."
}
```

---

### GET `/users/confirm-account-deletion`
Confirm deletion via link emailed to the patient. Token as query param `?token=`. No body.

**Response `200`**
```json
{
  "success": true,
  "message": "Account deleted successfully."
}
```

---

### POST `/users/cancel-account-deletion`
Cancel a pending account deletion request.

**Response `200`**
```json
{
  "success": true,
  "message": "Account deletion request cancelled."
}
```

---

## Profile — Basic

---

### GET `/users/profile`
Get the patient's basic profile.

**Response `200`**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "first_name": "Jane",
    "last_name": "Doe",
    "email": "jane@example.com",
    "phone": "0821234567",
    "nationality": "South African",
    "role": "patient",
    "status": "active",
    "email_verified": true,
    "created_at": "2026-01-15T08:30:00.000Z"
  }
}
```

---

### PUT `/users/profile`
Update basic profile fields. `id`, `email`, `id_passport_number`, and `password_hash` are protected and ignored.

**Request Body**
```json
{
  "first_name": "Jane",
  "last_name": "Smith",
  "phone": "0829876543"
}
```

**Response `200`**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": { "id": 1, "first_name": "Jane", "last_name": "Smith", "phone": "0829876543" }
}
```

---

### GET `/users/sessions`
List all active sessions for the authenticated patient.

**Response `200`**
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "id": 42,
        "ip_address": "102.0.0.1",
        "user_agent": "Mozilla/5.0...",
        "created_at": "2026-08-04T09:00:00.000Z",
        "expires_at": "2026-08-05T09:00:00.000Z",
        "is_active": true
      }
    ],
    "count": 1
  }
}
```

---

### GET `/users/activity-log`
View recent account activity.

**Query Params:** `limit` (default 50)

**Response `200`**
```json
{
  "success": true,
  "data": {
    "activities": [
      {
        "id": 101,
        "event_type": "login",
        "status": "success",
        "ip_address": "102.0.0.1",
        "created_at": "2026-08-04T09:00:00.000Z"
      }
    ],
    "count": 1
  }
}
```

---

## Profile — Extended (`/api/profile`)

### Personal

---

### GET `/profile`
Get full extended profile.

**Response `200`**
```json
{
  "success": true,
  "data": {
    "personal": { "first_name": "Jane", "last_name": "Doe", "dob": "1990-01-01", "gender": "female" },
    "account": { "email": "jane@example.com", "phone": "0821234567" },
    "avatar": "https://cdn.example.com/avatars/1.jpg"
  }
}
```

---

### PUT `/profile/personal`
Update personal details.

**Request Body**
```json
{
  "first_name": "Jane",
  "last_name": "Doe",
  "dob": "1990-01-01",
  "gender": "female",
  "address": "12 Main Road, Cape Town"
}
```

**Response `200`**
```json
{
  "success": true,
  "message": "Personal details updated successfully",
  "data": { "first_name": "Jane", "last_name": "Doe", "dob": "1990-01-01" }
}
```

---

### PUT `/profile/account`
Update account settings.

**Request Body**
```json
{
  "phone": "0829876543",
  "language": "en"
}
```

**Response `200`**
```json
{
  "success": true,
  "message": "Account settings updated successfully"
}
```

---

### PUT `/profile/avatar`
Upload or update the profile avatar. Send as `multipart/form-data`.

**Request Body** (`multipart/form-data`)
```
avatar: <image file (jpg, png, webp — max 5 MB)>
```

**Response `200`**
```json
{
  "success": true,
  "message": "Avatar updated successfully",
  "data": { "avatarUrl": "https://cdn.example.com/avatars/1.jpg" }
}
```

---

### GET `/profile/email/verify`
Confirm email change via link. Token as query param `?token=`. No body.

**Response `200`**
```json
{
  "success": true,
  "message": "Email address updated successfully."
}
```

---

### Security

---

### GET `/profile/security`
Get current security settings.

**Response `200`**
```json
{
  "success": true,
  "data": {
    "two_factor_enabled": false,
    "biometrics_enabled": false,
    "account_frozen": false,
    "last_password_change": "2026-06-01T12:00:00.000Z"
  }
}
```

---

### PUT `/profile/security/biometrics`
Enable or disable biometric login.

**Request Body**
```json
{
  "enabled": true
}
```

**Response `200`**
```json
{ "success": true, "message": "Biometric settings updated" }
```

---

### PUT `/profile/security/2fa`
Enable or disable two-factor authentication.

**Request Body**
```json
{
  "enabled": true
}
```

**Response `200`**
```json
{ "success": true, "message": "2FA settings updated. Please verify to confirm." }
```

---

### POST `/profile/security/2fa/verify`
Verify the OTP to confirm 2FA enrollment.

**Request Body**
```json
{
  "otp_code": "482913"
}
```

**Response `200`**
```json
{ "success": true, "message": "Two-factor authentication enabled successfully." }
```

---

### PUT `/profile/security/password`
Change password while authenticated.

**Request Body**
```json
{
  "current_password": "OldPass123!",
  "new_password": "NewSecurePass456!"
}
```

**Response `200`**
```json
{ "success": true, "message": "Password changed successfully." }
```

---

### POST `/profile/security/password/reset`
Trigger the forgot-password email flow (unauthenticated path).

**Request Body**
```json
{ "email": "jane@example.com" }
```

**Response `200`**
```json
{ "success": true, "message": "Password reset link sent to your email." }
```

---

### POST `/profile/security/report-suspicious`
Report suspicious activity on the account.

**Request Body**
```json
{
  "description": "Unexpected login from unknown device",
  "event_type": "unauthorized_login"
}
```

**Response `200`**
```json
{ "success": true, "message": "Report submitted. Our security team will review it." }
```

---

### POST `/profile/security/freeze`
Freeze the account immediately.

**Response `200`**
```json
{ "success": true, "message": "Account frozen. An unfreeze link has been sent to your email." }
```

---

### GET `/profile/security/unfreeze`
Unfreeze account via emailed link. Token as query param `?token=`. No body.

**Response `200`**
```json
{ "success": true, "message": "Account unfrozen successfully." }
```

---

### GET `/profile/security/audit-log/export`
Export the full security audit log as a downloadable file.

---

### Devices & Login Activity

---

### GET `/profile/devices`
List all trusted devices / active sessions.

**Response `200`**
```json
{
  "success": true,
  "data": {
    "devices": [
      {
        "sessionId": "sess_abc123",
        "deviceName": "Chrome on Windows",
        "ipAddress": "102.0.0.1",
        "lastActive": "2026-08-04T09:00:00.000Z",
        "isCurrent": true
      }
    ]
  }
}
```

---

### DELETE `/profile/devices/:sessionId`
Revoke a specific device/session.

**Response `200`**
```json
{ "success": true, "message": "Device session revoked." }
```

---

### POST `/profile/devices/revoke-others`
Revoke all sessions except the current one.

**Response `200`**
```json
{ "success": true, "message": "All other sessions revoked.", "data": { "revokedCount": 3 } }
```

---

### GET `/profile/login-activity`
View login history.

**Response `200`**
```json
{
  "success": true,
  "data": {
    "logins": [
      { "id": 55, "ip_address": "102.0.0.1", "location": "Cape Town, ZA", "device": "Chrome on Windows", "status": "success", "created_at": "2026-08-04T09:00:00.000Z" }
    ]
  }
}
```

---

### Linked Services

---

### GET `/profile/linked-services/doctors`
List doctors linked to the patient's account.

**Response `200`**
```json
{
  "success": true,
  "data": {
    "doctors": [
      { "connectionId": 10, "doctorId": 5, "doctorName": "Dr. John Smith", "specialization": "GP", "linkedAt": "2026-07-01T00:00:00.000Z" }
    ]
  }
}
```

---

### POST `/profile/linked-services/doctors`
Link a doctor.

**Request Body**
```json
{ "doctorId": 5 }
```

**Response `201`**
```json
{ "success": true, "message": "Doctor linked successfully.", "data": { "connectionId": 10 } }
```

---

### DELETE `/profile/linked-services/doctors/:connectionId`
Unlink a doctor.

**Response `200`**
```json
{ "success": true, "message": "Doctor unlinked." }
```

---

### GET `/profile/linked-services/pharmacies`
List pharmacies linked to the patient's account.

**Response `200`**
```json
{
  "success": true,
  "data": {
    "pharmacies": [
      { "connectionId": 3, "pharmacyId": 8, "pharmacyName": "HealthPlus Pharmacy", "linkedAt": "2026-07-10T00:00:00.000Z" }
    ]
  }
}
```

---

### POST `/profile/linked-services/pharmacies`
Link a pharmacy.

**Request Body**
```json
{ "pharmacyId": 8 }
```

**Response `201`**
```json
{ "success": true, "message": "Pharmacy linked successfully.", "data": { "connectionId": 3 } }
```

---

### DELETE `/profile/linked-services/pharmacies/:connectionId`
Unlink a pharmacy.

**Response `200`**
```json
{ "success": true, "message": "Pharmacy unlinked." }
```

---

### GET `/profile/linked-services/dependents`
List family dependents.

**Response `200`**
```json
{
  "success": true,
  "data": {
    "dependents": [
      { "id": 2, "name": "Tom Doe", "relationship": "child", "dob": "2015-03-10" }
    ]
  }
}
```

---

### POST `/profile/linked-services/dependents`
Add a dependent.

**Request Body**
```json
{
  "name": "Tom Doe",
  "relationship": "child",
  "dob": "2015-03-10",
  "id_passport_number": "1503100001085"
}
```

**Response `201`**
```json
{ "success": true, "message": "Dependent added.", "data": { "id": 2, "name": "Tom Doe" } }
```

---

### PUT `/profile/linked-services/dependents/:id`
Update a dependent.

**Request Body**
```json
{ "name": "Thomas Doe", "relationship": "child" }
```

**Response `200`**
```json
{ "success": true, "message": "Dependent updated." }
```

---

### DELETE `/profile/linked-services/dependents/:id`
Remove a dependent.

**Response `200`**
```json
{ "success": true, "message": "Dependent removed." }
```

---

### Medical Aid

---

### GET `/profile/medical-aid`
Get the patient's medical aid scheme details.

**Response `200`**
```json
{
  "success": true,
  "data": {
    "provider": "Discovery Health",
    "plan": "Comprehensive",
    "member_number": "DH123456",
    "dependants": 1
  }
}
```

---

### PUT `/profile/medical-aid`
Update medical aid scheme details.

**Request Body**
```json
{
  "provider": "Bonitas",
  "plan": "BonEssential",
  "member_number": "BON789",
  "dependants": 0
}
```

**Response `200`**
```json
{ "success": true, "message": "Medical aid details updated." }
```

---

### PUT `/profile/medical-aid/card`
Upload medical aid card images. Send as `multipart/form-data`.

**Request Body** (`multipart/form-data`)
```
front: <image file>
back:  <image file>
```

**Response `200`**
```json
{ "success": true, "message": "Card images uploaded.", "data": { "frontUrl": "...", "backUrl": "..." } }
```

---

### GET `/profile/medical-aid/card/:side/url`
Get a signed URL for a card image. `:side` = `front` or `back`.

**Response `200`**
```json
{ "success": true, "data": { "url": "https://storage.example.com/signed-url...", "expiresIn": 3600 } }
```

---

### GET `/profile/medical-aid/claims`
List all medical aid claims.

**Response `200`**
```json
{
  "success": true,
  "data": { "claims": [ { "id": 1, "amount": 550, "status": "approved", "date": "2026-07-20" } ] }
}
```

---

### GET `/profile/medical-aid/claims/:id`
Get a specific claim.

**Response `200`**
```json
{ "success": true, "data": { "id": 1, "amount": 550, "status": "approved", "provider": "Discovery Health" } }
```

---

### GET `/profile/medical-aid/invoices`
List all invoices.

**Response `200`**
```json
{ "success": true, "data": { "invoices": [ { "id": 1, "amount": 550, "status": "paid", "date": "2026-07-20" } ] } }
```

---

### GET `/profile/medical-aid/invoices/:id`
Get a specific invoice.

**Response `200`**
```json
{ "success": true, "data": { "id": 1, "amount": 550, "status": "paid", "issuedTo": "Jane Doe" } }
```

---

### GET `/profile/medical-aid/files/download`
Download a signed medical aid file. Token as query param `?token=`. No body.

---

### Account Deletion

---

### POST `/profile/account/delete-request`
Request permanent account deletion.

**Request Body**
```json
{
  "current_password": "SecurePass123!",
  "reason": "No longer using the service"
}
```

**Response `200`**
```json
{ "success": true, "message": "Deletion request submitted. A confirmation link valid for 24 hours has been sent to your email." }
```

---

### GET `/profile/account/delete-confirm`
Confirm deletion via emailed link. Token as query param `?token=`. No body.

**Response `200`**
```json
{ "success": true, "message": "Account permanently deleted." }
```

---

## Comprehensive Patient Profile (`/api/users`)

---

### GET `/users/profile/complete`
Get the complete patient profile.

**Response `200`**
```json
{
  "success": true,
  "data": {
    "personal": { "first_name": "Jane", "last_name": "Doe", "dob": "1990-01-01" },
    "allergies": [],
    "conditions": [],
    "medications": [],
    "vaccinations": [],
    "providers": []
  }
}
```

---

### GET `/users/profile/summary`
Get a brief profile summary.

**Response `200`**
```json
{ "success": true, "data": { "name": "Jane Doe", "age": 36, "conditions": 0, "medications": 0, "allergies": 0 } }
```

---

### PUT `/users/profile/personal`
Update personal details.

**Request Body**
```json
{
  "dob": "1990-01-01",
  "gender": "female",
  "blood_type": "O+",
  "address": "12 Main Rd, Cape Town"
}
```

**Response `200`**
```json
{ "success": true, "message": "Personal details updated." }
```

---

### POST `/users/profile/allergies`
Add an allergy.

**Request Body**
```json
{ "allergen": "Penicillin", "reaction": "Anaphylaxis", "severity": "severe" }
```

**Response `201`**
```json
{ "success": true, "message": "Allergy added.", "data": { "id": 1 } }
```

---

### POST `/users/profile/conditions`
Add a medical condition.

**Request Body**
```json
{ "condition_name": "Type 2 Diabetes", "diagnosed_date": "2020-03-15", "status": "active" }
```

**Response `201`**
```json
{ "success": true, "message": "Condition added.", "data": { "id": 1 } }
```

---

### POST `/users/profile/medications`
Add a current medication.

**Request Body**
```json
{ "medication_name": "Metformin", "dosage": "500mg", "frequency": "twice daily", "start_date": "2020-04-01" }
```

**Response `201`**
```json
{ "success": true, "message": "Medication added.", "data": { "id": 1 } }
```

---

### POST `/users/profile/vaccinations`
Add a vaccination record.

**Request Body**
```json
{ "vaccine_name": "COVID-19 (Pfizer)", "date_administered": "2021-07-15", "next_due_date": "2022-07-15" }
```

**Response `201`**
```json
{ "success": true, "message": "Vaccination added.", "data": { "id": 1 } }
```

---

### POST `/users/profile/test-results`
Add a lab test result.

**Request Body**
```json
{ "test_name": "HbA1c", "result_value": "6.5%", "date": "2026-07-01", "notes": "Slightly elevated" }
```

**Response `201`**
```json
{ "success": true, "message": "Test result added.", "data": { "id": 1 } }
```

---

### POST `/users/profile/providers`
Add a healthcare provider.

**Request Body**
```json
{ "provider_name": "Dr. John Smith", "provider_type": "General Practitioner", "phone": "0211234567" }
```

**Response `201`**
```json
{ "success": true, "message": "Provider added.", "data": { "id": 1 } }
```

---

### POST `/users/profile/lifestyle`
Add lifestyle data.

**Request Body**
```json
{ "smoking_status": "non-smoker", "alcohol_use": "occasional", "exercise_frequency": "3x per week" }
```

**Response `201`**
```json
{ "success": true, "message": "Lifestyle data saved.", "data": { "id": 1 } }
```

---

### POST `/users/profile/advance-directives`
Add an advance directive.

**Request Body**
```json
{ "directive_type": "DNR", "description": "Do not resuscitate", "date": "2026-01-01" }
```

**Response `201`**
```json
{ "success": true, "message": "Advance directive added.", "data": { "id": 1 } }
```

---

### POST `/users/profile/custom-categories`
Create a custom profile category.

**Request Body**
```json
{ "name": "Dental Records", "description": "All dental-related health information" }
```

**Response `201`**
```json
{ "success": true, "data": { "categoryId": 7, "name": "Dental Records" } }
```

---

### POST `/users/profile/custom-categories/:customCategoryId/data`
Add data to a custom category.

**Request Body**
```json
{ "label": "Crown Procedure", "value": "Upper left molar crowned", "date": "2025-11-20" }
```

**Response `201`**
```json
{ "success": true, "message": "Data added to category." }
```

---

### Tags

---

### POST `/users/profile/tags`
Create a tag.

**Request Body**
```json
{ "name": "Chronic", "color": "#FF5733" }
```

**Response `201`**
```json
{ "success": true, "data": { "tagId": 3, "name": "Chronic" } }
```

---

### GET `/users/profile/tags`
Get all tags.

**Response `200`**
```json
{ "success": true, "data": { "tags": [ { "id": 3, "name": "Chronic", "color": "#FF5733" } ] } }
```

---

### PUT `/users/profile/tags/:tagId`
Update a tag.

**Request Body**
```json
{ "name": "Long-term", "color": "#33C1FF" }
```

**Response `200`**
```json
{ "success": true, "message": "Tag updated." }
```

---

### DELETE `/users/profile/tags/:tagId`
Delete a tag.

**Response `200`**
```json
{ "success": true, "message": "Tag deleted." }
```

---

### POST `/users/profile/tags/assign`
Assign a tag to a profile item.

**Request Body**
```json
{ "tagId": 3, "itemType": "condition", "itemId": 1 }
```

**Response `200`**
```json
{ "success": true, "message": "Tag assigned." }
```

---

### POST `/users/profile/tags/remove`
Remove a tag from a profile item.

**Request Body**
```json
{ "tagId": 3, "itemType": "condition", "itemId": 1 }
```

**Response `200`**
```json
{ "success": true, "message": "Tag removed." }
```

---

### GET `/users/profile/tags/:tagId/items`
Get all profile items assigned to a tag.

**Response `200`**
```json
{
  "success": true,
  "data": {
    "tagId": 3,
    "items": [ { "itemType": "condition", "itemId": 1, "label": "Type 2 Diabetes" } ]
  }
}
```

---

### Search & Filter

---

### GET `/users/profile/search`
Search across all profile data.

**Query Params:** `q` (search term), `type` (optional — allergy, condition, medication, etc.)

**Response `200`**
```json
{ "success": true, "data": { "results": [ { "type": "condition", "id": 1, "label": "Type 2 Diabetes" } ] } }
```

---

### POST `/users/profile/filter-by-tags`
Filter profile data by tags.

**Request Body**
```json
{ "tagIds": [3, 5], "itemType": "condition" }
```

**Response `200`**
```json
{ "success": true, "data": { "items": [ { "id": 1, "label": "Type 2 Diabetes" } ] } }
```

---

### Version History & Audit

---

### GET `/users/profile/history/item`
Get change history for a specific item.

**Query Params:** `itemType`, `itemId`

**Response `200`**
```json
{ "success": true, "data": { "history": [ { "version": 2, "changedAt": "2026-07-01T00:00:00.000Z", "diff": {} } ] } }
```

---

### GET `/users/profile/history/recent`
Get recent changes across the profile.

**Response `200`**
```json
{ "success": true, "data": { "changes": [ { "itemType": "medication", "itemId": 2, "action": "updated", "changedAt": "2026-08-01" } ] } }
```

---

### GET `/users/profile/history/audit-trail`
View full audit trail.

**Response `200`**
```json
{ "success": true, "data": { "auditTrail": [ { "action": "create", "itemType": "allergy", "actor": "patient", "timestamp": "2026-06-01T00:00:00.000Z" } ] } }
```

---

### GET `/users/profile/history/audit-report`
Generate an audit report.

**Response `200`**
```json
{ "success": true, "data": { "reportUrl": "https://storage.example.com/audit-report-jane-doe.pdf" } }
```

---

### File Management

---

### POST `/users/profile/files/upload`
Upload a document. `multipart/form-data`, max 10 MB.

**Request Body** (`multipart/form-data`)
```
file:     <file>
category: "lab_results"
label:    "Blood test June 2026"
```

**Response `201`**
```json
{ "success": true, "data": { "fileId": 9, "label": "Blood test June 2026", "url": "https://storage.example.com/files/9" } }
```

---

### GET `/users/profile/files`
List all uploaded documents.

**Response `200`**
```json
{ "success": true, "data": { "files": [ { "fileId": 9, "label": "Blood test June 2026", "category": "lab_results", "uploadedAt": "2026-06-10" } ] } }
```

---

### GET `/users/profile/files/:fileId`
Get file details and a signed download URL.

**Response `200`**
```json
{ "success": true, "data": { "fileId": 9, "label": "Blood test June 2026", "url": "https://storage.example.com/signed..." } }
```

---

### DELETE `/users/profile/files/:fileId`
Delete a file.

**Response `200`**
```json
{ "success": true, "message": "File deleted." }
```

---

### POST `/users/profile/files/:fileId/verify-integrity`
Verify file hash integrity.

**Response `200`**
```json
{ "success": true, "data": { "intact": true, "hash": "sha256:abc..." } }
```

---

### Category Management

---

### PUT `/users/profile/categories/:categoryId/rename`
Rename a category.

**Request Body**
```json
{ "name": "Surgical History" }
```

**Response `200`**
```json
{ "success": true, "message": "Category renamed." }
```

---

### POST `/users/profile/categories/reorder`
Reorder categories.

**Request Body**
```json
{ "order": [3, 1, 5, 2] }
```

**Response `200`**
```json
{ "success": true, "message": "Categories reordered." }
```

---

## Doctor Discovery

---

### GET `/users/doctors`
List doctors with optional filtering and geolocation.

**Query Params:** `lat`, `lng`, `radius_km`, `specialty`, `max_fee`, `page` (default 1), `limit` (default 20)

**Response `200`**
```json
{
  "success": true,
  "data": {
    "doctors": [
      {
        "id": 5,
        "firstName": "John",
        "lastName": "Smith",
        "specialization": "General Practitioner",
        "clinicName": "City Clinic",
        "city": "Cape Town",
        "consultationFee": 550,
        "rating": { "averageRating": 4.7, "totalReviews": 23 }
      }
    ],
    "total": 1, "page": 1, "limit": 20
  }
}
```

---

### GET `/users/doctors/:id`
Get a doctor by ID.

**Response `200`**
```json
{
  "success": true,
  "data": {
    "id": 5,
    "firstName": "John",
    "lastName": "Smith",
    "specialization": "General Practitioner",
    "experience": "10 years",
    "clinicName": "City Clinic",
    "city": "Cape Town",
    "consultationFee": 550,
    "phone": "0211234567",
    "address": "15 Long Street",
    "bio": "Experienced GP...",
    "profileImage": "https://cdn.example.com/doctors/5.jpg",
    "rating": { "averageRating": 4.7, "totalReviews": 23 },
    "recentReviews": []
  }
}
```

---

### GET `/users/doctors/:doctorId/availability`
Get a doctor's availability for a specific date.

**Query Params:** `date=YYYY-MM-DD`

**Response `200`**
```json
{
  "success": true,
  "data": {
    "doctorId": 5,
    "date": "2026-08-10",
    "timePeriods": {
      "morning": { "available": 4, "total": 8 },
      "afternoon": { "available": 2, "total": 8 },
      "evening": { "available": 6, "total": 6 },
      "night": { "available": 4, "total": 4 }
    }
  }
}
```

---

### POST `/users/doctors/nearby`
Find nearby doctors by location.

**Request Body**
```json
{ "latitude": -33.9249, "longitude": 18.4241, "radius_km": 10 }
```

**Response `200`**
```json
{
  "success": true,
  "data": {
    "doctors": [
      { "id": 5, "name": "Dr. John Smith", "specialization": "GP", "distance_km": 2.3, "consultationFee": 550 }
    ]
  }
}
```

---

## Appointments

---

### GET `/users/appointments/booking-info`
Get time period definitions and the allowed booking date range.

**Response `200`**
```json
{
  "success": true,
  "message": "Booking information retrieved successfully",
  "data": {
    "timePeriods": [
      { "name": "morning", "label": "Morning", "timeRange": "08:00 - 11:30", "slots": ["08:00", "08:30", "..."] },
      { "name": "afternoon", "label": "Afternoon", "timeRange": "12:00 - 15:30", "slots": [] },
      { "name": "evening", "label": "Evening", "timeRange": "16:00 - 18:30", "slots": [] },
      { "name": "night", "label": "Night", "timeRange": "19:00 - 21:00", "slots": [] }
    ],
    "dateRange": {
      "startDate": "2026-08-04",
      "endDate": "2026-11-02",
      "maxDaysInAdvance": 90
    }
  }
}
```

---

### GET `/users/appointments/doctors`
Get all available (active) doctors with ratings and recent reviews.

**Response `200`**
```json
{
  "success": true,
  "message": "Available doctors retrieved successfully",
  "data": [
    {
      "id": 5,
      "firstName": "John",
      "lastName": "Smith",
      "specialization": "General Practitioner",
      "consultationFee": 550,
      "rating": { "averageRating": 4.7, "totalReviews": 23 },
      "recentReviews": []
    }
  ]
}
```

---

### GET `/users/appointments/available-slots`
Get available time slots for a specific doctor, date, and time period.

**Query Params:** `doctorId` (required), `date=YYYY-MM-DD` (required), `timePeriod=morning|afternoon|evening|night` (required)

**Response `200`**
```json
{
  "success": true,
  "message": "Available time slots retrieved successfully",
  "data": {
    "doctorId": 5,
    "date": "2026-08-10",
    "timePeriod": "morning",
    "availableSlots": ["08:00", "08:30", "09:30"],
    "allSlots": ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30"],
    "slotsAvailable": 3,
    "totalSlots": 8,
    "slotDetails": [
      { "time": "08:00", "available": true },
      { "time": "09:00", "available": false }
    ]
  }
}
```

---

### POST `/users/appointments/book`
Book a new appointment.

**Request Body**
```json
{
  "doctorId": 5,
  "appointmentDate": "2026-08-10",
  "timePeriod": "morning",
  "timeSlot": "08:30",
  "reasonForVisit": "Annual check-up"
}
```
> `timePeriod` must be `morning`, `afternoon`, `evening`, or `night`. `timeSlot` must be a valid slot within that period.

**Response `201`**
```json
{
  "success": true,
  "message": "Appointment booked successfully",
  "data": {
    "appointmentId": 101,
    "doctorName": "John Smith",
    "specialization": "General Practitioner",
    "date": "2026-08-10",
    "timePeriod": "morning",
    "timeSlot": "08:30",
    "consultationFee": 550,
    "status": "pending_payment",
    "clinicName": "City Clinic",
    "clinicAddress": "15 Long Street, Cape Town",
    "clinicPhone": "0211234567"
  }
}
```

---

### GET `/users/appointments`
List all of the patient's appointments.

**Response `200`**
```json
{
  "success": true,
  "message": "Patient appointments retrieved successfully",
  "data": {
    "total": 2,
    "appointments": [
      {
        "appointmentId": 101,
        "doctorName": "John Smith",
        "specialization": "General Practitioner",
        "date": "2026-08-10",
        "timePeriod": "morning",
        "timeSlot": "08:30",
        "consultationFee": 550,
        "status": "scheduled",
        "clinicName": "City Clinic",
        "city": "Cape Town",
        "reasonForVisit": "Annual check-up",
        "doctorPhone": "0211234567",
        "createdAt": "2026-08-04T09:00:00.000Z"
      }
    ]
  }
}
```

---

### GET `/users/appointments/upcoming`
List upcoming appointments (future dates only).

**Query Params:** `limit` (default 10)

**Response `200`**
```json
{
  "success": true,
  "message": "Upcoming appointments retrieved successfully",
  "data": {
    "total": 1,
    "appointments": [
      {
        "appointmentId": 101,
        "doctorName": "John Smith",
        "specialization": "General Practitioner",
        "date": "2026-08-10",
        "timePeriod": "morning",
        "timeSlot": "08:30",
        "consultationFee": 550,
        "status": "scheduled",
        "clinicName": "City Clinic",
        "city": "Cape Town",
        "doctorPhone": "0211234567"
      }
    ]
  }
}
```

---

### GET `/users/appointments/:appointmentId`
Get full appointment details.

**Response `200`**
```json
{
  "success": true,
  "message": "Appointment details retrieved successfully",
  "data": {
    "appointmentId": 101,
    "doctorName": "John Smith",
    "specialization": "General Practitioner",
    "date": "2026-08-10",
    "timePeriod": "morning",
    "timeSlot": "08:30",
    "consultationFee": 550,
    "status": "scheduled",
    "reasonForVisit": "Annual check-up",
    "notes": null,
    "clinicName": "City Clinic",
    "city": "Cape Town",
    "doctorPhone": "0211234567",
    "createdAt": "2026-08-04T09:00:00.000Z",
    "updatedAt": "2026-08-04T09:00:00.000Z"
  }
}
```

---

### DELETE `/users/appointments/:appointmentId`
Cancel an appointment.

**Response `200`**
```json
{
  "success": true,
  "message": "Appointment cancelled successfully",
  "data": {
    "appointmentId": 101,
    "status": "cancelled",
    "cancelledAt": "2026-08-04T10:00:00.000Z"
  }
}
```

---

### PUT `/users/appointments/:appointmentId/reschedule`
Reschedule an appointment.

**Request Body**
```json
{
  "newDate": "2026-08-15",
  "newTimePeriod": "afternoon",
  "newTimeSlot": "13:00"
}
```

**Response `200`**
```json
{
  "success": true,
  "message": "Appointment rescheduled successfully",
  "data": {
    "appointmentId": 101,
    "newDate": "2026-08-15",
    "newTimePeriod": "afternoon",
    "newTimeSlot": "13:00",
    "status": "scheduled",
    "rescheduledAt": "2026-08-04T10:05:00.000Z"
  }
}
```

---

### GET `/users/appointments/day-availability`
Get full day availability for a doctor on a date.

**Query Params:** `doctorId` (required), `date=YYYY-MM-DD` (required)

**Response `200`**
```json
{
  "success": true,
  "data": {
    "doctorId": 5,
    "date": "2026-08-10",
    "periods": {
      "morning": { "available": 4, "total": 8 },
      "afternoon": { "available": 6, "total": 8 },
      "evening": { "available": 2, "total": 6 },
      "night": { "available": 4, "total": 4 }
    }
  }
}
```

---

### Appointment Reminders

---

### POST `/users/appointments/:appointmentId/reminders`
Set a reminder for an appointment.

**Request Body**
```json
{ "remind_at": "2026-08-09T20:00:00.000Z", "channel": "push" }
```

**Response `201`**
```json
{ "success": true, "message": "Reminder set.", "data": { "reminderId": 12 } }
```

---

### GET `/users/appointments/:appointmentId/reminders`
Get the reminder for an appointment.

**Response `200`**
```json
{ "success": true, "data": { "reminderId": 12, "remind_at": "2026-08-09T20:00:00.000Z", "channel": "push", "enabled": true } }
```

---

### PUT `/users/appointments/:appointmentId/reminders`
Update the reminder.

**Request Body**
```json
{ "remind_at": "2026-08-09T18:00:00.000Z" }
```

**Response `200`**
```json
{ "success": true, "message": "Reminder updated." }
```

---

### PATCH `/users/appointments/:appointmentId/reminders/toggle`
Toggle a reminder on or off.

**Response `200`**
```json
{ "success": true, "data": { "enabled": false } }
```

---

### DELETE `/users/appointments/:appointmentId/reminders`
Delete the reminder.

**Response `200`**
```json
{ "success": true, "message": "Reminder deleted." }
```

---

### GET `/users/reminders`
List all reminders across all appointments.

**Response `200`**
```json
{
  "success": true,
  "data": {
    "reminders": [
      { "reminderId": 12, "appointmentId": 101, "remind_at": "2026-08-09T20:00:00.000Z", "enabled": true }
    ]
  }
}
```

---

### GET `/users/reminders/upcoming`
List reminders due within the next 24 hours.

**Response `200`**
```json
{ "success": true, "data": { "reminders": [] } }
```

---

### GET `/users/appointments/:appointmentId/notification-history`
View notification delivery history for an appointment.

**Response `200`**
```json
{
  "success": true,
  "data": {
    "notifications": [
      { "id": 5, "type": "appointment", "channel": "push", "sentAt": "2026-08-09T20:00:00.000Z", "status": "delivered" }
    ]
  }
}
```

---

## Reviews

---

### POST `/users/appointments/doctors/:doctorId/reviews`
Submit or update a review for a doctor.

**Request Body**
```json
{ "rating": 5, "reviewText": "Very thorough and professional." }
```
> `rating` must be an integer between 1 and 5.

**Response `201`**
```json
{
  "success": true,
  "message": "Review submitted successfully",
  "data": {
    "reviewId": 88,
    "doctorId": 5,
    "rating": 5,
    "reviewText": "Very thorough and professional.",
    "isVerified": true,
    "createdAt": "2026-08-04T10:30:00.000Z"
  }
}
```

---

### GET `/users/appointments/doctors/:doctorId/reviews`
Get all reviews for a doctor.

**Query Params:** `limit` (default 10), `offset` (default 0)

**Response `200`**
```json
{
  "success": true,
  "message": "Doctor reviews retrieved successfully",
  "data": {
    "doctorId": "5",
    "ratingStats": {
      "averageRating": 4.7,
      "totalReviews": 23,
      "highestRating": 5,
      "lowestRating": 3,
      "fiveStarPercentage": 70.0,
      "fourStarPercentage": 20.0,
      "threeStarPercentage": 10.0,
      "twoStarPercentage": 0.0,
      "oneStarPercentage": 0.0
    },
    "reviews": [
      {
        "reviewId": 88,
        "rating": 5,
        "reviewText": "Very thorough and professional.",
        "patientName": "Jane Doe",
        "isVerified": true,
        "createdAt": "2026-08-04T10:30:00.000Z"
      }
    ],
    "pagination": { "limit": 10, "offset": 0, "total": 23, "hasMore": true }
  }
}
```

---

### GET `/users/appointments/doctors/:doctorId/reviews/summary`
Get rating summary for a doctor.

**Response `200`**
```json
{
  "success": true,
  "data": {
    "doctorId": "5",
    "averageRating": 4.7,
    "totalReviews": 23,
    "ratingDistribution": [
      { "stars": 5, "count": 16 },
      { "stars": 4, "count": 5 },
      { "stars": 3, "count": 2 }
    ]
  }
}
```

---

### GET `/users/appointments/doctors/:doctorId/reviews/check-review`
Check whether the patient has already reviewed this doctor.

**Response `200`**
```json
{ "success": true, "data": { "hasReviewed": true, "reviewId": 88, "rating": 5 } }
```

---

### GET `/users/reviews`
Get all reviews submitted by the patient.

**Query Params:** `limit` (default 10), `offset` (default 0)

**Response `200`**
```json
{
  "success": true,
  "data": {
    "reviews": [
      { "reviewId": 88, "doctorId": 5, "doctorName": "Dr. John Smith", "rating": 5, "reviewText": "Very thorough.", "createdAt": "2026-08-04T10:30:00.000Z" }
    ]
  }
}
```

---

### PUT `/users/reviews/:reviewId`
Update a review.

**Request Body**
```json
{ "rating": 4, "reviewText": "Good but had a long wait." }
```

**Response `200`**
```json
{ "success": true, "message": "Review updated." }
```

---

### DELETE `/users/reviews/:reviewId`
Delete a review.

**Response `200`**
```json
{ "success": true, "message": "Review deleted." }
```

---

## Prescriptions (`/api/prescriptions`)

---

### GET `/prescriptions`
List all of the patient's prescriptions.

**Query Params:** `limit` (default 50), `offset` (default 0), `filter` (`all` | `signed` | `pending`)

**Response `200`**
```json
{
  "success": true,
  "message": "Prescriptions retrieved successfully",
  "data": {
    "total": 2,
    "prescriptions": [
      {
        "id": 33,
        "prescriptionNumber": "RX-2026-00033",
        "doctor": "Dr. John Smith",
        "diagnosis": "Hypertension",
        "status": "signed",
        "createdAt": "2026-07-20T08:00:00.000Z",
        "isRevoked": false
      }
    ]
  }
}
```

---

### GET `/prescriptions/:prescriptionId`
View full prescription details including medicines and digital signature.

**Response `200`**
```json
{
  "success": true,
  "message": "Prescription retrieved successfully",
  "data": {
    "prescription": {
      "id": 33,
      "prescriptionNumber": "RX-2026-00033",
      "prescriber": {
        "name": "Dr. John Smith",
        "hpcsa": "MP0123456",
        "phone": "0211234567",
        "email": "john.smith@cityclinic.co.za"
      },
      "patient": {
        "name": "Jane Doe",
        "idNumber": "9001015009087",
        "dob": "1990-01-01",
        "phone": "0821234567",
        "email": "jane@example.com"
      },
      "diagnosis": "Hypertension",
      "clinicalNotes": "Monitor BP weekly.",
      "medicines": [
        {
          "id": 1,
          "name": "Amlodipine",
          "genericName": "Amlodipine Besylate",
          "dosage": "5mg",
          "form": "tablet",
          "quantity": 30,
          "frequency": "once daily",
          "route": "oral",
          "duration": "30 days",
          "instructions": "Take in the morning",
          "schedule": "Schedule 4",
          "warnings": "May cause ankle swelling"
        }
      ],
      "signature": {
        "status": "signed",
        "timestamp": "2026-07-20T09:00:00.000Z",
        "certificate": { "hash": "sha256:abc...", "method": "RSA-SHA256" }
      },
      "createdAt": "2026-07-20T08:00:00.000Z",
      "updatedAt": "2026-07-20T09:00:00.000Z"
    }
  }
}
```

---

### GET `/prescriptions/:prescriptionId/download`
Download the prescription as a PDF.

**Response `200`**
```json
{
  "success": true,
  "message": "Prescription download initiated",
  "data": {
    "prescriptionNumber": "RX-2026-00033",
    "downloadLink": "/api/prescriptions/33/download",
    "format": "PDF",
    "size": "estimated 500KB"
  }
}
```

---

### GET `/prescriptions/:prescriptionId/print`
Get printable prescription data.

**Response `200`**
```json
{
  "success": true,
  "message": "Print data generated",
  "data": {
    "prescriptionNumber": "RX-2026-00033",
    "printUrl": "/api/prescriptions/33/print",
    "printFormat": "A4",
    "watermark": "Patient: Jane Doe | Doctor: Dr. John Smith"
  }
}
```

---

### GET `/prescriptions/:prescriptionId/qrcode`
Generate a QR code for the prescription.

**Response `200`**
```json
{
  "success": true,
  "data": {
    "qrCode": "data:image/png;base64,...",
    "accessLink": "https://backend-system-u8s2.onrender.com/api/prescriptions/qr/TOKEN123",
    "expiresAt": "2026-08-04T23:59:59.000Z"
  }
}
```

---

### GET `/prescriptions/:prescriptionId/qrcode-history`
View QR code scan history.

**Response `200`**
```json
{
  "success": true,
  "data": {
    "scans": [
      { "id": 1, "scannedBy": "HealthPlus Pharmacy", "scannedAt": "2026-07-21T10:00:00.000Z", "ipAddress": "102.0.1.2" }
    ]
  }
}
```

---

### GET `/prescriptions/:prescriptionId/share-history`
View email share history.

**Response `200`**
```json
{
  "success": true,
  "data": {
    "shares": [ { "sharedWith": "pharmacy@healthplus.co.za", "sharedAt": "2026-07-21T11:00:00.000Z" } ]
  }
}
```

---

### GET `/prescriptions/:prescriptionId/claim-status`
Check whether the prescription has been claimed at a pharmacy.

**Response `200`**
```json
{
  "success": true,
  "data": { "claimed": true, "claimedAt": "2026-07-22T09:00:00.000Z", "pharmacyName": "HealthPlus Pharmacy" }
}
```

---

### GET `/prescriptions/:prescriptionId/claim-info`
Get full claim info including pharmacy details and dispensing status.

**Response `200`**
```json
{
  "success": true,
  "data": {
    "prescriptionId": 33,
    "claimStatus": "dispensed",
    "pharmacy": { "id": 8, "name": "HealthPlus Pharmacy", "phone": "0219876543" },
    "dispensedAt": "2026-07-22T10:00:00.000Z"
  }
}
```

---

### POST `/prescriptions/:prescriptionId/share-email`
Share the prescription via email.

**Request Body**
```json
{ "recipientEmail": "pharmacy@healthplus.co.za", "message": "Please dispense as directed." }
```

**Response `200`**
```json
{ "success": true, "message": "Prescription shared via email.", "data": { "sentTo": "pharmacy@healthplus.co.za" } }
```

---

### POST `/prescriptions/:prescriptionId/claim`
Claim a prescription at a pharmacy.

**Request Body**
```json
{ "pharmacyId": 8 }
```

**Response `200`**
```json
{
  "success": true,
  "message": "Prescription claimed successfully.",
  "data": { "claimId": 7, "pharmacyName": "HealthPlus Pharmacy", "claimedAt": "2026-07-22T09:00:00.000Z" }
}
```

---

### POST `/prescriptions/:prescriptionId/route`
Route the prescription to a nearby pharmacy automatically.

**Request Body**
```json
{ "latitude": -33.9249, "longitude": 18.4241 }
```

**Response `200`**
```json
{
  "status": "success",
  "message": "Prescription routed successfully",
  "data": {
    "routingId": 15,
    "assignedPharmacy": { "id": 8, "name": "HealthPlus Pharmacy", "distance_km": 1.2 },
    "routedAt": "2026-08-04T11:00:00.000Z"
  }
}
```

---

### GET `/prescriptions/:prescriptionId/routing-history`
View the routing history for a prescription.

**Response `200`**
```json
{
  "status": "success",
  "data": [
    { "routingId": 15, "pharmacyId": 8, "pharmacyName": "HealthPlus Pharmacy", "status": "accepted", "routedAt": "2026-08-04T11:00:00.000Z" }
  ],
  "total": 1
}
```

---

### GET `/prescriptions/qr/:qrToken`
Access a prescription via a QR token (public). Returns prescription summary for pharmacy verification.

---

### GET `/prescriptions/qr/:qrToken/status`
Check whether a QR token is still valid (public).

**Response `200`**
```json
{ "success": true, "data": { "valid": true, "used": false, "expiresAt": "2026-08-04T23:59:59.000Z" } }
```

---

## Payments (`/api/users`)

---

### GET `/users/payments/methods`
Get available payment methods.

**Response `200`**
```json
{
  "success": true,
  "data": {
    "methods": [
      { "id": "stripe", "label": "Card (Stripe)", "available": true },
      { "id": "cash_on_arrival", "label": "Cash on Arrival", "available": true },
      { "id": "medical_aid", "label": "Medical Aid", "available": false, "reason": "Requires prior completed appointment" }
    ]
  }
}
```

---

### POST `/users/payments/initialize`
Initialize a payment for an appointment.

**Request Body**
```json
{
  "appointmentId": 101,
  "paymentMethod": "stripe",
  "medicalAidNumber": null,
  "medicalAidProvider": null
}
```
> `paymentMethod` must be `stripe`, `cash_on_arrival`, or `medical_aid`.
> `medicalAidNumber` and `medicalAidProvider` are required when method is `medical_aid`.

**Response `200`**
```json
{
  "success": true,
  "message": "Payment initialized successfully",
  "data": {
    "paymentId": 55,
    "appointmentId": 101,
    "amount": 550,
    "paymentMethod": "stripe",
    "status": "pending",
    "stripeClientSecret": "pi_3abc_secret_xyz",
    "stripePublicKey": "pk_test_..."
  }
}
```

---

### POST `/users/payments/confirm-stripe`
Confirm a Stripe payment after the client completes the card flow.

**Request Body**
```json
{ "paymentId": 55, "stripePaymentIntentId": "pi_3abc" }
```

**Response `200`**
```json
{
  "success": true,
  "message": "Payment confirmed successfully",
  "data": { "paymentId": 55, "status": "completed", "transactionId": "ch_1abc", "receiptUrl": "https://pay.stripe.com/receipts/..." }
}
```

---

### POST `/users/payments/cash-on-arrival`
Register a cash-on-arrival payment intention.

**Request Body**
```json
{ "paymentId": 55 }
```

**Response `200`**
```json
{ "success": true, "message": "Cash on arrival payment registered. Please pay at the clinic.", "data": { "paymentId": 55, "status": "pending" } }
```

---

### POST `/users/payments/medical-aid`
Register a medical aid payment.

**Request Body**
```json
{ "paymentId": 55 }
```

**Response `200`**
```json
{ "success": true, "message": "Medical aid payment registered.", "data": { "paymentId": 55, "status": "pending" } }
```

---

### GET `/users/payments/appointment/:appointmentId`
Get payment status for a specific appointment.

**Response `200`**
```json
{ "success": true, "data": { "paymentId": 55, "appointmentId": 101, "amount": 550, "paymentMethod": "stripe", "status": "completed" } }
```

---

### GET `/users/payments`
Get full payment history.

**Response `200`**
```json
{
  "success": true,
  "data": {
    "payments": [
      { "id": 55, "appointmentId": 101, "amount": 550, "method": "stripe", "status": "completed", "date": "2026-08-04" }
    ]
  }
}
```

---

### POST `/users/payments/stripe/create-intent`
Create a Stripe PaymentIntent directly.

**Request Body**
```json
{ "appointmentId": 101 }
```

**Response `200`**
```json
{ "success": true, "data": { "clientSecret": "pi_3abc_secret_xyz", "amount": 550, "currency": "zar" } }
```

---

### GET `/users/payments/stripe/methods`
Get saved Stripe payment methods.

**Response `200`**
```json
{
  "success": true,
  "data": {
    "methods": [
      { "id": "pm_1abc", "brand": "visa", "last4": "4242", "expMonth": 12, "expYear": 2028 }
    ]
  }
}
```

---

### GET `/users/payments/:paymentId/status`
Get payment status by payment ID.

**Response `200`**
```json
{ "success": true, "data": { "paymentId": 55, "status": "completed", "amount": 550, "updatedAt": "2026-08-04T10:00:00.000Z" } }
```

---

### POST `/users/payments/:paymentId/refund`
Request a refund for a completed payment.

**Request Body**
```json
{ "reason": "Appointment cancelled by doctor" }
```

**Response `200`**
```json
{ "success": true, "message": "Refund request submitted.", "data": { "refundId": "re_1abc", "status": "pending", "amount": 550 } }
```

---

### GET `/users/payments/appointment/:appointmentId/breakdown`
Get a payment cost breakdown for an appointment.

**Response `200`**
```json
{ "success": true, "data": { "appointmentId": 101, "consultationFee": 550, "platformFee": 0, "total": 550, "currency": "ZAR" } }
```

---

### POST `/users/payments/webhook/stripe`
Stripe webhook endpoint. Called by Stripe only — no client request body.

---

## Personal Health Record (PHR) (`/api/users`)

### PHR Data

---

### GET `/users/phr/complete`
Get the complete PHR.

**Response `200`**
```json
{
  "success": true,
  "data": {
    "personalCard": {},
    "medicalSummary": {},
    "prescriptions": [],
    "medications": [],
    "allergies": [],
    "conditions": [],
    "appointments": [],
    "vitals": [],
    "documents": []
  }
}
```

---

### GET `/users/phr/personal-card`
Get the personal health card.

**Response `200`**
```json
{
  "success": true,
  "data": {
    "name": "Jane Doe",
    "dob": "1990-01-01",
    "blood_type": "O+",
    "allergies": ["Penicillin"],
    "conditions": ["Hypertension"],
    "emergency_contact": { "name": "John Doe", "phone": "0821111111" }
  }
}
```

---

### PUT `/users/phr/personal-card`
Update the personal health card.

**Request Body**
```json
{ "blood_type": "O+", "emergency_contact": { "name": "John Doe", "phone": "0821111111" } }
```

**Response `200`**
```json
{ "success": true, "message": "Personal health card updated." }
```

---

### GET `/users/phr/medical-summary`
Get a medical summary.

**Response `200`**
```json
{ "success": true, "data": { "activeConditions": 1, "currentMedications": 1, "knownAllergies": 1, "lastVisit": "2026-07-20" } }
```

---

### GET `/users/phr/prescriptions`
Get active prescriptions in PHR view.

**Response `200`**
```json
{ "success": true, "data": { "prescriptions": [] } }
```

---

### GET `/users/phr/medications`
Get current medications.

**Response `200`**
```json
{ "success": true, "data": { "medications": [ { "name": "Amlodipine", "dosage": "5mg", "frequency": "once daily" } ] } }
```

---

### GET `/users/phr/allergies`
Get allergies.

**Response `200`**
```json
{ "success": true, "data": { "allergies": [ { "allergen": "Penicillin", "severity": "severe" } ] } }
```

---

### GET `/users/phr/conditions`
Get medical conditions.

**Response `200`**
```json
{ "success": true, "data": { "conditions": [ { "name": "Hypertension", "status": "active" } ] } }
```

---

### GET `/users/phr/appointments`
Get upcoming appointments in PHR view.

**Response `200`**
```json
{ "success": true, "data": { "appointments": [] } }
```

---

### GET `/users/phr/history`
Get health history.

**Response `200`**
```json
{ "success": true, "data": { "history": [] } }
```

---

### GET `/users/phr/vitals`
Get the latest vitals.

**Response `200`**
```json
{
  "success": true,
  "data": {
    "vitals": [
      { "id": 1, "type": "blood_pressure", "value": "120/80", "unit": "mmHg", "recordedAt": "2026-08-01" }
    ]
  }
}
```

---

### POST `/users/phr/vitals`
Record a vital sign.

**Request Body**
```json
{ "type": "blood_pressure", "value": "120/80", "unit": "mmHg", "recorded_at": "2026-08-04" }
```

**Response `201`**
```json
{ "success": true, "message": "Vital recorded.", "data": { "id": 2 } }
```

---

### GET `/users/phr/vitals/range`
Get vitals within a date range.

**Query Params:** `start=YYYY-MM-DD`, `end=YYYY-MM-DD`, `type` (optional)

**Response `200`**
```json
{ "success": true, "data": { "vitals": [] } }
```

---

### GET `/users/phr/documents`
Get PHR documents.

**Response `200`**
```json
{ "success": true, "data": { "documents": [] } }
```

---

### POST `/users/phr/documents`
Upload a PHR document. `multipart/form-data`.

**Request Body** (`multipart/form-data`)
```
file:     <file>
category: "lab_results"
label:    "Blood test"
```

**Response `201`**
```json
{ "success": true, "message": "Document uploaded.", "data": { "id": 3 } }
```

---

### PHR Access Control

---

### GET `/users/phr/access`
List who has access to the patient's PHR.

**Response `200`**
```json
{
  "success": true,
  "data": {
    "accessList": [
      { "doctorId": 5, "doctorName": "Dr. John Smith", "grantedAt": "2026-07-01", "expiresAt": null }
    ]
  }
}
```

---

### POST `/users/phr/access`
Grant PHR access to a doctor.

**Request Body**
```json
{ "doctorId": 5, "expiresAt": "2026-12-31" }
```

**Response `201`**
```json
{ "success": true, "message": "PHR access granted to Dr. John Smith." }
```

---

### DELETE `/users/phr/access/:doctorId`
Revoke PHR access from a doctor.

**Response `200`**
```json
{ "success": true, "message": "PHR access revoked." }
```

---

### GET `/users/phr/access/requests`
Get pending PHR access requests from doctors.

**Response `200`**
```json
{
  "success": true,
  "data": {
    "requests": [
      { "requestId": 3, "doctorId": 7, "doctorName": "Dr. Mary Jones", "requestedAt": "2026-08-03" }
    ]
  }
}
```

---

### POST `/users/phr/access/requests/:requestId/approve`
Approve a PHR access request.

**Response `200`**
```json
{ "success": true, "message": "Access request approved." }
```

---

### POST `/users/phr/access/requests/:requestId/deny`
Deny a PHR access request.

**Response `200`**
```json
{ "success": true, "message": "Access request denied." }
```

---

### GET `/users/phr/access-logs`
View who accessed the patient's PHR and when.

**Response `200`**
```json
{
  "success": true,
  "data": {
    "logs": [
      { "doctorId": 5, "doctorName": "Dr. John Smith", "accessedAt": "2026-07-25T08:00:00.000Z", "action": "view" }
    ]
  }
}
```

---

## Notifications (`/api/notifications`)

---

### GET `/notifications`
List notifications (newest first).

**Query Params:** `type` (`medication` | `prescription` | `appointment` | `message`), `limit` (max 200, default 50), `offset` (default 0)

**Response `200`**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": 10,
        "type": "appointment",
        "title": "Appointment Booked",
        "body": "Your appointment with Dr. John Smith has been booked.",
        "read": false,
        "createdAt": "2026-08-04T09:00:00.000Z"
      }
    ],
    "unreadCount": 1,
    "pagination": { "limit": 50, "offset": 0, "returned": 1 }
  }
}
```

---

### PATCH `/notifications/read-all`
Mark all notifications as read.

**Response `200`**
```json
{ "success": true, "data": { "updated": 3, "unreadCount": 0 } }
```

---

### PATCH `/notifications/:id/read`
Mark a single notification as read.

**Response `200`**
```json
{ "success": true, "data": { "notification": { "id": 10, "read": true }, "unreadCount": 0 } }
```

---

### GET `/notifications/settings`
Get the patient's notification preferences.

**Response `200`**
```json
{
  "success": true,
  "data": {
    "preferences": {
      "appointment_reminders": true,
      "prescription_updates": true,
      "marketing": false,
      "push_enabled": true,
      "email_enabled": true
    }
  }
}
```

---

### PUT `/notifications/settings`
Update notification preferences. Send any subset of preference fields.

**Request Body**
```json
{ "appointment_reminders": true, "marketing": false, "push_enabled": false }
```

**Response `200`**
```json
{ "success": true, "message": "Preferences updated", "data": { "preferences": { "appointment_reminders": true, "marketing": false } } }
```

---

### POST `/notifications/device-token`
Register a mobile push notification token.

**Request Body**
```json
{ "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]", "platform": "android" }
```
> `platform` must be `ios` or `android`.

**Response `200`**
```json
{ "success": true, "data": { "device": { "id": 5, "token": "ExponentPushToken[...]", "platform": "android" } } }
```

---

### DELETE `/notifications/device-token`
Remove a device push token (e.g., on logout).

**Request Body**
```json
{ "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]" }
```

**Response `200`**
```json
{ "success": true }
```

---

## Orders (`/api/orders`)

---

### POST `/orders`
Create a new dispensing order from a prescription.

**Request Body**
```json
{
  "prescription_id": 33,
  "pharmacy_id": 8,
  "payment_type": "cash"
}
```
> `payment_type` must be `cash` or `medical_aid`. Only one active order per prescription is allowed.

**Response `201`**
```json
{
  "success": true,
  "data": {
    "order": {
      "id": 20,
      "prescription_id": 33,
      "patient_id": 1,
      "pharmacy_id": 8,
      "payment_type": "cash",
      "status": "pending",
      "created_at": "2026-08-04T11:00:00.000Z"
    }
  }
}
```

---

### GET `/orders`
List the patient's own orders.

**Query Params:** `status` (pending | accepted | rejected | dispensed | cancelled), `limit` (max 200, default 50), `offset` (default 0)

**Response `200`**
```json
{
  "success": true,
  "data": {
    "orders": [
      { "id": 20, "prescription_id": 33, "pharmacy_id": 8, "status": "accepted", "created_at": "2026-08-04T11:00:00.000Z" }
    ],
    "pagination": { "limit": 50, "offset": 0, "returned": 1 }
  }
}
```

---

### PATCH `/orders/:id/cancel`
Cancel a pending order.

**Response `200`**
```json
{ "success": true, "data": { "order": { "id": 20, "status": "cancelled" } } }
```

---

### GET `/orders/:id`
Get full order details including status history.

**Response `200`**
```json
{
  "success": true,
  "data": {
    "order": {
      "id": 20,
      "prescription_id": 33,
      "pharmacy_id": 8,
      "payment_type": "cash",
      "status": "accepted",
      "total_amount": 250,
      "created_at": "2026-08-04T11:00:00.000Z"
    },
    "history": [
      { "from_status": null, "to_status": "pending", "actor_type": "patient", "notes": "Order placed", "changed_at": "2026-08-04T11:00:00.000Z" },
      { "from_status": "pending", "to_status": "accepted", "actor_type": "pharmacy", "notes": "Ready in 30 min", "changed_at": "2026-08-04T11:10:00.000Z" }
    ]
  }
}
```

---

## Support (`/api/support`)

---

### POST `/support/tickets`
Submit a support ticket. Authenticated patients have their details filled automatically; unauthenticated users must supply `email`.

**Request Body**
```json
{
  "email": "jane@example.com",
  "first_name": "Jane",
  "last_name": "Doe",
  "category": "billing",
  "subject": "Incorrect charge on appointment",
  "message": "I was charged twice for appointment #101.",
  "priority": "high"
}
```
> `category` must be one of: `general`, `billing`, `medical`, `technical`, `account`, `contact`.

**Response `201`**
```json
{
  "success": true,
  "message": "Support ticket submitted. Our team will respond by email.",
  "ticket": {
    "id": 7,
    "category": "billing",
    "subject": "Incorrect charge on appointment",
    "status": "open",
    "priority": "high",
    "created_at": "2026-08-04T12:00:00.000Z"
  }
}
```

---

### POST `/support/contact`
Send a general contact message (category forced to `contact`).

**Request Body**
```json
{ "email": "jane@example.com", "subject": "Question about prescriptions", "message": "How do I share my prescription with a pharmacy?" }
```

**Response `201`**
```json
{ "success": true, "message": "Support ticket submitted. Our team will respond by email.", "ticket": { "id": 8, "category": "contact", "status": "open" } }
```

---

### GET `/support/faq`
Get the FAQ list.

**Response `200`**
```json
{ "success": true, "faq": [ { "question": "How do I book an appointment?", "answer": "Go to Doctors and select Book." } ] }
```

---

### GET `/support/tickets`
List the authenticated patient's own support tickets.

**Response `200`**
```json
{
  "success": true,
  "tickets": [
    { "id": 7, "category": "billing", "subject": "Incorrect charge", "status": "open", "priority": "high", "created_at": "2026-08-04T12:00:00.000Z" }
  ],
  "total": 1
}
```

---

## Public (No Auth Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/legal/terms` | Terms of service |
| GET | `/legal/privacy` | Privacy policy |

Both endpoints return `200` with the document content.
