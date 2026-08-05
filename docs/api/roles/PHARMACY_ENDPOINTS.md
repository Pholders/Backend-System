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

### Request & Response Examples

#### POST `/users/pharmacy/signup`
**Request Body:**
```json
{
  "email": "pharmacy@example.com",
  "password": "SecurePassword123!",
  "pharmacyName": "City Pharmacy",
  "registrationNumber": "PHM-2024-001",
  "licenseNumber": "LIC-123456",
  "address": "123 Main St, City",
  "phone": "+1234567890",
  "city": "New York",
  "country": "USA"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Signup successful. Please verify your email.",
  "pharmacyId": "phm_abc123def456",
  "email": "pharmacy@example.com"
}
```

---

#### POST `/users/pharmacy/verify-email`
**Request Body:**
```json
{
  "email": "pharmacy@example.com",
  "otp": "123456"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Email verified successfully. Account activated.",
  "pharmacyId": "phm_abc123def456"
}
```

---

#### POST `/users/pharmacy/login`
**Request Body:**
```json
{
  "email": "pharmacy@example.com",
  "password": "SecurePassword123!"
}
```

**Response (200 OK - OTP Challenge):**
```json
{
  "success": true,
  "message": "OTP sent to registered email",
  "sessionId": "sess_xyz789",
  "requiresOTP": true
}
```

---

#### POST `/users/pharmacy/verify-otp`
**Request Body:**
```json
{
  "sessionId": "sess_xyz789",
  "otp": "654321"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Login successful",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "ref_token_123456",
  "pharmacyId": "phm_abc123def456",
  "role": "pharmacy",
  "expiresIn": 3600
}
```

---

## Profile

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users/pharmacy/profile` | Pharmacy | Get pharmacy profile |
| PUT | `/users/pharmacy/profile` | Pharmacy | Update pharmacy profile |
| GET | `/users/pharmacy/sessions` | Pharmacy | List active sessions |
| GET | `/users/pharmacy/activity-log` | Pharmacy | View account activity log |

### Request & Response Examples

#### GET `/users/pharmacy/profile`
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "pharmacyId": "phm_abc123def456",
    "email": "pharmacy@example.com",
    "pharmacyName": "City Pharmacy",
    "registrationNumber": "PHM-2024-001",
    "licenseNumber": "LIC-123456",
    "address": "123 Main St, City",
    "phone": "+1234567890",
    "city": "New York",
    "country": "USA",
    "currentTier": "Basic",
    "createdAt": "2026-01-15T10:30:00Z",
    "isVerified": true
  }
}
```

---

#### PUT `/users/pharmacy/profile`
**Request Body:**
```json
{
  "pharmacyName": "City Pharmacy - Updated",
  "phone": "+1234567891",
  "address": "456 Oak Avenue, City"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "pharmacyId": "phm_abc123def456",
    "pharmacyName": "City Pharmacy - Updated",
    "phone": "+1234567891",
    "address": "456 Oak Avenue, City"
  }
}
```

---

#### GET `/users/pharmacy/sessions`
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "activeSessions": [
      {
        "sessionId": "sess_xyz789",
        "loginTime": "2026-08-05T14:22:00Z",
        "lastActivity": "2026-08-05T15:30:45Z",
        "ipAddress": "192.168.1.100",
        "deviceType": "web",
        "location": "New York, USA"
      }
    ],
    "totalActive": 1
  }
}
```

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

### Request & Response Examples

#### POST `/users/pharmacy/upgrade-tier`
**Request Body:**
```json
{
  "targetTier": "Premium",
  "paymentMethod": "credit_card"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Tier upgrade initiated",
  "data": {
    "pharmacyId": "phm_abc123def456",
    "previousTier": "Basic",
    "newTier": "Premium",
    "upgradeDate": "2026-08-05T15:45:00Z",
    "status": "active",
    "features": [
      "Standard dispensing",
      "Basic claim routing",
      "Priority routing",
      "Enhanced analytics"
    ]
  }
}
```

---

#### GET `/users/pharmacy/current-tier`
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "currentTier": "Premium",
    "activeSince": "2026-08-05T15:45:00Z",
    "features": {
      "Standard dispensing": true,
      "Basic claim routing": true,
      "Priority routing": true,
      "Enhanced analytics": true,
      "Full routing control": false,
      "Compliance dashboard": false,
      "Custom agreements": false
    },
    "nextTierAvailable": "Enterprise",
    "upgradeCost": 299.99
  }
}
```

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

### Request & Response Examples

#### GET `/prescriptions/pharmacy/claimed`
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "claimedPrescriptions": [
      {
        "prescriptionId": "rx_123456",
        "patientName": "John Doe",
        "patientId": "pat_999",
        "doctorName": "Dr. Smith",
        "issuedDate": "2026-08-01T10:00:00Z",
        "claimDeadline": "2026-09-01T10:00:00Z",
        "status": "claimed",
        "medicines": [
          {
            "name": "Amoxicillin",
            "strength": "500mg",
            "quantity": 20,
            "daysSupply": 10
          }
        ]
      }
    ],
    "total": 1
  }
}
```

---

#### POST `/prescriptions/:prescriptionId/dispense`
**Request Body:**
```json
{
  "prescriptionId": "rx_123456",
  "dispensedMedicines": [
    {
      "medicineId": "med_789",
      "quantityDispensed": 20,
      "lotNumber": "LOT-2026-001",
      "expiryDate": "2027-08-05"
    }
  ],
  "dispensedDate": "2026-08-05T14:30:00Z",
  "notes": "Patient counseled on usage"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Prescription dispensed successfully",
  "data": {
    "prescriptionId": "rx_123456",
    "dispensingId": "disp_456789",
    "status": "dispensed",
    "dispensedDate": "2026-08-05T14:30:00Z",
    "patientName": "John Doe",
    "totalAmount": 45.99
  }
}
```

---

#### GET `/prescriptions/pharmacy/dispense-stats`
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "stats": {
      "totalDispensed": 156,
      "thisMonth": 42,
      "thisWeek": 12,
      "averagePerDay": 5.2,
      "topMedicines": [
        {
          "name": "Paracetamol 500mg",
          "dispensedCount": 48
        },
        {
          "name": "Amoxicillin 500mg",
          "dispensedCount": 35
        }
      ]
    }
  }
}
```

---

## Prescription Claim Routing (`/api/users`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users/pharmacy/claims/pending` | Pharmacy | Get pending incoming prescription claims |
| POST | `/users/pharmacy/claims/:routingId/accept` | Pharmacy | Accept a routed prescription claim |
| POST | `/users/pharmacy/claims/:routingId/reject` | Pharmacy | Reject a routed prescription claim |
| GET | `/users/pharmacy/performance/routing` | Pharmacy | Get pharmacy routing performance metrics |

### Request & Response Examples

#### GET `/users/pharmacy/claims/pending`
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "pendingClaims": [
      {
        "routingId": "route_123456",
        "prescriptionId": "rx_789012",
        "patientName": "Jane Smith",
        "doctorName": "Dr. Johnson",
        "issuedDate": "2026-08-04T09:15:00Z",
        "claimDeadline": "2026-09-04T09:15:00Z",
        "medicines": [
          {
            "name": "Lisinopril 10mg",
            "quantity": 30,
            "daysSupply": 30
          }
        ],
        "status": "pending",
        "routedAt": "2026-08-04T12:00:00Z"
      }
    ],
    "totalPending": 1
  }
}
```

---

#### POST `/users/pharmacy/claims/:routingId/accept`
**Request Body:**
```json
{
  "routingId": "route_123456"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Claim accepted successfully",
  "data": {
    "routingId": "route_123456",
    "prescriptionId": "rx_789012",
    "status": "accepted",
    "acceptedAt": "2026-08-05T16:22:00Z",
    "claimDeadline": "2026-09-04T09:15:00Z"
  }
}
```

---

#### POST `/users/pharmacy/claims/:routingId/reject`
**Request Body:**
```json
{
  "routingId": "route_123456",
  "reason": "Out of stock"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Claim rejected successfully",
  "data": {
    "routingId": "route_123456",
    "status": "rejected",
    "rejectedAt": "2026-08-05T16:25:00Z",
    "reason": "Out of stock"
  }
}
```

---

#### GET `/users/pharmacy/performance/routing`
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "metrics": {
      "acceptanceRate": 87.5,
      "rejectionRate": 12.5,
      "averageAcceptanceTime": "2.3 hours",
      "totalRouted": 120,
      "totalAccepted": 105,
      "totalRejected": 15,
      "thisMonth": {
        "routed": 42,
        "accepted": 38,
        "rejected": 4
      }
    }
  }
}
```

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

### Request & Response Examples

#### GET `/orders/pharmacy/queue`
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "queue": [
      {
        "orderId": "ord_111222",
        "patientName": "Alice Johnson",
        "prescriptionId": "rx_555666",
        "status": "pending",
        "receivedAt": "2026-08-05T14:00:00Z",
        "medicines": [
          {
            "name": "Aspirin 300mg",
            "quantity": 100,
            "daysSupply": 100
          }
        ]
      }
    ],
    "totalPending": 1
  }
}
```

---

#### PATCH `/orders/:id/accept`
**Request Body:**
```json
{
  "orderId": "ord_111222"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Order accepted",
  "data": {
    "orderId": "ord_111222",
    "status": "accepted",
    "acceptedAt": "2026-08-05T14:15:00Z"
  }
}
```

---

#### PATCH `/orders/:id/status`
**Request Body:**
```json
{
  "orderId": "ord_111222",
  "status": "dispensed",
  "notes": "Order ready for pickup"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Order status updated",
  "data": {
    "orderId": "ord_111222",
    "status": "dispensed",
    "updatedAt": "2026-08-05T14:45:00Z"
  }
}
```

---

#### POST `/orders/:id/claim`
**Request Body:**
```json
{
  "orderId": "ord_111222",
  "prescriptionId": "rx_555666",
  "claimAmount": 45.99
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Prescription claim recorded",
  "data": {
    "orderId": "ord_111222",
    "claimId": "claim_777888",
    "status": "claimed",
    "claimAmount": 45.99,
    "claimedAt": "2026-08-05T14:50:00Z"
  }
}
```

---

## Public Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/prescriptions/qr/:qrToken` | Public | Access prescription via QR code |
| GET | `/prescriptions/qr/:qrToken/status` | Public | Check QR code status |
| GET | `/legal/terms` | Public | Terms of service |
| GET | `/legal/privacy` | Public | Privacy policy |

### Request & Response Examples

#### GET `/prescriptions/qr/:qrToken`
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "prescriptionId": "rx_qr_abc123",
    "patientName": "John Doe",
    "doctorName": "Dr. Smith",
    "issuedDate": "2026-08-01T10:00:00Z",
    "medicines": [
      {
        "name": "Amoxicillin",
        "strength": "500mg",
        "quantity": 20,
        "daysSupply": 10,
        "instructions": "Take one tablet three times daily"
      }
    ],
    "status": "active",
    "expiryDate": "2026-09-01T10:00:00Z"
  }
}
```

---

#### GET `/prescriptions/qr/:qrToken/status`
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "qrToken": "qr_xyz789abc",
    "prescriptionId": "rx_qr_abc123",
    "status": "active",
    "issuedDate": "2026-08-01T10:00:00Z",
    "expiryDate": "2026-09-01T10:00:00Z",
    "dispensingStatus": "not_dispensed",
    "scans": 2
  }
}
```

---

#### GET `/legal/terms`
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "title": "Terms of Service",
    "lastUpdated": "2026-01-01T00:00:00Z",
    "content": "Terms and conditions content here..."
  }
}
```

---

#### GET `/legal/privacy`
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "title": "Privacy Policy",
    "lastUpdated": "2026-01-01T00:00:00Z",
    "content": "Privacy policy content here..."
  }
}
```

---

## Error Responses

All endpoints may return error responses in the following format:

### Common Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

### HTTP Status Codes
- `200 OK` — Request succeeded
- `201 Created` — Resource created successfully
- `400 Bad Request` — Invalid request parameters
- `401 Unauthorized` — Missing or invalid authentication token
- `403 Forbidden` — Insufficient permissions
- `404 Not Found` — Resource not found
- `409 Conflict` — Request conflicts with current state
- `500 Internal Server Error` — Server-side error

### Example Error Response (401 Unauthorized)
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired authentication token"
  }
}
```
