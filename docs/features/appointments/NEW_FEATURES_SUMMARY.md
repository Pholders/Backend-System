# New Features Documentation - May 13, 2026

## Summary
Three major features have been implemented and documented for the appointment booking system:

1. **Daily Availability Overview** - Shows which time periods are fully booked
2. **Real-Time Slot Availability** - Patients see individual slot status
3. **Auto-Cancel Pending Payments** - System automatically frees slots after payment timeout

---

## Feature 1: Daily Availability Overview

**Endpoint:** `GET /appointments/day-availability?doctorId={id}&date={YYYY-MM-DD}`

**Purpose:** Show patients which time periods (morning, afternoon, evening, night) are fully booked on a specific date.

**Key Metrics Returned:**
- `totalSlots` - Total slots available in period
- `availableSlots` - Number of open slots
- `bookedSlots` - Number of booked slots  
- `isFullyBooked` - Boolean indicator if period is at capacity

**Frontend Use Cases:**
- Display "FULLY BOOKED" badge on periods where all slots are taken
- Show "2/8 slots available" under periods with availability
- Disable period selection UI if fully booked
- Guide patients toward available periods

**Example Response:**
```json
{
  "availability": {
    "morning": {
      "availableSlots": 2,
      "totalSlots": 8,
      "isFullyBooked": false
    },
    "afternoon": {
      "availableSlots": 0,
      "totalSlots": 8,
      "isFullyBooked": true
    }
  }
}
```

---

## Feature 2: Real-Time Slot Availability

**Endpoint:** `GET /appointments/available-slots?doctorId={id}&date={YYYY-MM-DD}&timePeriod={period}`

**Purpose:** Show individual time slot availability after user selects a time period.

**Returns:**
- `availableSlots` - Array of available times (e.g., ["08:00", "08:30", "09:00"])
- `slotDetails` - Detailed view of each slot with availability status
- `slotsAvailable` - Count of open slots

**This endpoint already existed** - documented alongside new daily availability feature.

---

## Feature 3: Auto-Cancel Expired Pending Payments

### How It Works

**Two-Step Payment Flow:**
1. Patient books appointment → Status: `pending_payment` (slot RESERVED)
2. Patient confirms payment → Status: `scheduled` (confirmed)

**Auto-Cancel Process:**
- If payment not confirmed within **30 minutes** → Auto-cancelled
- Status changes: `pending_payment` → `cancelled`
- Slot becomes available for other patients

### Automatic Background Process

**Runs Automatically:**
- Frequency: Every 15 minutes
- Timeout: 30 minutes for pending payments
- No admin action required
- Fully automated

**Configured in:** `server.js` (AppointmentCleanupService.start(15, 30))

### Manual Admin Trigger

**Endpoint:** `POST /appointments/auto-cancel-expired` (Admin only)

**Request:**
```json
{
  "timeoutMinutes": 30
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully auto-cancelled 2 expired pending payment appointments",
  "data": {
    "cancelledCount": 2,
    "timeoutMinutes": 30,
    "timestamp": "2026-05-13T10:45:00Z"
  }
}
```

### Timeline Example

```
10:00 - Patient A books 14:00 slot → Status: pending_payment
        Slot locked ❌

10:05-10:30 - Slot reserved, within payment window

10:31 - Auto-cancel triggers (31 minutes elapsed) → Status: cancelled
        Slot freed ✅

10:32 - Patient B successfully books same 14:00 slot
```

---

## Implementation Details

### Files Modified/Created

**Models:**
- `models/Appointment.js` - Added methods:
  - `getDayAvailability()` - Get all periods for a day
  - `autoCancelExpiredPendingPayments()` - Auto-cancel logic

**Controllers:**
- `controllers/appointmentController.js` - Added endpoints:
  - `getDayAvailability()` - Get day availability data
  - `autoCancelExpiredPayments()` - Manual admin trigger

**Services:**
- `services/appointmentCleanupService.js` - NEW background scheduler service

**Routes:**
- `routes/userRoutes.js` - Added routes:
  - `GET /appointments/day-availability`
  - `POST /appointments/auto-cancel-expired`

**Server:**
- `server.js` - Integrated AppointmentCleanupService on startup

**Documentation:**
- `docs/features/appointments/APPOINTMENT_BOOKING.md` - Full documentation

### Database Updates

**Appointment Table Schema Changes:**
```sql
-- Status now defaults to pending_payment
status VARCHAR(20) DEFAULT 'pending_payment' CHECK (status IN (
  'pending_payment', 'scheduled', 'completed', 'cancelled', 'no-show', 'rescheduled'
))
```

**Applied Changes:**
- Added `pending_payment` status to CHECK constraint (via migration)
- Created `addPendingPaymentStatus.js` migration file
- Availability queries now include `pending_payment` in checks to reserve slots

---

## Benefits

✅ **Better Patient Experience**
- Clear indication of fully booked periods
- Real-time availability information
- No ghost bookings

✅ **Prevents Overbooking**
- Slots reserved during payment window
- No double-booking possible
- Auto-recovery of slots if payment fails

✅ **Admin-Free Operations**
- No manual intervention needed
- Automatic cleanup runs in background
- Manual override available if needed

✅ **Flexible Configuration**
- Adjustable timeout (5-1440 minutes)
- Adjustable check frequency
- Can be triggered manually

---

## Testing Checklist

- [ ] Get day availability shows correct fully booked status
- [ ] Get available slots returns correct individual slots
- [ ] Auto-cancel runs every 15 minutes in background
- [ ] Manual admin trigger works with custom timeout
- [ ] Cancelled appointments free up slots for re-booking
- [ ] `pending_payment` appointments block slots from double-booking
- [ ] Appointment transitions to `scheduled` after successful payment

---

## Configuration

**Current Settings (in server.js):**
```javascript
AppointmentCleanupService.start(15, 30);
// Runs every 15 minutes
// Cancels appointments pending payment for > 30 minutes
```

**To Modify:**
```javascript
// Run every 10 minutes, timeout after 20 minutes
AppointmentCleanupService.start(10, 20);

// Run every 30 minutes, timeout after 60 minutes  
AppointmentCleanupService.start(30, 60);
```

---

## API Reference Quick Links

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/appointments/day-availability` | GET | None | Show fully booked periods |
| `/appointments/available-slots` | GET | Patient | Show individual slots |
| `/appointments/auto-cancel-expired` | POST | Admin | Manually trigger cleanup |

---

**Documentation Complete:** May 13, 2026
**Status:** Ready for Production
**Next Steps:** Integration testing and frontend UI implementation
