# Patient Endpoint Documentation

**Role**: `patient` | **Base URL**: `https://backend-system-u8s2.onrender.com/api` | **Auth**: `Bearer {jwt_token}`

---

## Authentication & Account

> **Signup flow**: `POST /signup` → `POST /verify-email` (account activated) → then login normally.
> **Login flow**: `POST /login` → `POST /verify-otp` (OTP challenge).

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/users/signup` | Public | Register a new patient account |
| POST | `/users/verify-email` | Public | **Step 2 after signup** — activate account via email OTP |
| POST | `/users/resend-verification` | Public | Resend email activation OTP |
| POST | `/users/login` | Public | Login (returns OTP challenge) |
| POST | `/users/verify-otp` | Public | Verify login OTP |
| GET | `/users/auth/google` | Public | Initiate Google OAuth login |
| GET | `/users/auth/google/callback` | Public | Google OAuth callback |
| POST | `/users/auth/complete-profile` | Patient | Complete profile after OAuth signup |
| POST | `/users/forgot-password` | Public | Request password reset email |
| POST | `/users/reset-password` | Public | Reset password with token |
| POST | `/users/refresh-token` | Public | Refresh access token |
| POST | `/users/logout` | Patient | Logout current session |
| POST | `/users/request-account-deletion` | Patient | Request account deletion (type "Delete my account") |
| GET | `/users/confirm-account-deletion` | Public | Confirm deletion via email link |
| POST | `/users/cancel-account-deletion` | Patient | Cancel pending account deletion |

---

## Profile — Basic

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users/profile` | Patient | Get basic profile |
| PUT | `/users/profile` | Patient | Update basic profile |
| GET | `/users/sessions` | Patient | List active sessions |
| GET | `/users/activity-log` | Patient | View account activity log |

---

## Profile — Extended (`/api/profile`)

### Personal

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/profile` | Patient | Get full profile |
| PUT | `/profile/personal` | Patient | Update personal details |
| PUT | `/profile/account` | Patient | Update account settings |
| PUT | `/profile/avatar` | Patient | Upload/update avatar image |
| GET | `/profile/email/verify` | Public | Confirm email change (token in query) |

### Security

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/profile/security` | Patient | Get security settings |
| PUT | `/profile/security/biometrics` | Patient | Update biometric settings |
| PUT | `/profile/security/2fa` | Patient | Update two-factor authentication |
| POST | `/profile/security/2fa/verify` | Patient | Verify 2FA enable |
| PUT | `/profile/security/password` | Patient | Change password |
| POST | `/profile/security/password/reset` | Public | Trigger forgot-password flow |
| POST | `/profile/security/report-suspicious` | Patient | Report suspicious activity |
| POST | `/profile/security/freeze` | Patient | Freeze account |
| GET | `/profile/security/unfreeze` | Public | Unfreeze account via email link |
| GET | `/profile/security/audit-log/export` | Patient | Export security audit log |

### Devices & Login Activity

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/profile/devices` | Patient | List trusted devices/sessions |
| DELETE | `/profile/devices/:sessionId` | Patient | Revoke a specific device/session |
| POST | `/profile/devices/revoke-others` | Patient | Revoke all other sessions |
| GET | `/profile/login-activity` | Patient | View login history |

### Linked Services

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/profile/linked-services/doctors` | Patient | List connected doctors |
| POST | `/profile/linked-services/doctors` | Patient | Link a doctor |
| DELETE | `/profile/linked-services/doctors/:connectionId` | Patient | Unlink a doctor |
| GET | `/profile/linked-services/pharmacies` | Patient | List connected pharmacies |
| POST | `/profile/linked-services/pharmacies` | Patient | Link a pharmacy |
| DELETE | `/profile/linked-services/pharmacies/:connectionId` | Patient | Unlink a pharmacy |
| GET | `/profile/linked-services/dependents` | Patient | List family dependents |
| POST | `/profile/linked-services/dependents` | Patient | Add a dependent |
| PUT | `/profile/linked-services/dependents/:id` | Patient | Update a dependent |
| DELETE | `/profile/linked-services/dependents/:id` | Patient | Remove a dependent |

### Medical Aid

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/profile/medical-aid` | Patient | Get medical aid scheme |
| PUT | `/profile/medical-aid` | Patient | Update medical aid scheme |
| PUT | `/profile/medical-aid/card` | Patient | Upload medical aid card (front + back) |
| GET | `/profile/medical-aid/card/:side/url` | Patient | Get signed URL for card image |
| GET | `/profile/medical-aid/claims` | Patient | List claims |
| GET | `/profile/medical-aid/claims/:id` | Patient | Get claim details |
| GET | `/profile/medical-aid/invoices` | Patient | List invoices |
| GET | `/profile/medical-aid/invoices/:id` | Patient | Get invoice details |
| GET | `/profile/medical-aid/files/download` | Public | Download signed medical aid file (token auth) |

### Account Deletion

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/profile/account/delete-request` | Patient | Request permanent account deletion |
| GET | `/profile/account/delete-confirm` | Public | Confirm deletion via email link |

---

## Comprehensive Patient Profile (`/api/users`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users/profile/complete` | Patient | Get complete profile |
| GET | `/users/profile/summary` | Patient | Get profile summary |
| PUT | `/users/profile/personal` | Patient | Update personal details |
| POST | `/users/profile/allergies` | Patient | Add allergy |
| POST | `/users/profile/conditions` | Patient | Add medical condition |
| POST | `/users/profile/medications` | Patient | Add medication |
| POST | `/users/profile/vaccinations` | Patient | Add vaccination |
| POST | `/users/profile/test-results` | Patient | Add test result |
| POST | `/users/profile/providers` | Patient | Add healthcare provider |
| POST | `/users/profile/lifestyle` | Patient | Add lifestyle data |
| POST | `/users/profile/advance-directives` | Patient | Add advance directive |
| POST | `/users/profile/custom-categories` | Patient | Create custom category |
| POST | `/users/profile/custom-categories/:customCategoryId/data` | Patient | Add data to custom category |

### Tags

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/users/profile/tags` | Patient | Create tag |
| GET | `/users/profile/tags` | Patient | Get all tags |
| PUT | `/users/profile/tags/:tagId` | Patient | Update tag |
| DELETE | `/users/profile/tags/:tagId` | Patient | Delete tag |
| POST | `/users/profile/tags/assign` | Patient | Assign tag to item |
| POST | `/users/profile/tags/remove` | Patient | Remove tag from item |
| GET | `/users/profile/tags/:tagId/items` | Patient | Get items by tag |

### Search & Filter

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users/profile/search` | Patient | Search profile data |
| POST | `/users/profile/filter-by-tags` | Patient | Filter profile data by tags |

### Version History & Audit

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users/profile/history/item` | Patient | Get item history |
| GET | `/users/profile/history/recent` | Patient | Get recent changes |
| GET | `/users/profile/history/audit-trail` | Patient | View audit trail |
| GET | `/users/profile/history/audit-report` | Patient | Generate audit report |

### File Management

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/users/profile/files/upload` | Patient | Upload document (multipart/form-data, max 10MB) |
| GET | `/users/profile/files` | Patient | List uploaded files |
| GET | `/users/profile/files/:fileId` | Patient | Get file details |
| DELETE | `/users/profile/files/:fileId` | Patient | Delete file |
| POST | `/users/profile/files/:fileId/verify-integrity` | Patient | Verify file integrity |

### Category Management

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| PUT | `/users/profile/categories/:categoryId/rename` | Patient | Rename category |
| POST | `/users/profile/categories/reorder` | Patient | Reorder categories |

---

## Doctor Discovery

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users/doctors` | Patient | List doctors (query: lat, lng, radius_km, specialty, max_fee, page, limit) |
| GET | `/users/doctors/:id` | Patient | Get doctor by ID |
| GET | `/users/doctors/:doctorId/availability` | Patient | Get doctor availability (query: date=YYYY-MM-DD) |
| POST | `/users/doctors/nearby` | Patient | Find nearby doctors by location |

---

## Appointments

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users/appointments/booking-info` | Public | Get booking time periods and date ranges |
| GET | `/users/appointments/doctors` | Patient | Get available doctors |
| GET | `/users/appointments/available-slots` | Patient | Get available time slots for a doctor |
| POST | `/users/appointments/book` | Patient | Book a new appointment |
| GET | `/users/appointments` | Patient | List all appointments |
| GET | `/users/appointments/upcoming` | Patient | List upcoming appointments |
| GET | `/users/appointments/:appointmentId` | Patient | Get appointment details |
| DELETE | `/users/appointments/:appointmentId` | Patient | Cancel appointment |
| PUT | `/users/appointments/:appointmentId/reschedule` | Patient | Reschedule appointment |
| GET | `/users/appointments/day-availability` | Public | Get full day availability for a doctor |

### Appointment Reminders

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/users/appointments/:appointmentId/reminders` | Patient | Set reminder |
| GET | `/users/appointments/:appointmentId/reminders` | Patient | Get reminder |
| PUT | `/users/appointments/:appointmentId/reminders` | Patient | Update reminder |
| PATCH | `/users/appointments/:appointmentId/reminders/toggle` | Patient | Toggle reminder on/off |
| DELETE | `/users/appointments/:appointmentId/reminders` | Patient | Delete reminder |
| GET | `/users/reminders` | Patient | List all reminders |
| GET | `/users/reminders/upcoming` | Patient | List upcoming reminders (within 24 hours) |
| GET | `/users/appointments/:appointmentId/notification-history` | Patient | View notification history |

---

## Reviews

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/users/appointments/doctors/:doctorId/reviews` | Patient | Submit or update a review |
| GET | `/users/appointments/doctors/:doctorId/reviews` | Public | Get all reviews for a doctor |
| GET | `/users/appointments/doctors/:doctorId/reviews/summary` | Public | Get rating summary |
| GET | `/users/appointments/doctors/:doctorId/reviews/check-review` | Patient | Check if already reviewed |
| GET | `/users/reviews` | Patient | Get own reviews |
| PUT | `/users/reviews/:reviewId` | Patient | Update a review |
| DELETE | `/users/reviews/:reviewId` | Patient | Delete a review |

---

## Prescriptions (`/api/prescriptions`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/prescriptions` | Patient | List all prescriptions |
| GET | `/prescriptions/:prescriptionId` | Patient | View prescription details |
| GET | `/prescriptions/:prescriptionId/download` | Patient | Download prescription as PDF |
| GET | `/prescriptions/:prescriptionId/print` | Patient | Get printable prescription |
| GET | `/prescriptions/:prescriptionId/qrcode` | Patient | Generate QR code |
| GET | `/prescriptions/:prescriptionId/qrcode-history` | Patient | View QR code access history |
| GET | `/prescriptions/:prescriptionId/share-history` | Patient | View share history |
| GET | `/prescriptions/:prescriptionId/claim-status` | Patient | Check claim status |
| GET | `/prescriptions/:prescriptionId/claim-info` | Patient | Get claim info |
| POST | `/prescriptions/:prescriptionId/share-email` | Patient | Share prescription via email |
| POST | `/prescriptions/:prescriptionId/claim` | Patient | Claim a prescription at pharmacy |
| POST | `/prescriptions/:prescriptionId/route` | Patient | Route prescription to pharmacy |
| GET | `/prescriptions/:prescriptionId/routing-history` | Patient | View prescription routing history |
| GET | `/prescriptions/qr/:qrToken` | Public | Access prescription via QR code |
| GET | `/prescriptions/qr/:qrToken/status` | Public | Check QR code status |

---

## Payments (`/api/users`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users/payments/methods` | Patient | Get available payment methods |
| POST | `/users/payments/initialize` | Patient | Initialize payment for appointment |
| POST | `/users/payments/confirm-stripe` | Patient | Confirm Stripe payment |
| POST | `/users/payments/cash-on-arrival` | Patient | Complete cash-on-arrival payment |
| POST | `/users/payments/medical-aid` | Patient | Complete medical aid payment |
| GET | `/users/payments/appointment/:appointmentId` | Patient | Get payment status for appointment |
| GET | `/users/payments` | Patient | Get payment history |
| POST | `/users/payments/stripe/create-intent` | Patient | Create Stripe Payment Intent |
| GET | `/users/payments/stripe/methods` | Patient | Get saved Stripe payment methods |
| GET | `/users/payments/:paymentId/status` | Patient | Get payment status by ID |
| POST | `/users/payments/:paymentId/refund` | Patient | Request a refund |
| GET | `/users/payments/appointment/:appointmentId/breakdown` | Patient | Get payment breakdown |
| POST | `/users/payments/webhook/stripe` | Public | Stripe webhook (used by Stripe only) |

---

## Personal Health Record (PHR) (`/api/users`)

### PHR Data

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users/phr/complete` | Patient | Get complete PHR |
| GET | `/users/phr/personal-card` | Patient | Get personal health card |
| PUT | `/users/phr/personal-card` | Patient | Update personal health card |
| GET | `/users/phr/medical-summary` | Patient | Get medical summary |
| GET | `/users/phr/prescriptions` | Patient | Get active prescriptions |
| GET | `/users/phr/medications` | Patient | Get current medications |
| GET | `/users/phr/allergies` | Patient | Get allergies |
| GET | `/users/phr/conditions` | Patient | Get medical conditions |
| GET | `/users/phr/appointments` | Patient | Get upcoming appointments in PHR |
| GET | `/users/phr/history` | Patient | Get health history |
| GET | `/users/phr/vitals` | Patient | Get health vitals |
| POST | `/users/phr/vitals` | Patient | Record health vital |
| GET | `/users/phr/vitals/range` | Patient | Get vitals in date range |
| GET | `/users/phr/documents` | Patient | Get PHR documents |
| POST | `/users/phr/documents` | Patient | Upload PHR document |

### PHR Access Control

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users/phr/access` | Patient | List who has access to PHR |
| POST | `/users/phr/access` | Patient | Grant PHR access to a doctor |
| DELETE | `/users/phr/access/:doctorId` | Patient | Revoke PHR access from a doctor |
| GET | `/users/phr/access/requests` | Patient | Get pending access requests |
| POST | `/users/phr/access/requests/:requestId/approve` | Patient | Approve an access request |
| POST | `/users/phr/access/requests/:requestId/deny` | Patient | Deny an access request |
| GET | `/users/phr/access-logs` | Patient | View PHR access logs |

---

## Notifications (`/api/notifications`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/notifications` | Patient | List notifications |
| PATCH | `/notifications/read-all` | Patient | Mark all notifications as read |
| PATCH | `/notifications/:id/read` | Patient | Mark notification as read |
| GET | `/notifications/settings` | Patient | Get notification settings |
| PUT | `/notifications/settings` | Patient | Update notification settings |
| POST | `/notifications/device-token` | Patient | Register device push token |
| DELETE | `/notifications/device-token` | Patient | Remove device push token |

---

## Orders (`/api/orders`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/orders` | Patient | Create a new order |
| GET | `/orders` | Patient | List own orders |
| PATCH | `/orders/:id/cancel` | Patient | Cancel an order |
| GET | `/orders/:id` | Patient/Pharmacy | Get order details |

---

## Support (`/api/support`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/support/tickets` | Public | Submit a support ticket |
| POST | `/support/contact` | Public | Send a contact message |
| GET | `/support/faq` | Public | Get FAQ list |
| GET | `/support/tickets` | Patient | List own support tickets |

---

## Public (No Auth Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/legal/terms` | Terms of service |
| GET | `/legal/privacy` | Privacy policy |
