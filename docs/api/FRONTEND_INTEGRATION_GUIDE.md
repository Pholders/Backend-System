# Frontend Integration Guide

## Overview

This guide helps frontend developers integrate with the Healthcare Backend API. The system supports patients, doctors, pharmacies, and admin users with role-based access control.

---

## 1. Environment Setup

### Development
```
API_BASE_URL = http://localhost:3000/api
JWT_STORAGE = localStorage (as 'token')
OTP_EXPIRY_DISPLAY = 10 minutes
PRESCRIPTION_CLAIM_WINDOW = 30 days
```

### Production
```
API_BASE_URL = https://api.healthcare.com/api
HTTPS_ONLY = true
JWT_STORAGE = httpOnly Cookie (recommended)
```

---

## 2. Authentication Flow

### Step 1: User Registration (Signup)
```javascript
// Patient Signup
const response = await fetch('http://localhost:3000/api/users/signup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    first_name: 'John',
    last_name: 'Doe',
    email: 'john@example.com',
    phone: '+27701234567',
    id_passport_number: 'AB123456',
    nationality: 'South African',
    password: 'SecurePass123!'
  })
});

const data = await response.json();
// Response includes: token, user_type, user_id
localStorage.setItem('token', data.data.token);
```

### Step 2: User Login
```javascript
// Send login credentials
const response = await fetch('http://localhost:3000/api/users/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'john@example.com',
    password: 'SecurePass123!'
  })
});

const data = await response.json();
// Response: { email, expiresIn }
// OTP sent to email - prompt user to enter it
```

### Step 3: Verify OTP
```javascript
// User enters OTP from email
const response = await fetch('http://localhost:3000/api/users/verify-login-otp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'john@example.com',
    otp: '123456' // User input
  })
});

const data = await response.json();
// Response includes: token, refreshToken
localStorage.setItem('token', data.data.token);
localStorage.setItem('refreshToken', data.data.refreshToken);
// User is now authenticated
```

---

## 3. API Utility Functions

### Authentication Helper
```javascript
// apiClient.js
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

export const apiCall = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers
    });

    if (response.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      window.location.href = '/login';
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

// Usage:
const data = await apiCall('/users/patient-profile');
```

### With Axios
```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token expiration
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
```

---

## 4. Patient Features

### Get Patient Profile
```javascript
const profile = await apiCall('/users/patient-profile');
// Returns: id, first_name, last_name, email, phone, etc.
```

### Update Profile
```javascript
const result = await apiCall('/users/patient-profile', {
  method: 'PUT',
  body: JSON.stringify({
    phone: '+27701234567',
    first_name: 'John'
  })
});
```

### Book Appointment
```javascript
const appointment = await apiCall('/appointments/book', {
  method: 'POST',
  body: JSON.stringify({
    doctor_id: 1,
    appointment_date: '2026-06-20',
    appointment_time: '14:30',
    reason_for_visit: 'Regular checkup'
  })
});
// Returns: appointment_id, status, consultation_fee
```

### Initialize Payment
```javascript
const payment = await apiCall('/payments/initialize', {
  method: 'POST',
  body: JSON.stringify({
    appointment_id: 42,
    payment_method: 'stripe', // or 'cash_on_arrival', 'medical_aid'
    amount: 500
  })
});

// If using Stripe
if (payment.data.stripe_client_secret) {
  // Use with Stripe.js to collect payment
  const elements = stripe.elements();
  const cardElement = elements.create('card');
  cardElement.mount('#card-element');
  // ... complete Stripe flow
}
```

### View Prescriptions
```javascript
const prescriptions = await apiCall('/prescriptions');
// Returns: array of prescriptions with items, status, expiry
```

### Sign Prescription
```javascript
// After user receives OTP
const signed = await apiCall(`/prescriptions/${prescriptionId}/sign`, {
  method: 'POST',
  body: JSON.stringify({
    otp: '123456' // From email
  })
});
// Returns: digital_signature, signed_at
```

### Get Health Records
```javascript
const phrSummary = await apiCall('/phr/summary');
// Returns: appointments, prescriptions, vitals, documents

const vitals = await apiCall('/phr/vitals');
// Returns: array of recorded health vitals
```

### Submit Doctor Review
```javascript
const review = await apiCall('/reviews/doctor', {
  method: 'POST',
  body: JSON.stringify({
    doctor_id: 1,
    appointment_id: 42,
    rating: 5,
    title: 'Excellent Service',
    comment: 'Dr. Smith was very professional'
  })
});
```

---

## 5. Doctor Features

### Register Doctor
```javascript
const doctor = await apiCall('/doctors/register', {
  method: 'POST',
  body: JSON.stringify({
    first_name: 'Jane',
    last_name: 'Smith',
    email: 'jane@example.com',
    phone: '+27701234567',
    specialization: 'General Practitioner',
    license_number: 'LIC123456',
    years_experience: 8,
    password: 'SecurePass123!'
  })
});
// OTP sent to email
```

### Verify Doctor OTP
```javascript
const verified = await apiCall('/doctors/verify-otp', {
  method: 'POST',
  body: JSON.stringify({
    email: 'jane@example.com',
    otp: '123456'
  })
});
// Returns: token
```

### Get Available Slots
```javascript
const slots = await apiCall('/doctors/1/slots?date=2026-06-20');
// Returns: available time slots for that date
```

### Update Availability
```javascript
const updated = await apiCall('/doctors/availability', {
  method: 'PUT',
  body: JSON.stringify({
    availability: {
      monday: '09:00-17:00',
      tuesday: '09:00-17:00',
      wednesday: '09:00-17:00',
      thursday: '09:00-17:00',
      friday: '09:00-17:00',
      saturday: null,
      sunday: null
    }
  })
});
```

### View Appointments
```javascript
const appointments = await apiCall('/appointments?status=scheduled');
// Returns: list of scheduled appointments
```

### Complete Appointment
```javascript
const completed = await apiCall(`/appointments/${appointmentId}/complete`, {
  method: 'POST'
});
// Returns: completedAt, paymentUpdated: true
// Payment status automatically updated to 'completed'
```

### Create Prescription
```javascript
const prescription = await apiCall('/prescriptions/create', {
  method: 'POST',
  body: JSON.stringify({
    appointment_id: 42,
    patient_id: 1,
    items: [
      {
        drug_name: 'Aspirin',
        dosage: '500mg',
        frequency: 'Twice daily',
        duration: '7 days',
        quantity: 14,
        instructions: 'Take with food'
      }
    ],
    notes: 'No known allergies'
  })
});
// Returns: prescription_id, claim_expires_at
// If cash payment: paymentFinalized: true
```

---

## 6. Pharmacy Features

### Register Pharmacy
```javascript
const pharmacy = await apiCall('/pharmacies/register', {
  method: 'POST',
  body: JSON.stringify({
    pharmacy_name: 'Central City Pharmacy',
    email: 'info@pharmacy.com',
    phone: '+27701234567',
    location: '123 Main Street',
    license_number: 'PHARM123456',
    password: 'SecurePass123!',
    operating_hours: {
      monday: '08:00-18:00',
      tuesday: '08:00-18:00'
      // ... etc
    }
  })
});
```

### Verify Pharmacy OTP
```javascript
const verified = await apiCall('/pharmacies/verify-otp', {
  method: 'POST',
  body: JSON.stringify({
    email: 'info@pharmacy.com',
    otp: '123456'
  })
});
// Auto-assigned to Basic Tier (5% commission)
```

### Get Current Tier
```javascript
const tier = await apiCall('/users/pharmacy/current-tier');
// Returns: currentTier, features, commissionRate, etc.
```

### Upgrade Tier
```javascript
const upgrade = await apiCall('/users/pharmacy/upgrade-tier', {
  method: 'POST',
  body: JSON.stringify({
    toTier: 'premium'
  })
});
// Returns: previousTier, newTier, features, commissionRate
```

### Dispense Prescription
```javascript
const dispensed = await apiCall(`/prescriptions/${prescriptionId}/dispense`, {
  method: 'POST',
  body: JSON.stringify({
    items_dispensed: [
      {
        prescription_item_id: 1,
        quantity_dispensed: 14
      }
    ],
    total_amount_paid: 250,
    payment_method: 'cash'
  })
});
// Returns: dispensed_at, items_dispensed count
```

---

## 7. Error Handling

### Standard Error Response
```javascript
// All errors follow this format:
{
  success: false,
  message: "Error description",
  error: {
    code: "ERROR_CODE"
  }
}
```

### Error Handler
```javascript
const handleApiError = (error) => {
  if (!error.success) {
    const { code, message } = error.error;
    
    switch (code) {
      case 'INVALID_EMAIL':
        return 'Invalid email format';
      case 'EMAIL_EXISTS':
        return 'Email already registered';
      case 'INVALID_OTP':
        return 'OTP incorrect or expired';
      case 'UNAUTHORIZED':
        return 'Please login again';
      case 'PRESCRIPTION_EXPIRED':
        return 'This prescription claim has expired';
      case 'PAYMENT_FAILED':
        return 'Payment processing failed';
      default:
        return message || 'An error occurred';
    }
  }
};
```

---

## 8. State Management Examples

### React with Hooks
```javascript
// authContext.js
import { createContext, useState, useCallback } from 'react';
import { apiCall } from './apiClient';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const login = useCallback(async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiCall('/users/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      return response; // User needs to verify OTP next
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const verifyOtp = useCallback(async (email, otp) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiCall('/users/verify-login-otp', {
        method: 'POST',
        body: JSON.stringify({ email, otp })
      });
      const { token, user: userData } = response.data;
      localStorage.setItem('token', token);
      setUser(userData);
      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, error, login, verifyOtp }}>
      {children}
    </AuthContext.Provider>
  );
};
```

### Using in Component
```javascript
import { useContext } from 'react';
import { AuthContext } from './authContext';

function LoginForm() {
  const { login, loading, error } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(email, password);
      // Show OTP input
    } catch (err) {
      // Handle error
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={loading}
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={loading}
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Loading...' : 'Login'}
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
```

---

## 9. Common Patterns

### Pagination
```javascript
const getAppointments = async (page = 1, limit = 10) => {
  return apiCall(`/appointments?page=${page}&limit=${limit}`);
};
```

### Filtering
```javascript
const getDoctors = async (specialization = null, date = null) => {
  let url = '/doctors';
  const params = new URLSearchParams();
  if (specialization) params.append('specialization', specialization);
  if (date) params.append('date', date);
  return apiCall(`${url}?${params.toString()}`);
};
```

### File Upload
```javascript
const uploadDocument = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  const token = localStorage.getItem('token');
  const response = await fetch('http://localhost:3000/api/phr/documents', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData // Don't set Content-Type, browser will set it
  });
  return response.json();
};
```

---

## 10. Deployment Checklist

- [ ] Update `API_BASE_URL` to production endpoint
- [ ] Enable HTTPS only
- [ ] Store JWT in httpOnly cookies (not localStorage)
- [ ] Implement token refresh logic
- [ ] Add comprehensive error logging
- [ ] Implement rate limit handling
- [ ] Add loading states and animations
- [ ] Test all payment flows
- [ ] Verify OTP timeout display
- [ ] Test prescription claim window expiry handling
- [ ] Verify tier-specific features display
- [ ] Test role-based access control

---

## 11. Performance Optimization

### Caching
```javascript
const cache = new Map();
const cachedApiCall = async (endpoint) => {
  if (cache.has(endpoint)) {
    return cache.get(endpoint);
  }
  const result = await apiCall(endpoint);
  cache.set(endpoint, result);
  return result;
};
```

### Debouncing
```javascript
import { debounce } from 'lodash';

const debouncedSearch = debounce(async (query) => {
  const results = await apiCall(`/doctors?search=${query}`);
  // Update results
}, 300);
```

### Lazy Loading
```javascript
const AppointmentList = lazy(() => import('./AppointmentList'));

<Suspense fallback={<Loader />}>
  <AppointmentList />
</Suspense>
```

---

## Support & Resources

- **API Documentation**: See `FRONTEND_API_GUIDE.md`
- **Quick Reference**: See `QUICK_REFERENCE.md`
- **Issues**: Check error codes and messages
- **Questions**: Contact backend-team@example.com

---

**Version**: 1.0.0  
**Last Updated**: June 2026
