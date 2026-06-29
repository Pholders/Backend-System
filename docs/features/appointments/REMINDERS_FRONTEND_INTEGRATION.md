# Appointment Reminders - Frontend Integration Guide

This guide shows how to integrate appointment reminders into your React frontend.

---

## Service Layer

Create `services/reminderService.js`:

```javascript
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

const reminderService = {
  /**
   * Set or update reminder for an appointment
   */
  async setReminder(appointmentId, reminderTimes, reminderMethods) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/users/appointments/${appointmentId}/reminders`,
        { reminderTimes, reminderMethods },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Failed to set reminder' };
    }
  },

  /**
   * Get reminder for an appointment
   */
  async getReminder(appointmentId) {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/users/appointments/${appointmentId}/reminders`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      return response.data.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null; // No reminder set
      }
      throw error.response?.data || { success: false, message: 'Failed to get reminder' };
    }
  },

  /**
   * Update reminder settings
   */
  async updateReminder(appointmentId, reminderTimes, reminderMethods) {
    try {
      const response = await axios.put(
        `${API_BASE_URL}/users/appointments/${appointmentId}/reminders`,
        { reminderTimes, reminderMethods },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Failed to update reminder' };
    }
  },

  /**
   * Toggle reminder on/off
   */
  async toggleReminder(appointmentId, isEnabled) {
    try {
      const response = await axios.patch(
        `${API_BASE_URL}/users/appointments/${appointmentId}/reminders/toggle`,
        { isEnabled },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Failed to toggle reminder' };
    }
  },

  /**
   * Delete reminder
   */
  async deleteReminder(appointmentId) {
    try {
      const response = await axios.delete(
        `${API_BASE_URL}/users/appointments/${appointmentId}/reminders`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Failed to delete reminder' };
    }
  },

  /**
   * Get all patient reminders
   */
  async getPatientReminders() {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/users/reminders`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      return response.data.data.reminders;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Failed to fetch reminders' };
    }
  },

  /**
   * Get upcoming reminders (next 24 hours)
   */
  async getUpcomingReminders() {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/users/reminders/upcoming`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      return response.data.data.reminders;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Failed to fetch upcoming reminders' };
    }
  },

  /**
   * Get notification history for an appointment
   */
  async getNotificationHistory(appointmentId) {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/users/appointments/${appointmentId}/notification-history`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      return response.data.data.notifications;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Failed to fetch notification history' };
    }
  }
};

export default reminderService;
```

---

## React Components

### 1. Reminder Configuration Modal

Create `components/AppointmentReminderModal.jsx`:

```javascript
import React, { useState, useEffect } from 'react';
import reminderService from '../services/reminderService';
import './AppointmentReminderModal.css';

const AppointmentReminderModal = ({ appointmentId, isOpen, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [reminder, setReminder] = useState(null);
  const [reminderTimes, setReminderTimes] = useState([1440, 60]);
  const [reminderMethods, setReminderMethods] = useState(['email']);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadReminder();
    }
  }, [isOpen, appointmentId]);

  const loadReminder = async () => {
    try {
      const existingReminder = await reminderService.getReminder(appointmentId);
      if (existingReminder) {
        setReminder(existingReminder);
        setReminderTimes(existingReminder.reminderTimes);
        setReminderMethods(existingReminder.reminderMethods);
      }
    } catch (err) {
      console.error('Error loading reminder:', err);
    }
  };

  const handleTimeChange = (value) => {
    if (value === '') {
      setReminderTimes([]);
    } else {
      const times = value.split(',').map(t => parseInt(t.trim())).filter(t => !isNaN(t));
      setReminderTimes(times);
    }
  };

  const handleMethodToggle = (method) => {
    if (reminderMethods.includes(method)) {
      setReminderMethods(reminderMethods.filter(m => m !== method));
    } else {
      setReminderMethods([...reminderMethods, method]);
    }
  };

  const handleSave = async () => {
    try {
      setError('');
      setLoading(true);

      if (reminderTimes.length === 0) {
        setError('Please select at least one reminder time');
        return;
      }

      if (reminderMethods.length === 0) {
        setError('Please select at least one notification method');
        return;
      }

      if (reminder) {
        await reminderService.updateReminder(appointmentId, reminderTimes, reminderMethods);
      } else {
        await reminderService.setReminder(appointmentId, reminderTimes, reminderMethods);
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save reminder');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📅 Set Appointment Reminder</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {error && <div className="alert alert-error">{error}</div>}

          {/* Reminder Times */}
          <div className="form-group">
            <label>Reminder Times (minutes before appointment)</label>
            <div className="reminder-times-options">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={reminderTimes.includes(1440)}
                  onChange={() => {
                    if (reminderTimes.includes(1440)) {
                      setReminderTimes(reminderTimes.filter(t => t !== 1440));
                    } else {
                      setReminderTimes([...reminderTimes, 1440].sort((a, b) => b - a));
                    }
                  }}
                />
                <span>1 day before (1440 min)</span>
              </label>

              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={reminderTimes.includes(720)}
                  onChange={() => {
                    if (reminderTimes.includes(720)) {
                      setReminderTimes(reminderTimes.filter(t => t !== 720));
                    } else {
                      setReminderTimes([...reminderTimes, 720].sort((a, b) => b - a));
                    }
                  }}
                />
                <span>12 hours before (720 min)</span>
              </label>

              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={reminderTimes.includes(60)}
                  onChange={() => {
                    if (reminderTimes.includes(60)) {
                      setReminderTimes(reminderTimes.filter(t => t !== 60));
                    } else {
                      setReminderTimes([...reminderTimes, 60].sort((a, b) => b - a));
                    }
                  }}
                />
                <span>1 hour before (60 min)</span>
              </label>

              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={reminderTimes.includes(30)}
                  onChange={() => {
                    if (reminderTimes.includes(30)) {
                      setReminderTimes(reminderTimes.filter(t => t !== 30));
                    } else {
                      setReminderTimes([...reminderTimes, 30].sort((a, b) => b - a));
                    }
                  }}
                />
                <span>30 minutes before</span>
              </label>
            </div>
          </div>

          {/* Notification Methods */}
          <div className="form-group">
            <label>Notification Methods</label>
            <div className="notification-methods">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={reminderMethods.includes('email')}
                  onChange={() => handleMethodToggle('email')}
                  disabled // Email always available
                />
                <span>📧 Email</span>
              </label>

              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={reminderMethods.includes('sms')}
                  onChange={() => handleMethodToggle('sms')}
                />
                <span>💬 SMS</span>
              </label>

              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={reminderMethods.includes('push')}
                  onChange={() => handleMethodToggle('push')}
                />
                <span>🔔 Push Notification</span>
              </label>

              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={reminderMethods.includes('in-app')}
                  onChange={() => handleMethodToggle('in-app')}
                />
                <span>📱 In-App</span>
              </label>
            </div>
          </div>

          {/* Preview */}
          <div className="reminder-preview">
            <h4>Preview:</h4>
            <p>You will receive {reminderMethods.length} notification(s) at {reminderTimes.length} different time(s)</p>
            <ul>
              {reminderTimes.sort((a, b) => b - a).map(time => (
                <li key={time}>
                  {reminderMethods.length === 1 
                    ? `${reminderMethods[0]} reminder ${time} minutes before`
                    : `${reminderMethods.join(', ')} reminders ${time} minutes before`
                  }
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button 
            className="btn btn-primary" 
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Reminder'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AppointmentReminderModal;
```

### CSS for Modal

Create `components/AppointmentReminderModal.css`:

```css
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.25rem;
}

.modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #6b7280;
}

.modal-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 25px;
}

.form-group label {
  display: block;
  font-weight: 600;
  margin-bottom: 10px;
  color: #111827;
}

.reminder-times-options,
.notification-methods {
  display: grid;
  gap: 10px;
}

.checkbox {
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 8px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.checkbox:hover {
  background-color: #f3f4f6;
}

.checkbox input[type="checkbox"] {
  margin-right: 10px;
  cursor: pointer;
}

.checkbox span {
  user-select: none;
}

.reminder-preview {
  background-color: #f0f9ff;
  border: 1px solid #bfdbfe;
  border-radius: 6px;
  padding: 15px;
  margin-bottom: 20px;
}

.reminder-preview h4 {
  margin: 0 0 10px 0;
  color: #1e40af;
}

.reminder-preview p {
  margin: 0 0 10px 0;
  font-size: 0.95rem;
}

.reminder-preview ul {
  margin: 0;
  padding-left: 20px;
  font-size: 0.9rem;
}

.reminder-preview li {
  margin: 5px 0;
  color: #374151;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 20px;
  border-top: 1px solid #e5e7eb;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background-color: #1e40af;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #1e3a8a;
}

.btn-primary:disabled {
  background-color: #9ca3af;
  cursor: not-allowed;
}

.btn-secondary {
  background-color: #e5e7eb;
  color: #111827;
}

.btn-secondary:hover {
  background-color: #d1d5db;
}

.alert {
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 15px;
}

.alert-error {
  background-color: #fee2e2;
  color: #991b1b;
  border: 1px solid #fecaca;
}
```

---

### 2. Appointment Card with Reminder Button

```javascript
import React, { useState } from 'react';
import AppointmentReminderModal from './AppointmentReminderModal';

const AppointmentCard = ({ appointment }) => {
  const [showReminderModal, setShowReminderModal] = useState(false);

  return (
    <div className="appointment-card">
      <div className="appointment-details">
        <h3>{appointment.doctorName}</h3>
        <p className="specialization">{appointment.specialization}</p>
        <p className="date-time">
          📅 {appointment.date} at {appointment.timeSlot}
        </p>
        <p className="clinic">🏥 {appointment.clinicName}</p>
      </div>

      <div className="appointment-actions">
        <button 
          className="btn-reminder"
          onClick={() => setShowReminderModal(true)}
        >
          🔔 Set Reminder
        </button>
      </div>

      <AppointmentReminderModal
        appointmentId={appointment.appointmentId}
        isOpen={showReminderModal}
        onClose={() => setShowReminderModal(false)}
        onSuccess={() => alert('Reminder saved!')}
      />
    </div>
  );
};

export default AppointmentCard;
```

---

### 3. Upcoming Reminders Widget

```javascript
import React, { useState, useEffect } from 'react';
import reminderService from '../services/reminderService';

const UpcomingReminders = () => {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUpcomingReminders();
  }, []);

  const loadUpcomingReminders = async () => {
    try {
      setLoading(true);
      const data = await reminderService.getUpcomingReminders();
      setReminders(data);
    } catch (error) {
      console.error('Error loading reminders:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  if (reminders.length === 0) {
    return (
      <div className="no-reminders">
        <p>No reminders scheduled for the next 24 hours</p>
      </div>
    );
  }

  return (
    <div className="upcoming-reminders">
      <h3>📅 Upcoming Reminders (Next 24 Hours)</h3>
      <div className="reminder-list">
        {reminders.map(reminder => (
          <div key={reminder.reminderId} className="reminder-item">
            <div className="reminder-time">
              <h4>{reminder.doctorName}</h4>
              <p>{reminder.appointmentDate} at {reminder.appointmentTime}</p>
            </div>
            <div className="reminder-methods">
              {reminder.reminderMethods.map(method => (
                <span key={method} className={`badge badge-${method}`}>
                  {method}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UpcomingReminders;
```

---

## Usage in Your App

### In Your Appointments Page

```javascript
import React, { useState, useEffect } from 'react';
import AppointmentCard from './AppointmentCard';
import UpcomingReminders from './UpcomingReminders';

const AppointmentsPage = () => {
  const [appointments, setAppointments] = useState([]);

  // Load appointments...

  return (
    <div className="appointments-page">
      <div className="sidebar">
        <UpcomingReminders />
      </div>
      
      <div className="main-content">
        <h1>My Appointments</h1>
        {appointments.map(apt => (
          <AppointmentCard key={apt.appointmentId} appointment={apt} />
        ))}
      </div>
    </div>
  );
};

export default AppointmentsPage;
```

---

## Common Reminder Presets

Create a constants file `constants/reminderPresets.js`:

```javascript
export const REMINDER_PRESETS = {
  CONSERVATIVE: {
    name: 'Conservative',
    times: [1440],
    methods: ['email'],
    description: 'Email reminder 1 day before'
  },
  STANDARD: {
    name: 'Standard',
    times: [1440, 60],
    methods: ['email'],
    description: 'Email reminders 1 day and 1 hour before'
  },
  AGGRESSIVE: {
    name: 'Aggressive',
    times: [1440, 720, 60],
    methods: ['email', 'sms'],
    description: 'Email and SMS reminders 1 day, 12 hours, and 1 hour before'
  },
  COMPREHENSIVE: {
    name: 'Comprehensive',
    times: [1440, 720, 60, 30],
    methods: ['email', 'sms', 'push'],
    description: 'Multiple reminders via all channels'
  }
};
```

---

## Error Handling

```javascript
const handleReminderError = (error) => {
  const errorMessage = error.message || 'Failed to manage reminder';
  
  if (error.message === 'Invalid reminder times') {
    return 'Please select valid reminder times (minutes before appointment)';
  }
  
  if (error.message === 'Invalid reminder methods') {
    return 'Please select at least one notification method';
  }
  
  if (error.message === 'Unauthorized') {
    return 'You do not have permission to manage this reminder';
  }
  
  return errorMessage;
};
```

---

## Testing

```javascript
// Test reminders service
import reminderService from '../services/reminderService';

// Set reminder
await reminderService.setReminder(5, [1440, 60], ['email']);

// Get upcoming
const upcoming = await reminderService.getUpcomingReminders();
console.log(upcoming);

// Get history
const history = await reminderService.getNotificationHistory(5);
console.log(history);
```

---

## Best Practices

1. **Validate Input** - Always check reminder times and methods
2. **Handle Errors** - Show user-friendly error messages
3. **Loading States** - Disable buttons while saving
4. **Confirmation** - Show success message after saving
5. **Real-time Updates** - Refresh reminder list after changes
6. **Accessibility** - Use proper labels and ARIA attributes
7. **Responsive Design** - Ensure modal works on mobile

---

**Frontend Integration Complete!** ✅
