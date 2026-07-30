# Stripe Payment Testing Guide

**Date:** May 18, 2026  
**Status:** ✅ Ready to Test  
**Test Mode:** Yes (using test keys)

---

## 🎯 Quick Start

### Prerequisites
1. ✅ Add Stripe test keys to `.env`:
   ```env
   STRIPE_PUBLIC_KEY=pk_test_YOUR_KEY
   STRIPE_SECRET_KEY=sk_test_YOUR_KEY
   ```

2. ✅ Restart server:
   ```bash
   npm run dev
   ```

3. ✅ Get patient token and appointment ID

**Note:** Webhooks are optional and only needed when you have a public domain. For now, payments are confirmed directly from the frontend.

---

## 🧪 Test Cases

### Test 1: Get Available Payment Methods
```bash
curl -X GET http://localhost:3000/api/users/payments/methods \
  -H "Authorization: Bearer {PATIENT_TOKEN}"
```

**Expected Response:**
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

### Test 2: Create Payment Intent
```bash
curl -X POST http://localhost:3000/api/users/payments/stripe/create-intent \
  -H "Authorization: Bearer {PATIENT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "appointmentId": 1
  }'
```

**Expected Response:**
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
    "supportedMethods": ["card", "alipay", "bancontact", "apple_pay", "google_pay"],
    "paymentIntentId": "pi_xxx"
  }
}
```

---

### Test 3: Get Payment Breakdown
```bash
curl -X GET http://localhost:3000/api/users/payments/appointment/1/breakdown \
  -H "Authorization: Bearer {PATIENT_TOKEN}"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Payment breakdown calculated",
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

### Test 4: Check Payment Status
```bash
curl -X GET http://localhost:3000/api/users/payments/123/status \
  -H "Authorization: Bearer {PATIENT_TOKEN}"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Payment status retrieved",
  "data": {
    "paymentId": 123,
    "status": "pending",
    "amount": 500,
    "method": "stripe",
    "createdAt": "2026-05-18T10:30:00Z"
  }
}
```

---

### Test 5: Test Stripe Connection (Admin)
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

## 💳 Frontend Integration Test

### Install Stripe Libraries
```bash
npm install @stripe/react-stripe-js @stripe/js
```

### Minimal React Component
```jsx
import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLIC_KEY);

export function StripePayment({ appointmentId, token }) {
  return (
    <Elements stripe={stripePromise}>
      <PaymentForm appointmentId={appointmentId} token={token} />
    </Elements>
  );
}

function PaymentForm({ appointmentId, token }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    // Step 1: Create Payment Intent
    const intentResponse = await fetch('/api/users/payments/stripe/create-intent', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ appointmentId })
    });

    const intentData = await intentResponse.json();
    if (!intentData.success) {
      setError(intentData.message);
      setLoading(false);
      return;
    }

    // Step 2: Confirm Payment with Stripe
    const { error: confirmError } = await stripe.confirmCardPayment(
      intentData.data.clientSecret,
      {
        payment_method: {
          card: elements.getElement(CardElement)
        }
      }
    );

    if (confirmError) {
      setError(confirmError.message);
      setLoading(false);
    } else {
      // Payment succeeded
      alert('Payment successful!');
      // Redirect or update UI
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <CardElement />
      {error && <div style={{ color: 'red' }}>{error}</div>}
      <button type="submit" disabled={!stripe || loading}>
        {loading ? 'Processing...' : 'Pay Appointment'}
      </button>
    </form>
  );
}
```

---

## 🔗 Test Payment Methods

### Test Card: Visa (Success)
- **Number:** 4242 4242 4242 4242
- **Expiry:** Any future date (e.g., 12/25)
- **CVC:** Any 3 digits (e.g., 123)
- **Result:** ✅ Payment succeeds

### Test Card: Visa (Decline)
- **Number:** 4000 0000 0000 0002
- **Expiry:** Any future date
- **CVC:** Any 3 digits
- **Result:** ❌ Payment declines

### Test Card: 3D Secure
- **Number:** 4000 0025 0000 3155
- **Expiry:** Any future date
- **CVC:** Any 3 digits
- **Result:** ⚠️ Requires authentication

---

## 📊 Database Verification

### Check Payment Records
```sql
-- View all payments
SELECT id, appointment_id, patient_id, amount, payment_method, payment_status 
FROM payments 
ORDER BY created_at DESC 
LIMIT 10;

-- View Stripe payments specifically
SELECT id, stripe_payment_intent_id, stripe_transaction_id, payment_status 
FROM payments 
WHERE payment_method = 'stripe';

-- Check payment breakdown
SELECT 
  COALESCE(SUM(amount), 0) as total_collected,
  COALESCE(SUM(amount * 0.1), 0) as platform_fees,
  COUNT(*) as total_payments
FROM payments 
WHERE payment_status = 'completed';
```

---

## 🔔 Webhook Testing (Optional - Future)

**Webhooks are optional and only needed when you have a public domain.**

When you get a domain, you can set up webhooks for real-time payment updates:

### Setup Local Webhook Testing (Optional)

Install Stripe CLI:
```bash
# macOS
brew install stripe/stripe-cli/stripe

# Windows
choco install stripe-cli

# Linux
curl -s https://packages.stripe.dev/api/v1/install.sh | sudo bash
```

### Forward Webhook Events Locally
```bash
# Login to Stripe
stripe login

# Forward events to local endpoint
stripe listen --forward-to localhost:3000/api/users/payments/webhook/stripe

# The CLI will output your webhook signing secret
# Copy it to .env as STRIPE_WEBHOOK_SECRET
```

### Trigger Test Events
```bash
# In another terminal
stripe trigger payment_intent.succeeded

# This will send a test webhook to your local endpoint
```

**For now, skip this section and use manual confirmation (see next section).**

---

## ✅ Complete Payment Flow Test (Without Webhooks)

### 1. Create Appointment
```bash
curl -X POST http://localhost:3000/api/users/appointments \
  -H "Authorization: Bearer {PATIENT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "doctorId": 1,
    "appointmentDate": "2026-05-25",
    "timePeriod": "morning",
    "timeSlot": "09:00"
  }'
```

Save the `appointmentId` from response.

---

### 2. Get Payment Methods
```bash
curl -X GET http://localhost:3000/api/users/payments/methods \
  -H "Authorization: Bearer {PATIENT_TOKEN}"
```

---

### 3. Create Payment Intent
```bash
curl -X POST http://localhost:3000/api/users/payments/stripe/create-intent \
  -H "Authorization: Bearer {PATIENT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "appointmentId": {APPOINTMENT_ID}
  }'
```

Save the `clientSecret` and `paymentId`.

---

### 4. Confirm Payment with Stripe (Frontend)
```javascript
// Using Stripe SDK in React/Vue/Angular
const result = await stripe.confirmCardPayment(clientSecret, {
  payment_method: {
    card: cardElement
  }
});

if (result.paymentIntent.status === 'succeeded') {
  // Payment successful! Tell backend to confirm appointment
  // See step 5 below
}
```

---

### 5. Manually Confirm Appointment (After Frontend Success)
After payment succeeds on frontend, call this endpoint to confirm the appointment:

```bash
curl -X POST http://localhost:3000/api/users/payments/{paymentId}/confirm \
  -H "Authorization: Bearer {PATIENT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "appointmentId": {APPOINTMENT_ID}
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "Appointment confirmed successfully",
  "data": {
    "appointmentId": 1,
    "status": "confirmed"
  }
}
```

---

### 6. Check Payment Status
```bash
curl -X GET http://localhost:3000/api/users/payments/{paymentId}/status \
  -H "Authorization: Bearer {PATIENT_TOKEN}"
```

Expected status: `succeeded` ✅

---

### 7. Verify Appointment Updated
```bash
curl -X GET http://localhost:3000/api/users/appointments/{appointmentId} \
  -H "Authorization: Bearer {PATIENT_TOKEN}"
```

Expected appointment status: `confirmed` ✅

---

## 🔧 Debugging

### Enable Debug Logging
Add to `.env`:
```env
DEBUG=stripe:*
LOG_LEVEL=debug
```

### Check Server Logs
```bash
# Look for payment-related logs
tail -f ~/.pm2/logs/server-error.log | grep -i payment
```

### Verify Webhook Delivery
1. Go to Stripe Dashboard
2. Navigate to **Developers** → **Webhooks**
3. Click your endpoint
4. See **Recent Events**
5. Check if your webhook was received and processed

---

## 📋 Payment Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| `pending` | Awaiting payment | Patient needs to complete |
| `succeeded` | Payment received | Appointment confirmed |
| `failed` | Card declined | Patient can retry |
| `processing` | Processing payment | Wait for webhook |
| `canceled` | Patient cancelled | Appointment cancelled |
| `refunded` | Refund issued | Return money to patient |

---

## 🚨 Common Issues & Solutions

### Issue: Payment Intent Not Created
**Check:**
- Is `appointmentId` valid?
- Does appointment belong to patient?
- Is doctor consultation fee set?

### Issue: Webhook Not Received
**Check:**
- Is webhook secret correct?
- Is URL publicly accessible?
- Is raw body forwarded to webhook handler?
- Check Stripe Dashboard webhook logs

### Issue: Refund Not Processing
**Check:**
- Is appointment 24+ hours away?
- Is payment in `completed` status?
- Does Stripe have 90+ days to refund?

### Issue: Test Card Declined
**Check:**
- Is this a test decline card?
- Is date/CVC/ZIP correct?
- Is payment method supported?
- Check Stripe test mode is enabled

---

## 📞 Support Resources

- **Stripe Docs:** https://stripe.com/docs
- **Stripe Testing:** https://stripe.com/docs/testing
- **Stripe CLI:** https://stripe.com/docs/stripe-cli
- **Server Logs:** Check `npm run dev` console output

---

**Status:** ✅ Ready to Test  
**Last Updated:** May 18, 2026  
**Next:** Follow test cases above
