# Google OAuth Implementation - Quick Start

## ⚡ Quick Setup (5 minutes)

### 1. Update package.json

Add to your `package.json` scripts:

```json
{
  "scripts": {
    "migrate:oauth": "node config/addOAuthSupport.js"
  }
}
```

### 2. Run Migration

```bash
npm run migrate:oauth
```

Expected output:
```
🔄 Starting OAuth support migration...
✅ Added OAuth columns
✅ Made password_hash nullable for OAuth users
✅ Created OAuth index
✅ OAuth support migration completed successfully
```

### 3. Update .env

```bash
# Copy from .env.example and fill in:
GOOGLE_CLIENT_ID=your_id
GOOGLE_CLIENT_SECRET=your_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/users/auth/google/callback
SESSION_SECRET=your_random_secret
```

### 4. Restart Server

```bash
npm run dev
```

Should see:
```
✅ Connected to PostgreSQL database
🚀 Server is running on port 3000
```

### 5. Test It

Open browser and go to:
```
http://localhost:3000/api/users/auth/google
```

---

## 📋 What Was Implemented

### Backend Files Modified/Created:

1. **config/passport.js** - Passport configuration with Google Strategy
2. **config/addOAuthSupport.js** - Database migration for OAuth fields
3. **controllers/userController.js** - Added 3 new methods:
   - `googleAuth()` - Initiate Google login
   - `googleAuthCallback()` - Handle Google callback
   - `completeOAuthProfile()` - Complete profile for new users
4. **models/User.js** - Added 2 new methods:
   - `findByOAuthProvider()` - Find user by OAuth provider
   - `createOAuthUser()` - Create OAuth user account
5. **routes/userRoutes.js** - Added 3 new routes:
   - `GET /auth/google` - Initiate login
   - `GET /auth/google/callback` - OAuth callback
   - `POST /auth/complete-profile` - Complete profile
6. **server.js** - Added Passport and session middleware

### Dependencies Installed:

```bash
✅ passport
✅ passport-google-oauth20
✅ passport-local
✅ express-session
```

### New npm Scripts:

```bash
npm run migrate:oauth          # Run OAuth migration
npm run dev                    # Start with nodemon
```

---

## 🔄 OAuth Flow Diagram

```
User clicks "Sign up with Google"
         ↓
   GET /auth/google
         ↓
   Google Consent Screen
         ↓
   User approves
         ↓
   GET /auth/google/callback
         ↓
   ✓ Profile Complete? → Generate tokens → Frontend with tokens
         ↓ (No)
   Profile Incomplete → Redirect to /complete-profile page
         ↓
   User fills: phone, ID, nationality
         ↓
   POST /auth/complete-profile
         ↓
   Generate tokens → Redirect to dashboard
```

---

## 🧪 Testing

### Test 1: Initiate OAuth

```bash
curl -L http://localhost:3000/api/users/auth/google
```

Should redirect to Google consent screen (look at redirect URL)

### Test 2: Check Database

```sql
-- Check if OAuth columns exist
\d patients

-- Should show columns:
-- oauth_provider | character varying(50)
-- oauth_provider_id | character varying(255)
-- oauth_profile_picture | text
```

### Test 3: Complete Profile

```bash
curl -X POST http://localhost:3000/api/users/auth/complete-profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+27123456789",
    "id_passport_number": "SA123456789",
    "nationality": "South African"
  }'
```

---

## 🎯 Frontend Integration (Next Steps)

### 1. Add Sign-up Button

```html
<a href="http://localhost:3000/api/users/auth/google" class="btn-google">
  Sign up with Google
</a>
```

### 2. Create OAuth Callback Handler

```javascript
// pages/auth-callback.js
const params = new URLSearchParams(window.location.search);
const accessToken = params.get('accessToken');
const refreshToken = params.get('refreshToken');

if (accessToken) {
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('refreshToken', refreshToken);
  window.location.href = '/dashboard';
}
```

### 3. Handle Profile Completion

```javascript
// pages/complete-profile.js
const tempToken = new URLSearchParams(window.location.search).get('token');

async function submitProfile(phone, idPassport, nationality) {
  const response = await fetch(
    'http://localhost:3000/api/users/auth/complete-profile',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tempToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phone, id_passport_number: idPassport, nationality
      })
    }
  );
  
  if (response.ok) {
    window.location.href = '/dashboard';
  }
}
```

---

## 🔧 Troubleshooting

### Error: "GOOGLE_CLIENT_ID is not defined"

**Solution:** Add to .env and restart server:
```bash
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

### Error: "Callback URL mismatch"

**Solution:**
1. Check GOOGLE_CALLBACK_URL in .env matches your route
2. Add the exact URL to Google Cloud Console
3. Default: `http://localhost:3000/api/users/auth/google/callback`

### Error: "Cannot find module 'passport'"

**Solution:** Install dependencies:
```bash
npm install passport passport-google-oauth20 express-session passport-local
```

### Error: "Migration failed: relation 'patients' does not exist"

**Solution:** Initialize database first:
```bash
npm run init-db
npm run migrate
npm run migrate:oauth
```

---

## 📚 Documentation

For complete documentation, see:
- [GOOGLE_OAUTH_SETUP.md](./GOOGLE_OAUTH_SETUP.md) - Comprehensive guide
- [.env.example](../.env.example) - Environment variables
- [README.md](../../README.md) - Project overview

---

## ✅ Verification Checklist

- [ ] Dependencies installed (`npm install` successful)
- [ ] Migration ran (`npm run migrate:oauth` successful)
- [ ] .env variables set (GOOGLE_CLIENT_ID, etc.)
- [ ] Server starts (`npm run dev` no errors)
- [ ] Database columns added (check with `\d patients`)
- [ ] Routes available (test in Postman or browser)
- [ ] Frontend routes created
- [ ] Testing in browser works

---

## 🚀 Production Deployment

Before deploying to production:

1. **Update .env for production:**
   ```bash
   NODE_ENV=production
   FRONTEND_URL=https://yourdomain.com
   GOOGLE_CALLBACK_URL=https://yourdomain.com/api/users/auth/google/callback
   ```

2. **Add HTTPS URLs to Google Console:**
   - Redirect URIs: `https://yourdomain.com/api/users/auth/google/callback`
   - JavaScript origins: `https://yourdomain.com`

3. **Set secure cookies:**
   - Session middleware has `secure: true` in production (requires HTTPS)

4. **Enable security headers:**
   - Add CORS for your frontend domain only
   - Use HTTPS everywhere

5. **Database backup:**
   - Ensure automatic backups are configured

---

## 📞 Support Resources

- [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Passport.js Guide](http://www.passportjs.org/docs)
- [Express Session Docs](https://github.com/expressjs/session)

---

**Version:** 1.0.0  
**Last Updated:** May 2026  
**Status:** ✅ Production Ready
