# Pharmacy Endpoint Documentation

**Role**: `pharmacy` | **Base URL**: `https://backend-system-u8s2.onrender.com/api` | **Auth**: `Bearer {jwt_token}`

---

## Authentication & Account

> **Signup flow**: `POST /pharmacy/signup` → `POST /pharmacy/verify-email` (account activated) → then login normally.
> **Login flow**: `POST /pharmacy/login` → `POST /pharmacy/verify-otp` (OTP challenge).

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/users/pharmacy/signup` | Public | Register a new pharmacy account |
| POST | `/users/pharmacy/verify-email` | Public | **Step 2 after signup** — activate account via email OTP |
| POST | `/users/pharmacy/resend-verification` | Public | Resend email activation OTP |
| POST | `/users/pharmacy/login` | Public | Login (returns OTP challenge) |
| POST | `/users/pharmacy/verify-otp` | Public | Verify login OTP |
| POST | `/users/refresh-token` | Public | Refresh access token |
| POST | `/users/pharmacy/logout` | Pharmacy | Logout current session |

> **Note**: Pharmacies are automatically assigned to **Basic Tier** on signup.

---

## Profile

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users/pharmacy/profile` | Pharmacy | Get pharmacy profile |
| PUT | `/users/pharmacy/profile` | Pharmacy | Update pharmacy profile |
| GET | `/users/pharmacy/sessions` | Pharmacy | List active sessions |
| GET | `/users/pharmacy/activity-log` | Pharmacy | View account activity log |

---

## Tier Management

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/users/pharmacy/upgrade-tier` | Pharmacy | Upgrade to a higher tier (Basic → Premium → Enterprise) |
| GET | `/users/pharmacy/current-tier` | Pharmacy | Get current tier and tier features |

### Tier Summary

| Tier | Features |
|------|----------|
| Basic | Standard dispensing, basic claim routing |
| Premium | Priority routing, enhanced analytics |
| Enterprise | Full routing control, compliance dashboard, custom agreements |

> **Note**: Tier downgrade is prevented by the system.

---

## Prescriptions — Dispensing (`/api/prescriptions`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/prescriptions/pharmacy/claimed` | Pharmacy | List all claimed prescriptions available for dispensing |
| GET | `/prescriptions/pharmacy/dispense-history` | Pharmacy | View dispensing history |
| GET | `/prescriptions/pharmacy/dispense-stats` | Pharmacy | View dispensing statistics |
| GET | `/prescriptions/pharmacy/medicines/:prescriptionId` | Pharmacy | View medicine details for a claimed prescription |
| POST | `/prescriptions/:prescriptionId/dispense` | Pharmacy | Dispense a prescription |

> **Claim Window**: Prescriptions have a **30-day** claim window, calculated automatically. Each prescription is one-time use per pharmacy.

---

## Prescription Claim Routing (`/api/users`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users/pharmacy/claims/pending` | Pharmacy | Get pending incoming prescription claims |
| POST | `/users/pharmacy/claims/:routingId/accept` | Pharmacy | Accept a routed prescription claim |
| POST | `/users/pharmacy/claims/:routingId/reject` | Pharmacy | Reject a routed prescription claim |
| GET | `/users/pharmacy/performance/routing` | Pharmacy | Get pharmacy routing performance metrics |

---

## Orders (`/api/orders`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/orders/pharmacy/queue` | Pharmacy | Get incoming order queue |
| PATCH | `/orders/:id/accept` | Pharmacy | Accept an order |
| PATCH | `/orders/:id/reject` | Pharmacy | Reject an order |
| PATCH | `/orders/:id/status` | Pharmacy | Update order status |
| POST | `/orders/:id/claim` | Pharmacy | Record a prescription claim on an order |
| GET | `/orders/:id` | Pharmacy/Patient | Get order details |

---

## Public Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/prescriptions/qr/:qrToken` | Public | Access prescription via QR code |
| GET | `/prescriptions/qr/:qrToken/status` | Public | Check QR code status |
| GET | `/legal/terms` | Public | Terms of service |
| GET | `/legal/privacy` | Public | Privacy policy |
