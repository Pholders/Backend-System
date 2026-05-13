# Frontend Integration Guide - Appointment Features

## Quick Reference for Frontend Developers

### Feature 1: Show Fully Booked Periods

**When:** After patient selects a date, before showing time periods

```javascript
// API Call
const response = await fetch(
  `/appointments/day-availability?doctorId=${doctorId}&date=${selectedDate}`
);
const data = await response.json();

// data.availability = {
//   morning: { isFullyBooked: false, availableSlots: 2, totalSlots: 8 },
//   afternoon: { isFullyBooked: true, availableSlots: 0, totalSlots: 8 },
//   evening: { isFullyBooked: false, availableSlots: 5, totalSlots: 6 },
//   night: { isFullyBooked: false, availableSlots: 5, totalSlots: 5 }
// }
```

**UI Implementation:**

```javascript
// Example: Render period buttons
data.availability.forEach(period => {
  const button = document.createElement('button');
  
  if (period.isFullyBooked) {
    button.disabled = true;
    button.className = 'period-btn fully-booked';
    button.textContent = `${period.period} - FULLY BOOKED`;
  } else {
    button.className = 'period-btn available';
    button.textContent = `${period.period} (${period.availableSlots}/${period.totalSlots})`;
  }
});
```

**CSS Styling:**

```css
.period-btn {
  padding: 10px 15px;
  margin: 5px;
  border: 2px solid #ddd;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.3s;
}

.period-btn.available {
  background: #e8f5e9;
  border-color: #4caf50;
}

.period-btn.available:hover {
  background: #c8e6c9;
}

.period-btn.fully-booked {
  background: #ffebee;
  border-color: #f44336;
  opacity: 0.5;
  cursor: not-allowed;
}
```

---

### Feature 2: Show Available Slots

**When:** After patient selects a time period

```javascript
// API Call
const response = await fetch(
  `/appointments/available-slots?doctorId=${doctorId}&date=${selectedDate}&timePeriod=${timePeriod}`
);
const data = await response.json();

// data.slotDetails = [
//   { time: "08:00", available: true },
//   { time: "08:30", available: false },
//   { time: "09:00", available: true },
//   ...
// ]
```

**UI Implementation:**

```javascript
// Render slot grid
const slotGrid = data.slotDetails.map(slot => {
  const div = document.createElement('div');
  div.className = slot.available ? 'slot available' : 'slot booked';
  div.textContent = slot.time;
  
  if (slot.available) {
    div.onclick = () => selectSlot(slot.time);
  } else {
    div.style.opacity = '0.5';
    div.style.pointerEvents = 'none';
  }
  
  return div;
});
```

**CSS Styling:**

```css
.slot {
  padding: 12px;
  margin: 5px;
  border-radius: 5px;
  text-align: center;
  font-weight: bold;
  transition: all 0.2s;
}

.slot.available {
  background: #e3f2fd;
  border: 2px solid #2196f3;
  cursor: pointer;
}

.slot.available:hover {
  background: #bbdefb;
  transform: scale(1.05);
}

.slot.booked {
  background: #f5f5f5;
  border: 2px solid #ccc;
  color: #999;
}
```

---

### Feature 3: Payment Status Management

**Appointment Status Lifecycle:**

```
┌─────────────────────────────────────────────────────────┐
│                 Appointment Created                     │
│                  pending_payment                        │
│          (Slot reserved, awaiting payment)              │
└──────────────┬──────────────────────────────────────────┘
               │
         ┌─────┴─────┐
         │           │
    PAYS  │           │  PAYMENT TIMEOUT
         │           │  (After 30 mins)
    ┌────▼────┐  ┌───▼──────┐
    │scheduled │  │cancelled │
    │(Confirmed)  │(Slot freed)
    └────┬────┘  └──────────┘
         │
    VISIT │
    COMPLETED
         │
    ┌────▼────┐
    │completed│
    └─────────┘
```

**Frontend Flow:**

```javascript
// Step 1: Book appointment (status = pending_payment)
const booking = await bookAppointment({
  doctorId, appointmentDate, timePeriod, timeSlot
});
// Response: { status: 'pending_payment', appointmentId: 1 }

// Step 2: Show payment options
showPaymentMethod(); // Stripe, Cash, Medical Aid

// Step 3: Process payment & confirm
if (paymentMethod === 'stripe') {
  const confirmed = await fetch('/payments/confirm-stripe', {
    method: 'POST',
    body: JSON.stringify({ paymentId, stripePaymentIntentId })
  });
  // Response: { status: 'scheduled' } - CONFIRMED ✅
}
```

---

### Feature 4: Auto-Cancel Notifications (Optional)

**Check Appointment Status:**

```javascript
// Poll appointment status every 5 minutes
const checkAppointmentStatus = async (appointmentId) => {
  const response = await fetch(`/appointments/${appointmentId}`);
  const data = await response.json();
  
  if (data.status === 'cancelled') {
    // Payment expired - notify user
    showNotification('Payment time expired. Booking cancelled. Slot available for rebooking.');
    redirectToBooking();
  } else if (data.status === 'scheduled') {
    // Payment confirmed
    showNotification('Payment confirmed! Your appointment is scheduled.');
  }
};

// Set polling interval
setInterval(() => checkAppointmentStatus(appointmentId), 5 * 60 * 1000);
```

**Or use WebSocket for real-time updates (if available):**

```javascript
const socket = io('http://localhost:3000');

socket.on('appointment:status-changed', (data) => {
  if (data.appointmentId === currentAppointmentId) {
    updateAppointmentStatus(data.status);
  }
});
```

---

## Complete Example: Date Selection Flow

```javascript
class AppointmentBooking {
  async selectDate(date) {
    // Step 1: Get daily availability
    const dayData = await fetch(
      `/appointments/day-availability?doctorId=${this.doctorId}&date=${date}`
    ).then(r => r.json());
    
    // Step 2: Render periods (disable fully booked)
    this.renderPeriods(dayData.availability);
  }
  
  async selectPeriod(period) {
    // Step 3: Get available slots
    const slotData = await fetch(
      `/appointments/available-slots?` +
      `doctorId=${this.doctorId}&date=${this.date}&timePeriod=${period}`
    ).then(r => r.json());
    
    // Step 4: Render slots (disable booked)
    this.renderSlots(slotData.slotDetails);
  }
  
  async selectSlot(slot) {
    // Step 5: Book appointment
    const booking = await fetch('/appointments/book', {
      method: 'POST',
      body: JSON.stringify({
        doctorId: this.doctorId,
        appointmentDate: this.date,
        timePeriod: this.period,
        timeSlot: slot,
        reasonForVisit: this.reason
      })
    }).then(r => r.json());
    
    // Step 6: Proceed to payment
    this.proceedToPayment(booking.appointmentId);
  }
  
  renderPeriods(availability) {
    const periods = ['morning', 'afternoon', 'evening', 'night'];
    
    periods.forEach(period => {
      const data = availability[period];
      const button = this.createButton({
        text: data.isFullyBooked 
          ? `${period} - FULLY BOOKED`
          : `${period} (${data.availableSlots}/${data.totalSlots})`,
        disabled: data.isFullyBooked,
        onClick: () => this.selectPeriod(period)
      });
      
      this.periodsContainer.appendChild(button);
    });
  }
  
  renderSlots(slotDetails) {
    slotDetails.forEach(slot => {
      const div = document.createElement('div');
      div.className = `slot ${slot.available ? 'available' : 'booked'}`;
      div.textContent = slot.time;
      
      if (slot.available) {
        div.onclick = () => this.selectSlot(slot.time);
      } else {
        div.style.opacity = '0.5';
      }
      
      this.slotsContainer.appendChild(div);
    });
  }
}
```

---

## Error Handling

```javascript
async function getAvailableSlots() {
  try {
    const response = await fetch(`/appointments/available-slots?...`);
    
    if (!response.ok) {
      if (response.status === 404) {
        showError('Doctor or date not found');
      } else if (response.status === 400) {
        showError('Invalid date or time period');
      } else {
        showError('Failed to load available slots');
      }
      return;
    }
    
    const data = await response.json();
    
    if (!data.success) {
      showError(data.message);
      return;
    }
    
    renderSlots(data.data);
  } catch (error) {
    showError('Network error. Please try again.');
    console.error(error);
  }
}
```

---

## State Management (Redux/Vuex Example)

```javascript
// Redux Slice
const appointmentSlice = {
  state: {
    selectedDate: null,
    selectedPeriod: null,
    selectedSlot: null,
    dayAvailability: null,
    slotDetails: null,
    appointmentStatus: 'pending_payment' // or 'scheduled'
  },
  
  actions: {
    async fetchDayAvailability({ commit }, { doctorId, date }) {
      const data = await fetch(`/appointments/day-availability?...`)
        .then(r => r.json());
      commit('setDayAvailability', data.availability);
    },
    
    async fetchSlots({ commit }, { doctorId, date, period }) {
      const data = await fetch(`/appointments/available-slots?...`)
        .then(r => r.json());
      commit('setSlotDetails', data.slotDetails);
    }
  }
};
```

---

**Last Updated:** May 13, 2026
**Ready for Implementation**
