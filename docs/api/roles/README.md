# Role-Specific Endpoint Documentation

**Base URL**: `https://backend-system-u8s2.onrender.com/api` | **Auth**: `Authorization: Bearer {jwt_token}`

---

## By Role

| Role | File | Description |
|------|------|-------------|
| Patient | [PATIENT_ENDPOINTS.md](./PATIENT_ENDPOINTS.md) | Registration, appointments, prescriptions, payments, PHR, profile, notifications, orders |
| Doctor | [DOCTOR_ENDPOINTS.md](./DOCTOR_ENDPOINTS.md) | Registration, appointments, prescription management, patient PHR access |
| Pharmacy | [PHARMACY_ENDPOINTS.md](./PHARMACY_ENDPOINTS.md) | Registration, dispensing, claim routing, orders, tier management |
| Admin | [ADMIN_ENDPOINTS.md](./ADMIN_ENDPOINTS.md) | Security monitoring, partnership management, compliance, routing statistics |

---

## Quick Role Comparison

| Feature | Patient | Doctor | Pharmacy | Admin |
|---------|---------|--------|----------|-------|
| Self-registration | Yes | Yes | Yes | No |
| Email OTP activation | Yes | Yes | Yes | No |
| Appointments | Book/Cancel/Reschedule | Accept/Complete | — | Auto-cancel expired |
| Prescriptions | View/Claim/Share | Create/Sign/Revoke | Dispense | Revert claim |
| PHR | Full access + control | View (with permission) | — | — |
| Payments | Initialize/Track/Refund | — | — | Test Stripe |
| Orders | Create/Cancel | — | Queue/Accept/Reject | — |
| Partnerships | — | — | Tier upgrade | Full management |
| Claim routing | Route prescription | — | Accept/Reject | Statistics |
| Security | Account freeze/audit | — | — | System-wide dashboard |
