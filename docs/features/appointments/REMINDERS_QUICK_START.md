# Appointment Reminders - Quick Start Guide

## ⚡ Installation (3 Steps)

### Step 1: Restart Server
The appointment reminders tables will be automatically created when the server starts.

```bash
# Stop current server (Ctrl+C)
# Then restart it
npm start
# or
node server.js
```

You should see logs like:
```
📅 Initializing Appointment Reminder Scheduler...
✅ Reminder Scheduler initialized (checks every 5 minutes)
```

### Step 2: Verify Installation
```bash
curl http://localhost:3000/api/health
```

### Step 3: Start Using!
You're ready to use appointment reminders via the API.

---

## 📱 API Quick Reference

### Set Reminder (Most Common)
```bash
curl -X POST http://localhost:3000/api/users/appointments/5/reminders \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reminderTimes": [1440, 60],
    "reminderMethods": ["email"]
  }'
```

**Common reminder times:**
- `1440` = 1 day before
- `720` = 12 hours before
- `60` = 1 hour before
- `30` = 30 minutes before

---

### Get Upcoming Reminders
```bash
curl -X GET http://localhost:3000/api/users/reminders/upcoming \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### Update Reminder
```bash
curl -X PUT http://localhost:3000/api/users/appointments/5/reminders \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reminderTimes": [1440, 720, 60],
    "reminderMethods": ["email", "sms"]
  }'
```

---

### Disable Reminder Temporarily
```bash
curl -X PATCH http://localhost:3000/api/users/appointments/5/reminders/toggle \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isEnabled": false}'
```

---

### Delete Reminder
```bash
curl -X DELETE http://localhost:3000/api/users/appointments/5/reminders \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 🎯 Common Scenarios

### Scenario 1: Patient Wants Reminder 1 Day Before
```json
{
  "reminderTimes": [1440],
  "reminderMethods": ["email"]
}
```

### Scenario 2: Multiple Reminders at Different Times
```json
{
  "reminderTimes": [1440, 60],
  "reminderMethods": ["email", "sms"]
}
```
- Gets email 1 day before
- Gets SMS 1 hour before

### Scenario 3: Three Reminders with Different Methods
```json
{
  "reminderTimes": [1440, 720, 60],
  "reminderMethods": ["email", "sms", "push"]
}
```
- Email 1 day before
- SMS 12 hours before
- Push notification 1 hour before

---

## 📊 How It Works

### Automatic Sending
1. Server checks every 5 minutes for due reminders
2. Finds reminders where appointment time matches reminder time (±2 min tolerance)
3. Sends notifications via configured methods
4. Records in notification history

### Timeline Example
If patient sets reminders for [1440, 60] minutes with ["email"]:

```
Day 1, 10:00 AM - Patient sets reminder for Day 2, 10:00 AM appointment
Day 1, 10:00 AM - Reminder stored in database ✓

Day 2, 10:00 AM - Appointment time
  - 09:58-10:02 AM: Email sent (60 min before)
  - Day 1, 9:58-10:02 AM: Email sent (1440 min before)
```

---

## 🔍 Debugging

### Check if Scheduler is Running
```bash
# Look at server logs on startup, should show:
# ✅ Reminder Scheduler initialized (checks every 5 minutes)
```

### View All Patient Reminders
```bash
curl -X GET http://localhost:3000/api/users/reminders \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Check Notification History
```bash
curl -X GET http://localhost:3000/api/users/appointments/5/notification-history \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## ⚙️ Configuration

### Change Scheduler Check Interval
Edit `services/reminderSchedulerService.js`:
```javascript
// Default: 5 minutes
static checkIntervalMinutes = 5;

// Change to 10 minutes (checks less frequently)
static checkIntervalMinutes = 10;
```

---

## 📝 Database Queries (Admin)

### View All Reminders
```sql
SELECT * FROM appointment_reminders ORDER BY created_at DESC;
```

### View Sent Notifications Today
```sql
SELECT * FROM reminder_notification_history 
WHERE DATE(sent_at) = CURRENT_DATE
ORDER BY sent_at DESC;
```

### View Failed Notifications
```sql
SELECT * FROM reminder_notification_history 
WHERE status = 'failed'
ORDER BY sent_at DESC;
```

### View Reminders for Specific Patient
```sql
SELECT ar.* FROM appointment_reminders ar
JOIN patients p ON ar.patient_id = p.id
WHERE p.email = 'patient@example.com'
ORDER BY ar.created_at DESC;
```

---

## 🚀 Next Steps

1. **✅ Server is ready** - Restart and verify initialization
2. **Test with API** - Try setting a reminder with the curl examples above
3. **Monitor logs** - Watch for scheduler messages
4. **Integrate with frontend** - Use the endpoints in your React app
5. **Customize** - Adjust reminder times based on user preferences

---

## 📚 Full Documentation

For complete API documentation, see: [APPOINTMENT_REMINDERS.md](./APPOINTMENT_REMINDERS.md)

Key sections:
- Full API endpoint specifications
- Request/response examples
- Database schema details
- Error handling
- Testing procedures

---

## ❓ Troubleshooting

**Q: Reminders not sending?**
A: Check:
1. Server logs show scheduler initialized
2. `appointment_reminders` table has data
3. Appointment time is set correctly
4. Reminder is enabled (`is_enabled = true`)

**Q: How do I send test reminders?**
A: Use manual scheduler trigger:
```javascript
// In server code or admin endpoint:
const ReminderSchedulerService = require('./services/reminderSchedulerService');
await ReminderSchedulerService.triggerReminderCheck();
```

**Q: Can I change reminder times after setting?**
A: Yes, use the PUT endpoint to update:
```bash
PUT /api/users/appointments/{id}/reminders
```

**Q: What if I need SMS/push notifications?**
A: Those are ready for integration:
- SMS: Connect Twilio or AWS SNS in `reminderNotificationService.js`
- Push: Connect Firebase or OneSignal in `reminderNotificationService.js`
- Email: ✅ Already working!

---

## 📞 Support

For issues or questions, check:
1. Server logs for error messages
2. Database entries in reminder tables
3. API response status codes
4. Full documentation in `APPOINTMENT_REMINDERS.md`

---

**Quick Start Complete!** 🎉  
Your appointment reminder system is ready to use.
