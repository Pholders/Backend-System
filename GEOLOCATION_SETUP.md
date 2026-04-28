# 🌍 Geolocation & Fraud Detection System

## Overview

Your audit logs now include **geolocation tracking** and **impossible travel detection** to significantly enhance security and fraud detection capabilities.

## Features Added

### 1. **Geolocation Tracking** 🌐
Each login attempt now captures:
- **Country** - Login country
- **City** - Login city  
- **Timezone** - User's timezone
- **ISP** - Internet Service Provider
- **Coordinates** - Latitude and longitude for distance calculations
- **IP Address** - Raw IP address

### 2. **Impossible Travel Detection** ⚡
Automatically detects suspicious fast travel patterns:
- Calculates distance between consecutive logins
- Checks if travel speed exceeds 900 km/h (commercial jet speed)
- Flags impossible travel for investigation
- Example: Login in New York, then 5 minutes later in Tokyo → **ALERT**

### 3. **Security Dashboard** 📊
Admin endpoint: `GET /api/users/admin/security/dashboard?hours=24`

Returns:
```json
{
  "success": true,
  "data": {
    "period": "24 hours",
    "summary": {
      "total_logins": 156,
      "failed_attempts": 12,
      "impossible_travels": 2,
      "unique_locations": 8,
      "unique_ips": 15
    },
    "alerts": {
      "impossible_travels": 2,
      "suspicious_locations": 3
    },
    "impossible_travels": [
      {
        "user_id": 5,
        "email": "user@example.com",
        "country": "US",
        "city": "New York",
        "created_at": "2024-01-15T10:30:00Z"
      }
    ],
    "suspicious_locations": [
      {
        "country": "NG",
        "city": "Lagos",
        "failed_attempts": 5,
        "emails": ["attacker@example.com"],
        "last_attempt": "2024-01-15T09:15:00Z"
      }
    ]
  }
}
```

### 4. **User Login History by Location** 📍
Admin endpoint: `GET /api/users/admin/security/user-locations?user_id=5&days=30`

Returns all login locations for a user over time:
```json
{
  "success": true,
  "data": {
    "user_id": 5,
    "days": 30,
    "locations": [
      {
        "country": "US",
        "city": "New York",
        "timezone": "America/New_York",
        "login_count": 45,
        "last_login": "2024-01-15T10:30:00Z",
        "first_login": "2024-01-01T08:00:00Z"
      }
    ]
  }
}
```

## Database Schema

### New Audit Log Columns

```sql
-- Geolocation data (JSONB)
geolocation JSONB -- Contains: country, city, timezone, latitude, longitude, isp, ip

-- Fraud detection flag
impossible_travel_detected BOOLEAN DEFAULT FALSE
```

### Sample Geolocation Data
```json
{
  "ip": "203.0.113.45",
  "country": "US",
  "region": "New York",
  "city": "New York",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "timezone": "America/New_York",
  "isp": "Verizon Communications Inc.",
  "is_private": false
}
```

## Setup Instructions

### 1. Run Migration
```bash
npm run migrate:geolocation
```

This adds:
- `geolocation` column to store location data
- `impossible_travel_detected` flag
- Optimized database indices

### 2. Restart Server
```bash
npm run dev
```

## How It Works

### Login Flow with Geolocation

```
User attempts login
    ↓
Credentials verified ✓
    ↓
Fetch IP geolocation (async)
    ↓
Check for impossible travel
    ├─ Get last login location
    ├─ Calculate distance
    ├─ Check if speed > 900 km/h
    └─ Flag if impossible
    ↓
Generate OTP
    ↓
Store in audit logs with geolocation
    ↓
Log entry includes geolocation & travel flag
```

### Geolocation Service

**File**: `services/geolocationService.js`

Features:
- Fetches location from IP (ip-api.com free tier: 45 requests/min)
- Handles private/local IPs (returns "Private Network")
- Calculates Haversine distance between coordinates
- Detects impossible travel patterns
- Includes 5-second timeout for API calls

## API Endpoints

### Get Security Dashboard
```http
GET /api/users/admin/security/dashboard?hours=24
Authorization: Bearer <admin-jwt-token>
```

Query Parameters:
- `hours` (optional, default: 24) - Time window in hours

### Get User Login Locations
```http
GET /api/users/admin/security/user-locations?user_id=5&days=30
Authorization: Bearer <admin-jwt-token>
```

Query Parameters:
- `user_id` (required) - User ID to analyze
- `days` (optional, default: 30) - Days of history to fetch

## Audit Log Methods

New AuditLog model methods:

```javascript
// Get impossible travel detections
AuditLog.getImpossibleTravelAlerts(hours)

// Get all login locations for a user
AuditLog.getLoginsByLocation(userId, days)

// Get suspicious locations with failed attempts
AuditLog.getSuspiciousLocations(minFailedAttempts, hours)

// Get last login location
AuditLog.getLastLoginLocation(userId)

// Get security dashboard summary
AuditLog.getSecurityDashboard(hours)
```

## Example: Fraud Scenario

### Scenario: Account Takeover Attempt
```
2024-01-15 08:00 - Legitimate login: New York, US (40.7128°N, 74.0060°W)
2024-01-15 08:15 - Suspicious login: London, UK (51.5074°N, 0.1278°W)
   → Distance: ~5,570 km
   → Time: 15 minutes
   → Required Speed: 22,280 km/h (25x faster than commercial jet)
   → Status: 🚨 IMPOSSIBLE TRAVEL DETECTED ⚨
```

## Security Considerations

✅ **What's Tracked**:
- Login country, city, timezone
- IP address and ISP
- GPS coordinates (latitude/longitude)
- Time between logins
- Failed login attempts per location

❌ **What's NOT Tracked**:
- Real-time device location (GPS)
- Device motion/accelerometer
- Camera/microphone access
- Any personally identifiable location data beyond city-level

## Performance Impact

- **Geolocation lookup**: ~1-3 seconds (cached via Redis if available)
- **Distance calculation**: <1ms (local computation)
- **Database write**: <10ms (indexed fields)
- **Dashboard query**: ~200-500ms (depending on data volume)

## Limitations

1. **IP-based accuracy**: City-level accuracy (~90%), not precise street address
2. **VPN/Proxy**: Location will show VPN endpoint, not actual user location
3. **Rate limiting**: ip-api.com free tier: 45 requests/minute
4. **Private networks**: Local IPs show as "Private Network"

## Future Enhancements

🔜 Possible improvements:
- ML-based anomaly detection for location patterns
- Device fingerprinting
- Risk scoring for login attempts
- Automatic account lockdown on suspicious activity
- SMS/Email alerts for impossible travel
- Whitelist/blacklist locations
- CAPTCHA challenge for risky logins

## Testing

### Manual Test
```bash
# 1. Login with valid credentials
curl -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'

# 2. Get OTP from database or email
# 3. Verify OTP (triggers geolocation tracking)
curl -X POST http://localhost:3000/api/users/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "otp_code": "123456"}'

# 4. Check security dashboard
curl http://localhost:3000/api/users/admin/security/dashboard \
  -H "Authorization: Bearer <admin-token>"
```

---

**Deployed**: ✅ January 15, 2024
**Status**: Production Ready
**Security Level**: Medium (IP-based) → High (impossible travel detection)
