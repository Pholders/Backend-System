# Admin Endpoint Documentation

**Role**: `admin` | **Base URL**: `https://backend-system-u8s2.onrender.com/api` | **Auth**: `Bearer {jwt_token}`

> **Note**: Admin accounts do not use self-registration. Login requires credentials pre-created in the system.

---

## Authentication & Account

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/users/admin/login` | Public | Admin login (returns OTP challenge) |
| POST | `/users/admin/verify-otp` | Public | Verify login OTP |
| POST | `/users/refresh-token` | Public | Refresh access token |
| POST | `/users/admin/logout` | Admin | Logout current session |

---

## Profile

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users/admin/profile` | Admin | Get admin profile |
| PUT | `/users/admin/profile` | Admin | Update admin profile |
| GET | `/users/admin/sessions` | Admin | List active sessions |
| GET | `/users/admin/activity-log` | Admin | View account activity log |

---

## Security Monitoring

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users/admin/security/dashboard` | Admin | View security monitoring dashboard |
| GET | `/users/admin/security/user-locations` | Admin | View user login locations |

---

## Appointments

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/users/appointments/auto-cancel-expired` | Admin | Auto-cancel appointments with expired pending payments |

---

## Payments

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users/payments/stripe/test` | Admin | Test Stripe connection |

---

## Prescriptions

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/prescriptions/:prescriptionId/revert-claim` | Admin | Revert a prescription claim |

---

## Pharmacy Partnership Management (`/api/users`)

### Pharmacy Groups

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/users/partnerships/groups` | Admin | Create a pharmacy group |
| GET | `/users/partnerships/groups` | Admin | List all pharmacy groups |
| GET | `/users/partnerships/groups/:groupId` | Admin | Get pharmacy group details |
| PUT | `/users/partnerships/groups/:groupId` | Admin | Update pharmacy group |
| POST | `/users/partnerships/groups/:groupId/pharmacies` | Admin | Add pharmacy to group |
| DELETE | `/users/partnerships/groups/:groupId/pharmacies/:pharmacyId` | Admin | Remove pharmacy from group |
| GET | `/users/partnerships/groups/search` | Admin | Search pharmacy groups |

### Partnership Agreements

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/users/partnerships/agreements` | Admin | Create partnership agreement |
| GET | `/users/partnerships/agreements` | Admin | List all agreements |
| GET | `/users/partnerships/agreements/:agreementId` | Admin | Get agreement details |
| PUT | `/users/partnerships/agreements/:agreementId` | Admin | Update agreement |
| POST | `/users/partnerships/agreements/:agreementId/activate` | Admin | Activate agreement |
| POST | `/users/partnerships/agreements/:agreementId/suspend` | Admin | Suspend agreement |
| GET | `/users/partnerships/agreements/expiring` | Admin | Get agreements expiring soon |

### Compliance & Reporting

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users/partnerships/compliance/dashboard` | Admin | View compliance dashboard |
| GET | `/users/partnerships/compliance/pharmacy/:pharmacyId` | Admin | Get compliance report for a pharmacy |
| GET | `/users/partnerships/compliance/report` | Admin | Get full compliance report |

### Prescription Claim Routing

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users/partnerships/routing/candidates` | Admin | Get candidate pharmacies for routing |
| GET | `/users/partnerships/routing/statistics` | Admin | View routing statistics |
| GET | `/users/partnerships/routing/by-tier` | Admin | View routing breakdown by pharmacy tier |

---

## Support

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/support/tickets` | Public | Submit a support ticket (also available to public) |
| GET | `/support/faq` | Public | Get FAQ list |
