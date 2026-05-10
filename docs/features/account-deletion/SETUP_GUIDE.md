# 🎯 Account Deletion Feature - Setup Guide

**Status**: ✅ **READY TO USE**  
**Date**: April 29, 2026

---

## 🚀 Quick Setup (5 Minutes)

### Step 1: Initialize Database Table

```bash
node config/initDb.js
```

**Expected Output**:
```
🔄 Starting database initialization...
✅ Account deletion tokens table created
✅ Database initialization completed successfully
```

### Step 2: Test the Feature

```bash
# 1. Request deletion
curl -X POST http://localhost:3000/api/users/request-account-deletion \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"confirmation_text": "Delete my account"}'

# Expected Response:
# {
#   "success": true,
#   "message": "Confirmation email sent!"
# }
```

### Step 3: Confirm from Email

- Check your email
- Click "Confirm Deletion" link
- Account permanently deleted

---

## 📡 API Endpoints

### 1. Request Deletion (Authenticated)
```
POST /api/users/request-account-deletion

Headers:
  Authorization: Bearer {jwt_token}

Body:
  {
    "confirmation_text": "Delete my account"
  }
```

### 2. Confirm Deletion (Token-based)
```
POST /api/users/confirm-account-deletion

Body:
  {
    "token": "token_from_email_link"
  }
```

### 3. Cancel Deletion (Authenticated)
```
POST /api/users/cancel-account-deletion

Headers:
  Authorization: Bearer {jwt_token}
```

---

## 🧪 Full Test Scenarios

### Scenario 1: Normal Deletion
```bash
# 1. Request
curl -X POST http://localhost:3000/api/users/request-account-deletion \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"confirmation_text": "Delete my account"}'

# 2. Get token from email

# 3. Confirm
curl -X POST http://localhost:3000/api/users/confirm-account-deletion \
  -H "Content-Type: application/json" \
  -d '{"token": "TOKEN_FROM_EMAIL"}'
```

### Scenario 2: Wrong Confirmation Text
```bash
curl -X POST http://localhost:3000/api/users/request-account-deletion \
  -H "Authorization: Bearer TOKEN" \
  -d '{"confirmation_text": "Delete account"}'

# Response: 400 - Wrong text
```

### Scenario 3: Cancel Deletion
```bash
# 1. Request deletion
curl -X POST http://localhost:3000/api/users/request-account-deletion \
  -H "Authorization: Bearer TOKEN" \
  -d '{"confirmation_text": "Delete my account"}'

# 2. Cancel
curl -X POST http://localhost:3000/api/users/cancel-account-deletion \
  -H "Authorization: Bearer TOKEN"
```

---

## 💻 Frontend Implementation

### React Component Example
```jsx
function AccountDeletion() {
  const [confirmed, setConfirmed] = useState('');

  const handleRequestDeletion = async () => {
    if (confirmed !== 'Delete my account') {
      alert('Type exactly: "Delete my account"');
      return;
    }

    const response = await fetch('/api/users/request-account-deletion', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ confirmation_text: confirmed })
    });

    const data = await response.json();
    if (data.success) {
      alert('Check your email to confirm deletion');
    }
  };

  return (
    <div>
      <h2>Delete Account</h2>
      <p>⚠️ This action is permanent!</p>
      <input
        placeholder='Type "Delete my account" to confirm'
        value={confirmed}
        onChange={(e) => setConfirmed(e.target.value)}
      />
      <button onClick={handleRequestDeletion}>Request Deletion</button>
    </div>
  );
}
```

---

## ✅ Deployment Checklist

- [ ] Database table created
- [ ] Email service configured
- [ ] All endpoints tested
- [ ] Email delivery verified
- [ ] Token expiration tested
- [ ] Cancel workflow tested
- [ ] Audit logs checked
- [ ] Security review done
- [ ] Documentation reviewed
- [ ] Frontend integration ready

---

## 📊 Database Monitoring

### View Active Deletions
```sql
SELECT * FROM account_deletion_tokens
WHERE confirmed = FALSE
AND cancelled = FALSE
AND deletion_token_expires_at > CURRENT_TIMESTAMP;
```

### View Deletion History
```sql
SELECT * FROM account_deletion_tokens
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🐛 Troubleshooting

**Email not received?**
- Check spam folder
- Verify email configuration in `.env`
- Resend by requesting deletion again

**Token expired?**
- Token valid for 24 hours only
- Request new deletion if expired

**User not deleted?**
- Verify token was clicked
- Check if token is valid
- Query database for errors

---

## 📚 More Information

- [Full Implementation Guide](IMPLEMENTATION.md)
- [Quick API Reference](QUICK_REFERENCE.md)
- [Email Template Design](EMAIL_TEMPLATE.md)
- [Main Documentation Index](../../../README.md)

---

**Status**: ✅ READY FOR PRODUCTION

For technical details, see [IMPLEMENTATION.md](IMPLEMENTATION.md)
