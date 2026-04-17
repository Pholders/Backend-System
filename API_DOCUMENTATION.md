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
      "nationality": "South African",
      "status": "active",
      "created_at": "2026-04-17T10:30:00.000Z",
      "updated_at": "2026-04-17T10:30:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Error Responses

#### Missing Required Fields (400 Bad Request)
```json
{
  "success": false,
  "message": "All fields are required: first_name, last_name, email, phone, id_passport_number, nationality, password"
}
```

#### Invalid Nationality (400 Bad Request)
```json
{
  "success": false,
  "message": "Nationality must be either \"South African\" or \"Other\""
}
```

#### Invalid Email Format (400 Bad Request)
```json
{
  "success": false,
  "message": "Invalid email format"
}
```

#### Weak Password (400 Bad Request)
```json
{
  "success": false,
  "message": "Password must be at least 6 characters long"
}
```

#### Email Already Exists (409 Conflict)
```json
{
  "success": false,
  "message": "Email already registered"
}
```

#### ID/Passport Already Exists (409 Conflict)
```json
{
  "success": false,
  "message": "ID/Passport number already registered"
}
```

---

## User Login Endpoint

### Endpoint
`POST /api/users/login`

### Description
Authenticates a user and returns a JWT token.

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
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "first_name": "John",
      "last_name": "Doe",
      "email": "john.doe@example.com",
      "phone": "1234567890",
      "id_passport_number": "AB123456",
      "nationality": "South African",
      "status": "active",
      "created_at": "2026-04-17T10:30:00.000Z",
      "updated_at": "2026-04-17T10:30:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Error Responses

#### Missing Credentials (400 Bad Request)
```json
{
  "success": false,
  "message": "Email and password are required"
}
```

#### Invalid Credentials (401 Unauthorized)
```json
{
  "success": false,
  "message": "Invalid email or password"
}
```

#### Inactive Account (403 Forbidden)
```json
{
  "success": false,
  "message": "Account is inactive. Please contact support."
}
```

---

## Protected Endpoints

The following endpoints require authentication. Include the JWT token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

### Get User Profile
`GET /api/users/profile`

Returns the authenticated user's profile information.

### Update User Profile
`PUT /api/users/profile`

Updates the authenticated user's profile.

**Note:** Email and ID/Passport number cannot be changed through this endpoint.

#### Request Example
```json
{
  "phone": "0987654321",
  "address": "123 Main Street",
  "city": "New York",
  "state": "NY"
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

### Get Profile (with token)
```bash
curl -X GET http://localhost:3000/api/users/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

---

## Security Features

- ✅ Passwords are hashed using bcrypt (10 salt rounds)
- ✅ JWT tokens expire after 7 days
- ✅ Email validation
- ✅ Unique constraints on email and ID/Passport number
- ✅ Password minimum length requirement (6 characters)
- ✅ Protected routes require valid JWT token
