# Security Alerts - Setup Guide

## Step-by-Step Installation

### Step 1: Install Dependencies ✅

```bash
npm install ua-parser-js
```

**What it does**: Installs UA parser for device/browser detection from user agent strings.

### Step 2: Run Migrations ✅

Run the migrations in order:

```bash
# Create login_locations table
npm run migrate:login-locations

# Create security_alerts table  
npm run migrate:security-alerts
```

**Tables Created:**
- `login_locations` - Tracks user login history with geolocation
- `security_alerts` - Manages suspicious activity alerts

### Step 3: Update Environment Variables ✅

Add to your `.env` file:

```env
# Email Configuration (Required)
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

# Frontend URL (Required for verification links)
FRONTEND_URL=https://your-frontend-domain.com

# Optional: Geolocation API
# (Using free tier: 45 requests/minute)
GEOLOCATION_API_KEY=optional
```

**Gmail Setup:**
1. Enable 2-Factor Authentication in Gmail
2. Generate App Password: https://myaccount.google.com/apppasswords
3. Use the generated 16-character password in `EMAIL_PASSWORD`

### Step 4: Verify Installation ✅

```bash
# Start development server
npm run dev

# Test database tables exist
curl http://localhost:3000/api/test-db

# Test health endpoint
curl http://localhost:3000/api/health
```

---

## Verification Checklist

- [ ] Database migrations completed without errors
- [ ] Login location table exists and is indexed
- [ ] Security alerts table exists with proper constraints
- [ ] Email service configured and tested
- [ ] Frontend URL added to .env
- [ ] UA Parser JS installed
- [ ] Dev server starts without errors
- [ ] No database connection errors in logs

---

## Integration Points

### 1. User Login Flow (Already Integrated ✅)

When a user logs in:
1. ✅ Email + password verified
2. ✅ OTP generated and sent
3. ✅ OTP verified
4. ✅ **[NEW] Security analysis performed**
5. ✅ **[NEW] Location tracked**
6. ✅ **[NEW] Alert email sent if risky**
7. ✅ JWT token issued
8. ✅ Session created

**Modified File**: `controllers/userController.js` - `verifyOTP()`

### 2. Password Reset Flow (Already Integrated ✅)

When a user resets password:
1. ✅ Reset token verified
2. ✅ Password updated and hashed
3. ✅ Old sessions invalidated
4. ✅ **[NEW] Password change email sent**
5. ✅ Confirmation email sent

**Modified File**: `controllers/userController.js` - `resetPassword()`

---

## Admin Dashboard Setup (Optional)

To enable admin endpoints for security monitoring:

### 1. Add to Routes (Not required for basic functionality)

```javascript
const securityAdminController = require('./controllers/securityAdminController');

// Admin security routes
router.get('/admin/security/dashboard', 
  authMiddleware, 
  requireRole('admin'), 
  securityAdminController.getDashboardStats);

router.get('/admin/security/critical-alerts',
  authMiddleware,
  requireRole('admin'),
  securityAdminController.getCriticalAlerts);

router.get('/admin/security/user/:userId/alerts',
  authMiddleware,
  requireRole('admin'),
  securityAdminController.getUserAlertHistory);

router.post('/admin/security/alerts/:alertId/review',
  authMiddleware,
  requireRole('admin'),
  securityAdminController.reviewAlert);

router.get('/admin/security/suspicious-users',
  authMiddleware,
  requireRole('admin'),
  securityAdminController.getSuspiciousUsers);

router.post('/admin/security/alerts/bulk-update',
  authMiddleware,
  requireRole('admin'),
  securityAdminController.bulkUpdateAlerts);

router.get('/admin/security/report',
  authMiddleware,
  requireRole('admin'),
  securityAdminController.generateSecurityReport);
```

### 2. Create Admin User (One-time setup)

```sql
INSERT INTO admins (email, password_hash, first_name, last_name, role, status)
VALUES ('admin@pholders.com', 'hashed_password', 'Security', 'Admin', 'super_admin', 'active');
```

---

## Testing the System

### Test 1: Simulate New Location Login

```bash
curl -X POST http://localhost:3000/api/users/verify-otp \
  -H "Content-Type: application/json" \
  -H "X-Forwarded-For: 102.89.32.XX" \
  -d '{
    "email": "test@example.com",
    "otp_code": "123456"
  }'
```

Expected: 
- ✅ Login succeeds
- ✅ `risk_score` in response > 0
- ✅ Email alert sent to user

### Test 2: Simulate Impossible Travel

```
1. Login from New York (40.7128°N, 74.0060°W)
2. Wait 30 seconds
3. Login from London (51.5074°N, 0.1278°W)
```

Expected:
- ✅ Second login gets CRITICAL alert
- ✅ `riskScore` = 95+
- ✅ Impossible travel detected

### Test 3: Check Security Alerts in Database

```sql
SELECT * FROM security_alerts ORDER BY created_at DESC LIMIT 5;
SELECT * FROM login_locations ORDER BY created_at DESC LIMIT 5;
```

### Test 4: Send Test Email

```javascript
// In node console
const emailService = require('./services/emailService');

emailService.sendSecurityAlert({
  email: 'your-email@gmail.com',
  firstName: 'Test',
  lastName: 'User',
  eventType: 'NEW_LOGIN',
  details: { 
    alerts: [{ type: 'NEW_LOCATION', severity: 'MEDIUM', message: 'Test' }],
    riskScore: 40
  },
  location: { city: 'Lagos', country: 'Nigeria', isp: 'Test ISP' },
  deviceInfo: { browser: 'Chrome', os: 'Windows' },
  timestamp: new Date(),
  riskLevel: 'MEDIUM'
}).then(console.log).catch(console.error);
```

---

## Monitoring & Maintenance

### Daily Tasks
- [ ] Check critical alerts dashboard
- [ ] Review any HIGH severity alerts
- [ ] Verify no email delivery failures

### Weekly Tasks
- [ ] Generate security report
- [ ] Review suspicious users
- [ ] Update detection thresholds if needed
- [ ] Check geolocation API quota

### Monthly Tasks
- [ ] Archive old records (>90 days)
- [ ] Analyze false positive rate
- [ ] Update risk scoring rules
- [ ] Generate compliance report

---

## Troubleshooting

### Issue: Email not sending
**Symptoms**: Alert created but email_sent = false
**Solution**:
1. Check .env EMAIL_* variables
2. Verify Gmail app password (not regular password)
3. Check spam folder
4. Review email service logs

```bash
# Test email service
node -e "require('./services/emailService').verifyConnection()"
```

### Issue: Geolocation always returning "Unknown"
**Symptoms**: All location data is "Unknown"
**Solution**:
1. Check IP is public (not localhost)
2. Verify geolocation API quota not exceeded
3. Check network connectivity
4. Verify timeout is sufficient

### Issue: Risk scores too high/low
**Symptoms**: Too many or too few alerts
**Solution**:
1. Review detection rules in `securityAlertService.js`
2. Adjust risk score weights
3. Update thresholds in alert triggering logic
4. Test with known scenarios

### Issue: Database migration fails
**Symptoms**: Error during `npm run migrate:*`
**Solution**:
1. Verify database connection
2. Check if tables already exist
3. Review migration file for syntax
4. Check user permissions for CREATE TABLE

```bash
# Debug migration
DB_HOST=localhost DB_PORT=5432 DB_USER=postgres npm run migrate:login-locations
```

---

## Performance Optimization

### 1. Database Indexing
Tables are created with proper indexes:
- `idx_login_locations_user_id` - User queries
- `idx_security_alerts_status` - Alert filtering
- `idx_security_alerts_unreviewed` - Dashboard queries

### 2. Geolocation Caching
Add Redis caching for IPs (optional):

```javascript
const cacheKey = `geoloc:${ipAddress}`;
const cached = await cache.get(cacheKey);
if (cached) return JSON.parse(cached);
// ... fetch geolocation
await cache.setex(cacheKey, 300, JSON.stringify(result)); // 5 min TTL
```

### 3. Async Email Sending
Emails are sent non-blocking to avoid response delays.

### 4. Database Query Optimization
Use LIMIT clauses and pagination for large result sets.

---

## Security Best Practices

### ✅ Do
- Review critical alerts within 1 hour
- Keep audit logs for compliance (90+ days)
- Update risk thresholds quarterly
- Test email delivery weekly
- Monitor geolocation API quota
- Archive old records monthly
- Use strong passwords for admin accounts
- Enable 2FA on email account

### ❌ Don't
- Ignore repeated alerts from same user
- Block users without manual review (except threats)
- Store plain text in alert messages
- Use production credentials in logs
- Share admin dashboard publicly
- Disable security checks
- Modify risk scoring without testing

---

## Configuration Examples

### Strict Mode (Fewer False Negatives)
```javascript
// In securityAlertService.js
const RISK_THRESHOLDS = {
  NEW_LOCATION: 50,        // Increased from 40
  NEW_DEVICE: 35,          // Increased from 25
  PATTERN_ANOMALY: 70      // Increased from 60
};

const ALERT_TRIGGER_THRESHOLD = 35; // Alert on MEDIUM risk
```

### Lenient Mode (Fewer False Positives)
```javascript
const RISK_THRESHOLDS = {
  NEW_LOCATION: 25,        // Decreased from 40
  NEW_DEVICE: 10,          // Decreased from 25
  PATTERN_ANOMALY: 50      // Decreased from 60
};

const ALERT_TRIGGER_THRESHOLD = 60; // Alert on HIGH risk only
```

### Balanced Mode (Default - Production)
```javascript
// Uses default thresholds as implemented
// Recommended for most deployments
```

---

## Next Steps

1. ✅ **Complete Setup**: Follow installation steps above
2. ✅ **Run Migrations**: Create database tables
3. ✅ **Configure Email**: Update .env variables
4. ✅ **Test System**: Use test scenarios
5. ✅ **Monitor Dashboard**: Watch for alerts
6. ✅ **Review Alerts**: Respond to critical events
7. ✅ **Optimize**: Adjust thresholds based on data

---

## Support & Documentation

- **Implementation Details**: [IMPLEMENTATION.md](./IMPLEMENTATION.md)
- **Quick Reference**: [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)
- **Security Features**: [../../../security/ENHANCEMENTS.md](../../../security/ENHANCEMENTS.md)
- **Audit Logging**: [../audit-logging/README.md](../audit-logging/README.md)

---

**Last Updated**: April 2026  
**Status**: ✅ Production Ready  
**Version**: 1.0
