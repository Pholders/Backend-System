# Gmail Setup for Nodemailer - Step by Step

## Prerequisites
- A Gmail account (you can use princengwakomashumu@gmail.com)
- 2-Factor Authentication enabled on that Gmail account

---

## Step 1: Enable 2-Factor Authentication

1. Go to your Google Account: **https://myaccount.google.com**
2. Click on **Security** (left sidebar)
3. Scroll to "How you sign in to Google"
4. Click **2-Step Verification**
5. Follow the prompts to enable it (you'll need your phone)

---

## Step 2: Generate App Password

**IMPORTANT:** You must complete Step 1 first. App Passwords only work with 2FA enabled.

1. Go to: **https://myaccount.google.com/apppasswords**
   - Or navigate: Google Account → Security → 2-Step Verification → App passwords

2. You may need to sign in again

3. Under "Select app":
   - Choose **Mail**

4. Under "Select device":
   - Choose **Other (Custom name)**
   - Enter: **Pholders Backend**

5. Click **Generate**

6. Google will show you a 16-character password like:
   ```
   abcd efgh ijkl mnop
   ```

7. **COPY THIS PASSWORD** - you won't see it again!

---

## Step 3: Update .env File

Open your `.env` file and update these lines:

```env
# Email Configuration (Gmail)
EMAIL_SERVICE=gmail
EMAIL_USER=princengwakomashumu@gmail.com
EMAIL_PASSWORD=abcdefghijklmnop
```

**Replace:**
- `EMAIL_USER` with your actual Gmail address
- `EMAIL_PASSWORD` with the 16-character app password (remove spaces)

**Example:**
If your app password is: `wxyz 1234 abcd 5678`
Enter it as: `wxyz1234abcd5678`

---

## Step 4: Test Email Configuration

Run the test script:

```bash
node test-email.js
```

**Expected output if successful:**
```
=== Testing Email Configuration ===

Email Service: gmail
Email User: princengwakomashumu@gmail.com
Email Password: ✓ Set

1. Testing email connection...
✅ Email service is configured correctly

2. Sending test OTP email...
✅ Test OTP email sent to princengwakomashumu@gmail.com
   Check your inbox for the test email
```

**If you get an error:**
- "Invalid login" → Wrong app password or 2FA not enabled
- "No recipients" → EMAIL_USER not set correctly
- Connection timeout → Check your internet connection/firewall

---

## Step 5: Test Login Flow

1. **Login** (sends OTP via email):
```bash
POST http://localhost:3000/api/users/login
{
  "email": "princengwakomashumu@gmail.com",
  "password": "secure123"
}
```

2. **Check your Gmail inbox** for the OTP code

3. **Verify OTP** (completes login):
```bash
POST http://localhost:3000/api/users/verify-otp
{
  "email": "princengwakomashumu@gmail.com",
  "otp_code": "123456"
}
```

---

## Troubleshooting

### Problem: "Invalid login: 535-5.7.8 Username and Password not accepted"

**Solutions:**
1. Make sure 2-Factor Authentication is enabled first
2. Generate a new App Password (old one might be invalid)
3. Remove all spaces from the app password in .env
4. Make sure you're using App Password, not your Gmail password

### Problem: App Passwords option not showing

**Cause:** 2-Factor Authentication not enabled

**Solution:** Complete Step 1 first, then try Step 2 again

### Problem: Email not arriving

**Check:**
1. Check your Gmail inbox (not spam)
2. Check server logs for "✅ OTP email sent"
3. Look for error messages in console
4. Verify EMAIL_USER matches the Gmail account

### Problem: "Less secure app access" message

**Note:** Google deprecated this in 2022. You MUST use App Passwords now, not "less secure apps".

---

## Alternative Email Providers

If you don't want to use Gmail, you can use:

### SendGrid (Free tier: 100 emails/day)
```env
EMAIL_SERVICE=
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASSWORD=<your-sendgrid-api-key>
```

### Outlook/Office365
```env
EMAIL_SERVICE=
EMAIL_HOST=smtp-mail.outlook.com
EMAIL_PORT=587
EMAIL_USER=your-email@outlook.com
EMAIL_PASSWORD=your-password
```

---

## Security Notes

⚠️ **Never commit .env file to git!**

The `.env` file is already in `.gitignore`, but double-check:
```bash
# Make sure .env is listed in .gitignore
cat .gitignore | findstr ".env"
```

🔒 **App Passwords are safer than regular passwords:**
- They only work for specific apps
- You can revoke them anytime
- They don't give access to your full Google Account

---

## Quick Reference

**Gmail App Password URL:**
https://myaccount.google.com/apppasswords

**Test email command:**
```bash
node test-email.js
```

**Check OTPs in database:**
```bash
node get-otp.js
```

**Development mode:**
- Set `NODE_ENV=development` in .env
- OTP will be included in login response
- Emails not required for testing

**Production mode:**
- Set `NODE_ENV=production` in .env
- Email MUST be configured
- OTP only sent via email
