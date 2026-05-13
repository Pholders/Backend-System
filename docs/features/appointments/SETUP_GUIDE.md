# Appointment System Setup Guide

## Quick Start

The appointment booking system has been fully implemented. Follow these steps to activate it:

### Step 1: Initialize the Database Table

Add the appointments table migration to your database initialization file. In `config/initDb.js` or wherever you initialize tables, add:

```javascript
const { addAppointmentsTable } = require('./config/addAppointmentsTable');

// In your initialization function, add:
await addAppointmentsTable();
```

### Step 2: Restart Your Server

After running the migration, restart your backend server:

```bash
npm start
# or
node server.js
```

### Step 3: Verify Installation

Test the booking info endpoint to confirm everything is working:

```bash
curl http://localhost:YOUR_PORT/appointments/booking-info
```

You should receive a response with time periods and date range information.

## What's Included

### Models
- **Appointment.js** - Database model for appointments with methods for:
  - Creating appointments
  - Retrieving appointments (by patient, doctor, date)
  - Managing appointment status (cancel, reschedule)
  - Checking slot availability
  - Generating available time slots

### Controllers
- **appointmentController.js** - API handlers for:
  - Getting available doctors
  - Getting available time slots
  - Booking appointments
  - Managing appointments (view, cancel, reschedule)

### Routes
All appointment routes are added to `routes/userRoutes.js`:
- `GET /appointments/booking-info` - Get booking information
- `GET /appointments/doctors` - Get available doctors
- `GET /appointments/available-slots` - Get available time slots
- `POST /appointments/book` - Book an appointment
- `GET /appointments` - Get all patient appointments
- `GET /appointments/upcoming` - Get upcoming appointments
- `GET /appointments/:appointmentId` - Get appointment details
- `DELETE /appointments/:appointmentId` - Cancel appointment
- `PUT /appointments/:appointmentId/reschedule` - Reschedule appointment

### Database
- **Appointments Table** with:
  - Doctor and patient references
  - Date and time (with 30-minute slots)
  - Time period categorization (morning, afternoon, evening, night)
  - Consultation fee (captured at booking time)
  - Appointment status tracking
  - Audit timestamps

## API Summary

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/appointments/booking-info` | No | Get booking info (time periods, date range) |
| GET | `/appointments/doctors` | No | Get all available doctors |
| GET | `/appointments/available-slots` | Yes | Get available slots for a doctor |
| POST | `/appointments/book` | Yes | Book an appointment |
| GET | `/appointments` | Yes | Get all patient appointments |
| GET | `/appointments/upcoming` | Yes | Get upcoming appointments |
| GET | `/appointments/:appointmentId` | Yes | Get appointment details |
| DELETE | `/appointments/:appointmentId` | Yes | Cancel appointment |
| PUT | `/appointments/:appointmentId/reschedule` | Yes | Reschedule appointment |

## Time Slots Configuration

The system comes preconfigured with the following time periods:

```
Morning:     08:00 - 11:30 (8 slots of 30 minutes each)
Afternoon:   12:00 - 15:30 (8 slots of 30 minutes each)
Evening:     16:00 - 18:30 (6 slots of 30 minutes each)
Night:       19:00 - 21:00 (5 slots of 30 minutes each)
```

To modify time slots, edit the `getTimeSlots()` method in `models/Appointment.js`.

## Customization

### Change Booking Window
Default: 90 days in advance. To change, modify in `appointmentController.js`:

```javascript
// Line ~140
const maxDate = new Date();
maxDate.setDate(maxDate.getDate() + 90); // Change 90 to desired days
```

### Change Time Slots
Edit the `getTimeSlots()` method in `models/Appointment.js` to customize time slots per period.

### Modify Consultation Fee Capture
The system captures consultation fee from the doctor's profile at booking time. This is stored in `consultation_fee` column on the appointments table.

## Features

✅ **Doctor Selection** - View all active doctors with specialization and fees
✅ **Date Selection** - Calendar picker with minimum date (today) and maximum date (90 days)
✅ **Time Period Selection** - 4 time periods with predefined time slots
✅ **Real-time Availability** - Check slot availability instantly
✅ **Appointment Cancellation** - Cancel upcoming appointments
✅ **Appointment Rescheduling** - Reschedule to different date/time
✅ **Appointment History** - View past and upcoming appointments
✅ **Reason for Visit** - Optional field for patient to specify reason

## Testing

### Test Booking Information
```bash
curl http://localhost:3000/appointments/booking-info
```

### Test Available Doctors
```bash
curl http://localhost:3000/appointments/doctors
```

### Test Available Slots
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/appointments/available-slots?doctorId=1&date=2026-05-20&timePeriod=morning"
```

### Test Book Appointment
```bash
curl -X POST http://localhost:3000/appointments/book \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "doctorId": 1,
    "appointmentDate": "2026-05-20",
    "timePeriod": "morning",
    "timeSlot": "09:00",
    "reasonForVisit": "Regular checkup"
  }'
```

## Error Handling

The system includes comprehensive error handling for:
- Invalid dates (past dates, beyond 90 days)
- Double booking prevention (slot already taken)
- Doctor availability validation
- Invalid time period/slot validation
- Authorization checks (only patient can manage own appointments)

All errors return a `success: false` response with a descriptive message.

## Security Features

✅ **Authentication Required** - Appointment endpoints (except booking info and doctors) require patient authentication
✅ **Authorization Checks** - Patients can only view/manage their own appointments
✅ **Database Constraints** - Foreign key constraints ensure data integrity
✅ **Audit Timestamps** - created_at and updated_at for all appointments
✅ **Status Validation** - Appointment status must be one of predefined values

## Next Steps

1. Run the database migration to create the appointments table
2. Restart your server
3. Test the endpoints using the provided examples
4. Integrate with your frontend application
5. Customize time slots and booking window as needed

For detailed API documentation, see [APPOINTMENT_BOOKING.md](./APPOINTMENT_BOOKING.md)
