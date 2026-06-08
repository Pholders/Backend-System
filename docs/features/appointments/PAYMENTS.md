# Payment System Documentation

## Overview
The payment system allows patients to pay for doctor appointments using three methods:
1. **Stripe** - Pay securely with credit/debit card
2. **Cash on Arrival** - Pay cash at the clinic
3. **Medical Aid** - Use medical aid (available only for returning patients)

## Features

### 1. **Multiple Payment Methods**
- Stripe for secure online payments
- Cash on arrival for convenience
- Medical aid claims for returning patients

### 2. **Payment Validation**
- Medical aid restricted to patients with completed appointment history
- Real-time payment status tracking
- Automatic payment verification with Stripe

### 3. **Payment Management**
- View payment history
- Check payment status for appointments
- See available payment methods

## Database Schema

### Payments Table
```sql
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('stripe', 'cash_on_arrival', 'medical_aid')),
  payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'cancelled')),
  stripe_payment_intent_id VARCHAR(255),
  stripe_transaction_id VARCHAR(255),
  medical_aid_number VARCHAR(100),
  medical_aid_provider VARCHAR(255),
  receipt_url VARCHAR(500),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:**
- `idx_payments_appointment_id`: Fast lookup by appointment
- `idx_payments_patient_id`: Fast lookup by patient
- `idx_payments_doctor_id`: Fast lookup by doctor
- `idx_payments_payment_method`: Filter by method
- `idx_payments_status`: Filter by status
- `idx_payments_created_at`: Timeline queries

## API Endpoints

### Get Available Payment Methods
```http
GET /payments/methods
```
**Authentication:** Required (Patient only)

**Response:**
```json
{
  "success": true,
  "message": "Available payment methods retrieved successfully",
  "data": {
    "isReturningPatient": true,
    "availableMethods": [
      {
        "method": "stripe",
        "label": "Credit/Debit Card (Stripe)",
        "description": "Pay securely with your credit or debit card",
        "available": true
      },
      {
        "method": "cash_on_arrival",
        "label": "Cash on Arrival",
        "description": "Pay in cash when you arrive at the clinic",
        "available": true
      },
      {
        "method": "medical_aid",
        "label": "Medical Aid",
        "description": "Use your medical aid for payment",
        "available": true,
        "restricted": null
      }
    ]
  }
}
```

**Response for New Patient (No Medical Aid):**
```json
{
  "success": true,
  "message": "Available payment methods retrieved successfully",
  "data": {
    "isReturningPatient": false,
    "availableMethods": [
      {
        "method": "stripe",
        "label": "Credit/Debit Card (Stripe)",
        "description": "Pay securely with your credit or debit card",
        "available": true
      },
      {
        "method": "cash_on_arrival",
        "label": "Cash on Arrival",
        "description": "Pay in cash when you arrive at the clinic",
        "available": true
      },
      {
        "method": "medical_aid",
        "label": "Medical Aid",
        "description": "Use your medical aid for payment",
        "available": false,
        "restricted": "Only available for returning patients with completed appointments"
      }
    ]
  }
}
```

---

### Initialize Payment
```http
POST /payments/initialize
```
**Authentication:** Required (Patient only)

**Request Body:**
```json
{
  "appointmentId": 1,
  "paymentMethod": "stripe"
}
```

**For Medical Aid:**
```json
{
  "appointmentId": 1,
  "paymentMethod": "medical_aid",
  "medicalAidNumber": "MA123456",
  "medicalAidProvider": "Discovery Health"
}
```

**Response (Stripe):**
```json
{
  "success": true,
  "message": "Payment initialized successfully",
  "data": {
    "paymentId": 1,
    "appointmentId": 1,
    "amount": 500,
    "paymentMethod": "stripe",
    "status": "pending",
    "stripeClientSecret": "pi_1234567890_secret_1234567890",
    "stripePublicKey": "pk_live_1234567890"
  }
}
```

**Response (Cash on Arrival):**
```json
{
  "success": true,
  "message": "Payment initialized successfully",
  "data": {
    "paymentId": 1,
    "appointmentId": 1,
    "amount": 500,
    "paymentMethod": "cash_on_arrival",
    "status": "pending",
    "stripeClientSecret": null,
    "stripePublicKey": null
  }
}
```

**Error: Medical Aid Not Available for New Patient**
```json
{
  "success": false,
  "message": "Medical aid payment is only available for returning patients with completed appointments"
}
```

**Error: Medical Aid Missing Details**
```json
{
  "success": false,
  "message": "Medical aid number and provider are required for medical aid payment"
}
```

---

### Confirm Stripe Payment
```http
POST /payments/confirm-stripe
```
**Authentication:** Required (Patient only)

**Request Body:**
```json
{
  "paymentId": 1,
  "stripePaymentIntentId": "pi_1234567890"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Payment confirmed successfully",
  "data": {
    "paymentId": 1,
    "status": "completed",
    "transactionId": "ch_1234567890",
    "receiptUrl": "https://receipt.stripe.com/..."
  }
}
```

**Response (Processing):**
```json
{
  "success": true,
  "message": "Payment is processing",
  "data": {
    "paymentId": 1,
    "status": "pending"
  }
}
```

---

### Complete Cash on Arrival Payment
```http
POST /payments/cash-on-arrival
```
**Authentication:** Required (Patient only)

**Request Body:**
```json
{
  "paymentId": 1
}
```

**Response:**
```json
{
  "success": true,
  "message": "Cash payment confirmed. You will pay during the appointment.",
  "data": {
    "paymentId": 1,
    "status": "completed",
    "amount": 500,
    "appointmentId": 1
  }
}
```

---

### Complete Medical Aid Payment
```http
POST /payments/medical-aid
```
**Authentication:** Required (Patient only)

**Request Body:**
```json
{
  "paymentId": 1,
  "medicalAidNumber": "MA123456",
  "medicalAidProvider": "Discovery Health"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Medical aid payment confirmed. Claim will be submitted to your provider.",
  "data": {
    "paymentId": 1,
    "status": "completed",
    "amount": 500,
    "appointmentId": 1,
    "medicalAidProvider": "Discovery Health",
    "medicalAidNumber": "MA123456"
  }
}
```

---

### Get Payment Status
```http
GET /payments/appointment/{appointmentId}
```
**Authentication:** Required (Patient only)

**Response:**
```json
{
  "success": true,
  "message": "Payment status retrieved successfully",
  "data": {
    "paymentId": 1,
    "appointmentId": 1,
    "amount": 500,
    "paymentMethod": "stripe",
    "paymentStatus": "completed",
    "createdAt": "2026-05-13T15:30:00Z"
  }
}
```

---

### Get Payment History
```http
GET /payments?limit=20&offset=0
```
**Authentication:** Required (Patient only)

**Query Parameters:**
- `limit` (optional): Number of payments to retrieve (default: 20)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "message": "Payment history retrieved successfully",
  "data": {
    "payments": [
      {
        "paymentId": 1,
        "appointmentId": 1,
        "doctorName": "Dr. John Smith",
        "specialization": "Cardiology",
        "appointmentDate": "2026-05-20",
        "amount": 500,
        "paymentMethod": "stripe",
        "paymentStatus": "completed",
        "createdAt": "2026-05-13T15:30:00Z"
      },
      {
        "paymentId": 2,
        "appointmentId": 2,
        "doctorName": "Dr. Jane Doe",
        "specialization": "Dermatology",
        "appointmentDate": "2026-05-25",
        "amount": 350,
        "paymentMethod": "cash_on_arrival",
        "paymentStatus": "pending",
        "createdAt": "2026-05-14T10:00:00Z"
      }
    ],
    "pagination": {
      "limit": 20,
      "offset": 0,
      "total": 2
    }
  }
}
```

## Payment Flow

### 1. Patient Checks Available Payment Methods
```javascript
GET /payments/methods
```
- System checks if patient is returning (has completed appointments)
- Returns available payment methods based on status

### 2. Patient Initializes Payment
```javascript
POST /payments/initialize
```
- Select payment method
- For Stripe: payment intent is created
- For Cash: payment record is created
- For Medical Aid: validation and payment record creation

### 3. Complete Payment Based on Method

#### Stripe Flow:
1. Patient gets Stripe client secret
2. Patient enters card details
3. Frontend confirms payment with Stripe
4. Patient calls confirm-stripe endpoint
5. Payment status updated to completed

#### Cash on Arrival Flow:
1. Patient calls cash-on-arrival endpoint
2. Payment marked as pending (to be paid at clinic)
3. Appointment is scheduled
4. Patient pays cash during appointment

#### Medical Aid Flow:
1. Patient provides medical aid details
2. Patient calls medical-aid endpoint
3. Payment marked as completed with medical aid details
4. Claim information stored for submission

### 4. Appointment Confirmation
- Once payment is completed, appointment is confirmed
- Patient receives confirmation email with details

## Error Handling

### Invalid Payment Method
```json
{
  "success": false,
  "message": "Invalid payment method. Must be one of: stripe, cash_on_arrival, medical_aid"
}
```

### Medical Aid Not Available
```json
{
  "success": false,
  "message": "Medical aid payment is only available for returning patients with completed appointments"
}
```

### Appointment Not Found
```json
{
  "success": false,
  "message": "Appointment not found"
}
```

### Unauthorized Payment Access
```json
{
  "success": false,
  "message": "This payment does not belong to you"
}
```

### Stripe Payment Failed
```json
{
  "success": false,
  "message": "Payment failed with status: requires_payment_method"
}
```

## Payment Statuses

| Status | Description |
|--------|-------------|
| `pending` | Payment initialized, awaiting confirmation |
| `completed` | Payment successfully processed |
| `failed` | Payment attempt failed |
| `cancelled` | Payment was cancelled by user |

## Payment Methods Details

### Stripe
- **Security**: PCI compliant, industry standard
- **Card Types**: Visa, Mastercard, American Express
- **Fees**: Variable (typically 2.9% + $0.30)
- **Settlement**: Real-time
- **Refunds**: Full refund available up to appointment date

### Cash on Arrival
- **Security**: Physical cash exchange
- **Receipt**: Provided at clinic
- **Confirmation**: Payment pending until received
- **Refunds**: Cash refund policy per clinic

### Medical Aid
- **Eligibility**: Returning patients only (must have completed appointment)
- **Claim**: Submitted to medical aid provider
- **Settlement**: Provider dependent (typically 3-5 days)
- **Coverage**: Up to medical aid plan limits

## Frontend Integration Examples

### Get Payment Methods
```javascript
async function getPaymentMethods(token) {
  const response = await fetch('/payments/methods', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
}
```

### Initialize Stripe Payment
```javascript
async function initializeStripePayment(appointmentId, token) {
  const response = await fetch('/payments/initialize', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      appointmentId,
      paymentMethod: 'stripe'
    })
  });
  return response.json();
}
```

### Confirm Stripe Payment
```javascript
async function confirmStripePayment(paymentId, stripeIntentId, token) {
  const response = await fetch('/payments/confirm-stripe', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      paymentId,
      stripePaymentIntentId: stripeIntentId
    })
  });
  return response.json();
}
```

### Cash on Arrival
```javascript
async function confirmCashPayment(paymentId, token) {
  const response = await fetch('/payments/cash-on-arrival', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ paymentId })
  });
  return response.json();
}
```

### Medical Aid Payment
```javascript
async function confirmMedicalAidPayment(paymentId, medicalAidNumber, provider, token) {
  const response = await fetch('/payments/medical-aid', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      paymentId,
      medicalAidNumber,
      medicalAidProvider: provider
    })
  });
  return response.json();
}
```

## Security Features

✅ **Authentication**: All payment operations require valid JWT token
✅ **Authorization**: Patients can only access their own payments
✅ **PCI Compliance**: Stripe handles all card data (never stored on server)
✅ **Audit Logging**: All payment operations logged for security monitoring
✅ **Input Validation**: Payment method and amounts validated
✅ **Encryption**: Sensitive data encrypted in database
✅ **HTTPS Required**: All payment endpoints require HTTPS

## Environment Setup

Add to `.env` file:
```
STRIPE_SECRET_KEY=sk_live_your_secret_key
STRIPE_PUBLIC_KEY=pk_live_your_public_key
```

## Testing

### Test Stripe Cards
- **Success**: 4242 4242 4242 4242
- **Decline**: 4000 0000 0000 0002
- **3D Secure**: 4000 0025 0000 3155

Use any future expiry date and any 3-digit CVC.

## Future Enhancements

1. **Payment Reconciliation**
   - Automated payment verification
   - Dispute handling
   - Refund management

2. **Advanced Medical Aid Integration**
   - Direct medical aid API integration
   - Real-time coverage verification
   - Automatic claim submission

3. **Analytics & Reporting**
   - Payment trends
   - Revenue reporting
   - Payment method popularity

4. **Additional Payment Methods**
   - EFT/Bank transfers
   - Digital wallets (Apple Pay, Google Pay)
   - Installment plans

5. **Notifications**
   - Payment confirmation SMS
   - Receipts via email
   - Payment reminders
