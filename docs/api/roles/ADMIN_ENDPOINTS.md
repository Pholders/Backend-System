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
| GET | `/users/admin/security/alerts/stats` | Admin | Alert counts, last 24 hours and 7 days |
| GET | `/users/admin/security/alerts` | Admin | List alerts, most severe first (`status`, `severity`, `alert_type`, `user_type` + `user_id`, `hours`) |
| GET | `/users/admin/security/alerts/:alertId` | Admin | One alert |
| POST | `/users/admin/security/alerts/:alertId/review` | Admin | `verified_legit` / `verified_threat` / `dismissed`. A threat signs the account out and emails its owner |
| POST | `/users/admin/security/alerts/bulk-review` | Admin | Same for up to 200 `alertIds` |
| GET | `/users/admin/security/suspicious-users` | Admin | Accounts with `threshold`+ unreviewed critical alerts in `hours` |
| GET | `/users/admin/security/report` | Admin | Alerts per day, type and severity (`from`/`to`, default last 30 days) |

---

## Platform records

Every list takes `limit` (1-200, default 50) and `offset` and returns `total` over the whole filtered set. `from`/`to` are inclusive South African dates (`YYYY-MM-DD`). Clinical text, ID numbers, medical-aid numbers, signatures and QR tokens are never returned.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users/admin/orders` | Admin | List orders (`status`, `payment_type`, `pharmacy_id`, `patient_id`, `from`, `to`) |
| GET | `/users/admin/orders/:orderId` | Admin | One order with its status history |
| GET | `/users/admin/payments` | Admin | List payments, with count and amount per status (`status`, `method`, `patient_id`, `doctor_id`, `from`, `to`) |
| GET | `/users/admin/payments/:paymentId` | Admin | One payment |
| GET | `/users/admin/appointments` | Admin | List appointments (`status`, `payment_status`, `doctor_id`, `patient_id`; `from`/`to` on the appointment date) |
| GET | `/users/admin/appointments/:appointmentId` | Admin | One appointment with its payments and prescriptions |
| GET | `/users/admin/prescriptions` | Admin | List prescriptions (`state` = pending/active/dispensed/revoked, `doctor_id`, `patient_id`, `from`, `to`) |
| GET | `/users/admin/prescriptions/:prescriptionId` | Admin | One prescription with its orders. Audit-logged |

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
| GET | `/users/admin/support/tickets` | Admin | Support inbox, open and urgent first (`status`, `priority`, `category`, `search` on subject/email) |
| GET | `/users/admin/support/tickets/:ticketId` | Admin | One ticket with its message and replies |
| PATCH | `/users/admin/support/tickets/:ticketId` | Admin | Set `status` and/or `priority` |
| POST | `/users/admin/support/tickets/:ticketId/replies` | Admin | Email a reply (`message`) to the sender. An open ticket moves to in_progress; a closed one is refused (409) |

---

## Doctor reviews

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users/admin/reviews` | Admin | List reviews, hidden ones included (`doctor_id`, `patient_id`, `rating`, `hidden`) |
| PATCH | `/users/admin/reviews/:reviewId/visibility` | Admin | `{ hidden, reason }`. Hidden reviews leave the doctor's public list and rating; the patient still sees their own |
| DELETE | `/users/admin/reviews/:reviewId` | Admin | Delete a review permanently |
