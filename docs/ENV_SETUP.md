# 🔐 Environment Variables Setup Guide

## Overview

This guide explains how credentials are kept secure in this project using `.env` and `.env.example`.

## File Structure

```
Backend-System/
├── .env                 ← REAL credentials (GITIGNORED - stays local)
├── .env.example         ← TEMPLATE only (committed to git)
├── .gitignore           ← Tells git to ignore .env files
└── ...other files
```

## 🚀 For New Developers

### Step 1: Clone the Repository
```bash
git clone <repository-url>
cd Backend-System
```

### Step 2: Create Your Local .env
```bash
cp .env.example .env
```

### Step 3: Fill in Real Credentials

Edit `.env` with your editor:
```bash
# On Windows
notepad .env

# On Mac/Linux
nano .env
```

Replace template values with real credentials:

**Before (template):**
```
DB_PASSWORD=your_database_password_here
GOOGLE_CLIENT_ID=your_google_client_id_here
```

**After (real values):**
```
DB_PASSWORD=Prince@082
GOOGLE_CLIENT_ID=598386378545-f10bb0fjq9oevpadlomg3ie66u9of4c7.apps.googleusercontent.com
```

### Step 4: Verify Git Ignoring

```bash
# Check that .env is ignored
git status

# Output should show:
# - .env is NOT listed
# - .env.example may show as unchanged or modified
```

### Step 5: Start Development
```bash
npm install
npm run dev
```

---

## 📋 Security Information

### What Gets Committed to Git

✅ **Committed (Safe to Share):**
- `.env.example` - Template with placeholders
- `.gitignore` - Git ignore rules
- Source code
- Configuration files (without secrets)

❌ **NOT Committed (Never Shared):**
- `.env` - Real credentials
- `.env.local` - Local development secrets
- `.env.production` - Production secrets
- Any file with real passwords/API keys

### Credential Examples

| Variable | Example | Sensitivity |
|----------|---------|------------|
| `DB_PASSWORD` | `Prince@082` | 🔴 **SECRET** |
| `GOOGLE_CLIENT_SECRET` | `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` | 🔴 **SECRET** |
| `EMAIL_PASSWORD` | `tidbvhgddyjbkaeb` | 🔴 **SECRET** |
| `JWT_SECRET` | (long random string) | 🔴 **SECRET** |
| `DB_HOST` | `localhost` | 🟢 **public** |
| `PORT` | `3000` | 🟢 **public** |

---

## 🔧 Required Environment Variables

### Server Configuration
```bash
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

### Database
```bash
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_database_password_here
DB_NAME=pholders
```

### Google OAuth
```bash
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_CALLBACK_URL=http://localhost:3000/api/users/auth/google/callback
```

### Email (Gmail)
```bash
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password_here
```

### Security
```bash
JWT_SECRET=your_jwt_secret_key_change_in_production
SESSION_SECRET=your_session_secret_change_in_production
```

---

## ⚠️ Important Rules

### DO ✅
- [x] Keep `.env` in `.gitignore`
- [x] Edit `.env` with real credentials
- [x] Commit `.env.example` (template)
- [x] Share `.env` values securely (encrypted message, password manager)
- [x] Rotate credentials regularly
- [x] Use strong random secrets

### DON'T ❌
- [ ] Commit `.env` to git
- [ ] Share `.env` file via email/chat
- [ ] Use weak passwords
- [ ] Hardcode secrets in source code
- [ ] Push real credentials to public repos
- [ ] Reuse same credentials across projects

---

## 🆘 Troubleshooting

### Issue: "Cannot find module 'dotenv'"
```bash
# Solution: Install dependencies
npm install
```

### Issue: ".env not being loaded"
```bash
# Verify .env exists in project root
ls -la .env

# Check that require('dotenv').config() is at top of server.js
grep "dotenv" server.js
```

### Issue: ".env is being committed to git"
```bash
# Remove from git history
git rm --cached .env
git commit -m "Stop tracking .env"

# Make sure .gitignore has .env
grep ".env" .gitignore
```

### Issue: "Environment variables undefined"
```bash
# Verify values are in .env
cat .env | grep VARIABLE_NAME

# Restart server to reload .env
npm run dev
```

---

## 🚀 For Production Deployment

### DO NOT use .env files in production!

Instead, use:

**Option 1: Environment Variables (Direct)**
```bash
export DB_PASSWORD="prod-password"
export GOOGLE_CLIENT_SECRET="prod-secret"
npm start
```

**Option 2: Docker Secrets**
```dockerfile
ENV DB_PASSWORD=${DB_PASSWORD}
ENV GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
```

**Option 3: Secret Manager**
- AWS Secrets Manager
- Azure Key Vault
- HashiCorp Vault
- Doppler

### Production Checklist
- [ ] Use HTTPS (not HTTP)
- [ ] Set `NODE_ENV=production`
- [ ] Use strong random values for all `*_SECRET` variables
- [ ] Store credentials in secure vault (not .env)
- [ ] Enable error logging (no stack traces exposed)
- [ ] Regular credential rotation
- [ ] Database backups configured

---

## 📚 Related Documentation

- [Google OAuth Setup](../setup/GOOGLE_OAUTH_SETUP.md)
- [OAuth Quick Start](../setup/OAUTH_QUICK_START.md)
- [Credential Security Best Practices](https://12factor.net/config)

---

## ✅ Verification Checklist

Before committing:
- [ ] `.env` is in `.gitignore`
- [ ] `.env.example` has only placeholder values
- [ ] `.env` file exists locally with real credentials
- [ ] `.env` is NOT tracked by git (`git status` doesn't show it)
- [ ] Server starts successfully (`npm run dev`)
- [ ] Database connection works
- [ ] Google OAuth configured

---

**Last Updated:** May 2026  
**Status:** ✅ Secure Implementation
