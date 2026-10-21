# Pharmacy Partnership Management System

## 📋 Overview

A comprehensive **Pharmacy Partnership Network** system enabling intelligent prescription claim routing, pharmacy group management, tiered partnerships, and automated compliance tracking.

**Status:** ✅ **FULLY IMPLEMENTED & TESTED**

---

## 🎯 Core Features

### 1. **Pharmacy Group Management**
- Create/manage pharmacy chains and independent networks
- Organize pharmacies into groups with primary/secondary branches
- Tier-based organization: Premium, Standard, Basic
- Group-level commission rates and revenue tracking

### 2. **Partnership Agreements**
- Define contract terms with pharmacies/groups
- Configurable SLA requirements (response time, dispensing time)
- Commission and payment terms management
- Auto-renewal and expiration handling

### 3. **Smart Claim Routing**
- Automatically route prescriptions to best pharmacy based on:
  - **Tier** (Premium first, then Standard, then Basic)
  - **Compliance score** (higher performance = higher priority)
  - **Acceptance rate** (pharmacies that accept more claims get priority)
  - **Distance** (proximity to patient location)
- Fallback routing if top choice declines
- Records complete routing history

### 4. **Compliance Tracking**
- Monthly compliance metrics per agreement
- Auto-calculate compliance scores (0-100)
- Track response times and dispensing times
- Performance-based tier adjustments
- Auto-suspend agreements below 60% compliance

### 5. **Performance Analytics**
- Dashboard with compliance summary
- Top-performing pharmacies
- Low-performing alerts
- Revenue and commission tracking
- Trend analysis

---

## 🗄️ Database Schema

### `pharmacy_groups` Table
```sql
id: SERIAL PRIMARY KEY
group_name: VARCHAR(255)
tier: VARCHAR(20) -- premium, standard, basic
commission_rate: DECIMAL(5,2)
total_pharmacies: INT
total_claims_handled: INT
total_revenue: DECIMAL(15,2)
is_active: BOOLEAN
created_at: TIMESTAMP
```

### `pharmacy_group_members` Table
```sql
id: SERIAL PRIMARY KEY
pharmacy_id: INT (FK)
group_id: INT (FK)
is_primary: BOOLEAN
joined_at: TIMESTAMP
left_at: TIMESTAMP (for soft delete)
```

### `pharmacy_agreements` Table
```sql
id: SERIAL PRIMARY KEY
pharmacy_or_group_id: INT
entity_type: VARCHAR(20) -- pharmacy, group
commission_rate: DECIMAL(5,2)
claim_response_time_hours: INT (SLA requirement)
dispensing_time_hours: INT (SLA requirement)
status: VARCHAR(20) -- pending, active, suspended, expired
start_date: DATE
end_date: DATE
auto_renew: BOOLEAN
```

### `agreement_compliance` Table
```sql
id: SERIAL PRIMARY KEY
agreement_id: INT (FK)
month_date: DATE
total_claims: INT
claims_accepted: INT
on_time_responses: INT
on_time_dispensed: INT
compliance_score: DECIMAL(5,2) -- 0-100
```

### `claim_routing_history` Table
```sql
id: SERIAL PRIMARY KEY
prescription_id: INT
routed_to_pharmacy_id: INT
routing_reason: VARCHAR(100)
routing_order: INT
accepted: BOOLEAN
response_time_seconds: INT
dispensing_time_seconds: INT
claim_sent_at: TIMESTAMP
claim_response_at: TIMESTAMP
```

### `pharmacy_performance_metrics` Table
```sql
id: SERIAL PRIMARY KEY (UNIQUE per pharmacy)
pharmacy_id: INT (FK, UNIQUE)
total_claims_routed: INT
total_claims_accepted: INT
acceptance_rate: DECIMAL(5,2)
overall_score: DECIMAL(5,2) -- 0-100
```

---

## 📡 API Endpoints

### **Pharmacy Group Management** (Admin only)

#### Create Group
```http
POST /api/partnerships/groups
Authorization: Bearer {admin_token}

{
  "group_name": "MedCare Pharmacy Chain",
  "parent_company": "MedCare Holdings",
  "tier": "premium",
  "description": "Leading pharmacy chain...",
  "commission_rate": 7.50
}
```

#### Get All Groups
```http
GET /api/partnerships/groups?tier=premium&is_active=true&limit=50&offset=0
Authorization: Bearer {admin_token}
```

#### Get Group Details
```http
GET /api/partnerships/groups/{groupId}
Authorization: Bearer {admin_token}

Response:
{
  "id": 1,
  "group_name": "MedCare Pharmacy Chain",
  "tier": "premium",
  "pharmacy_count": 45,
  "pharmacies": [...],
  "statistics": {
    "active_pharmacies": 45,
    "active_agreements": 3,
    "total_claims": 1250,
    "total_revenue": 75000
  }
}
```

#### Add Pharmacy to Group
```http
POST /api/partnerships/groups/{groupId}/pharmacies
Authorization: Bearer {admin_token}

{
  "pharmacy_id": 5,
  "is_primary": true
}
```

#### Remove Pharmacy from Group
```http
DELETE /api/partnerships/groups/{groupId}/pharmacies/{pharmacyId}
Authorization: Bearer {admin_token}
```

---

### **Partnership Agreements** (Admin only)

#### Create Agreement
```http
POST /api/partnerships/agreements
Authorization: Bearer {admin_token}

{
  "pharmacy_or_group_id": 1,
  "entity_type": "group",           -- pharmacy or group
  "agreement_type": "dispensing",
  "start_date": "2026-06-14",
  "end_date": "2027-06-14",
  "auto_renew": true,
  "commission_rate": 7.50,          -- percentage
  "service_fee": 50,                -- per transaction
  "minimum_monthly_transactions": 100,
  "claim_response_time_hours": 1,   -- SLA
  "dispensing_time_hours": 4,       -- SLA
  "payment_terms": "NET30"
}
```

#### Get Agreement Details
```http
GET /api/partnerships/agreements/{agreementId}
Authorization: Bearer {admin_token}

Response:
{
  "id": 1,
  "pharmacy_or_group_id": 1,
  "entity_name": "MedCare Pharmacy Chain",
  "status": "active",
  "commission_rate": 7.50,
  "compliance": {
    "avg_compliance": 94.5,
    "min_compliance": 88.0,
    "max_compliance": 98.5
  },
  "trends": [
    {
      "month_date": "2026-05-01",
      "compliance_score": 92.0,
      "total_claims": 156
    },
    ...
  ]
}
```

#### Update Agreement
```http
PUT /api/partnerships/agreements/{agreementId}
Authorization: Bearer {admin_token}

{
  "commission_rate": 8.0,
  "claim_response_time_hours": 2,
  "status": "active"
}
```

#### Activate Agreement
```http
POST /api/partnerships/agreements/{agreementId}/activate
Authorization: Bearer {admin_token}
```

#### Suspend Agreement
```http
POST /api/partnerships/agreements/{agreementId}/suspend
Authorization: Bearer {admin_token}
```

#### Get Expiring Agreements
```http
GET /api/partnerships/agreements/expiring?days=30
Authorization: Bearer {admin_token}
```

---

### **Prescription Claim Routing**

#### Route Prescription (Patient)
```http
POST /api/prescriptions/{prescriptionId}/route
Authorization: Bearer {patient_token}

{
  "latitude": -34.0522,
  "longitude": 18.3932
}

Response:
{
  "success": true,
  "message": "Prescription routed successfully",
  "data": {
    "prescriptionId": 123,
    "candidatesCount": 12,
    "routedSuccessfully": true
  }
}
```

#### Get Routing History (Patient)
```http
GET /api/prescriptions/{prescriptionId}/routing-history
Authorization: Bearer {patient_token}

Response: [
  {
    "routing_order": 1,
    "pharmacy_name": "MedCare Premium #1",
    "tier": "premium",
    "claim_sent_at": "2026-06-14T10:30:00Z",
    "accepted": true,
    "response_time_seconds": 45
  },
  ...
]
```

---

### **Pharmacy Claim Management** (Pharmacy)

#### Get Pending Claims
```http
GET /api/pharmacy/claims/pending
Authorization: Bearer {pharmacy_token}

Response: [
  {
    "routing_id": 456,
    "prescription_id": 123,
    "patient_name": "John Smith",
    "medication_name": "Amoxicillin 500mg",
    "claim_sent_at": "2026-06-14T10:30:00Z"
  },
  ...
]
```

#### Accept Claim
```http
POST /api/pharmacy/claims/{routingId}/accept
Authorization: Bearer {pharmacy_token}

{
  "notes": "Stock available, will prepare within 2 hours"
}
```

#### Reject Claim
```http
POST /api/pharmacy/claims/{routingId}/reject
Authorization: Bearer {pharmacy_token}

{
  "reason": "Out of stock - can order within 24 hours"
}
```

#### Get Pharmacy Routing Performance
```http
GET /api/pharmacy/performance/routing
Authorization: Bearer {pharmacy_token}

Response:
{
  "total_routed": 245,
  "accepted": 212,
  "rejected": 18,
  "pending": 15,
  "avg_response_time": 120,        -- seconds
  "acceptance_rate": 86.5          -- percent
}
```

---

### **Compliance & Analytics** (Admin)

#### Get Compliance Dashboard
```http
GET /api/partnerships/compliance/dashboard
Authorization: Bearer {admin_token}

Response:
{
  "summary": {
    "total_agreements": 25,
    "active_agreements": 23,
    "suspended_agreements": 2,
    "avg_compliance_score": 87.5,
    "excellent_count": 15,  -- >= 90%
    "good_count": 6,        -- 80-89%
    "poor_count": 2         -- < 80%
  },
  "topPerformers": [...],
  "lowPerformers": [...]
}
```

#### Get Pharmacy Compliance Status
```http
GET /api/partnerships/compliance/pharmacy/{pharmacyId}
Authorization: Bearer {admin_token}

Response:
{
  "pharmacyId": 5,
  "overallCompliance": 94.5,
  "status": "excellent",    -- excellent, good, fair, poor
  "agreementCount": 2,
  "agreements": [
    {
      "agreementId": 1,
      "avg_compliance": 92.0,
      "min_compliance": 88.0,
      "max_compliance": 98.0
    }
  ]
}
```

#### Get Compliance Report
```http
GET /api/partnerships/compliance/report?start_date=2026-05-01&end_date=2026-06-14
Authorization: Bearer {admin_token}

Response: [
  {
    "agreement_id": 1,
    "entity_name": "MedCare Pharmacy Chain",
    "compliance_score": 95.0,
    "total_claims": 156,
    "claims_accepted": 145,
    "month_date": "2026-06-01"
  },
  ...
]
```

#### Get Routing Statistics
```http
GET /api/partnerships/routing/statistics?start_date=2026-06-01&end_date=2026-06-14
Authorization: Bearer {admin_token}

Response:
{
  "total_routes": 458,
  "accepted_count": 398,
  "rejected_count": 42,
  "pending_count": 18,
  "avg_response_time": 145,      -- seconds
  "acceptance_rate": 86.9        -- percent
}
```

---

## 🎯 Routing Algorithm

The smart routing engine prioritizes pharmacies as follows:

```
1. Get all pharmacies with active agreements
2. Rank by tier (Premium > Standard > Basic)
3. Within tier, rank by compliance score
4. Within compliance, sort by distance (nearest first)
5. Route to top candidate pharmacy
6. If rejected within SLA window, try next pharmacy
7. Record in routing history for analytics
```

### Scoring Formula

```
Routing Score = (40 * tier_score) + 
                (40 * performance_score) + 
                (15 * acceptance_rate) + 
                (5 * response_compliance)

Where:
- tier_score: Premium=100, Standard=62.5, Basic=25
- performance_score: 0-100 based on compliance metrics
- acceptance_rate: 0-100 percentage
- response_compliance: 0-100 based on on-time responses
```

---

## 📊 Compliance Scoring

Compliance score is calculated monthly for each agreement:

```
Compliance Score = (40% * Response Compliance) +
                   (40% * Dispensing Compliance) +
                   (20% * Acceptance Rate)

Where:
- Response Compliance = (On-Time Responses / Total Claims) * 100
- Dispensing Compliance = (On-Time Dispensed / Accepted Claims) * 100
- Acceptance Rate = (Accepted / Total Routed) * 100
```

### Auto-Suspension Rules
- **Score < 60%**: Immediately suspended
- **Score 60-79%**: Warning issued
- **Score 80-89%**: Good standing
- **Score >= 90%**: Excellent standing

---

## 🔧 Services

### PharmacyRoutingService
```javascript
// Route prescription to pharmacy
await PharmacyRoutingService.routePrescription(prescriptionId, patientLocation)

// Get candidate pharmacies
await PharmacyRoutingService.getCandidatePharmacies(patientLocation)

// Record claim response
await PharmacyRoutingService.recordClaimResponse(routingId, accepted, reason)

// Get routing history
await PharmacyRoutingService.getRoutingHistory(prescriptionId)

// Get statistics
await PharmacyRoutingService.getRoutingStatistics(startDate, endDate)
```

### ComplianceTrackingService
```javascript
// Initialize compliance tracking
await ComplianceTrackingService.initialize()

// Calculate monthly compliance
await ComplianceTrackingService.calculateMonthlyCompliance()

// Get pharmacy compliance status
await ComplianceTrackingService.getPharmacyComplianceStatus(pharmacyId)

// Get compliance report
await ComplianceTrackingService.getComplianceReport(startDate, endDate)

// Update pharmacy metrics
await ComplianceTrackingService.updatePharmacyMetrics(pharmacyId)

// Get dashboard data
await ComplianceTrackingService.getDashboardData()
```

---

## 📂 File Structure

```
Backend-System/
├── config/
│   └── addPharmacyPartnerships.js          (Database migration)
├── models/
│   ├── PharmacyGroup.js                    (Group CRUD operations)
│   ├── PharmacyAgreement.js                (Agreement management)
│   └── AgreementCompliance.js              (Compliance tracking)
├── services/
│   ├── pharmacyRoutingService.js           (Smart routing engine)
│   └── complianceTrackingService.js        (Compliance monitoring)
├── controllers/
│   ├── pharmacyPartnershipController.js    (Partnership endpoints)
│   └── pharmacyClaimRoutingController.js   (Routing endpoints)
└── routes/
    └── userRoutes.js                       (All endpoints)
```

---

## ⚙️ Installation & Setup

### 1. Database Tables
All tables created automatically on server startup:
- `pharmacy_groups`
- `pharmacy_group_members`
- `pharmacy_agreements`
- `agreement_compliance`
- `claim_routing_history`
- `pharmacy_performance_metrics`

### 2. Server Initialization
```javascript
// In server.js:
const ComplianceTrackingService = require('./services/complianceTrackingService');
await ComplianceTrackingService.initialize();
```

### 3. Environment Variables
```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/backend_db
```

---

## 🚀 Example Usage

### Create Pharmacy Group (Admin)
```bash
curl -X POST http://localhost:3000/api/partnerships/groups \
  -H "Authorization: Bearer admin_token" \
  -H "Content-Type: application/json" \
  -d '{
    "group_name": "PharmaCare Chain",
    "tier": "premium",
    "commission_rate": 7.50
  }'
```

### Create Agreement
```bash
curl -X POST http://localhost:3000/api/partnerships/agreements \
  -H "Authorization: Bearer admin_token" \
  -H "Content-Type: application/json" \
  -d '{
    "pharmacy_or_group_id": 1,
    "entity_type": "group",
    "commission_rate": 7.50,
    "claim_response_time_hours": 1,
    "dispensing_time_hours": 4
  }'
```

### Route Prescription (Patient)
```bash
curl -X POST http://localhost:3000/api/prescriptions/123/route \
  -H "Authorization: Bearer patient_token" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": -34.0522,
    "longitude": 18.3932
  }'
```

### Check Pharmacy Compliance (Admin)
```bash
curl http://localhost:3000/api/partnerships/compliance/pharmacy/5 \
  -H "Authorization: Bearer admin_token"
```

---

## 🔄 Data Flow

```
Patient requests prescription
    ↓
System routes to pharmacies (tier-based)
    ↓
Pharmacy receives claim (24-hour acceptance window)
    ↓
Pharmacy accepts or rejects
    ↓
Response recorded in routing history
    ↓
Compliance metrics updated monthly
    ↓
Performance dashboard reflects changes
    ↓
Low compliance agreements auto-suspended
    ↓
Admin notified of issues
```

---

## 📈 Metrics Dashboard

Available metrics per pharmacy/group:
- **Routing**: Total routed, accepted, rejected, pending
- **Response**: Average response time, on-time percentage
- **Dispensing**: Average dispensing time, on-time percentage
- **Financial**: Total revenue, commissions paid, payment status
- **Compliance**: Overall score, monthly trend, acceptance rate

---

## ⏰ Scheduled Tasks

### Compliance Tracking Service
- **Expiration Check**: Daily at midnight
- **Low Compliance Alerts**: When score drops below 80%
- **Auto-Renewal**: For agreements with auto_renew=true
- **Auto-Suspension**: For agreements with score < 60%

---

## 🔐 Security Features

- **Role-based access control** (Admin, Pharmacy, Patient)
- **Token-based authentication** (JWT)
- **Audit logging** for all claims and routing
- **Data validation** on all inputs
- **Rate limiting** on sensitive endpoints
- **Encrypted storage** of sensitive data

---

## 📝 Testing Endpoints

### Health Check
```bash
curl http://localhost:3000/api/health
```

### Test Database
```bash
curl http://localhost:3000/api/test-db
```

---

## 🎓 Key Concepts

- **Tier System**: Premium (fast response, high-performing), Standard (moderate), Basic (fallback)
- **SLA**: Service Level Agreement - defined response/dispensing times
- **Compliance Score**: Percentage metric indicating pharmacy reliability
- **Claim Routing**: Process of assigning prescriptions to pharmacies
- **Fallback Chain**: Premium → Standard → Basic when pharmacy declines

---

## 🚀 Next Steps (Optional Enhancements)

1. **SMS/Push Notifications**: Send claim alerts to pharmacies
2. **Delivery Integration**: Track order delivery status
3. **Payment Settlement**: Automated commission payouts
4. **Multi-Channel Orders**: Support phone/web ordering
5. **Inventory Sync**: Real-time stock updates
6. **Advanced Analytics**: Predictive routing, demand forecasting

---

## ✅ Verification Checklist

- [x] Database tables created successfully
- [x] All models implemented with CRUD operations
- [x] Smart routing engine functioning
- [x] Compliance tracking active
- [x] API endpoints tested
- [x] Server starts without errors
- [x] Authentication working
- [x] Authorization rules enforced

---

## 📞 Support

For issues or questions:
1. Check server logs: `/api/system/logs`
2. Check compliance dashboard: `/api/partnerships/compliance/dashboard`
3. Review routing statistics: `/api/partnerships/routing/statistics`

**Status**: ✅ **PRODUCTION READY**

