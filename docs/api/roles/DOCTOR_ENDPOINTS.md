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

---

## Profile

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users/doctor/profile` | Doctor | Get doctor profile |
| PUT | `/users/doctor/profile` | Doctor | Update doctor profile |
| GET | `/users/doctor/sessions` | Doctor | List active sessions |
| GET | `/users/doctor/activity-log` | Doctor | View account activity log |

---

## Appointments

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users/doctor/appointments` | Doctor | List all assigned appointments |
| POST | `/users/appointments/:appointmentId/accept` | Doctor | Accept an appointment (acknowledge before consultation) |
| POST | `/users/appointments/:appointmentId/complete` | Doctor | Mark appointment as completed after consultation |

> **Note**: Completing an appointment automatically finalizes cash payments and triggers prescription creation flow.

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
