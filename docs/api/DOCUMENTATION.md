# User Authentication API

## User Signup Endpoint

### Endpoint
`POST /api/users/signup`

### Description
Registers a new user (patient) in the system.

### Required Fields
- `first_name` (string) - User's first name
- `last_name` (string) - User's last name
- `email` (string) - Valid email address (must be unique)
- `phone` (string) - Phone number
- `id_passport_number` (string) - ID or Passport number (must be unique)
- `nationality` (string) - Must be either "South African" or "Other"
- `password` (string) - Password (minimum 6 characters)

### Request Example
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "email": "john.doe@example.com",
  "phone": "1234567890",
  "id_passport_number": "AB123456",
  "nationality": "South African",
  "password": "securepassword123"
}
```

### Success Response (201 Created)
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": 1,
      "first_name": "John",
      "last_name": "Doe",
      "email": "john.doe@example.com",
      "phone": "1234567890",
      "id_passport_number": "AB123456",
      "nationality": "South African"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

## User Login Endpoint

### Endpoint
`POST /api/users/login`

### Description
Authenticates a user and initiates OTP verification.

### Required Fields
- `email` (string) - User's email address
- `password` (string) - User's password

### Request Example
```json
{
  "email": "john.doe@example.com",
  "password": "securepassword123"
}
```

### Success Response (200 OK)
```json
{
  "success": true,
  "message": "OTP sent to your email. Please verify to complete login.",
  "data": {
    "email": "john.doe@example.com",
    "expiresIn": "10 minutes"
  }
}
```

---

## Testing with cURL

### Signup
```bash
curl -X POST http://localhost:3000/api/users/signup \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com",
    "phone": "1234567890",
    "id_passport_number": "AB123456",
    "nationality": "South African",
    "password": "securepassword123"
  }'
```

### Login
```bash
curl -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com",
    "password": "securepassword123"
  }'
```

---

## Security Features

- ✅ Passwords are hashed using bcrypt (10 salt rounds)
- ✅ JWT tokens expire after 7 days
- ✅ Email validation
- ✅ Unique constraints on email and ID/Passport number
- ✅ Password minimum length requirement (6 characters)
- ✅ Protected routes require valid JWT token

---

**Status**: ✅ Production Ready
