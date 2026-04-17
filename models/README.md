# Database Models

This directory contains the database models for the application.

## Models

### 1. User (Patient) Model
**File:** `User.js`  
**Table:** `users`

Represents patients in the system.

#### Fields:
- `id` - Primary key (auto-increment)
- `first_name` - Patient's first name
- `last_name` - Patient's last name
- `email` - Unique email address
- `password_hash` - Hashed password
- `phone` - Contact number
- `date_of_birth` - Date of birth
- `gender` - Gender
- `address` - Street address
- `city` - City
- `state` - State
- `zip_code` - Postal code
- `blood_type` - Blood type (e.g., A+, O-, etc.)
- `allergies` - Known allergies
- `medical_history` - Medical history details
- `emergency_contact_name` - Emergency contact person
- `emergency_contact_phone` - Emergency contact number
- `status` - Account status (active/inactive)
- `created_at` - Record creation timestamp
- `updated_at` - Record update timestamp

### 2. Doctor Model
**File:** `Doctor.js`  
**Table:** `doctors`

Represents doctors/physicians in the system.

#### Fields:
- `id` - Primary key (auto-increment)
- `first_name` - Doctor's first name
- `last_name` - Doctor's last name
- `email` - Unique email address
- `password_hash` - Hashed password
- `phone` - Contact number
- `license_number` - Unique medical license number
- `specialization` - Medical specialization
- `qualification` - Educational qualifications
- `experience_years` - Years of experience
- `hospital_affiliation` - Associated hospital/clinic
- `address` - Office address
- `city` - City
- `state` - State
- `zip_code` - Postal code
- `consultation_fee` - Consultation fee amount
- `bio` - Professional bio
- `profile_image` - Profile image URL
- `availability` - Available time slots (JSON)
- `status` - Account status (active/inactive)
- `created_at` - Record creation timestamp
- `updated_at` - Record update timestamp

### 3. Pharmacy Model
**File:** `Pharmacy.js`  
**Table:** `pharmacies`

Represents pharmacies in the system.

#### Fields:
- `id` - Primary key (auto-increment)
- `name` - Pharmacy name
- `email` - Unique email address
- `password_hash` - Hashed password
- `phone` - Contact number
- `license_number` - Unique pharmacy license number
- `owner_name` - Owner's name
- `registration_number` - Registration number
- `address` - Street address
- `city` - City
- `state` - State
- `zip_code` - Postal code
- `latitude` - Geographic latitude
- `longitude` - Geographic longitude
- `operating_hours` - Operating hours (JSON)
- `services` - Array of services offered
- `delivery_available` - Whether delivery is available (boolean)
- `delivery_radius` - Delivery radius in km
- `website` - Website URL
- `description` - Pharmacy description
- `profile_image` - Profile image URL
- `is_24_hours` - 24-hour operation flag
- `status` - Account status (active/inactive)
- `created_at` - Record creation timestamp
- `updated_at` - Record update timestamp

## Usage

### Initialize Database Tables

Run the following command to create all tables:

```bash
npm run init-db
```

### Import Models

```javascript
const { User, Doctor, Pharmacy } = require('./models');

// Or import individually
const User = require('./models/User');
const Doctor = require('./models/Doctor');
const Pharmacy = require('./models/Pharmacy');
```

### Example Operations

#### Create a User
```javascript
const newUser = await User.create({
  first_name: 'John',
  last_name: 'Doe',
  email: 'john.doe@example.com',
  password_hash: hashedPassword,
  phone: '1234567890',
  // ... other fields
});
```

#### Find by Email
```javascript
const user = await User.findByEmail('john.doe@example.com');
const doctor = await Doctor.findByEmail('doctor@example.com');
const pharmacy = await Pharmacy.findByEmail('pharmacy@example.com');
```

#### Update Record
```javascript
const updatedUser = await User.update(userId, {
  phone: '0987654321',
  address: '123 New Street'
});
```

#### Find All
```javascript
const users = await User.findAll(50, 0); // limit, offset
const doctors = await Doctor.findAll();
const pharmacies = await Pharmacy.findAll();
```

#### Specialized Queries
```javascript
// Find doctors by specialization
const cardiologists = await Doctor.findBySpecialization('Cardiology');

// Find pharmacies by city
const localPharmacies = await Pharmacy.findByCity('New York');

// Find nearby pharmacies
const nearbyPharmacies = await Pharmacy.findNearby(40.7128, -74.0060, 5); // lat, lng, radius in km
```

## Notes

- All models use **soft delete** by updating the `status` field to 'inactive'
- Password fields should always store hashed passwords, never plain text
- The `availability` and `operating_hours` fields use JSONB for flexible scheduling
- Pharmacy model includes geolocation support for proximity searches
- All timestamps are automatically managed by PostgreSQL
