# ⚡ Account Deletion - Quick Reference

---

## 📡 API Endpoints

### Request Deletion
```
POST /api/users/request-account-deletion
Authorization: Bearer {token}
Content-Type: application/json

{
  "confirmation_text": "Delete my account"
}
```

**Response**: Confirmation email sent (24hr link)

### Confirm Deletion
```
POST /api/users/confirm-account-deletion
Content-Type: application/json

{
  "token": "{token_from_email}"
}
```

**Response**: Account deleted permanently

### Cancel Deletion
```
POST /api/users/cancel-account-deletion
Authorization: Bearer {token}
```

**Response**: Deletion cancelled

---

## 🗑️ What Gets Deleted

✅ User account  
✅ Medical records  
✅ OTPs  
✅ Password tokens  
✅ Patient profiles  
✅ Session data  
✅ Cache entries  

⚠️ Audit logs (preserved)

---

## ⏱️ Timeline

```
Request → Email (1 min) → Click Link (24 hr window) → DELETED ✓
```

---

## 🔐 Security

✅ Exact text confirmation required  
✅ Email verification required  
✅ 24-hour token expiration  
✅ All deletions logged  
✅ Cannot be reversed  

---

## 🧪 Quick Test

```bash
# Request
curl -X POST http://localhost:3000/api/users/request-account-deletion \
  -H "Authorization: Bearer TOKEN" \
  -d '{"confirmation_text": "Delete my account"}'

# Confirm (use token from email)
curl -X POST http://localhost:3000/api/users/confirm-account-deletion \
  -d '{"token": "TOKEN_FROM_EMAIL"}'
```

---

## ❓ FAQ

| Q | A |
|---|---|
| **Undo deletion?** | No - permanent |
| **How long?** | 24 hours from email |
| **Don't click link?** | Account stays active |
| **Cancel anytime?** | Yes, before email confirmation |
| **GDPR compliant?** | Yes ✅ |

---

**For complete details**: See [SETUP_GUIDE.md](SETUP_GUIDE.md)
