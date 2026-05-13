# Appointment Booking System Documentation

## Overview
The appointment booking system allows patients to book appointments with doctors. The flow includes doctor selection, date/time selection with time period categorization, and appointment management.

## Features

### 1. **Doctor Selection**
- View all available active doctors
- Filter doctors by specialization and location
- View doctor's consultation fee, experience, clinic details, and about paragraph (bio)
- Each doctor displays a biographical paragraph describing their background and approach

### 2. **Date & Time Selection**
- Select appointment date from today onwards (up to 90 days in advance)
- Choose time period: Morning, Afternoon, Evening, or Night
- View available time slots for each period
- Real-time slot availability checking

### 3. **Time Periods**
| Period | Time Range | Available Slots |
|--------|-----------|-----------------|
| Morning | 08:00 - 11:30 | 08:00, 08:30, 09:00, 09:30, 10:00, 10:30, 11:00, 11:30 |
| Afternoon | 12:00 - 15:30 | 12:00, 12:30, 13:00, 13:30, 14:00, 14:30, 15:00, 15:30 |
| Evening | 16:00 - 18:30 | 16:00, 16:30, 17:00, 17:30, 18:00, 18:30 |
| Night | 19:00 - 21:00 | 19:00, 19:30, 20:00, 20:30, 21:00 |

### 4. **Appointment Management**
- View all appointments
- View upcoming appointments
- Cancel appointments (up to the appointment date)
- Reschedule appointments to different dates/times
- View appointment details

## API Endpoints

### Get Booking Information
```http
GET /appointments/booking-info
```
**Description:** Get time periods and date range information for appointment booking.

**Response:**
```json
{
  "success": true,
  "message": "Booking information retrieved successfully",
  "data": {
    "timePeriods": [
      {
        "name": "morning",
        "label": "Morning",
        "timeRange": "08:00 - 11:30",
        "slots": ["08:00", "08:30", ...]
      },
      ...
    ],
    "dateRange": {
      "startDate": "2026-05-13",
      "endDate": "2026-08-11",
      "maxDaysInAdvance": 90
    }
  }
}
```

### Get Available Doctors
```http
GET /appointments/doctors
```
**Description:** Get list of all available active doctors with their biographical information and recent reviews.

**Response:**
```json
{
  "success": true,
  "message": "Available doctors retrieved successfully",
  "data": [
    {
      "id": 1,
      "firstName": "John",
      "lastName": "Doe",
      "specialization": "Cardiology",
      "experience": 10,
      "clinicName": "Health Clinic",
      "city": "Johannesburg",
      "consultationFee": 500,
      "profileImage": "...",
      "phone": "0123456789",
      "address": "123 Medical Street",
      "bio": "Dr. John Doe is a highly experienced cardiologist with over 10 years of practice specializing in preventive cardiology and heart disease management. He completed his medical degree at the University of Johannesburg and holds a Master's in Cardiology. Dr. Doe is passionate about patient education and uses a holistic approach to healthcare.",
      "rating": {
        "averageRating": 4.75,
        "totalReviews": 20,
        "highestRating": 5,
        "lowestRating": 3
      },
      "recentReviews": [
        {
          "reviewId": 1,
          "rating": 5,
          "reviewText": "Dr. Doe is excellent! Very professional and took time to explain everything.",
          "patientName": "Jane Smith",
          "isVerified": true,
          "createdAt": "2026-05-12T14:30:00Z"
        },
        {
          "reviewId": 2,
          "rating": 4,
          "reviewText": "Good consultation, very knowledgeable.",
          "patientName": "John Mclean",
          "isVerified": true,
          "createdAt": "2026-05-10T10:15:00Z"
        },
        {
          "reviewId": 3,
          "rating": 5,
          "reviewText": "Highly recommend Dr. Doe for heart health issues.",
          "patientName": "Sarah Johnson",
          "isVerified": true,
          "createdAt": "2026-05-08T16:45:00Z"
        }
      ]
    },
    ...
  ]
}
```

**Response Fields:**
- `rating`: Summary statistics for all reviews
  - `averageRating`: Average rating from all reviews (0-5)
  - `totalReviews`: Total number of reviews submitted
  - `highestRating`: Highest rating the doctor received
  - `lowestRating`: Lowest rating the doctor received
- `recentReviews`: Array of up to 5 most recent reviews
  - `reviewId`: Unique review identifier
  - `rating`: Rating given (1-5 stars)
  - `reviewText`: Patient's review text
  - `patientName`: Name of the patient who left the review
  - `isVerified`: Whether the patient has completed an appointment with this doctor
  - `createdAt`: When the review was posted

### Get Available Time Slots
```http
GET /appointments/available-slots?doctorId={id}&date={YYYY-MM-DD}&timePeriod={period}
```
**Description:** Get available time slots for a doctor on a specific date and time period.

**Query Parameters:**
- `doctorId` (required): Doctor ID
- `date` (required): Appointment date in YYYY-MM-DD format (from today onwards)
- `timePeriod` (required): One of: morning, afternoon, evening, night

**Response:**
```json
{
  "success": true,
  "message": "Available time slots retrieved successfully",
  "data": {
    "doctorId": 1,
    "date": "2026-05-20",
    "timePeriod": "morning",
    "availableSlots": ["08:00", "08:30", "09:00", "10:00"],
    "allSlots": ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30"],
    "slotsAvailable": 4,
    "totalSlots": 8,
    "slotDetails": [
      {
        "time": "08:00",
        "available": true
      },
      {
        "time": "08:30",
        "available": true
      },
      ...
    ]
  }
}
```

### Book Appointment
```http
POST /appointments/book
```
**Authentication:** Required (Patient only)

**Request Body:**
```json
{
  "doctorId": 1,
  "appointmentDate": "2026-05-20",
  "timePeriod": "morning",
  "timeSlot": "09:00",
  "reasonForVisit": "Regular checkup"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Appointment booked successfully",
  "data": {
    "appointmentId": 1,
    "doctorName": "John Doe",
    "specialization": "Cardiology",
    "date": "2026-05-20",
    "timePeriod": "morning",
    "timeSlot": "09:00",
    "consultationFee": 500,
    "status": "scheduled",
    "clinicName": "Health Clinic",
    "clinicAddress": "123 Medical Street",
    "clinicPhone": "0123456789"
  }
}
```

### Get Patient Appointments
```http
GET /appointments
```
**Authentication:** Required (Patient only)

**Response:**
```json
{
  "success": true,
  "message": "Patient appointments retrieved successfully",
  "data": {
    "total": 3,
    "appointments": [
      {
        "appointmentId": 1,
        "doctorName": "John Doe",
        "specialization": "Cardiology",
        "date": "2026-05-20",
        "timePeriod": "morning",
        "timeSlot": "09:00",
        "consultationFee": 500,
        "status": "scheduled",
        "clinicName": "Health Clinic",
        "city": "Johannesburg",
        "reasonForVisit": "Regular checkup",
        "doctorPhone": "0123456789",
        "createdAt": "2026-05-13T10:30:00Z"
      },
      ...
    ]
  }
}
```

### Get Upcoming Appointments
```http
GET /appointments/upcoming?limit=10
```
**Authentication:** Required (Patient only)

**Query Parameters:**
- `limit` (optional): Number of appointments to retrieve (default: 10)

**Response:** Same format as Get Patient Appointments but only returns future appointments.

### Get Appointment Details
```http
GET /appointments/{appointmentId}
```
**Authentication:** Required (Patient only)

**Response:**
```json
{
  "success": true,
  "message": "Appointment details retrieved successfully",
  "data": {
    "appointmentId": 1,
    "doctorName": "John Doe",
    "specialization": "Cardiology",
    "date": "2026-05-20",
    "timePeriod": "morning",
    "timeSlot": "09:00",
    "consultationFee": 500,
    "status": "scheduled",
    "reasonForVisit": "Regular checkup",
    "notes": null,
    "clinicName": "Health Clinic",
    "city": "Johannesburg",
    "doctorPhone": "0123456789",
    "createdAt": "2026-05-13T10:30:00Z",
    "updatedAt": "2026-05-13T10:30:00Z"
  }
}
```

### Cancel Appointment
```http
DELETE /appointments/{appointmentId}
```
**Authentication:** Required (Patient only)

**Response:**
```json
{
  "success": true,
  "message": "Appointment cancelled successfully",
  "data": {
    "appointmentId": 1,
    "status": "cancelled",
    "cancelledAt": "2026-05-13T10:35:00Z"
  }
}
```

### Reschedule Appointment
```http
PUT /appointments/{appointmentId}/reschedule
```
**Authentication:** Required (Patient only)

**Request Body:**
```json
{
  "newDate": "2026-05-25",
  "newTimePeriod": "afternoon",
  "newTimeSlot": "14:00"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Appointment rescheduled successfully",
  "data": {
    "appointmentId": 1,
    "newDate": "2026-05-25",
    "newTimePeriod": "afternoon",
    "newTimeSlot": "14:00",
    "status": "rescheduled",
    "rescheduledAt": "2026-05-13T10:40:00Z"
  }
}
```

## Database Schema

### Appointments Table
```sql
CREATE TABLE appointments (
  id SERIAL PRIMARY KEY,
  doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  appointment_date DATE NOT NULL,
  time_period VARCHAR(20) NOT NULL,
  time_slot VARCHAR(10) NOT NULL,
  consultation_fee DECIMAL(10, 2) NOT NULL,
  reason_for_visit TEXT,
  status VARCHAR(20) DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:**
- `idx_appointments_doctor_date`: On (doctor_id, appointment_date)
- `idx_appointments_patient_id`: On (patient_id)
- `idx_appointments_status`: On (status)
- `idx_appointments_date`: On (appointment_date)

## Appointment Statuses

| Status | Description |
|--------|-------------|
| `scheduled` | Appointment is booked and waiting |
| `completed` | Appointment has been completed |
| `cancelled` | Appointment was cancelled by patient |
| `no-show` | Patient did not show up for appointment |
| `rescheduled` | Appointment was rescheduled to a new date/time |

## Appointment Booking Flow (Frontend)

### Step 1: Get Booking Information
```javascript
// Get time periods and available date range
GET /appointments/booking-info
```

### Step 2: Display Available Doctors
```javascript
// Fetch and display list of active doctors with ratings and reviews
GET /appointments/doctors
```

Each doctor includes:
- **Bio**: Professional background and experience
- **Rating Summary**: Average rating, total reviews, high/low ratings
- **Recent Reviews**: Up to 5 most recent patient reviews with ratings and comments

### Step 3: Patient Selects Doctor
```javascript
// User clicks on a doctor to proceed
```

### Step 4: Patient Selects Date
```javascript
// Display calendar from today to 90 days in the future
// Date must be today or later
```

### Step 5: Patient Selects Time Period
```javascript
// Display 4 options: Morning, Afternoon, Evening, Night
// Show time range for each period
```

### Step 6: Check Available Slots
```javascript
// When date and time period are selected, fetch available slots
GET /appointments/available-slots?doctorId={id}&date={date}&timePeriod={period}
```

### Step 7: Patient Selects Time Slot
```javascript
// User selects from available time slots
// Display slot status (available/booked)
```

### Step 8: Optional - Add Reason for Visit
```javascript
// Allow patient to add optional reason for visit
```

### Step 9: Book Appointment
```javascript
// Submit booking request with all details
POST /appointments/book
```

### Step 10: Confirmation
```javascript
// Display booking confirmation with:
// - Doctor name and specialization
// - Date and time
// - Consultation fee
// - Clinic location and contact
```

## Error Handling

### Common Error Scenarios

1. **Invalid Date (Past Date)**
   ```json
   {
     "success": false,
     "message": "Cannot book appointment for past dates"
   }
   ```

2. **Time Slot Already Booked**
   ```json
   {
     "success": false,
     "message": "Time slot already booked. Please select another slot."
   }
   ```

3. **Doctor Not Available**
   ```json
   {
     "success": false,
     "message": "Doctor is not available for appointments"
   }
   ```

4. **Invalid Time Period**
   ```json
   {
     "success": false,
     "message": "Invalid time period. Must be one of: morning, afternoon, evening, night"
   }
   ```

5. **Booking Exceeds 90 Days**
   ```json
   {
     "success": false,
     "message": "Cannot book appointment more than 90 days in advance"
   }
   ```

## Installation & Setup

### 1. Run Database Migration
Run the migration to create the appointments table:

```javascript
// In your database initialization file (config/initDb.js or similar)
const { addAppointmentsTable } = require('./config/addAppointmentsTable');
await addAppointmentsTable();
```

### 2. Restart Server
After running the migration, restart your backend server to ensure all changes are active.

## Usage Examples

### Complete Booking Flow (Frontend Example)
```javascript
// Step 1: Get booking information
const bookingInfo = await fetch('/appointments/booking-info').then(r => r.json());

// Step 2: Get available doctors
const doctors = await fetch('/appointments/doctors').then(r => r.json());

// Step 3: User selects doctor and date
const doctorId = 1;
const appointmentDate = '2026-05-20';

// Step 4: Get available time periods with slots
const timePeriods = bookingInfo.data.timePeriods; // morning, afternoon, evening, night

// Step 5: User selects time period
const selectedPeriod = 'morning';

// Step 6: Get available slots for this combination
const slotsResponse = await fetch(
  `/appointments/available-slots?doctorId=${doctorId}&date=${appointmentDate}&timePeriod=${selectedPeriod}`,
  { headers: { 'Authorization': `Bearer ${token}` } }
).then(r => r.json());

const availableSlots = slotsResponse.data.availableSlots;

// Step 7: User selects time slot
const selectedSlot = '09:00';

// Step 8: Book appointment
const bookingResponse = await fetch('/appointments/book', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    doctorId,
    appointmentDate,
    timePeriod: selectedPeriod,
    timeSlot: selectedSlot,
    reasonForVisit: 'Regular checkup'
  })
}).then(r => r.json());

if (bookingResponse.success) {
  console.log('Appointment booked:', bookingResponse.data);
}
```

## Notes

- All dates should be in `YYYY-MM-DD` format
- Time slots are in 24-hour format (`HH:MM`)
- Patients can only cancel appointments that are on today or later (past appointments cannot be cancelled)
- Appointment consultation fee is automatically captured from the doctor's profile at booking time
- Appointments are stored in UTC timezone in the database

## Doctor Bio/About Information

The `bio` field is optional and allows doctors to provide patients with a professional biography or about paragraph. This helps patients learn about the doctor's background, experience, approach to patient care, and specializations.

### For Doctors:
- The `bio` field can be added during registration (optional) or updated later through the profile update endpoint
- Use this field to provide a compelling professional biography (typically 2-5 sentences)
- Example bio: "Dr. Jane Smith is a board-certified dermatologist with 8 years of clinical experience. She specializes in cosmetic and medical dermatology and is committed to providing personalized skincare solutions. Dr. Smith completed her medical degree at Stanford University and is an active member of the American Academy of Dermatology."

### For Patients:
- When viewing available doctors via `/appointments/doctors`, the `bio` field displays the doctor's professional background
- This information helps patients make informed decisions when selecting a healthcare provider
- The bio provides insight into the doctor's experience, specialization focus, and approach to medicine
