# 🚀 Stripe Payment - Quick Reference Card

**Bookmark this for quick access to common commands and endpoints**

---

## 📌 Quick Setup

```bash
# 1. Get test keys from https://dashboard.stripe.com
# 2. Add to .env:
STRIPE_PUBLIC_KEY=pk_test_xxx
STRIPE_SECRET_KEY=sk_test_xxx

# 3. Start server
npm run dev

# Webhooks optional - only needed when you have a public domain
```

---

## 💳 Common API Calls

### Create Payment Intent
```bash
curl -X POST http://localhost:3000/api/users/payments/stripe/create-intent \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"appointmentId": 1}'
```

### Check Payment Status
```bash
curl -X GET http://localhost:3000/api/users/payments/123/status \
  -H "Authorization: Bearer {TOKEN}"
```

### Get Fee Breakdown
```bash
curl -X GET http://localhost:3000/api/users/payments/appointment/1/breakdown \
  -H "Authorization: Bearer {TOKEN}"
```

### Request Refund
```bash
curl -X POST http://localhost:3000/api/users/payments/123/refund \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Need to reschedule"}'
```

### Get Payment Methods
```bash
curl -X GET http://localhost:3000/api/users/payments/stripe/methods \
  -H "Authorization: Bearer {TOKEN}"
```

---

## 🧪 Test Cards

| Purpose | Card | CVC | Expiry |
|---------|------|-----|--------|
| ✅ Success | 4242 4242 4242 4242 | 123 | 12/25 |
| ❌ Decline | 4000 0000 0000 0002 | 123 | 12/25 |
| ⚠️ 3D Secure | 4000 0025 0000 3155 | 123 | 12/25 |
| 🌍 Amex | 3782 822463 10005 | 123 | 12/25 |
| 🌍 Mastercard | 5555 5555 5555 4444 | 123 | 12/25 |

---

## 📊 Payment Status Codes

| Code | Meaning |
|------|---------|
| `pending` | Awaiting payment |
| `completed` | Payment received ✅ |
| `failed` | Card declined ❌ |
| `processing` | Processing payment ⏳ |
| `cancelled` | User cancelled |
| `refunded` | Refund issued |

---

## 💰 Fee Calculation

```
Appointment Cost:    R500
Platform Fee (10%):  R50  (platform keeps)
Doctor Receives:     R450 (to doctor)
Refund Amount:       R450 (if cancelled within 24h)
```

---

## 🔗 Key Files

| File | Purpose |
|------|---------|
| `services/stripeService.js` | Stripe API operations |
| `controllers/paymentController.js` | Payment endpoints |
| `models/Payment.js` | Database operations |
| `routes/userRoutes.js` | Route definitions |
| `docs/payments/STRIPE_SETUP.md` | Full setup guide |
| `docs/payments/PAYMENT_TESTING.md` | Testing guide |

---

## 🔐 Security

```
✅ Webhook signature verified
✅ Payment Intent validated
✅ No card data stored locally
✅ PCI DSS compliant
✅ Role-based access control
```

---

## 🚨 Troubleshooting

**Issue:** "STRIPE_SECRET_KEY not configured"
→ Add key to `.env` and restart

**Issue:** Webhook not received
→ Check webhook URL in Stripe Dashboard

**Issue:** Test card declined
→ Use 4242 4242 4242 4242 or check CVC

**Issue:** Payment Intent creation failed
→ Verify appointment exists and has fee

---

## 📞 Resources

- [Stripe Dashboard](https://dashboard.stripe.com)
- [Stripe API Docs](https://stripe.com/docs/api)
- [Stripe Testing](https://stripe.com/docs/testing)
- [Setup Guide](./STRIPE_SETUP.md)
- [Testing Guide](./PAYMENT_TESTING.md)

---

## ✅ Daily Checklist

```
Morning:
[ ] Server running? npm run dev
[ ] Stripe configured? Check .env
[ ] Recent errors? Check logs

Testing:
[ ] Create payment intent
[ ] Check payment status
[ ] Get fee breakdown
[ ] Frontend confirming payments?

Production:
[ ] Stripe keys correct?
[ ] SSL/TLS enabled?
[ ] Monitoring payments?

Future (When You Get Domain):
[ ] Add webhooks for real-time updates
[ ] Stripe webhook secret in .env
[ ] Webhook endpoint configured
```

---

## 📈 Database Queries

### View Payments
```sql
SELECT * FROM payments ORDER BY created_at DESC LIMIT 10;
```

### Check Doctor Earnings
```sql
SELECT doctor_id, SUM(amount * 0.9) as earnings
FROM payments WHERE payment_status = 'completed'
GROUP BY doctor_id;
```

### View Refunds
```sql
SELECT * FROM payments WHERE payment_status = 'refunded';
```

### Total Revenue
```sql
SELECT SUM(amount * 0.1) as platform_fees,
       SUM(amount * 0.9) as doctor_payments
FROM payments WHERE payment_status = 'completed';
```

---

## 🎯 Payment Flow

```
1. Patient selects appointment
2. POST /stripe/create-intent → Get clientSecret
3. Frontend confirms payment with Stripe
4. Stripe processes payment
5. Webhook event received
6. Database updated → Appointment confirmed
7. Doctor & patient notified
```

---

## 🔔 Webhook Events

```
payment_intent.succeeded    → Payment successful
payment_intent.payment_failed → Payment declined
payment_intent.canceled     → User cancelled
charge.dispute.created      → Chargeback filed
charge.refunded             → Refund processed
```

---

## 💡 Pro Tips

1. Use Stripe CLI for local webhook testing
2. Monitor webhook logs in Stripe Dashboard
3. Always verify webhook signatures
4. Keep test and live keys separate
5. Document custom fee structures
6. Set up alerts for failed payments

---

## 🚀 Quick Deploy

```bash
# 1. Get live keys from Stripe (when ready)
# 2. Update .env with live keys
# 3. Test with small payment
# 4. Monitor payments
# 5. Go live!

# Optional (Future): Add webhooks when you have a domain
# See STRIPE_SETUP.md for webhook section
```

---

## 📱 Frontend Code Snippet

```jsx
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';

export function PaymentForm({ clientSecret, token }) {
  const stripe = useStripe();
  const elements = useElements();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { error } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: elements.getElement(CardElement)
      }
    });
    if (!error) alert('Payment successful!');
  };

  return (
    <form onSubmit={handleSubmit}>
      <CardElement />
      <button type="submit">Pay</button>
    </form>
  );
}
```

---

**Last Updated:** May 18, 2026  
**Status:** ✅ Ready to Use  
**Print This:** Yes, keep handy!
