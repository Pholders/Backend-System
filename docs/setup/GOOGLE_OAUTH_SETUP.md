# Google OAuth Implementation Guide

## Overview

This guide explains how to implement and use Google OAuth signup/login in the backend system. Google OAuth allows users to sign up and log in using their Google credentials without needing to create a separate password.

## Features

✅ **Google OAuth 2.0 Authentication**
✅ **Automatic User Account Creation**
✅ **Profile Completion Flow** (phone, ID/passport, nationality)
✅ **Session Management**
✅ **JWT Token Generation**
✅ **Security Logging & Audit Trails**
✅ **Account Linking** (link Google to existing accounts)

---

## Setup Instructions

### Step 1: Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable the Google+ API:
   - Navigate to **APIs & Services** → **Library**
   - Search for "Google+ API"
   - Click on it and press **Enable**

4. Create OAuth 2.0 Credentials:
   - Go to **APIs & Services** → **Credentials**
   - Click **+ Create Credentials** → **OAuth client ID**
   - Choose **Web application**
   - Add authorized redirect URIs:
     ```
     http://localhost:3000/api/users/auth/google/callback  (development)
     https://yourdomain.com/api/users/auth/google/callback  (production)
     ```
   - Add authorized JavaScript origins:
     ```
     http://localhost:3000  (development)
     https://yourdomain.com  (production)
     ```
   - Copy your **Client ID** and **Client Secret**

### Step 2: Set Environment Variables

Add these variables to your `.env` file:



**Important:** 
- Never commit `.env` to version control
- Use strong, random values for secrets in production
- Use HTTPS in production for security

### Step 3: Run Database Migration

Add OAuth fields to your users table:

```bash
npm run migrate:oauth-support
```

Or manually add this migration script to your `package.json`:

```json
{
  "scripts": {
    "migrate:oauth-support": "node config/addOAuthSupport.js"
  }
}
```

### Step 4: Restart Server

```bash
npm run dev
```

The server should now be ready to handle Google OAuth requests.

---

## API Endpoints

### 1. Initiate Google Login/Signup

**Endpoint:** `GET /api/users/auth/google`

Redirects user to Google OAuth consent screen.

**Frontend Example:**
```html
<a href="http://localhost:3000/api/users/auth/google">
  Sign up with Google
</a>
```

### 2. Google OAuth Callback

**Endpoint:** `GET /api/users/auth/google/callback`

Google redirects back here after user approves. This is handled automatically by Passport.

### 3. Complete OAuth Profile

**Endpoint:** `POST /api/users/auth/complete-profile`

For new OAuth users without complete profiles.

**Request Headers:**
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request Body:**
```json
{
  "phone": "+27123456789",
  "id_passport_number": "SA123456789",
  "nationality": "South African"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Profile completed successfully",
  "data": {
    "user": {
      "id": 1,
      "first_name": "John",
      "last_name": "Doe",
      "email": "john@gmail.com",
      "phone": "+27123456789",
      "id_passport_number": "SA123456789",
      "nationality": "South African",
      "oauth_provider": "google",
      "oauth_profile_picture": "https://..."
    }
  }
}
```

---

## Authentication Flow

### For New OAuth Users (No Existing Account)

```
1. User clicks "Sign up with Google"
   ↓
2. GET /api/users/auth/google (redirects to Google)
   ↓
3. User approves permissions on Google
   ↓
4. Google redirects to callback endpoint
   ↓
5. Passport verifies and creates user account with:
   - First name, Last name, Email from Google profile
   - oauth_provider = "google"
   - oauth_provider_id = Google user ID
   - oauth_profile_picture = Google profile image
   ↓
6. Check if profile is complete (phone, ID, nationality)
   ↓
7. If NOT complete → Redirect to /complete-profile page
   User must provide: phone, ID/passport, nationality
   ↓
8. POST /api/users/auth/complete-profile
   ↓
9. Generate tokens and session
   ↓
10. Redirect to frontend with tokens
```

### For Existing Account Linking

```
1. OAuth user exists with email match
   ↓
2. Link Google OAuth to existing account
   ↓
3. Update oauth_provider and oauth_provider_id fields
   ↓
4. Log in successfully
```

---

## Frontend Integration

### Step 1: Add Sign-up Button

```html
<a href="http://localhost:3000/api/users/auth/google" class="btn-google">
  Sign up with Google
</a>
```

### Step 2: Handle OAuth Callback

After Google OAuth callback, your frontend receives:

**URL with params:**
```
http://localhost:3000/auth-callback?accessToken=...&refreshToken=...&userId=...&email=...&success=true
```

**Extract tokens and store:**
```javascript
const params = new URLSearchParams(window.location.search);
const accessToken = params.get('accessToken');
const refreshToken = params.get('refreshToken');
const userId = params.get('userId');

localStorage.setItem('accessToken', accessToken);
localStorage.setItem('refreshToken', refreshToken);
localStorage.setItem('userId', userId);
```

### Step 3: Complete Profile (if needed)

Detect if redirect is to `/complete-profile`:

```javascript
// URL: /complete-profile?token=...&email=...
const tempToken = params.get('token');

// Show profile completion form
// On submit:
const response = await fetch('/api/users/auth/complete-profile', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${tempToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    phone: formData.phone,
    id_passport_number: formData.idPassport,
    nationality: formData.nationality
  })
});

// After completion, redirect to login/dashboard
```

### Step 4: Subsequent Requests

Use the access token for authenticated API calls:

```javascript
const headers = {
  'Authorization': `Bearer ${accessToken}`,
  'Content-Type': 'application/json'
};

// Get user profile
const profile = await fetch('/api/users/profile', { headers });

// Make authenticated requests
```

---

## Database Schema

### OAuth Fields Added to `patients` Table

```sql
ALTER TABLE patients ADD COLUMN IF NOT EXISTS:
  - oauth_provider VARCHAR(50)           -- 'google', 'facebook', etc.
  - oauth_provider_id VARCHAR(255)       -- Provider's user ID
  - oauth_profile_picture TEXT           -- URL to profile picture
```

**Example Data:**
```sql
INSERT INTO patients (
  first_name, last_name, email, oauth_provider, 
  oauth_provider_id, oauth_profile_picture
) VALUES (
  'John', 'Doe', 'john@gmail.com', 'google',
  '123456789', 'https://lh3.google.com/...'
);
```

---

## Security Considerations

### ✅ Best Practices Implemented

1. **Token Security**
   - Access tokens expire in 15 minutes
   - Refresh tokens for long-term sessions
   - Tokens stored securely (httpOnly cookies recommended)

2. **Session Management**
   - Sessions stored server-side
   - CSRF protection enabled
   - Secure cookies in production

3. **OAuth Scope**
   - Only requesting: `profile`, `email`
   - Minimal permissions needed

4. **Audit Logging**
   - All OAuth events logged to audit_logs
   - IP address and user agent tracked
   - Failed attempts recorded

5. **Profile Completion**
   - Required fields: phone, ID/passport, nationality
   - Temporary token for profile completion (expires in 24h)

### ⚠️ Production Security Checklist

- [ ] Use HTTPS only (not HTTP)
- [ ] Set `NODE_ENV=production`
- [ ] Use strong `SESSION_SECRET` and `GOOGLE_CLIENT_SECRET`
- [ ] Store secrets in secure environment (not in code)
- [ ] Enable CORS only for your frontend domain
- [ ] Implement rate limiting on OAuth endpoints
- [ ] Use secure database credentials
- [ ] Enable HTTPS for OAuth callback URL
- [ ] Rotate credentials regularly

---

## Error Handling

### Common OAuth Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `auth_failed` | OAuth credentials invalid | Check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET |
| `callback_failed` | Callback URL mismatch | Verify GOOGLE_CALLBACK_URL in .env and Google Console |
| `Invalid or expired token` | Session expired | User must log in again |
| `Profile incomplete` | Missing required fields | User must complete profile first |

### Debugging

Enable debug logging in Passport:

```javascript
passport.use(new GoogleStrategy({
  // ... config
}, (accessToken, refreshToken, profile, done) => {
  console.log('Google Profile:', profile);  // Debug
  // ... rest of strategy
}));
```

---

## Testing

### Test OAuth Flow Locally

1. **Start server:**
   ```bash
   npm run dev
   ```

2. **Open browser and navigate to:**
   ```
   http://localhost:3000/api/users/auth/google
   ```

3. **Google will redirect to consent screen**
   - You may need to log in to your Google account

4. **After approval, should redirect to:**
   ```
   http://localhost:3000/auth-callback?accessToken=...&success=true
   ```

5. **Or if profile incomplete:**
   ```
   http://localhost:3000/complete-profile?token=...
   ```

### Test with cURL (Postman)

```bash
# Get redirect URL (follow redirects)
curl -L "http://localhost:3000/api/users/auth/google"

# Complete profile endpoint
curl -X POST http://localhost:3000/api/users/auth/complete-profile \
  -H "Authorization: Bearer {accessToken}" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+27123456789",
    "id_passport_number": "SA123456789",
    "nationality": "South African"
  }'
```

---

## Troubleshooting

### Issue: "Callback URL mismatch"

**Solution:**
1. Verify `GOOGLE_CALLBACK_URL` in `.env`
2. Add the exact URL to Google Console:
   - Go to Credentials → OAuth Client → Authorized redirect URIs
   - Add: `http://localhost:3000/api/users/auth/google/callback`

### Issue: "Google strategy not configured"

**Solution:**
- Ensure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set in `.env`
- Restart server after updating `.env`

### Issue: "User not created"

**Solution:**
- Check database connection
- Ensure `patients` table has OAuth columns (run migration)
- Check server logs for detailed error

### Issue: "Tokens not received after callback"

**Solution:**
- Check FRONTEND_URL in `.env`
- Verify frontend can receive URL parameters
- Check browser console for errors

---

## Advanced Configuration

### Linking to Existing Accounts

If user logs in via OAuth but email already exists:

```javascript
// Automatically links OAuth to existing account
let user = await User.findByOAuthProvider('google', profile.id);

if (!user) {
  user = await User.findByEmail(profile.emails[0].value);
  
  if (user) {
    // Link OAuth to existing account
    await User.update(user.id, {
      oauth_provider: 'google',
      oauth_provider_id: profile.id
    });
  }
}
```

### Custom Claims in JWT

Modify JWT payload in controller:

```javascript
const token = jwt.sign(
  { 
    id: user.id, 
    email: user.email,
    role: user.role,
    type: 'patient',
    oauth_provider: user.oauth_provider,  // Include provider
    hasCompletedProfile: !!user.phone
  },
  process.env.JWT_SECRET,
  { expiresIn: '7d' }
);
```

### Multiple OAuth Providers

To add Facebook, GitHub, etc.:

1. Install additional strategies:
   ```bash
   npm install passport-facebook passport-github2
   ```

2. Add to `config/passport.js`:
   ```javascript
   passport.use(new FacebookStrategy({ ... }));
   passport.use(new GitHubStrategy({ ... }));
   ```

3. Add routes:
   ```javascript
   router.get('/auth/facebook', passport.authenticate('facebook'));
   router.get('/auth/facebook/callback', UserController.facebookAuthCallback);
   ```

---

## References

- [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Passport.js Documentation](http://www.passportjs.org/)
- [Passport Google OAuth Strategy](https://github.com/jaredhanson/passport-google-oauth2)
- [Express Session Documentation](https://github.com/expressjs/session)

---

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review server logs: `console.log()` outputs
3. Check browser console for frontend errors
4. Verify all environment variables are set correctly

---

**Last Updated:** May 2026  
**Version:** 1.0.0  
**Status:** Production Ready
