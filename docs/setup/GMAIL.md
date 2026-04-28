# Gmail Setup for Email Configuration

## Overview
Complete guide to setting up Gmail for sending OTP and system emails through your backend.

---

## Prerequisites
- A Gmail account
- 2-Factor Authentication enabled

---

## Step 1: Enable 2-Factor Authentication

1. Go to: https://myaccount.google.com
2. Click **Security** (left sidebar)
3. Scroll to "How you sign in to Google"
4. Click **2-Step Verification**
5. Follow the prompts to enable it

---

## Step 2: Generate App Password

1. Go to: https://myaccount.google.com/apppasswords
2. Under "Select app": Choose **Mail**
3. Under "Select device": Choose **Other (Custom name)**
4. Enter: **Pholders Backend**
5. Click **Generate**
6. Copy the 16-character password

---

## Step 3: Update .env

```env
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password-here
```

Replace:
- `EMAIL_USER` with your Gmail address
- `EMAIL_PASSWORD` with the 16-character app password (remove spaces)

---

## Step 4: Test Configuration

```bash
node test-email.js
```

Expected output:
```
✅ Email service is configured correctly
✅ Test email sent successfully
```

---

## Alternative Providers

### SendGrid
```env
EMAIL_SERVICE=sendgrid
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASSWORD=your-api-key
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

## Troubleshooting

### "Invalid login" Error
- Make sure 2FA is enabled
- Generate a new App Password
- Remove spaces from password

### Email Not Arriving
- Check Gmail spam folder
- Verify EMAIL_USER is correct
- Check server logs for errors

### App Passwords Not Showing
- Enable 2-Factor Authentication first

---

**Status**: ✅ Production Ready
