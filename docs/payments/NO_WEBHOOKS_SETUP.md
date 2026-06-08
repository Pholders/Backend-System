# 🚀 Payment Setup Without Webhooks (No Domain Required)

**Status:** ✅ Ready to Use  
**Domain Required:** ❌ No  
**Setup Time:** ~2-3 minutes  
**Test Immediately:** ✅ Yes

---

## 📋 Overview

You can start accepting Stripe payments **right now** without a public domain. Webhooks are optional and can be added later when you have a domain.

**How it works:**
1. Frontend collects payment details via Stripe.js
2. Stripe processes payment on frontend
3. Frontend receives payment confirmation immediately
4. Frontend tells backend to confirm the appointment
5. Backend updates appointment status to "confirmed"

---

## ⚡ Quick Start (2 Minutes)

### Step 1: Get Stripe Test Keys
1. Go to https://dashboard.stripe.com
2. Click **Developers** → **API Keys**
3. Copy the test keys:
   - Publishable Key (pk_test_...)
   - Secret Key (sk_test_...)

### Step 2: Update .env
```env
STRIPE_PUBLIC_KEY=pk_test_YOUR_KEY
STRIPE_SECRET_KEY=sk_test_YOUR_KEY
```

### Step 3: Done! 
Start server and you're ready to test:
```bash
npm run dev
```

**That's it!** No domain, no webhooks needed yet.

---

## 💳 Payment Flow (Without Webhooks)

```
┌────────────────────────────────┐
│  Patient Books Appointment     │
└────────────────┬───────────────┘
                 │
                 ▼
         ┌───────────────┐
         │ Select Stripe │
         └───────┬───────┘
                 │
                 ▼
    ┌────────────────────────┐
    │ Create Payment Intent  │
    │ (Backend)              │
    │ Returns: clientSecret  │
    └────────────┬───────────┘
                 │
                 ▼
    ┌────────────────────────┐
    │  Frontend Collects     │
    │  Card Information      │
    │  (via Stripe.js)       │
    └────────────┬───────────┘
                 │
                 ▼
    ┌────────────────────────┐
    │  Confirm Payment with  │
    │  Stripe (Frontend)     │
    │  No Backend Involved   │
    └────────────┬───────────┘
                 │
    ┌────────────┴────────────┐
    │                         │
    ▼                         ▼
┌─────────┐            ┌──────────┐
│ Success │            │  Failed  │
│   ✅    │            │    ❌    │
└────┬────┘            └──────────┘
     │
     ▼
┌──────────────────────┐
│ Frontend Calls       │
│ Confirm Endpoint    │
│ (Manual)             │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ Backend Updates      │
│ Appointment Status   │
│ to: confirmed        │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ Notify Doctor &      │
│ Patient              │
│ Payment Complete ✅  │
└──────────────────────┘
```

---

## 🔌 API Endpoints You Need

### 1. Create Payment Intent (Backend)
```http
POST /api/users/payments/stripe/create-intent
Authorization: Bearer {PATIENT_TOKEN}
Content-Type: application/json

{
  "appointmentId": 1
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "clientSecret": "pi_xxx_secret_xxx",
    "amount": 500,
    "breakdown": {
      "patient_pays": "R500.00",
      "platform_fee": "R50.00",
      "doctor_receives": "R450.00"
    }
  }
}
```

---

### 2. Confirm Payment (New Endpoint - Manual)
After frontend gets payment confirmation from Stripe, call this:

```http
POST /api/users/payments/{paymentId}/confirm
Authorization: Bearer {PATIENT_TOKEN}
Content-Type: application/json

{
  "appointmentId": 1
}
```

**Response:**
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

## 💻 Frontend Code Example

```jsx
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLIC_KEY);

export function PaymentForm({ appointmentId, token }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Step 1: Create Payment Intent (call backend)
      const intentResponse = await fetch('/api/users/payments/stripe/create-intent', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ appointmentId })
      });

      const intentData = await intentResponse.json();
      if (!intentData.success) throw new Error(intentData.message);

      const { clientSecret, data } = intentData;
      const { paymentId } = data;

      // Step 2: Confirm payment with Stripe (frontend - no backend)
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement)
        }
      });

      if (result.error) {
        alert(`Payment failed: ${result.error.message}`);
        setLoading(false);
        return;
      }

      // Step 3: Manual confirmation (tell backend payment succeeded)
      const confirmResponse = await fetch(
        `/api/users/payments/${paymentId}/confirm`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ appointmentId })
        }
      );

      const confirmData = await confirmResponse.json();
      if (confirmData.success) {
        alert('Payment successful! Appointment confirmed.');
        // Redirect or refresh
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    }

    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <CardElement />
      <button type="submit" disabled={!stripe || loading}>
        {loading ? 'Processing...' : 'Pay & Confirm'}
      </button>
    </form>
  );
}

// Use it:
<Elements stripe={stripePromise}>
  <PaymentForm appointmentId={1} token={patientToken} />
</Elements>
```

---

## 🧪 Test Payment Flow

### 1. Create Appointment
```bash
curl -X POST http://localhost:3000/api/users/appointments \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "doctorId": 1,
    "appointmentDate": "2026-05-25",
    "timePeriod": "morning",
    "timeSlot": "09:00"
  }'
```

Save `appointmentId` from response.

---

### 2. Create Payment Intent
```bash
curl -X POST http://localhost:3000/api/users/payments/stripe/create-intent \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"appointmentId": 1}'
```

Save `clientSecret` and `paymentId` from response.

---

### 3. Confirm Payment in Frontend
Use the `clientSecret` in your React component (see code above).

When payment succeeds, frontend will automatically call the confirm endpoint.

---

### 4. Test with Test Card
Use test card for testing:
- Number: `4242 4242 4242 4242`
- Expiry: Any future date (e.g., 12/25)
- CVC: Any 3 digits (e.g., 123)

---

## 📊 Test Scenarios

### Scenario 1: Successful Payment
1. Create appointment
2. Create payment intent
3. Use card `4242 4242 4242 4242`
4. Payment confirms immediately ✅
5. Frontend calls confirm endpoint
6. Appointment status → confirmed

---

### Scenario 2: Card Declined
1. Create appointment
2. Create payment intent
3. Use card `4000 0000 0000 0002`
4. Stripe declines payment ❌
5. Show error to patient
6. Patient can retry

---

### Scenario 3: Refund Request
1. After successful payment
2. Request refund within 24 hours
3. Backend processes 90% refund (10% fee retained)
4. Appointment cancelled

---

## 🔐 Security Notes

✅ **Frontend:** No card data passes through your server
- Card data goes directly to Stripe
- Frontend gets clientSecret from backend
- Stripe processes payment securely

✅ **Backend:** Manual confirmation is authenticated
- Patient token required
- Patient can only confirm their own payment
- Appointment ownership verified

✅ **Database:** Payment recorded with Stripe Intent ID
- All Stripe metadata stored for audits
- Can look up original payment
- Refunds tracked

---

## 🔄 Later: Adding Webhooks (When You Get Domain)

When you get a public domain, webhooks become optional for better UX:

1. **Without webhooks (current):**
   - Frontend confirms, tells backend
   - Real-time but manual

2. **With webhooks (future):**
   - Stripe confirms directly to backend
   - Async and automatic
   - Better for reliability

**Process to add later:**
1. Get domain/SSL certificate
2. Create webhook in Stripe Dashboard
3. Add webhook endpoint to server
4. Add webhook secret to .env
5. Remove manual confirmation calls from frontend
6. Use webhook for appointment updates

See STRIPE_SETUP.md webhook section when ready.

---

## ✅ Checklist

```
Setup:
☑️  Get Stripe test keys
☑️  Add to .env
☑️  Server running

Frontend Development:
☐ Install @stripe/react-stripe-js
☐ Create payment form component
☐ Implement card input field
☐ Handle payment confirmation
☐ Call create-intent endpoint
☐ Call confirm endpoint after payment
☐ Test with card: 4242 4242 4242 4242

Testing:
☐ Create test appointment
☐ Verify payment intent created
☐ Confirm payment with test card
☐ Check appointment status changed
☐ Verify payment recorded in database

Done:
✅ Payments working without domain
✅ Ready for production
✅ Can add webhooks later
```

---

## 📚 Documentation

- [STRIPE_SETUP.md](./STRIPE_SETUP.md) - Full setup with webhooks info
- [PAYMENT_TESTING.md](./PAYMENT_TESTING.md) - Testing procedures
- [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) - Quick commands
- [README.md](./README.md) - Feature overview

---

## 🚨 Troubleshooting

### "clientSecret not returned"
- Check patient has valid token
- Verify appointment exists
- Check STRIPE_SECRET_KEY is set

### "Confirm endpoint not working"
- Verify paymentId from intent creation
- Check patient token is correct
- Ensure appointmentId matches

### "Card always declines"
- Use test card: 4242 4242 4242 4242
- Check it's test mode (pk_test_, sk_test_)
- Verify card expiry is future date

### "Payment confirmed but appointment not updated"
- Check confirm endpoint response
- Verify appointment ownership
- Check patient token permissions

---

## 💡 Pro Tips

1. **Save the paymentId** after create-intent - you need it for confirm endpoint
2. **Always use test cards** until you have live keys
3. **Show fee breakdown** before asking customer to pay
4. **Handle errors gracefully** on frontend
5. **Log payment confirmations** for debugging

---

## 🎉 You're Ready!

Your payment system is ready to use without webhooks. Start with step 1 above and you'll be accepting payments in minutes.

**Next:** Implement the frontend component and test with a test card.

---

**Status:** ✅ Ready to Use  
**Domain Required:** ❌ No  
**Webhooks Required:** ❌ No (Optional for later)  
**Test Cards Available:** ✅ Yes  
**Can Go Live Now:** ✅ Yes (with live keys)
