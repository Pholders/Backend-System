# Appointment System Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React/Vue)                     │
│                                                                   │
│  1. Date Selection → 2. Period Selection → 3. Slot Selection    │
│     (Show fully        (Show slots)           (Book appointment) │
│      booked periods)                                             │
└──────────────┬───────────────────────────────────────────────────┘
               │
        ┌──────▼──────────────────────────────────────┐
        │         API LAYER (Express.js)              │
        │                                              │
        │  ┌─────────────────────────────────────┐   │
        │  │ /appointments/day-availability      │   │
        │  │ → Shows fully booked periods        │   │
        │  └─────────────────────────────────────┘   │
        │                                              │
        │  ┌─────────────────────────────────────┐   │
        │  │ /appointments/available-slots       │   │
        │  │ → Shows available time slots        │   │
        │  └─────────────────────────────────────┘   │
        │                                              │
        │  ┌─────────────────────────────────────┐   │
        │  │ /appointments/book                  │   │
        │  │ → Creates appointment (pending)     │   │
        │  └─────────────────────────────────────┘   │
        │                                              │
        │  ┌─────────────────────────────────────┐   │
        │  │ /payments/confirm-*                 │   │
        │  │ → Confirms payment                  │   │
        │  └─────────────────────────────────────┘   │
        │                                              │
        │  ┌─────────────────────────────────────┐   │
        │  │ /appointments/auto-cancel-expired   │   │
        │  │ → Manual trigger (Admin only)       │   │
        │  └─────────────────────────────────────┘   │
        └──────────────┬───────────────────────────────┘
                       │
        ┌──────────────▼───────────────────────────────┐
        │    BUSINESS LOGIC LAYER (Controllers)        │
        │                                               │
        │  - AppointmentController                     │
        │  - PaymentController                         │
        │  - AppointmentCleanupService (Background)    │
        └──────────────┬───────────────────────────────┘
                       │
        ┌──────────────▼───────────────────────────────┐
        │      DATA ACCESS LAYER (Models)              │
        │                                               │
        │  - Appointment.getDayAvailability()          │
        │  - Appointment.getAvailableSlots()           │
        │  - Appointment.autoCancelExpiredPayments()   │
        │  - Appointment.confirmPaymentAndSchedule()   │
        └──────────────┬───────────────────────────────┘
                       │
        ┌──────────────▼───────────────────────────────┐
        │      DATABASE LAYER (PostgreSQL)             │
        │                                               │
        │  appointments table                          │
        │  ├─ status (pending_payment/scheduled/...)  │
        │  ├─ doctor_id                                │
        │  ├─ patient_id                               │
        │  ├─ appointment_date                         │
        │  ├─ time_period                              │
        │  ├─ time_slot                                │
        │  └─ consultation_fee                         │
        │                                               │
        │  payments table                              │
        │  ├─ appointment_id (FK)                      │
        │  ├─ payment_method                           │
        │  ├─ payment_status                           │
        │  └─ stripe/medical_aid details               │
        └────────────────────────────────────────────────┘
```

---

## Data Flow: Appointment Lifecycle

### Phase 1: Selection & Booking

```
1. Patient selects date
   ├─ GET /appointments/day-availability
   └─ Response: All periods with fully_booked status
   
2. Frontend shows available periods
   ├─ Fully booked periods disabled/grayed
   └─ Available periods clickable
   
3. Patient selects period
   ├─ GET /appointments/available-slots
   └─ Response: Slot-by-slot availability
   
4. Frontend shows available slots
   ├─ Booked slots disabled/grayed
   └─ Available slots clickable
   
5. Patient selects slot & provides reason
   ├─ POST /appointments/book
   ├─ Request: { doctorId, date, period, slot, reason }
   └─ Response: appointmentId, status="pending_payment"
   
6. Database Update
   ├─ INSERT appointments (status='pending_payment')
   └─ Slot now reserved ✅
```

### Phase 2: Payment & Confirmation

```
7. Patient proceeds to payment
   ├─ Stripe: Send to payment gateway
   ├─ Cash: Show clinic payment info
   └─ Medical Aid: Request insurance details
   
8. Patient confirms payment
   ├─ POST /payments/confirm-stripe (or cash/medical)
   ├─ Backend validates payment
   └─ Response: success/failure
   
9. Database Update (On Success)
   ├─ UPDATE appointments SET status='scheduled'
   ├─ UPDATE payments SET status='completed'
   └─ Appointment confirmed ✅
```

### Phase 3: Auto-Cleanup

```
10. Background Service (Every 15 mins)
    ├─ Query: SELECT appointments WHERE status='pending_payment'
    │          AND created_at < NOW() - 30 mins
    ├─ Action: UPDATE status='cancelled' for expired
    └─ Result: Slots freed for re-booking ♻️
    
11. Or Manual Admin Trigger
    ├─ POST /appointments/auto-cancel-expired
    ├─ Body: { timeoutMinutes: 30 }
    └─ Response: { cancelledCount: X }
```

### Phase 4: Appointment Completion

```
12. After appointment time
    ├─ Doctor marks: status='completed'
    ├─ System: allows patient to leave review
    └─ Slot: completely freed
```

---

## Database Query Optimization

### Critical Queries & Indexes

```sql
-- Query: Check slot availability (called frequently)
SELECT time_slot FROM appointments 
WHERE doctor_id = $1 
  AND appointment_date = $2 
  AND time_period = $3
  AND status IN ('pending_payment', 'scheduled', 'rescheduled')

-- Optimized by indexes:
CREATE INDEX idx_appointments_doctor_date ON appointments(doctor_id, appointment_date);
CREATE INDEX idx_appointments_status ON appointments(status);
```

### Availability Check Logic

```
For a specific slot:
1. Count existing appointments with same doctor/date/period/slot
   WHERE status IN ('pending_payment', 'scheduled', 'rescheduled')

2. If count = 0 → slot available ✅
   If count > 0 → slot booked ❌
```

**Why include `pending_payment`?**
- Prevents double-booking during payment window
- Reserves slot immediately when booked
- Slot freed automatically after timeout

---

## Background Service Architecture

### AppointmentCleanupService

```javascript
// Initialization (in server.js)
AppointmentCleanupService.start(
  intervalMinutes = 15,    // Run every 15 minutes
  timeoutMinutes = 30      // Cancel if pending > 30 mins
);

// Execution Flow
┌─────────────────────────────────────┐
│   Timer Triggers (Every 15 mins)    │
└──────────────┬──────────────────────┘
               │
        ┌──────▼──────────────────────┐
        │  runCleanup(30 minutes)      │
        └──────────────┬───────────────┘
                       │
        ┌──────────────▼───────────────┐
        │  Check if already running    │
        │  (Prevent overlapping)       │
        └──────────────┬───────────────┘
                       │
        ┌──────────────▼───────────────────────────┐
        │  Query expired pending appointments      │
        │  WHERE status = 'pending_payment'        │
        │    AND created_at < NOW() - 30 mins      │
        └──────────────┬───────────────────────────┘
                       │
        ┌──────────────▼───────────────────────────┐
        │  UPDATE status = 'cancelled'             │
        │  RETURNING updated rows                  │
        └──────────────┬───────────────────────────┘
                       │
        ┌──────────────▼───────────────────────────┐
        │  Log results in console                  │
        │  "✅ Auto-cancelled X appointments"      │
        └─────────────────────────────────────────┘
```

---

## Status Flow Diagram

```
                    ┌─────────────────────────┐
                    │     START: Booked       │
                    │  pending_payment ⏱️      │
                    └────────────┬────────────┘
                                 │
                        ┌────────┴────────┐
                        │                 │
                  PAYS  │                 │  TIMEOUT
                        │                 │  (30 mins)
                  ┌─────▼─────┐      ┌───▼──────────┐
                  │ scheduled  │      │  cancelled   │
                  │  ✅        │      │   ♻️ freed   │
                  └─────┬─────┘      └──────────────┘
                        │
                        │ TIME PASSES
                        │
                  ┌─────▼─────┐
                  │ completed │
                  │   ✅ END  │
                  └───────────┘
                        │
                   REVIEW? → doctor_reviews table
```

---

## Performance Considerations

### Query Performance

| Query | Frequency | Index Used | Response Time |
|-------|-----------|-----------|----------------|
| Check slot availability | Per booking | `idx_appointments_doctor_date` | < 10ms |
| Get day availability | Per date select | `idx_appointments_status` | < 50ms |
| Get all available slots | Per period select | `idx_appointments_doctor_date` | < 50ms |
| Auto-cancel expired | Every 15 mins | `idx_appointments_status` | < 100ms |

### Caching Opportunities

```javascript
// Cache day availability for 2 minutes
// (User rarely changes selected date)
cache.set(`day-availability:${doctorId}:${date}`, data, 2 * 60);

// Cache available slots for 1 minute
// (Prevents race conditions)
cache.set(`slots:${doctorId}:${date}:${period}`, slots, 60);

// Invalidate cache on:
// - New booking
// - Payment confirmation
// - Auto-cancel execution
```

---

## Error Scenarios

### Scenario 1: Double-Click Booking

```
User clicks "Book" twice quickly

System Prevents:
├─ First click: POST /book → Create appointment ✅
├─ Slot now reserved (status=pending_payment)
├─ Second click: POST /book → Check availability
├─ Query finds pending_payment for same slot
└─ Returns: "Slot already booked"
```

### Scenario 2: Payment Timeout

```
User books but doesn't pay

Timeline:
├─ 10:00 - Booked (pending_payment)
├─ 10:15 - Auto-check runs, no action (< 30 mins)
├─ 10:31 - Auto-check runs, expired
├─ Status → cancelled, slot freed
├─ 10:32 - Another user successfully books slot
└─ Original user: Can retry booking another slot
```

### Scenario 3: Manual Reschedule

```
User wants to reschedule after payment

Flow:
├─ PUT /appointments/:id/reschedule
├─ Check new slot available
├─ If available: Create new appointment with new slot
├─ Update old appointment: status='rescheduled'
└─ Old slot freed, new slot reserved
```

---

## Monitoring & Logging

```javascript
// Log on auto-cancel execution
[HH:MM:SS] 🧹 Running appointment cleanup...
[HH:MM:SS] ✅ Auto-cancelled 2 expired pending payment appointments

// Log when fully booked
[HH:MM:SS] ℹ️ Doctor 5 fully booked for 2026-05-20 afternoon

// Log on manual trigger
[HH:MM:SS] 🔄 Admin triggered auto-cancel (timeout: 30 mins)
[HH:MM:SS] ✅ Processed 5 expired appointments
```

---

## Testing Strategy

### Unit Tests
- ✅ `getDayAvailability()` returns correct fully_booked status
- ✅ `getAvailableSlots()` filters booked slots correctly
- ✅ `autoCancelExpiredPayments()` cancels only expired appointments

### Integration Tests
- ✅ Full booking flow: Date → Period → Slot → Payment → Confirmed
- ✅ Auto-cancel: Create pending → Wait 30+ mins → Verify cancelled
- ✅ Double-booking prevention: Slot unavailable after first booking

### Load Tests
- ✅ 1000 concurrent availability checks
- ✅ 500 concurrent bookings
- ✅ Auto-cancel with 10K expired appointments

---

**Architecture Version:** 1.0
**Last Updated:** May 13, 2026
**Status:** Production Ready
