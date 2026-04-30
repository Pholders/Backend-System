# Enterprise-Level Suspicious Activity Alerts System

## Overview

A comprehensive security monitoring system that detects, alerts, and responds to suspicious account activities in real-time. This enterprise-grade implementation includes:

- **Impossible Travel Detection** - Detects physically impossible logins (>900 km/h)
- **New Location & Device Tracking** - Alerts on new login locations and devices
- **Pattern Anomaly Detection** - Identifies unusual access patterns
- **Email Security Alerts** - Real-time notifications with risk scoring
- **Timezone Anomaly Detection** - Identifies unusual timezone changes
- **Admin Dashboard** - Comprehensive security monitoring and response tools

---

## Architecture

### Components

#### 1. **LoginLocation Model** (`models/LoginLocation.js`)
Tracks user login locations and device information for pattern analysis.

**Key Features:**
- Records login coordinates (latitude/longitude)
- Device fingerprinting
- Login history tracking
- Suspicious location flagging
- Risk score calculation

**Database Table:** `login_locations`
```
- user_id, user_type, ip_address
- country, region, city
- latitude, longitude
- device_fingerprint, device_name
- browser, os
- is_known, is_suspicious
- risk_score, login_count
- user_verified, flagged_at
```

#### 2. **SecurityAlert Model** (`models/SecurityAlert.js`)
Manages security alerts and tracks user verification responses.

**Alert Types:**
- `IMPOSSIBLE_TRAVEL` - Login speed exceeds 900 km/h
- `NEW_LOCATION` - Login from unrecognized location
- `NEW_DEVICE` - Login from new device
- `PATTERN_ANOMALY` - Multiple suspicious logins detected
- `UNUSUAL_COUNTRY_PATTERN` - Excessive country diversity
- `TIMEZONE_ANOMALY` - Large timezone shifts
- `PASSWORD_CHANGED` - Password modification alert
- `MULTIPLE_FAILURES` - Failed login attempts
- `ACCOUNT_LOCKOUT` - Account locked

**Severity Levels:**
- `CRITICAL` (Risk Score: 80+)
- `HIGH` (60-79)
- `MEDIUM` (40-59)
- `LOW` (20-39)

**Database Table:** `security_alerts`
```
- user_id, user_type, email
- alert_type, severity, risk_score
- alert_message, location_data, device_data
- status (unreviewed, verified_legit, verified_threat, dismissed)
- user_response, user_response_at
- admin_notes, admin_action_at
- email_sent, verification_token
```

#### 3. **SecurityAlertService** (`services/securityAlertService.js`)
Core detection and analysis engine.

**Main Methods:**

##### `analyzeLoginActivity()`
Performs comprehensive analysis of login activity.

```javascript
const analysis = await SecurityAlertService.analyzeLoginActivity({
  userId,
  userType,
  email,
  firstName,
  lastName,
  ipAddress,
  geolocation,
  deviceFingerprint,
  deviceName,
  browser,
  os,
  userAgent
});

// Returns:
{
  locationRecordId,
  alerts: [
    {
      type: 'NEW_LOCATION',
      severity: 'MEDIUM',
      message: '...',
      riskScore: 40
    }
  ],
  riskScore: 65,           // 0-100
  requiresReview: true,    // riskScore > 70
  requiresUserVerification: true  // riskScore > 50
}
```

**Detection Rules:**
1. **Impossible Travel**: Distance / Time > 900 km/h
2. **New Location**: No similar IP/Device in 90 days
3. **New Device**: New device fingerprint
4. **Pattern Anomaly**: ≥3 suspicious locations in 24h
5. **Country Pattern**: >5 countries in 30 days
6. **Timezone Anomaly**: >12 hour timezone difference

##### `sendSecurityAlert()`
Sends detailed HTML email alert to user.

```javascript
await SecurityAlertService.sendSecurityAlert({
  email,
  firstName,
  lastName,
  eventType: 'NEW_LOGIN',
  details: analysisResult,
  location: geolocationData,
  deviceInfo: deviceData,
  timestamp: new Date(),
  riskLevel: 'HIGH',
  actionRequired: true,
  verificationLink: 'https://...'
});
```

**Email Includes:**
- Risk assessment and severity
- Location and device details
- Specific alerts and recommendations
- Verification link (if needed)
- Security tips

##### `sendPasswordChangeAlert()`
Notifies user of password changes.

```javascript
await SecurityAlertService.sendPasswordChangeAlert({
  email,
  firstName,
  lastName,
  timestamp,
  ipAddress,
  location,
  deviceInfo
});
```

##### `detectImpossibleTravel()`
Haversine formula calculates distance between coordinates.

```javascript
const result = SecurityAlertService.detectImpossibleTravel(
  previousLogin,
  currentLogin
);

// Returns:
{
  detected: true,
  distance: 5000,           // km
  timeDiffHours: 0.5,
  timeDiffMinutes: 30,
  speed: 10000,             // km/h
  previousLocation: 'Lagos, Nigeria',
  currentLocation: 'London, UK'
}
```

#### 4. **SecurityAdminController** (`controllers/securityAdminController.js`)
Admin endpoints for security monitoring and incident response.

**Endpoints:**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/admin/security/dashboard` | Get security stats |
| GET | `/api/admin/security/critical-alerts` | Get critical unreviewed alerts |
| GET | `/api/admin/security/user/:userId/alerts` | Get user's alert history |
| POST | `/api/admin/security/alerts/:alertId/review` | Review and update alert status |
| GET | `/api/admin/security/suspicious-users` | Get high-risk users |
| POST | `/api/admin/security/alerts/bulk-update` | Bulk update multiple alerts |
| GET | `/api/admin/security/report` | Generate security report |

---

## Implementation Flow

### 1. Login Flow with Security Analysis

```
User Login (email + password)
        ↓
Verify OTP
        ↓
Generate JWT & Session
        ↓
Get IP Geolocation
        ↓
Parse Device Info (UA)
        ↓
Create Device Fingerprint
        ↓
Analyze Login Activity
        ├─→ Check for Impossible Travel
        ├─→ Check for New Location
        ├─→ Check for New Device
        ├─→ Check for Pattern Anomalies
        ├─→ Check for Country Pattern
        └─→ Check for Timezone Anomaly
        ↓
Calculate Risk Score
        ↓
Record Login Location
        ↓
If Risk Score > 40:
    ├─→ Mark as Suspicious
    ├─→ Create SecurityAlert
    ├─→ Send Email Alert
    └─→ Include Verification Link if Score > 70
        ↓
Return Login Response with Risk Info
```

### 2. Password Reset Flow with Alert

```
User Requests Password Reset
        ↓
Verify Reset Token
        ↓
Update Password
        ↓
Invalidate All Sessions
        ↓
Get IP Geolocation
        ↓
Parse Device Info
        ↓
Send Password Change Alert Email
        ↓
Return Success Response
```

### 3. Admin Review Flow

```
Admin Reviews Security Dashboard
        ↓
Views Critical/Unreviewed Alerts
        ↓
Clicks Alert to Review
        ↓
Chooses Action: Verified Legitimate | Verified Threat | Dismissed
        ↓
If Verified Threat:
    ├─→ Invalidate User Sessions
    ├─→ Force Password Reset
    ├─→ Send Threat Notification
    └─→ Log Admin Action
        ↓
Update Alert Status
        ↓
Send Audit Log Entry
```

---

## Database Schema

### login_locations
```sql
CREATE TABLE login_locations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  user_type VARCHAR(50),
  ip_address VARCHAR(50),
  country VARCHAR(100),
  region VARCHAR(100),
  city VARCHAR(100),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  device_fingerprint VARCHAR(255),
  device_name VARCHAR(255),
  browser VARCHAR(100),
  os VARCHAR(100),
  is_known BOOLEAN DEFAULT false,
  is_suspicious BOOLEAN DEFAULT false,
  risk_score INTEGER DEFAULT 0,
  last_login_at TIMESTAMP,
  login_count INTEGER DEFAULT 1,
  user_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### security_alerts
```sql
CREATE TABLE security_alerts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  user_type VARCHAR(50),
  email VARCHAR(255),
  alert_type VARCHAR(100),
  severity VARCHAR(20),
  risk_score INTEGER,
  alert_message TEXT,
  location_data JSONB,
  device_data JSONB,
  ip_address VARCHAR(50),
  status VARCHAR(50) DEFAULT 'unreviewed',
  user_response TEXT,
  user_response_at TIMESTAMP,
  admin_notes TEXT,
  admin_action_at TIMESTAMP,
  email_sent BOOLEAN DEFAULT false,
  verification_token VARCHAR(255) UNIQUE,
  verification_token_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Migration & Setup

### 1. Install Dependencies
```bash
npm install ua-parser-js
```

### 2. Run Migrations
```bash
# Add login location tracking
node config/addLoginLocationTracking.js

# Add security alerts
node config/addSecurityAlerts.js
```

### 3. Update Environment Variables (`.env`)
```env
# Email Configuration (used by SecurityAlertService)
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

# Frontend URL for verification links
FRONTEND_URL=https://your-frontend-domain.com
```

---

## Risk Scoring Algorithm

**Base Score: 0**

| Detection | Risk Score | Max Score |
|-----------|-----------|-----------|
| Impossible Travel | 95 | 95 |
| New Location | 40 | 40 |
| New Device | 25 | 25 |
| Pattern Anomaly (3+ in 24h) | 60 | 60 |
| Country Pattern (5+ in 30d) | 35 | 35 |
| Timezone Anomaly (>12h) | 30 | 30 |
| **Total** | - | **100** |

**Risk Levels:**
- **CRITICAL**: 80-100 (Requires immediate action)
- **HIGH**: 60-79 (Review recommended)
- **MEDIUM**: 40-59 (Monitor)
- **LOW**: 20-39 (Information only)
- **MINIMAL**: 0-19 (No action needed)

---

## Email Templates

### 1. Security Alert Email
**When**: New login detected with moderate-to-high risk
**Includes**: Alert type, location, device, risk level, verification link
**Action**: User can verify the login is legitimate or report threat

### 2. Password Change Alert Email
**When**: Password reset successful
**Includes**: Time, IP, location, device details
**Action**: User can verify or report unauthorized change

### 3. Threat Notification Email
**When**: Admin confirms verified threat
**Includes**: Alert details, urgent action items, support contact
**Action**: User must immediately change password and review sessions

---

## Best Practices

### For Users
1. ✅ Review security alerts promptly
2. ✅ Verify new locations/devices
3. ✅ Enable two-factor authentication
4. ✅ Use strong, unique passwords
5. ✅ Review active sessions regularly
6. ✅ Report suspicious alerts immediately

### For Admins
1. ✅ Monitor critical alerts dashboard daily
2. ✅ Review high-risk users weekly
3. ✅ Investigate patterns of abuse
4. ✅ Generate monthly security reports
5. ✅ Respond to threats within 1 hour
6. ✅ Keep audit logs for compliance
7. ✅ Update alert thresholds based on patterns

### For Development
1. ✅ Test impossible travel detection
2. ✅ Validate geolocation accuracy
3. ✅ Test email delivery
4. ✅ Monitor performance (geolocation API calls)
5. ✅ Cache geolocation results (5-minute TTL)
6. ✅ Handle geolocation API failures gracefully
7. ✅ Log all security events to audit logs

---

## Monitoring & Alerts

### Dashboard Metrics
- Total alerts (24h, 7d)
- Unreviewed alerts count
- Critical/High severity alerts
- Affected users count
- Threat confirmation rate
- False positive rate

### Admin Notifications (Future)
- Email digest of critical alerts
- SMS alert for CRITICAL severity
- Slack integration for real-time updates
- Custom webhook triggers

### Compliance
- All alerts logged to `audit_logs` table
- Tamper-evident audit trail
- 90-day retention policy
- GDPR compliance built-in
- Data anonymization on deletion

---

## Testing

### Test Cases

1. **Impossible Travel**
   ```javascript
   // Login from New York, then London 30 min later
   // Expected: CRITICAL alert
   ```

2. **New Location**
   ```javascript
   // First login from new IP/country
   // Expected: MEDIUM alert
   ```

3. **New Device**
   ```javascript
   // Login from new device fingerprint
   // Expected: LOW alert
   ```

4. **Pattern Anomaly**
   ```javascript
   // 4 logins from different countries in 2 hours
   // Expected: HIGH alert
   ```

---

## Troubleshooting

### Geolocation API Issues
- Check rate limits (45 req/min on free tier)
- Implement caching for IP addresses
- Graceful fallback with default location
- 5-second timeout on API calls

### Email Delivery Failures
- Verify SMTP credentials
- Check email provider spam settings
- Implement retry logic with exponential backoff
- Log all email failures to audit logs

### Performance Concerns
- Index queries on user_id, created_at
- Archive old records (>90 days)
- Use connection pooling
- Async email sending (non-blocking)

---

## Future Enhancements

1. **Machine Learning**
   - Anomaly detection with ML models
   - Behavioral fingerprinting
   - Predictive threat scoring

2. **2FA Integration**
   - TOTP (Google Authenticator)
   - SMS verification
   - Push notifications

3. **Advanced Analytics**
   - Geographic heatmaps
   - Device profiling
   - Login pattern analysis

4. **Incident Response**
   - Automated threat remediation
   - Session hijacking detection
   - Brute-force attack prevention

5. **Integration**
   - Slack/Teams notifications
   - Third-party SIEM systems
   - Custom webhook triggers

---

## File Structure

```
Backend-System/
├── models/
│   ├── LoginLocation.js          # Login tracking model
│   └── SecurityAlert.js          # Alert management model
├── services/
│   ├── securityAlertService.js   # Core detection engine
│   └── emailService.js           # Enhanced with threat notifications
├── controllers/
│   ├── userController.js         # Integrated with security alerts
│   └── securityAdminController.js # Admin management
├── config/
│   ├── addLoginLocationTracking.js
│   └── addSecurityAlerts.js
└── docs/
    └── features/
        └── security-alerts/
            └── IMPLEMENTATION.md (this file)
```

---

**Version:** 1.0  
**Last Updated:** April 2026  
**Status:** Production Ready
