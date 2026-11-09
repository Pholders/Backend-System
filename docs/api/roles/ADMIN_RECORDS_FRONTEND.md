# Admin Records — Frontend Integration

What the admin app needs to show and manage orders, payments, appointments, prescriptions, support tickets, doctor reviews and security alerts.

**Base URL**: `https://backend-system-u8s2.onrender.com/api/users/admin`
**Auth**: every endpoint needs `Authorization: Bearer <token>`, where the token is `data.token` from `POST /api/users/admin/verify-otp`. A non-admin token gets `403`.

The full list of admin endpoints is in [ADMIN_ENDPOINTS.md](./ADMIN_ENDPOINTS.md); the same endpoints are in Swagger under **Admin records** at `/api-docs`.

---

## 1. Conventions

### Response envelope

Every response has the same shape:

```json
{ "success": true, "message": "Orders retrieved", "data": { ... } }
```

On failure `success` is `false`, and `message` is written for a person to read. You can show it to the admin as it is.

| Status | When | Body |
|---|---|---|
| `400` | A filter or body value is invalid | `{ "success": false, "message": "status must be one of: open, in_progress, resolved, closed" }` |
| `401` | No token, bad token, expired token, or the session was revoked | `{ "success": false, "message": "...", "code": "NO_TOKEN" \| "INVALID_TOKEN" \| "TOKEN_EXPIRED" }` |
| `403` | The token isn't an admin's | `{ "success": false, "message": "Access denied. Required role: admin." }` |
| `404` | The record doesn't exist | `{ "success": false, "message": "Order not found" }` |
| `409` | Replying to a closed ticket | `{ "success": false, "message": "Ticket is closed. Reopen it before replying." }` |
| `500` | Server error | `{ "success": false, "message": "Error processing orders", "error": "..." }` |

If you get `401` with `TOKEN_EXPIRED`, refresh the token. For any other `401`, send the admin back to the login page.

### Lists and pagination

Every list endpoint takes these parameters:

| Param | Default | Notes |
|---|---|---|
| `limit` | `50` | Clamped to 1–200 |
| `offset` | `0` | |

Every list response has this shape:

```json
{ "total": 137, "limit": 50, "offset": 0, "<items>": [ ... ] }
```

`total` counts every row that matches the filters, not just this page. Use it for the page count and the "137 results" label.

### Filters

- Leave out a filter, or send it empty (`?status=`), and that filter isn't applied.
- An unknown filter value gets a `400`. It never comes back as an empty list.
- `from` and `to` are **South African calendar dates** in the form `YYYY-MM-DD`, and both days are included. `from` must not be after `to`.
- Ids must be positive integers.

### Timestamps and money

- Timestamps are ISO-8601 instants. Format them in `Africa/Johannesburg`.
- `appointment_date` is a plain date (`"2026-11-12"`). Don't run it through time-zone conversion.
- Money values are numbers in **ZAR** (`"total_amount": 350.5`).

### Fields the backend never sends

Clinical text (diagnosis, clinical notes, reason for visit, doctor notes, medicine names), ID numbers, medical-aid numbers, signatures and QR tokens are never sent. Don't build UI that expects them.

---

## 2. Orders

### `GET /orders`

| Filter | Values |
|---|---|
| `status` | `pending`, `accepted`, `awaiting_claim`, `claim_approved`, `claim_rejected`, `preparing`, `ready`, `picked_up`, `cancelled`, `rejected` |
| `payment_type` | `cash`, `medical_aid` |
| `pharmacy_id`, `patient_id` | integer |
| `from`, `to` | date the order was created |

Newest first. Example response:

```json
{
  "total": 15, "limit": 50, "offset": 0,
  "orders": [
    {
      "id": 42,
      "status": "ready",
      "payment_type": "medical_aid",
      "fulfillment_type": "pickup",
      "total_amount": 350.5,
      "patient_responsibility": 50,
      "prescription_id": 17,
      "prescription_number": "RX-2026-000017",
      "patient_id": 8, "patient_name": "Thandi Nkosi", "patient_email": "thandi@example.com",
      "pharmacy_id": 3, "pharmacy_name": "Greenside Pharmacy",
      "created_at": "2026-11-08T09:14:02.000Z",
      "updated_at": "2026-11-08T11:40:10.000Z",
      "completed_at": null,
      "cancelled_at": null
    }
  ]
}
```

### `GET /orders/:orderId`

Returns everything in the list row, plus:

```json
{
  "pharmacy_notes": "Out of stock, ordered in",
  "cancellation_reason": null,
  "rejection_reason": null,
  "restocking_fee_amount": null,
  "payment_id": null,
  "stripe_payment_intent_id": null,
  "accepted_at": "...", "prepared_at": "...", "ready_at": "...",
  "status_history": [
    { "id": 1, "from_status": null, "to_status": "pending", "actor_type": "patient", "actor_id": 8, "notes": null, "created_at": "..." },
    { "id": 2, "from_status": "pending", "to_status": "accepted", "actor_type": "pharmacy", "actor_id": 3, "notes": null, "created_at": "..." }
  ]
}
```

`status_history` is oldest first, so you can render it as a timeline as it comes.

---

## 3. Payments

### `GET /payments`

| Filter | Values |
|---|---|
| `status` | `pending`, `completed`, `failed`, `cancelled` |
| `method` | `stripe`, `cash_on_arrival`, `medical_aid` |
| `patient_id`, `doctor_id` | integer |
| `from`, `to` | date the payment was created |

```json
{
  "total": 38, "limit": 50, "offset": 0,
  "totals": {
    "currency": "ZAR",
    "by_status": {
      "completed": { "count": 30, "amount": 15400 },
      "failed":    { "count": 3,  "amount": 1500 }
    }
  },
  "payments": [
    {
      "id": 91, "amount": 500, "payment_method": "stripe", "payment_status": "completed",
      "appointment_id": 27,
      "patient_id": 8, "patient_name": "Thandi Nkosi", "patient_email": "thandi@example.com",
      "doctor_id": 5, "doctor_name": "Sipho Dlamini",
      "medical_aid_provider": null,
      "stripe_payment_intent_id": "pi_...", "stripe_transaction_id": "ch_...",
      "receipt_url": "https://...",
      "created_at": "...", "updated_at": "..."
    }
  ]
}
```

`totals.by_status` covers the whole filtered set, not just this page, so it suits summary cards above the table. A status with no matching payments is **missing** from `by_status`, not zero. Treat a missing status as 0.

### `GET /payments/:paymentId`

Returns the same fields as a list row, plus `notes`.

---

## 4. Appointments

### `GET /appointments`

| Filter | Values |
|---|---|
| `status` | `pending_payment`, `scheduled`, `completed`, `cancelled`, `no-show`, `rescheduled` |
| `payment_status` | `pending`, `completed`, `failed`, `cancelled` |
| `doctor_id`, `patient_id` | integer |
| `from`, `to` | the **appointment date**, not the booking date |

Sorted by appointment date, latest first.

```json
{
  "id": 27,
  "appointment_date": "2026-11-12",
  "time_period": "morning",
  "time_slot": "09:30",
  "status": "scheduled",
  "consultation_fee": 500,
  "payment_status": "completed",
  "payment_method": "stripe",
  "doctor_accepted": true,
  "doctor_accepted_at": "...",
  "patient_id": 8, "patient_name": "Thandi Nkosi", "patient_email": "thandi@example.com",
  "doctor_id": 5, "doctor_name": "Sipho Dlamini",
  "created_at": "...", "updated_at": "..."
}
```

### `GET /appointments/:appointmentId`

Returns the same fields, plus:

```json
{
  "payments":      [ { "id": 91, "amount": 500, "payment_method": "stripe", "payment_status": "completed", "created_at": "..." } ],
  "prescriptions": [ { "id": 17, "prescription_number": "RX-2026-000017", "signature_status": "signed", "created_at": "..." } ]
}
```

To link to these, open them with `GET /payments/:id` and `GET /prescriptions/:id`.

---

## 5. Prescriptions

### `GET /prescriptions`

| Filter | Values |
|---|---|
| `state` | `pending`, `active`, `dispensed`, `revoked` |
| `doctor_id`, `patient_id` | integer |
| `from`, `to` | date the prescription was created |

`state` is worked out by the backend. Each prescription has exactly one state, so the four states add up to the total:

| state | Meaning | Suggested badge |
|---|---|---|
| `pending` | Not signed yet | grey |
| `active` | Signed, and can still be filled | green |
| `dispensed` | Dispensed, or collected through an order | blue |
| `revoked` | Revoked by the doctor | red |

```json
{
  "id": 17,
  "prescription_number": "RX-2026-000017",
  "signature_status": "signed",
  "state": "active",
  "is_revoked": false, "revoke_reason": null, "revoked_at": null,
  "is_dispensed": false, "dispensed_at": null,
  "dispensed_by_pharmacy_id": null, "dispensed_by_pharmacy_name": null,
  "claimed": true, "claimed_at": "...", "claim_expires_at": "...",
  "claimed_by_pharmacy_id": "3", "claimed_by_pharmacy_name": "Greenside Pharmacy",
  "item_count": 2,
  "appointment_id": 27,
  "patient_id": 8, "patient_name": "Thandi Nkosi",
  "doctor_id": 5, "doctor_name": "Sipho Dlamini",
  "signed_at": "...", "created_at": "...", "updated_at": "..."
}
```

`item_count` is the number of medicines. The medicines themselves are not sent.

### `GET /prescriptions/:prescriptionId`

Returns the same fields, plus `orders: [{ id, status, pharmacy_id, pharmacy_name, created_at }]`.

> Every call to this endpoint is written to the audit log with the admin's name. Call it only when the admin actually opens a prescription. Don't prefetch it, and don't call it on hover.

---

## 6. Support tickets

### `GET /support/tickets`

| Filter | Values |
|---|---|
| `status` | `open`, `in_progress`, `resolved`, `closed` |
| `priority` | `low`, `normal`, `high`, `urgent` |
| `category` | `general`, `billing`, `medical`, `technical`, `account`, `contact` |
| `search` | Text matched against subject and email (case-insensitive, at most 100 characters) |

The list comes already sorted as an inbox: open tickets first, then in progress, then the rest; within each group, by priority (urgent first), then newest. Show it in the order you receive it.

```json
{
  "id": 12,
  "patient_id": 8,
  "email": "thandi@example.com",
  "first_name": "Thandi", "last_name": "Nkosi",
  "category": "billing",
  "subject": "Charged twice",
  "status": "open",
  "priority": "normal",
  "reply_count": 0,
  "resolved_at": null,
  "created_at": "...", "updated_at": "..."
}
```

`patient_id` is `null` when the ticket came from someone who wasn't logged in, such as a visitor or a doctor using the contact form.

### `GET /support/tickets/:ticketId`

Returns the same fields, plus:

```json
{
  "message": "I was charged twice for my appointment on ...",
  "ip_address": "102.x.x.x",
  "user_agent": "Mozilla/5.0 ...",
  "replies": [
    { "id": 3, "admin_id": 1, "admin_name": "Admin User", "message": "Hi Thandi, ...", "email_sent": true, "created_at": "..." }
  ]
}
```

`message` is plain text. Render it with `white-space: pre-wrap`, and don't render it as HTML. `replies` is oldest first, so it reads as a conversation.

### `PATCH /support/tickets/:ticketId`

```json
{ "status": "resolved" }
{ "priority": "urgent" }
{ "status": "in_progress", "priority": "high" }
```

Send at least one of `status` or `priority`. The response's `data` is the updated ticket, including its replies, so you can replace your local copy with it.

How `resolved_at` changes:

- Moving to `resolved` or `closed` sets it.
- Moving back to `open` or `in_progress` clears it.

### `POST /support/tickets/:ticketId/replies`

Request body:

```json
{ "message": "Hi Thandi, we've refunded the duplicate charge." }
```

- `message` is required, and can be at most 5000 characters. It's sent as plain text; any HTML is shown as text, not run.
- The reply is emailed to the ticket's `email`. If the person replies to that email, it goes to the support inbox, not back into this ticket.
- Replying to an `open` ticket moves it to `in_progress`.
- Replying to a `closed` ticket gets `409`. Reopen the ticket with `PATCH` first.

Response (`201`):

```json
{
  "success": true,
  "message": "Reply sent",
  "data": { "email_sent": true, "ticket": { "...": "full ticket with replies" } }
}
```

If `email_sent` is `false`, the reply was **saved but not emailed**, and `message` says `"Reply saved, but the email could not be sent"`. Show a warning, not an error. The reply also comes back with `email_sent: false` in `replies`, so you can mark it in the conversation. Don't resend automatically, because that would save a duplicate reply.

---

## 7. Doctor reviews

### `GET /reviews`

| Filter | Values |
|---|---|
| `doctor_id`, `patient_id` | integer |
| `rating` | `1`–`5` |
| `hidden` | `true` / `false` |

```json
{
  "id": 4,
  "rating": 1,
  "review_text": "...",
  "is_verified": false,
  "is_hidden": false, "hidden_at": null, "hidden_by": null, "hidden_reason": null,
  "doctor_id": 5, "doctor_name": "Sipho Dlamini",
  "patient_id": 8, "patient_name": "Thandi Nkosi",
  "created_at": "...", "updated_at": "..."
}
```

### `PATCH /reviews/:reviewId/visibility`

Request body to hide a review:

```json
{ "hidden": true, "reason": "Abusive language" }
```

Request body to show it again:

```json
{ "hidden": false }
```

`reason` is required when hiding, and can be at most 500 characters. Ask for it in the confirm dialog.

A hidden review disappears from the doctor's public page, review count and average rating. The patient who wrote it still sees it in their own reviews. Showing the review again clears `hidden_at`, `hidden_by` and `hidden_reason`.

The response's `data` is the updated review.

### `DELETE /reviews/:reviewId`

Deletes the review permanently and returns `{ "id": 4 }`. This can't be undone, so offer **Hide** as the main action and put **Delete** behind a confirm dialog.

---

## 8. Security alerts

### `GET /security/alerts/stats`

For the header cards:

```json
{
  "last_24_hours": { "total": 5, "unreviewed": 4, "critical": 2, "high": 1, "affected_users": 3 },
  "last_7_days":   { "total": 21, "unreviewed": 9, "critical": 4, "high": 6, "affected_users": 11 },
  "unreviewed_critical_or_high": 7
}
```

`unreviewed_critical_or_high` covers all time, not just these windows, so it works as the badge count on the nav item.

### `GET /security/alerts`

| Filter | Values |
|---|---|
| `status` | `unreviewed`, `verified_legit`, `verified_threat`, `dismissed` |
| `severity` | `CRITICAL`, `HIGH`, `MEDIUM`, `LOW` |
| `alert_type` | e.g. `IMPOSSIBLE_TRAVEL`, `NEW_LOCATION`, `NEW_DEVICE`, `PATTERN_ANOMALY`, `UNUSUAL_COUNTRY_PATTERN`, `TIMEZONE_ANOMALY`, `PASSWORD_CHANGED`, `MULTIPLE_FAILURES`, `ACCOUNT_LOCKOUT` |
| `user_type` | `patient`, `doctor`, `pharmacy`, `admin` |
| `user_id` | integer. Needs `user_type` too, because a patient and a doctor can have the same id |
| `hours` | Only alerts from the last N hours (1–8760) |

Sorted most severe first, then newest.

```json
{
  "id": 77,
  "user_id": 8, "user_type": "patient", "email": "thandi@example.com",
  "alert_type": "IMPOSSIBLE_TRAVEL",
  "severity": "CRITICAL",
  "risk_score": 90,
  "alert_message": "Login from Lagos 20 minutes after Johannesburg",
  "location_data": { "...": "..." },
  "device_data": { "...": "..." },
  "ip_address": "...",
  "status": "unreviewed",
  "user_response": null, "user_response_at": null,
  "admin_notes": null, "admin_action_at": null, "action_taken": null,
  "email_sent": true,
  "requires_user_verification": false,
  "verified_at": null,
  "created_at": "...", "updated_at": "..."
}
```

`user_response` holds what the account owner said when asked "was this you?", if they answered.

### `GET /security/alerts/:alertId`

Returns one alert, with the same fields as a list row.

### `POST /security/alerts/:alertId/review`

Request body:

```json
{ "status": "verified_threat", "adminNotes": "Confirmed with user by phone", "actionTaken": "Sessions revoked" }
```

`status` is required and must be one of `verified_legit`, `verified_threat` or `dismissed`. `adminNotes` and `actionTaken` are optional.

The response's `data` is the updated alert, plus `sessions_revoked` (a number).

> ⚠️ `verified_threat` **signs that account out of every device** and emails its owner. Put it behind a confirm dialog that says so.

### `POST /security/alerts/bulk-review`

Request body:

```json
{ "alertIds": [77, 78, 81], "status": "dismissed", "actionReason": "Known VPN" }
```

You can send up to 200 ids. Response:

```json
{ "updated_count": 2, "not_found": [81], "sessions_revoked": 0 }
```

If an account has several alerts in the batch, a `verified_threat` here still emails its owner only once. Refetch the list after a bulk action.

### `GET /security/suspicious-users?hours=24&threshold=3`

Lists accounts that have at least `threshold` unreviewed CRITICAL alerts in the last `hours`:

```json
{
  "hours": 24, "threshold": 3, "count": 1,
  "users": [
    { "user_id": 8, "user_type": "patient", "email": "thandi@example.com",
      "alert_count": 4, "critical_count": 3, "avg_risk_score": 85,
      "latest_alert": "...", "alert_types": ["IMPOSSIBLE_TRAVEL", "NEW_DEVICE"] }
  ]
}
```

To drill into one account, call `GET /security/alerts?user_type=patient&user_id=8`.

### `GET /security/report?from=2026-10-01&to=2026-10-31`

Both dates are optional. Without them the report covers the last 30 days.

```json
{
  "period": { "from": "2026-10-01", "to": "2026-10-31" },
  "report": [
    { "date": "2026-10-31", "alert_type": "NEW_DEVICE", "severity": "MEDIUM", "count": 3, "confirmed_threats": 0, "avg_risk_score": 40 }
  ]
}
```

The report has one row per day, alert type and severity. Days with no alerts have **no row**, so fill the gaps with zeros if you chart it.

---

## 9. Drop-in client

A small `fetch` wrapper that covers all of the above. Adapt `getToken` and `onUnauthorized` to the app's auth store.

```js
const BASE = 'https://backend-system-u8s2.onrender.com/api/users/admin';

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message || `Request failed (${status})`);
    this.status = status;
    this.code = body?.code;
  }
}

export function createAdminRecordsApi({ getToken, onUnauthorized }) {
  async function request(method, path, { query, body } = {}) {
    const qs = new URLSearchParams(
      Object.entries(query || {}).filter(([, v]) => v !== undefined && v !== null && v !== '')
    ).toString();
    const res = await fetch(`${BASE}${path}${qs ? `?${qs}` : ''}`, {
      method,
      headers: {
        Authorization: `Bearer ${getToken()}`,
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const json = await res.json().catch(() => null);
    if (res.status === 401) onUnauthorized?.(json?.code);
    if (!res.ok || !json?.success) throw new ApiError(res.status, json);
    return json.data;
  }

  const get = (path, query) => request('GET', path, { query });

  return {
    // Orders and payments
    listOrders: (q) => get('/orders', q),
    getOrder: (id) => get(`/orders/${id}`),
    listPayments: (q) => get('/payments', q),
    getPayment: (id) => get(`/payments/${id}`),

    // Appointments and prescriptions
    listAppointments: (q) => get('/appointments', q),
    getAppointment: (id) => get(`/appointments/${id}`),
    listPrescriptions: (q) => get('/prescriptions', q),
    getPrescription: (id) => get(`/prescriptions/${id}`), // audit-logged

    // Support
    listTickets: (q) => get('/support/tickets', q),
    getTicket: (id) => get(`/support/tickets/${id}`),
    updateTicket: (id, { status, priority }) =>
      request('PATCH', `/support/tickets/${id}`, { body: { status, priority } }),
    replyToTicket: (id, message) =>
      request('POST', `/support/tickets/${id}/replies`, { body: { message } }), // → { email_sent, ticket }

    // Reviews
    listReviews: (q) => get('/reviews', q),
    hideReview: (id, reason) =>
      request('PATCH', `/reviews/${id}/visibility`, { body: { hidden: true, reason } }),
    showReview: (id) =>
      request('PATCH', `/reviews/${id}/visibility`, { body: { hidden: false } }),
    deleteReview: (id) => request('DELETE', `/reviews/${id}`),

    // Security alerts
    getAlertStats: () => get('/security/alerts/stats'),
    listAlerts: (q) => get('/security/alerts', q),
    getAlert: (id) => get(`/security/alerts/${id}`),
    reviewAlert: (id, { status, adminNotes, actionTaken }) =>
      request('POST', `/security/alerts/${id}/review`, { body: { status, adminNotes, actionTaken } }),
    bulkReviewAlerts: (alertIds, status, actionReason) =>
      request('POST', '/security/alerts/bulk-review', { body: { alertIds, status, actionReason } }),
    getSuspiciousUsers: (q) => get('/security/suspicious-users', q),
    getAlertReport: (q) => get('/security/report', q)
  };
}
```

Usage:

```js
const api = createAdminRecordsApi({
  getToken: () => localStorage.getItem('adminToken'),
  onUnauthorized: (code) => { if (code !== 'TOKEN_EXPIRED') window.location.assign('/admin/login'); }
});

const { total, orders } = await api.listOrders({ status: 'ready', from: '2026-11-01', limit: 25, offset: 0 });

try {
  const { email_sent } = await api.replyToTicket(12, 'We have refunded the duplicate charge.');
  if (!email_sent) toast.warn('Reply saved, but the email could not be sent.');
} catch (e) {
  if (e.status === 409) toast.error('Reopen the ticket before replying.');
  else toast.error(e.message);
}
```

---

## 10. Not available yet

Don't build controls for these yet:

- **Orders, payments, appointments and prescriptions are view-only.** There is no endpoint to cancel an order, refund a payment, or cancel an appointment.
- Ticket replies are **outbound only**. When the person answers the email, the answer lands in the support inbox and doesn't appear in `replies`.
- There is no CSV export. Page through the list endpoints (at most `limit=200` per call) if you need one.
