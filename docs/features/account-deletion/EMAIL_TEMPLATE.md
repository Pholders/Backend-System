# 📧 Account Deletion - Email Template

This document shows the account deletion confirmation email template.

---

## Email Subject
```
Confirm Account Deletion - Pholders Healthcare
```

---

## Email Visual Design

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│   [Pholders Logo]                                              │
│   PHOLDERS HEALTHCARE                                          │
│   Account Deletion Request                                     │
│                                                                │
│   (RED HEADER - Warning color #d9534f)                         │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│   Hello {FirstName},                                           │
│                                                                │
│   ⚠️ IMPORTANT: You have requested to delete your              │
│      Pholders Healthcare account.                              │
│                                                                │
│   ⚡ THIS ACTION IS PERMANENT AND CANNOT BE UNDONE.             │
│                                                                │
│   ┌──────────────────────────────────────────────────────┐    │
│   │ WHAT WILL BE DELETED                                │    │
│   │                                                      │    │
│   │ ✓ Permanently delete your account and all          │    │
│   │   personal data                                    │    │
│   │ ✓ Remove all your medical records and health      │    │
│   │   information                                      │    │
│   │ ✓ Delete all appointments and consultations       │    │
│   │ ✓ Clear all stored communications and files       │    │
│   └──────────────────────────────────────────────────────┘    │
│                                                                │
│   To confirm account deletion, click below:                    │
│                                                                │
│              ┌──────────────────────────┐                      │
│              │  Confirm Deletion        │                      │
│              │  (Red button)            │                      │
│              └──────────────────────────┘                      │
│                                                                │
│   Or copy and paste this link:                                 │
│   https://yourapp.com/confirm-deletion?token=...              │
│                                                                │
│   ┌──────────────────────────────────────────────────────┐    │
│   │ ⏰ ACTION REQUIRED                                    │    │
│   │                                                      │    │
│   │ This link will expire in 24 HOURS.                  │    │
│   │ If you don't click, your account will NOT be        │    │
│   │ deleted.                                             │    │
│   └──────────────────────────────────────────────────────┘    │
│                                                                │
│   CHANGED YOUR MIND?                                           │
│   If you no longer want to delete your account, simply         │
│   ignore this email. Your account will remain active.          │
│                                                                │
│   SECURITY NOTICE                                              │
│   ✓ Never share this link with anyone                         │
│   ✓ Only click if you requested deletion                      │
│   ✓ If unwanted, contact support immediately                 │
│                                                                │
│   Thank you for using Pholders Healthcare!                    │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│   © 2026 Pholders Healthcare. All rights reserved.             │
│   support@pholders.com                                         │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## Color Scheme

| Element | Color | Hex |
|---------|-------|-----|
| Header Background | Red (Danger) | #d9534f |
| Header Text | White | #ffffff |
| Warning Box | Yellow | #fff3cd |
| Warning Border | Red | #d9534f |
| Button | Red | #d9534f |
| Button Hover | Dark Red | #c9302c |
| Text | Dark Gray | #333333 |
| Footer | Light Gray | #f9f9f9 |

---

## Email Features

✅ Professional HTML template  
✅ Warning color scheme  
✅ Clear action button  
✅ 24-hour countdown  
✅ List of deletions  
✅ Cancellation instructions  
✅ Security tips  
✅ Plain text fallback  
✅ Mobile responsive  
✅ Logo attachment  
✅ Branded footer  

---

## Template Customization

**Edit in**: `services/emailService.js`  
**Method**: `sendAccountDeletionConfirmation()`

**Customizable Fields**:
- Company name
- Support email
- Logo image
- Link text
- Warning messages
- Footer text
- Brand colors

---

## Email Client Compatibility

✅ Works in:
- Gmail
- Outlook
- Apple Mail
- Yahoo Mail
- Mobile clients
- Web browsers

---

## Responsive Design

✅ Mobile responsive  
✅ Adapts to screen size  
✅ Button scales properly  
✅ Text readable  
✅ Images scale  

---

## Accessibility

✅ High contrast colors  
✅ Readable font sizes  
✅ Clear hierarchy  
✅ Alt text for images  
✅ Semantic HTML  
✅ Screen reader friendly  

---

## Testing Email

### Send Test Email
```bash
node -e "
const emailService = require('./services/emailService');
emailService.sendAccountDeletionConfirmation(
  'test@example.com',
  'John',
  'http://localhost:3000/confirm-deletion?token=test123'
).then(r => console.log(r)).catch(e => console.error(e));
"
```

### Verify in Gmail
1. Check inbox and spam
2. View full headers
3. Verify sender
4. Test link click
5. Confirm button works

---

## Plain Text Version

Users with plain text only email receive:

```
Hello {FirstName},

IMPORTANT: You requested to delete your Pholders Healthcare account.

THIS ACTION IS PERMANENT AND CANNOT BE UNDONE.

WHAT WILL BE DELETED:
- Account and all personal data
- Medical records and health information
- All appointments and consultations
- Communications and files

CONFIRM DELETION:
Click this link within 24 hours:
{DeletionLink}

CANCEL:
Simply ignore this email. Your account will remain active.

SECURITY:
- Don't share this link
- Only click if you requested deletion
- If unwanted, contact support

Thanks,
Pholders Healthcare Team
© 2026 Pholders Healthcare
```

---

## Compliance

✅ GDPR: Clear data deletion notice  
✅ CCPA: Right to deletion notice  
✅ CAN-SPAM: From address correct  
✅ Accessibility: WCAG compliant  

---

**For implementation details**: See [IMPLEMENTATION.md](IMPLEMENTATION.md)
