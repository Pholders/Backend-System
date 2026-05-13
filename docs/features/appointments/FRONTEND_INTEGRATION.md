# Frontend Integration Guide - Appointment Booking

This guide shows you how to integrate the appointment booking system into your frontend application.

## Frontend Flow Overview

```
1. Load Booking Info
   ↓
2. Display Available Doctors
   ↓
3. Patient Selects Doctor
   ↓
4. Display Calendar (Today to +90 days)
   ↓
5. Patient Selects Date
   ↓
6. Display Time Periods (Morning/Afternoon/Evening/Night)
   ↓
7. Patient Selects Time Period
   ↓
8. Fetch & Display Available Slots
   ↓
9. Patient Selects Time Slot
   ↓
10. (Optional) Add Reason for Visit
    ↓
11. Confirm & Book Appointment
    ↓
12. Show Confirmation
```

## Step-by-Step Implementation

### Step 1: Create Appointment Service

Create a new service file `appointmentService.js`:

```javascript
// appointmentService.js
const API_BASE_URL = 'http://localhost:3000'; // Update with your API URL

export const appointmentService = {
  // Get booking information
  async getBookingInfo() {
    const response = await fetch(`${API_BASE_URL}/appointments/booking-info`);
    return response.json();
  },

  // Get available doctors
  async getAvailableDoctors() {
    const response = await fetch(`${API_BASE_URL}/appointments/doctors`);
    return response.json();
  },

  // Get available time slots
  async getAvailableSlots(doctorId, date, timePeriod, token) {
    const params = new URLSearchParams({
      doctorId,
      date,
      timePeriod
    });
    const response = await fetch(
      `${API_BASE_URL}/appointments/available-slots?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    return response.json();
  },

  // Book appointment
  async bookAppointment(appointmentData, token) {
    const response = await fetch(`${API_BASE_URL}/appointments/book`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(appointmentData)
    });
    return response.json();
  },

  // Get all appointments
  async getAppointments(token) {
    const response = await fetch(`${API_BASE_URL}/appointments`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return response.json();
  },

  // Get upcoming appointments
  async getUpcomingAppointments(token, limit = 10) {
    const response = await fetch(`${API_BASE_URL}/appointments/upcoming?limit=${limit}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return response.json();
  },

  // Get appointment details
  async getAppointmentDetails(appointmentId, token) {
    const response = await fetch(`${API_BASE_URL}/appointments/${appointmentId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return response.json();
  },

  // Cancel appointment
  async cancelAppointment(appointmentId, token) {
    const response = await fetch(`${API_BASE_URL}/appointments/${appointmentId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return response.json();
  },

  // Reschedule appointment
  async rescheduleAppointment(appointmentId, rescheduleData, token) {
    const response = await fetch(`${API_BASE_URL}/appointments/${appointmentId}/reschedule`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(rescheduleData)
    });
    return response.json();
  }
};
```

### Step 2: Doctor Selection Component

```javascript
// DoctorSelectionComponent.js
import React, { useState, useEffect } from 'react';
import { appointmentService } from './appointmentService';

export const DoctorSelection = ({ onDoctorSelect, onClose }) => {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDoctors();
  }, []);

  const loadDoctors = async () => {
    try {
      setLoading(true);
      const response = await appointmentService.getAvailableDoctors();
      if (response.success) {
        setDoctors(response.data);
      } else {
        setError(response.message);
      }
    } catch (err) {
      setError('Failed to load doctors');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading doctors...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="doctor-selection">
      <h2>Select a Doctor</h2>
      <div className="doctors-grid">
        {doctors.map(doctor => (
          <div key={doctor.id} className="doctor-card">
            {doctor.profileImage && <img src={doctor.profileImage} alt={doctor.firstName} />}
            <h3>{doctor.firstName} {doctor.lastName}</h3>
            <p className="specialization">{doctor.specialization}</p>
            <p className="experience">Experience: {doctor.experience} years</p>
            <p className="clinic">{doctor.clinicName}</p>
            <p className="city">{doctor.city}</p>
            <p className="fee">Fee: R {doctor.consultationFee}</p>
            <p className="phone">{doctor.phone}</p>
            <button onClick={() => onDoctorSelect(doctor)}>
              Select Doctor
            </button>
          </div>
        ))}
      </div>
      <button onClick={onClose}>Cancel</button>
    </div>
  );
};
```

### Step 3: Date & Time Period Selection

```javascript
// DateTimeSelection.js
import React, { useState } from 'react';

export const DateTimeSelection = ({ doctor, bookingInfo, onNext, onBack }) => {
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('');

  const today = new Date().toISOString().split('T')[0];
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 90);
  const maxDateStr = maxDate.toISOString().split('T')[0];

  const handleNext = () => {
    if (selectedDate && selectedPeriod) {
      onNext({
        doctorId: doctor.id,
        date: selectedDate,
        timePeriod: selectedPeriod
      });
    } else {
      alert('Please select both date and time period');
    }
  };

  return (
    <div className="date-time-selection">
      <div className="step-back">
        <button onClick={onBack}>← Back</button>
      </div>

      <div className="doctor-info">
        <h3>{doctor.firstName} {doctor.lastName}</h3>
        <p>{doctor.specialization}</p>
      </div>

      <div className="date-picker">
        <label>Select Date:</label>
        <input
          type="date"
          min={today}
          max={maxDateStr}
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
      </div>

      <div className="time-period-picker">
        <label>Select Time Period:</label>
        <div className="periods">
          {bookingInfo.timePeriods.map(period => (
            <div key={period.name} className="period-option">
              <input
                type="radio"
                id={period.name}
                name="timePeriod"
                value={period.name}
                checked={selectedPeriod === period.name}
                onChange={(e) => setSelectedPeriod(e.target.value)}
              />
              <label htmlFor={period.name}>
                <strong>{period.label}</strong>
                <br />
                <small>{period.timeRange}</small>
              </label>
            </div>
          ))}
        </div>
      </div>

      <button onClick={handleNext} disabled={!selectedDate || !selectedPeriod}>
        Select Time Slot →
      </button>
    </div>
  );
};
```

### Step 4: Time Slot Selection

```javascript
// TimeSlotSelection.js
import React, { useState, useEffect } from 'react';
import { appointmentService } from './appointmentService';

export const TimeSlotSelection = ({ doctor, date, timePeriod, token, onNext, onBack }) => {
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSlots();
  }, [doctor.id, date, timePeriod]);

  const loadSlots = async () => {
    try {
      setLoading(true);
      const response = await appointmentService.getAvailableSlots(
        doctor.id,
        date,
        timePeriod,
        token
      );
      if (response.success) {
        setSlots(response.data.slotDetails);
      } else {
        setError(response.message);
      }
    } catch (err) {
      setError('Failed to load available slots');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (selectedSlot) {
      onNext(selectedSlot);
    } else {
      alert('Please select a time slot');
    }
  };

  if (loading) return <div>Loading available slots...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="time-slot-selection">
      <div className="step-back">
        <button onClick={onBack}>← Back</button>
      </div>

      <div className="appointment-summary">
        <h3>{doctor.firstName} {doctor.lastName}</h3>
        <p>{date} - {timePeriod.charAt(0).toUpperCase() + timePeriod.slice(1)}</p>
      </div>

      <div className="slots-grid">
        {slots.map((slot, index) => (
          <button
            key={index}
            className={`slot-button ${slot.available ? 'available' : 'booked'}`}
            disabled={!slot.available}
            onClick={() => setSelectedSlot(slot.time)}
          >
            <input
              type="radio"
              name="timeSlot"
              value={slot.time}
              checked={selectedSlot === slot.time}
              disabled={!slot.available}
            />
            <span>{slot.time}</span>
          </button>
        ))}
      </div>

      <button onClick={handleNext} disabled={!selectedSlot}>
        Continue →
      </button>
    </div>
  );
};
```

### Step 5: Booking Confirmation

```javascript
// BookingConfirmation.js
import React, { useState } from 'react';
import { appointmentService } from './appointmentService';

export const BookingConfirmation = ({
  doctor,
  date,
  timePeriod,
  timeSlot,
  token,
  onSuccess,
  onBack
}) => {
  const [reasonForVisit, setReasonForVisit] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleBooking = async () => {
    try {
      setLoading(true);
      const response = await appointmentService.bookAppointment(
        {
          doctorId: doctor.id,
          appointmentDate: date,
          timePeriod,
          timeSlot,
          reasonForVisit: reasonForVisit || undefined
        },
        token
      );

      if (response.success) {
        onSuccess(response.data);
      } else {
        setError(response.message);
      }
    } catch (err) {
      setError('Failed to book appointment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="booking-confirmation">
      <div className="step-back">
        <button onClick={onBack}>← Back</button>
      </div>

      <h2>Confirm Appointment</h2>

      <div className="confirmation-details">
        <div className="detail">
          <label>Doctor:</label>
          <p>{doctor.firstName} {doctor.lastName}</p>
        </div>
        <div className="detail">
          <label>Specialization:</label>
          <p>{doctor.specialization}</p>
        </div>
        <div className="detail">
          <label>Clinic:</label>
          <p>{doctor.clinicName}</p>
        </div>
        <div className="detail">
          <label>Address:</label>
          <p>{doctor.address}</p>
        </div>
        <div className="detail">
          <label>Phone:</label>
          <p>{doctor.phone}</p>
        </div>

        <hr />

        <div className="detail">
          <label>Date:</label>
          <p>{date}</p>
        </div>
        <div className="detail">
          <label>Time:</label>
          <p>{timeSlot} ({timePeriod})</p>
        </div>
        <div className="detail">
          <label>Consultation Fee:</label>
          <p className="fee">R {doctor.consultationFee}</p>
        </div>
      </div>

      <div className="reason-for-visit">
        <label htmlFor="reason">Reason for Visit (Optional):</label>
        <textarea
          id="reason"
          value={reasonForVisit}
          onChange={(e) => setReasonForVisit(e.target.value)}
          placeholder="Describe the reason for your visit"
          rows="4"
        />
      </div>

      {error && <div className="error">{error}</div>}

      <button
        onClick={handleBooking}
        disabled={loading}
        className="confirm-button"
      >
        {loading ? 'Booking...' : 'Confirm Booking'}
      </button>
    </div>
  );
};
```

### Step 6: Main Booking Component

```javascript
// AppointmentBooking.js
import React, { useState, useEffect } from 'react';
import { DoctorSelection } from './DoctorSelectionComponent';
import { DateTimeSelection } from './DateTimeSelection';
import { TimeSlotSelection } from './TimeSlotSelection';
import { BookingConfirmation } from './BookingConfirmation';
import { appointmentService } from './appointmentService';

export const AppointmentBooking = ({ token, onClose }) => {
  const [currentStep, setCurrentStep] = useState('doctors'); // doctors, date, slots, confirm, success
  const [bookingInfo, setBookingInfo] = useState(null);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [bookedAppointment, setBookedAppointment] = useState(null);

  useEffect(() => {
    loadBookingInfo();
  }, []);

  const loadBookingInfo = async () => {
    try {
      const response = await appointmentService.getBookingInfo();
      if (response.success) {
        setBookingInfo(response.data);
      }
    } catch (err) {
      console.error('Failed to load booking info:', err);
    }
  };

  const handleDoctorSelect = (doctor) => {
    setSelectedDoctor(doctor);
    setCurrentStep('date');
  };

  const handleDateTimeNext = (data) => {
    setSelectedDate(data.date);
    setSelectedPeriod(data.timePeriod);
    setCurrentStep('slots');
  };

  const handleSlotSelect = (slot) => {
    setSelectedSlot(slot);
    setCurrentStep('confirm');
  };

  const handleBookingSuccess = (appointment) => {
    setBookedAppointment(appointment);
    setCurrentStep('success');
  };

  const handleBack = () => {
    if (currentStep === 'date') setCurrentStep('doctors');
    if (currentStep === 'slots') setCurrentStep('date');
    if (currentStep === 'confirm') setCurrentStep('slots');
  };

  if (!bookingInfo) return <div>Loading...</div>;

  return (
    <div className="appointment-booking-modal">
      <div className="modal-content">
        {currentStep === 'doctors' && (
          <DoctorSelection onDoctorSelect={handleDoctorSelect} onClose={onClose} />
        )}

        {currentStep === 'date' && (
          <DateTimeSelection
            doctor={selectedDoctor}
            bookingInfo={bookingInfo}
            onNext={handleDateTimeNext}
            onBack={handleBack}
          />
        )}

        {currentStep === 'slots' && (
          <TimeSlotSelection
            doctor={selectedDoctor}
            date={selectedDate}
            timePeriod={selectedPeriod}
            token={token}
            onNext={handleSlotSelect}
            onBack={handleBack}
          />
        )}

        {currentStep === 'confirm' && (
          <BookingConfirmation
            doctor={selectedDoctor}
            date={selectedDate}
            timePeriod={selectedPeriod}
            timeSlot={selectedSlot}
            token={token}
            onSuccess={handleBookingSuccess}
            onBack={handleBack}
          />
        )}

        {currentStep === 'success' && (
          <div className="booking-success">
            <h2>✓ Appointment Booked Successfully!</h2>
            <div className="success-details">
              <p><strong>Appointment ID:</strong> {bookedAppointment.appointmentId}</p>
              <p><strong>Doctor:</strong> {bookedAppointment.doctorName}</p>
              <p><strong>Date & Time:</strong> {bookedAppointment.date} at {bookedAppointment.timeSlot}</p>
              <p><strong>Location:</strong> {bookedAppointment.clinicName}</p>
              <p><strong>Fee:</strong> R {bookedAppointment.consultationFee}</p>
            </div>
            <button onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
};
```

## Styling Example (CSS)

```css
/* appointmentBooking.css */
.appointment-booking-modal {
  background: white;
  border-radius: 8px;
  max-width: 600px;
  margin: auto;
  padding: 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.doctors-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 15px;
  margin: 20px 0;
}

.doctor-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 15px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
}

.doctor-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.doctor-card img {
  width: 100%;
  height: 200px;
  object-fit: cover;
  border-radius: 8px;
  margin-bottom: 10px;
}

.periods {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
  margin: 15px 0;
}

.period-option {
  border: 2px solid #ddd;
  border-radius: 8px;
  padding: 10px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.period-option input[type="radio"]:checked + label {
  color: #007bff;
}

.period-option:has(input:checked) {
  border-color: #007bff;
  background-color: #f0f7ff;
}

.slots-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 10px;
  margin: 20px 0;
}

.slot-button {
  padding: 10px;
  border: 2px solid #ddd;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  background: white;
}

.slot-button.available:hover {
  border-color: #007bff;
  background-color: #f0f7ff;
}

.slot-button.available input:checked + span {
  color: #007bff;
  font-weight: bold;
}

.slot-button.booked {
  background-color: #f5f5f5;
  cursor: not-allowed;
  opacity: 0.5;
}

.booking-success {
  text-align: center;
  padding: 30px;
}

.success-details {
  background: #f0f7ff;
  border-left: 4px solid #007bff;
  padding: 15px;
  border-radius: 4px;
  text-align: left;
  margin: 20px 0;
}
```

## Integration in Main App

```javascript
// In your main App.js or Patient Dashboard
import React, { useState } from 'react';
import { AppointmentBooking } from './components/AppointmentBooking';

export const PatientDashboard = () => {
  const [showBookingModal, setShowBookingModal] = useState(false);
  const token = localStorage.getItem('authToken');

  return (
    <div>
      <h1>Patient Dashboard</h1>
      <button onClick={() => setShowBookingModal(true)}>
        Book an Appointment
      </button>

      {showBookingModal && (
        <AppointmentBooking
          token={token}
          onClose={() => setShowBookingModal(false)}
        />
      )}
    </div>
  );
};
```

## Key Integration Points

1. **Authentication**: All appointment endpoints (except booking-info and doctors list) require JWT token
2. **Date Format**: Use YYYY-MM-DD for all dates
3. **Time Format**: Use 24-hour format (HH:MM) for time slots
4. **Error Handling**: Check `response.success` before processing data
5. **Loading States**: Show loading indicators while fetching data
6. **Validation**: Validate date range and time period on frontend too

## Next Steps

1. Copy the service functions to your project
2. Create React components based on the examples
3. Integrate with your authentication system
4. Add error boundaries and loading states
5. Style according to your design system
6. Test the complete booking flow

For API documentation, see [APPOINTMENT_BOOKING.md](./APPOINTMENT_BOOKING.md)
