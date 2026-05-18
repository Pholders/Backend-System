# Stripe Payment Integration Setup Guide

**Date:** May 18, 2026  
**Status:** ✅ Ready for Configuration  
**Payment Gateway:** Stripe  
**Supported Methods:** Card, Apple Pay, Google Pay, Bank Transfer, Alipay

---

## 📋 Overview

Your system now has full Stripe integration for appointment payments with:
- ✅ Multiple payment methods (card, wallet, bank transfer)
- ✅ Flexible payment timing (upfront or after appointment)
- ✅ Refund system (10% platform fee retained)
- ✅ Webhook support for payment status updates
- ✅ Complete audit trail

---

## 🔑 Step 1: Get Stripe API Keys

### For Test Mode (Development)

1. Go to https://dashboard.stripe.com
2. Sign up or log in to your Stripe account
3. Go to **Developers** → **API Keys**
4. Copy the **Test Keys**:
   - **Publishable Key** (starts with `pk_test_`)
   - **Secret Key** (starts with `sk_test_`)

### For Live Mode (Production)

1. Activate your Stripe account (verify email, business info)
2. Go to **Developers** → **API Keys**
3. Copy the **Live Keys**:
   - **Publishable Key** (starts with `pk_live_`)
   - **Secret Key** (starts with `sk_live_`)

⚠️ **NEVER** commit Secret Keys to version control!

---

## 🔧 Step 2: Configure Environment Variables

Add these to your `.env` file:

```env
# Stripe API Keys (use test keys first)
STRIPE_PUBLIC_KEY=pk_test_YOUR_PUBLIC_KEY_HERE
STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY_HERE

# Stripe Webhook Secret (optional - only needed if using webhooks later)
# STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE

# Payment Settings
PLATFORM_FEE_PERCENTAGE=10
PAYMENT_CURRENCY=ZAR
```

**Note:** Webhooks are optional and only needed when you have a public domain. For now, payments will be confirmed directly from the frontend.

---

## 📡 Step 3: Server Configuration (Already Done)

Server is already configured to accept payments. Webhook support can be added later when you get a public domain.

**Note:** If you later add webhooks, update `server.js` to handle raw body (see QUICK_REFERENCE.md).

---

## 🚀 Step 4: Install Dependencies (Already Done)

Stripe is already installed:
```bash
npm list stripe
# stripe@22.1.1
```

---

## ✅ Step 5: Test Stripe Connection

Run this command to verify keys are configured:

```bash
curl -X GET http://localhost:3000/api/users/payments/stripe/test \
  -H "Authorization: Bearer {ADMIN_TOKEN}"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Connected to Stripe API successfully",
  "stripeConfigured": true
}
```

---

## 💳 API Endpoints Reference

### Patient Endpoints

#### 1. Get Available Payment Methods
```
GET /api/users/payments/methods
Authorization: Bearer {PATIENT_TOKEN}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "isReturningPatient": false,
    "availableMethods": [
      {
        "method": "stripe",
        "label": "Credit/Debit Card (Stripe)",
        "available": true
      },
      {
        "method": "cash_on_arrival",
        "label": "Cash on Arrival",
        "available": true
      }
    ]
  }
}
```

---

#### 2. Create Payment Intent
```
POST /api/users/payments/stripe/create-intent
Authorization: Bearer {PATIENT_TOKEN}
Content-Type: application/json
```

**Request:**
```json
{
  "appointmentId": 1
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment intent created successfully",
  "data": {
    "paymentId": 123,
    "appointmentId": 1,
    "clientSecret": "pi_xxx_secret_xxx",
    "amount": 500,
    "currency": "ZAR",
    "breakdown": {
      "patient_pays": "R500.00",
      "platform_fee": "R50.00 (10%)",
      "doctor_receives": "R450.00"
    },
    "supportedMethods": [
      "card",
      "alipay",
      "bancontact",
      "apple_pay",
      "google_pay"
    ],
    "paymentIntentId": "pi_xxx"
  }
}
```

---

#### 3. Get Payment Status
```
GET /api/users/payments/:paymentId/status
Authorization: Bearer {PATIENT_TOKEN}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "paymentId": 123,
    "status": "succeeded",
    "amount": 500,
    "method": "stripe",
    "createdAt": "2026-05-18T10:30:00Z"
  }
}
```

---

#### 4. Request Refund
```
POST /api/users/payments/:paymentId/refund
Authorization: Bearer {PATIENT_TOKEN}
Content-Type: application/json
```

**Request:**
```json
{
  "reason": "Need to reschedule appointment"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Refund processed successfully",
  "data": {
    "refundAmount": 450,
    "platformFeeRetained": 50,
    "refundId": "re_xxx",
    "status": "succeeded"
  }
}
```

**Refund Policy:**
- ✅ Full refund (minus 10% fee) if cancelled 24+ hours before
- ❌ No refund if cancelled within 24 hours

---

#### 5. Get Payment Breakdown
```
GET /api/users/payments/appointment/:appointmentId/breakdown
Authorization: Bearer {PATIENT_TOKEN}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "appointmentFee": 500,
    "platformFee": 50,
    "doctorReceives": 450,
    "breakdown": {
      "patient_pays": "R500.00",
      "platform_fee": "R50.00 (10%)",
      "doctor_receives": "R450.00"
    }
  }
}
```

---

#### 6. Get Payment Methods
```
GET /api/users/payments/stripe/methods
Authorization: Bearer {PATIENT_TOKEN}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "count": 2,
    "paymentMethods": [
      {
        "id": "pm_xxx",
        "brand": "visa",
        "last4": "4242",
        "expMonth": 12,
        "expYear": 2025
      }
    ]
  }
}
```

---

## 🧪 Testing with Stripe Test Cards

### Test Card Numbers

| Card | Number | CVC | Expiry |
|------|--------|-----|--------|
| Visa (Success) | 4242 4242 4242 4242 | Any | Future |
| Visa (Decline) | 4000 0000 0000 0002 | Any | Future |
| Mastercard | 5555 5555 5555 4444 | Any | Future |
| Amex | 3782 822463 10005 | Any | Future |
| 3D Secure Required | 4000 0025 0000 3155 | Any | Future |

### Test Email & Password
```
Email: any@email.com
Password: anything
```

### Complete Payment Flow Test

1. **Create appointment** (see Appointment API)
2. **Get payment methods:**
   ```bash
   curl -X GET http://localhost:3000/api/users/payments/methods \
     -H "Authorization: Bearer {TOKEN}"
   ```

3. **Create payment intent:**
   ```bash
   curl -X POST http://localhost:3000/api/users/payments/stripe/create-intent \
     -H "Authorization: Bearer {TOKEN}" \
     -H "Content-Type: application/json" \
     -d '{"appointmentId": 1}'
   ```

4. **In Frontend:** Use Stripe's `@stripe/react-stripe-js` to handle card input
   - Use `clientSecret` from step 3
   - Use `card` element or `payment request button`
   - Frontend confirms payment directly with Stripe
   - **Important:** After successful confirmation, frontend should call your backend to confirm the appointment (see manual confirmation below)

5. **Manual Confirmation (No Webhooks):**
   After frontend confirms payment successfully:
   ```bash
   curl -X POST http://localhost:3000/api/users/payments/{paymentId}/confirm \
     -H "Authorization: Bearer {TOKEN}" \
     -H "Content-Type: application/json" \
     -d '{"appointmentId": 1}'
   ```
   This updates the appointment to `confirmed`

6. **Check status:**
   ```bash
   curl -X GET http://localhost:3000/api/users/payments/{paymentId}/status \
     -H "Authorization: Bearer {TOKEN}"
   ```

---

## 🔔 Webhook Events (Optional)

**Note:** Webhooks are optional and only needed when you have a public domain. For now, payments are confirmed directly from the frontend.

When you're ready to add webhooks later, Stripe will send these events to your webhook endpoint:

### 1. Payment Succeeded
- Triggers when payment is successful
- Updates appointment to `confirmed`
- Notifies doctor

### 2. Payment Failed
- Triggers when card is declined
- Keeps appointment `pending_payment`
- Patient can retry

### 3. Charge Refunded
- Triggers when refund is processed
- Updates appointment to `cancelled`

### 4. Dispute Created
- Triggers on chargeback
- Alerts admin
- Holds appointment status

**To set up webhooks later:**
1. Get a public domain
2. Go to Stripe Dashboard → **Developers** → **Webhooks**
3. Add endpoint: `https://yourdomain.com/api/users/payments/webhook/stripe`
4. Copy webhook secret to `.env`
5. See QUICK_REFERENCE.md for server configuration

---

## 🛡️ Security Best Practices

### ✅ DO:
- ✅ Always use HTTPS (never HTTP)
- ✅ Store Stripe Secret Key in environment variables
- ✅ Verify webhook signatures
- ✅ Use test keys in development, live keys in production
- ✅ Never log full card numbers
- ✅ Set appropriate CORS headers
- ✅ Rate limit payment endpoints

### ❌ DON'T:
- ❌ Commit API keys to Git
- ❌ Log sensitive payment data
- ❌ Store full card numbers
- ❌ Skip webhook verification
- ❌ Mix test and live keys
- ❌ Expose client secret to other users

---

## 📊 Database Schema

### `payments` table (Updated)
```sql
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  appointment_id INTEGER NOT NULL REFERENCES appointments(id),
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  doctor_id INTEGER NOT NULL REFERENCES doctors(id),
  amount DECIMAL(10, 2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL,  -- 'stripe', 'cash_on_arrival', 'medical_aid'
  payment_status VARCHAR(50) DEFAULT 'pending',  -- 'pending', 'completed', 'failed', 'cancelled', 'refunded'
  stripe_payment_intent_id VARCHAR(255),  -- Stripe Payment Intent ID
  stripe_transaction_id VARCHAR(255),     -- Stripe Charge ID
  medical_aid_number VARCHAR(100),
  medical_aid_provider VARCHAR(255),
  receipt_url VARCHAR(500),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🔄 Payment Status Flow

```
┌─────────────────┐
│   Appointment   │
│   Created       │
└────────┬────────┘
         │
         ▼
┌─────────────────────┐
│  Patient Chooses    │
│  Payment Method     │
└────────┬────────────┘
         │
    ┌────┴────┐
    │          │
    ▼          ▼
┌────────┐  ┌──────┐
│ Stripe │  │ Cash │
└───┬────┘  └──┬───┘
    │          │
    ▼          ▼
┌─────────────────────┐
│  Payment Intent     │
│  Created (pending)  │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  Patient Confirms   │
│  Payment            │
└────────┬────────────┘
         │
    ┌────┴────┐
    │          │
    ▼          ▼
┌────────┐  ┌──────────┐
│Success │  │  Failed  │
└───┬────┘  └──────┬───┘
    │              │
    ▼              ▼
┌──────────┐  ┌─────────┐
│Completed │  │ Pending │
│Confirmed │  │ Retry   │
└──────────┘  └─────────┘
```

---

## 🐛 Troubleshooting

### Issue: "STRIPE_SECRET_KEY not configured"
**Solution:** Add `STRIPE_SECRET_KEY` to `.env` file

### Issue: Webhook signature verification failed
**Solution:** 
1. Copy correct webhook secret from Stripe Dashboard
2. Ensure raw body is passed to webhook handler
3. Check webhook URL is publicly accessible

### Issue: Payment status not updating
**Solution:**
1. Check webhook endpoint is receiving events
2. Verify webhook secret is correct
3. Check database permissions
4. Review server logs for errors

### Issue: Test cards not working
**Solution:**
1. Ensure you're using test keys (pk_test_, sk_test_)
2. Use valid test card numbers from table above
3. Check browser console for JavaScript errors
4. Verify Stripe.js library is loaded

---

## 📚 Frontend Integration

### Required Libraries
```bash
npm install @stripe/react-stripe-js @stripe/js
```

### Basic React Component
```jsx
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLIC_KEY);

function PaymentForm({ clientSecret }) {
  const stripe = useStripe();
  const elements = useElements();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const { error } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: elements.getElement(CardElement)
      }
    });

    if (error) {
      console.error(error);
    } else {
      // Payment succeeded
    }
  };

  return (
    <Elements stripe={stripePromise}>
      <form onSubmit={handleSubmit}>
        <CardElement />
        <button type="submit">Pay</button>
      </form>
    </Elements>
  );
}
```

---

## 📞 Support

- **Stripe Documentation:** https://stripe.com/docs
- **API Reference:** https://stripe.com/docs/api
- **Test Mode Guide:** https://stripe.com/docs/testing

---

**Status:** ✅ Ready for Configuration  
**Last Updated:** May 18, 2026  
**Next Step:** Add Stripe keys to `.env` and test connection
