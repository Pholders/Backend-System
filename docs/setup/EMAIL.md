# Email Configuration Setup

## Overview
Complete guide to email configuration for OTP, password reset, and system notifications.

---

## Quick Setup

### Gmail (Easiest)
```env
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
```

See [GMAIL.md](GMAIL.md) for detailed setup

### SendGrid
```env
EMAIL_SERVICE=sendgrid
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASSWORD=your-sendgrid-api-key
```

### Outlook/Office365
```env
EMAIL_SERVICE=outlook
EMAIL_HOST=smtp-mail.outlook.com
EMAIL_PORT=587
EMAIL_USER=your-email@outlook.com
EMAIL_PASSWORD=your-password
```

---

## Testing Email

```bash
# Run test script
node test-email.js

# Output:
# ✅ Email service is configured correctly
# ✅ Test email sent successfully
```

---

## Environment Variables

```env
# Email service
EMAIL_SERVICE=gmail|sendgrid|outlook

# Email credentials
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-password

# Optional (for non-standard providers)
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
```

---

## Features

✅ OTP delivery  
✅ Password reset emails  
✅ System notifications  
✅ HTML templates  
✅ Security warnings included  

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Email not sending | Check credentials in .env |
| Invalid login | Ensure 2FA enabled (Gmail) |
| Connection timeout | Check firewall settings |
| Email in spam | Whitelist sender address |

---

**Status**: ✅ Production Ready
