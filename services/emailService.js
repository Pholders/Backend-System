const nodemailer = require('nodemailer');
const path = require('path');

/**
 * Email Service
 * Handles sending emails for OTP and other notifications
 */

class EmailService {
  constructor() {
    // Use Resend HTTP API when configured — bypasses SMTP port blocking on cloud hosts
    if (process.env.RESEND_API_KEY || process.env.EMAIL_USER === 'resend') {
      const apiKey = process.env.RESEND_API_KEY || process.env.EMAIL_PASSWORD;
      this.transporter = {
        sendMail: async (opts) => {
          const abort = new AbortController();
          const timer = setTimeout(() => abort.abort(), 10_000);
          let res;
          try {
            res = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: opts.from,
                to: Array.isArray(opts.to) ? opts.to : [opts.to],
                subject: opts.subject,
                html: opts.html,
                text: opts.text,
              }),
              signal: abort.signal,
            });
          } finally {
            clearTimeout(timer);
          }
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || `Resend API error ${res.status}`);
          return { messageId: data.id };
        },
      };
      return;
    }

    const service = process.env.EMAIL_SERVICE;
    const port = parseInt(process.env.EMAIL_PORT, 10) || 465;
    const transportConfig = {
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    };

    if (service) {
      transportConfig.service = service;
    } else {
      transportConfig.host = process.env.EMAIL_HOST;
      transportConfig.port = port;
      transportConfig.secure = process.env.EMAIL_SECURE === 'true' || port === 465;
      // Allow self-signed certs on custom mail servers
      transportConfig.tls = { rejectUnauthorized: false };
    }

    this.transporter = nodemailer.createTransport(transportConfig);
  }

  getAuthFromAddress() {
    return process.env.EMAIL_FROM_NOREPLY || process.env.EMAIL_FROM_AUTH || process.env.EMAIL_USER;
  }

  getNotificationFromAddress() {
    return process.env.EMAIL_FROM_NOTIFICATIONS || process.env.EMAIL_FROM_NOREPLY || process.env.EMAIL_USER;
  }

  getSupportFromAddress() {
    return process.env.EMAIL_SUPPORT || process.env.EMAIL_FROM_NOREPLY || process.env.EMAIL_USER;
  }

  /**
   * Send OTP email
   */
  async sendOTP(email, otpCode, firstName) {
    const mailOptions = {
      from: `"Pholders" <${this.getAuthFromAddress()}>`,
      to: email,
      subject: 'Your Login Code - Pholders Healthcare',
      html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:6px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.1);">
  <tr><td style="background:#1C2B4B;padding:28px 40px;">
    <span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:1px;">PHOLDERS</span><span style="color:#6DD0D8;font-size:18px;font-weight:300;"> HEALTHCARE</span>
  </td></tr>
  <tr><td style="background:#6DD0D8;height:3px;font-size:0;">&nbsp;</td></tr>
  <tr><td style="padding:40px;">
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#1C2B4B;">Hello, ${firstName}</h2>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#3d4852;">We received a sign-in request for your Pholders Healthcare account. Use the one-time code below to complete your login.</p>
    <div style="text-align:center;margin:0 0 28px;">
      <div style="display:inline-block;background:#f0f9fa;border:1px solid #b2e4e8;border-radius:6px;padding:18px 48px;">
        <span style="font-size:34px;font-weight:700;letter-spacing:10px;color:#1C2B4B;font-family:'Courier New',monospace;">${otpCode}</span>
      </div>
    </div>
    <div style="background:#fff8f0;border-left:3px solid #e65100;padding:14px 18px;border-radius:0 4px 4px 0;margin:0 0 24px;">
      <p style="margin:0;font-size:13px;color:#3d4852;line-height:1.6;">This code expires in <strong>10 minutes</strong>. If you did not initiate this request, please disregard this email or contact our support team immediately.</p>
    </div>
    <p style="margin:0;font-size:13px;color:#6c7a89;line-height:1.6;">For your security, never share this code with anyone — including Pholders Healthcare staff.</p>
  </td></tr>
  <tr><td style="background:#f8f9fb;border-top:1px solid #e8edf2;padding:20px 40px;text-align:center;">
    <p style="margin:0;font-size:12px;color:#9aa3ae;">&copy; 2026 Pholders Healthcare. All rights reserved.</p>
    <p style="margin:4px 0 0;font-size:12px;color:#9aa3ae;">This is an automated message — please do not reply to this email.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`,
      text: `Hello ${firstName},

We received a sign-in request for your Pholders Healthcare account.

Your one-time login code: ${otpCode}

This code expires in 10 minutes. If you did not initiate this request, please disregard this email or contact our support team immediately.

For your security, never share this code with anyone.`,
      attachments: [
        {
          filename: 'logo.png',
          path: path.join(__dirname, '..', 'images', 'PHolders 2.png'),
          cid: 'logo'
        }
      ]
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ OTP email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      // Dev-mode fallback: SMTP unavailable (e.g. broken Gmail creds).
      // Log the OTP to the server console so local testing isn't blocked.
      if (process.env.NODE_ENV !== 'production') {
        console.warn('⚠️  SMTP send failed, falling back to console (dev mode):', error.message);
        console.log('────────────────────────────────────────────');
        console.log('🔐 Development OTP Code');
        console.log('   To:    ', email);
        console.log('   Name:  ', firstName);
        console.log('   Code:  ', otpCode);
        console.log('────────────────────────────────────────────');
        return { success: true, devMode: true };
      }
      console.error('❌ Email sending failed:', error);
      throw error;
    }
  }

  /**
   * Send email verification OTP (for signup activation)
   * Visually identical to the login OTP, but with a distinct subject and copy
   * so users understand they're verifying ownership of the email address.
   */
  async sendVerificationOTP(email, otpCode, firstName) {
    const mailOptions = {
      from: `"Pholders" <${this.getAuthFromAddress()}>`,
      to: email,
      subject: 'Verify Your Email Address - Pholders Healthcare',
      html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:6px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.1);">
  <tr><td style="background:#1C2B4B;padding:28px 40px;">
    <span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:1px;">PHOLDERS</span><span style="color:#6DD0D8;font-size:18px;font-weight:300;"> HEALTHCARE</span>
  </td></tr>
  <tr><td style="background:#6DD0D8;height:3px;font-size:0;">&nbsp;</td></tr>
  <tr><td style="padding:40px;">
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#1C2B4B;">Verify Your Email Address</h2>
    <p style="margin:0 0 8px;font-size:14px;color:#6c7a89;">Hello, ${firstName}</p>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#3d4852;">Welcome to Pholders Healthcare. To activate your account, please confirm your email address using the verification code below.</p>
    <div style="text-align:center;margin:0 0 28px;">
      <div style="display:inline-block;background:#f0f9fa;border:1px solid #b2e4e8;border-radius:6px;padding:18px 48px;">
        <span style="font-size:34px;font-weight:700;letter-spacing:10px;color:#1C2B4B;font-family:'Courier New',monospace;">${otpCode}</span>
      </div>
    </div>
    <div style="background:#fff8f0;border-left:3px solid #e65100;padding:14px 18px;border-radius:0 4px 4px 0;margin:0 0 24px;">
      <p style="margin:0;font-size:13px;color:#3d4852;line-height:1.6;">This code expires in <strong>15 minutes</strong>. You will not be able to sign in until your email is verified.</p>
    </div>
    <p style="margin:0;font-size:13px;color:#6c7a89;line-height:1.6;">If you did not create an account with Pholders Healthcare, you can safely disregard this email.</p>
  </td></tr>
  <tr><td style="background:#f8f9fb;border-top:1px solid #e8edf2;padding:20px 40px;text-align:center;">
    <p style="margin:0;font-size:12px;color:#9aa3ae;">&copy; 2026 Pholders Healthcare. All rights reserved.</p>
    <p style="margin:4px 0 0;font-size:12px;color:#9aa3ae;">This is an automated message — please do not reply to this email.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`,
      text: `Hello ${firstName},

Welcome to Pholders Healthcare.

Your email verification code: ${otpCode}

This code expires in 15 minutes. You will not be able to sign in until your email is verified.

If you did not create an account, please disregard this email.`,
      attachments: [
        {
          filename: 'logo.png',
          path: path.join(__dirname, '..', 'images', 'PHolders 2.png'),
          cid: 'logo'
        }
      ]
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Verification email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Verification email sending failed:', error);
      throw error;
    }
  }

  /**
   * Send welcome email
   */
  async sendWelcome(email, userName) {
    const mailOptions = {
      from: `"Pholders Healthcare" <${this.getNotificationFromAddress()}>`,
      to: email,
      subject: 'Welcome to Pholders Healthcare',
      html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:6px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.1);">
  <tr><td style="background:#1C2B4B;padding:28px 40px;">
    <span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:1px;">PHOLDERS</span><span style="color:#6DD0D8;font-size:18px;font-weight:300;"> HEALTHCARE</span>
  </td></tr>
  <tr><td style="background:#6DD0D8;height:3px;font-size:0;">&nbsp;</td></tr>
  <tr><td style="padding:40px;">
    <h2 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#1C2B4B;">Welcome, ${userName}</h2>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#3d4852;">Thank you for joining Pholders Healthcare. Your account has been successfully created and is ready to use.</p>
    <p style="margin:0 0 28px;font-size:14px;line-height:1.7;color:#3d4852;">You can now book appointments, manage prescriptions, and access your health records — all in one place.</p>
    <table cellpadding="0" cellspacing="0"><tr><td style="border-radius:4px;background:#6DD0D8;"><a href="${process.env.FRONTEND_URL}/login" style="display:inline-block;padding:12px 32px;color:#fff;text-decoration:none;font-size:14px;font-weight:600;">Get Started</a></td></tr></table>
  </td></tr>
  <tr><td style="background:#f8f9fb;border-top:1px solid #e8edf2;padding:20px 40px;text-align:center;">
    <p style="margin:0;font-size:12px;color:#9aa3ae;">&copy; 2026 Pholders Healthcare. All rights reserved.</p>
    <p style="margin:4px 0 0;font-size:12px;color:#9aa3ae;">This is an automated message — please do not reply to this email.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`,
      text: `Welcome to Pholders Healthcare, ${userName}.

Your account has been successfully created. You can now book appointments, manage prescriptions, and access your health records.

Sign in at: ${process.env.FRONTEND_URL}/login`,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Welcome email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Email sending failed:', error);
      // Don't throw error for welcome emails
      return { success: false, error: error.message };
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset(email, firstName, resetToken, resetLink) {
    const mailOptions = {
      from: `"Pholders" <${this.getAuthFromAddress()}>`,
      to: email,
      subject: 'Reset Your Password - Pholders Healthcare',
      html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:6px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.1);">
  <tr><td style="background:#1C2B4B;padding:28px 40px;">
    <span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:1px;">PHOLDERS</span><span style="color:#6DD0D8;font-size:18px;font-weight:300;"> HEALTHCARE</span>
  </td></tr>
  <tr><td style="background:#6DD0D8;height:3px;font-size:0;">&nbsp;</td></tr>
  <tr><td style="padding:40px;">
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#1C2B4B;">Password Reset Request</h2>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#3d4852;">Hello ${firstName}, we received a request to reset the password for your Pholders Healthcare account. Click the button below to proceed.</p>
    <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;"><tr><td style="border-radius:4px;background:#6DD0D8;"><a href="${resetLink}" style="display:inline-block;padding:13px 36px;color:#fff;text-decoration:none;font-size:14px;font-weight:600;">Reset Password</a></td></tr></table>
    <p style="margin:0 0 8px;font-size:13px;color:#6c7a89;">Or copy and paste this link into your browser:</p>
    <div style="background:#f4f6f9;border:1px solid #dde3ea;border-radius:4px;padding:12px 14px;margin:0 0 24px;word-break:break-all;font-size:12px;color:#5a6474;font-family:'Courier New',monospace;">${resetLink}</div>
    <div style="background:#fff8f0;border-left:3px solid #e65100;padding:14px 18px;border-radius:0 4px 4px 0;margin:0 0 24px;">
      <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#3d4852;">Security Notice</p>
      <p style="margin:0;font-size:13px;color:#3d4852;line-height:1.6;">This link expires in <strong>24 hours</strong>. If you did not request a password reset, please ignore this email or contact our support team immediately — your account remains secure.</p>
    </div>
    <ul style="margin:0;padding:0 0 0 18px;">
      <li style="font-size:13px;color:#6c7a89;line-height:1.8;">Never share this link with anyone</li>
      <li style="font-size:13px;color:#6c7a89;line-height:1.8;">Choose a strong, unique password</li>
      <li style="font-size:13px;color:#6c7a89;line-height:1.8;">If you did not make this request, contact support immediately</li>
    </ul>
  </td></tr>
  <tr><td style="background:#f8f9fb;border-top:1px solid #e8edf2;padding:20px 40px;text-align:center;">
    <p style="margin:0;font-size:12px;color:#9aa3ae;">&copy; 2026 Pholders Healthcare. All rights reserved.</p>
    <p style="margin:4px 0 0;font-size:12px;color:#9aa3ae;">This is an automated message — please do not reply to this email.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`,
      text: `Hello ${firstName},

We received a request to reset the password for your Pholders Healthcare account.

Reset your password using this link:
${resetLink}

This link expires in 24 hours.

If you did not request this, please ignore this email. Your account remains secure.

Security reminders:
- Never share this link with anyone
- Choose a strong, unique password
- If you did not make this request, contact support immediately`,
      attachments: [
        {
          filename: 'logo.png',
          path: path.join(__dirname, '..', 'images', 'PHolders 2.png'),
          cid: 'logo'
        }
      ]
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Password reset email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Password reset email sending failed:', error);
      throw error;
    }
  }

  /**
   * Send password reset confirmation email
   */
  async sendPasswordResetConfirmation(email, firstName) {
    const mailOptions = {
      from: `"Pholders" <${this.getAuthFromAddress()}>`,
      to: email,
      subject: 'Password Reset Successful - Pholders Healthcare',
      html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:6px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.1);">
  <tr><td style="background:#1C2B4B;padding:28px 40px;">
    <span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:1px;">PHOLDERS</span><span style="color:#6DD0D8;font-size:18px;font-weight:300;"> HEALTHCARE</span>
  </td></tr>
  <tr><td style="background:#6DD0D8;height:3px;font-size:0;">&nbsp;</td></tr>
  <tr><td style="padding:40px;">
    <h2 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#1C2B4B;">Password Reset Successful</h2>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#3d4852;">Hello ${firstName}, your password has been successfully updated. You can now sign in to your Pholders Healthcare account using your new credentials.</p>
    <div style="background:#f0fdf4;border-left:3px solid #2e7d32;padding:14px 18px;border-radius:0 4px 4px 0;margin:0 0 24px;">
      <p style="margin:0;font-size:13px;color:#3d4852;line-height:1.6;">If you did not make this change, please contact our support team at <a href="mailto:support@pholders.co.za" style="color:#6DD0D8;text-decoration:none;">support@pholders.co.za</a> immediately.</p>
    </div>
    <table cellpadding="0" cellspacing="0"><tr><td style="border-radius:4px;background:#6DD0D8;"><a href="${process.env.FRONTEND_URL}/login" style="display:inline-block;padding:12px 32px;color:#fff;text-decoration:none;font-size:14px;font-weight:600;">Sign In</a></td></tr></table>
  </td></tr>
  <tr><td style="background:#f8f9fb;border-top:1px solid #e8edf2;padding:20px 40px;text-align:center;">
    <p style="margin:0;font-size:12px;color:#9aa3ae;">&copy; 2026 Pholders Healthcare. All rights reserved.</p>
    <p style="margin:4px 0 0;font-size:12px;color:#9aa3ae;">This is an automated message — please do not reply to this email.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`,
      text: `Hello ${firstName},

Your password has been successfully updated. You can now sign in using your new credentials.

If you did not make this change, please contact our support team immediately at support@pholders.co.za.`
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Password reset confirmation email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Password reset confirmation email sending failed:', error);
      // Don't throw error for confirmation emails
      return { success: false, error: error.message };
    }
  }

  /**
   * Send account deletion confirmation email
   * User must click link to confirm deletion
   */
  async sendAccountDeletionConfirmation(email, firstName, deletionLink) {
    const mailOptions = {
      from: `"Pholders Healthcare" <${this.getNotificationFromAddress()}>`,
      to: email,
      subject: 'Confirm Account Deletion - Pholders Healthcare',
      html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:6px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.1);">
  <tr><td style="background:#B71C1C;padding:28px 40px;">
    <span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:1px;">PHOLDERS</span><span style="color:#ef9a9a;font-size:18px;font-weight:300;"> HEALTHCARE</span>
  </td></tr>
  <tr><td style="background:#ef5350;height:3px;font-size:0;">&nbsp;</td></tr>
  <tr><td style="padding:40px;">
    <h2 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#B71C1C;">Account Deletion Request</h2>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#3d4852;">Hello ${firstName}, we received a request to permanently delete your Pholders Healthcare account.</p>
    <div style="background:#fff5f5;border-left:3px solid #B71C1C;padding:14px 18px;border-radius:0 4px 4px 0;margin:0 0 20px;">
      <p style="margin:0;font-size:13px;font-weight:600;color:#B71C1C;">This action is permanent and cannot be undone.</p>
    </div>
    <p style="margin:0 0 12px;font-size:14px;color:#3d4852;">Confirming deletion will permanently remove:</p>
    <ul style="margin:0 0 24px;padding:0 0 0 18px;">
      <li style="font-size:13px;color:#6c7a89;line-height:1.8;">Your account and all personal data</li>
      <li style="font-size:13px;color:#6c7a89;line-height:1.8;">All medical records and health information</li>
      <li style="font-size:13px;color:#6c7a89;line-height:1.8;">All appointments, prescriptions, and consultations</li>
      <li style="font-size:13px;color:#6c7a89;line-height:1.8;">All stored communications and uploaded files</li>
    </ul>
    <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;"><tr><td style="border-radius:4px;background:#B71C1C;"><a href="${deletionLink}" style="display:inline-block;padding:13px 36px;color:#fff;text-decoration:none;font-size:14px;font-weight:600;">Confirm Deletion</a></td></tr></table>
    <p style="margin:0 0 8px;font-size:13px;color:#6c7a89;">Or copy and paste this link into your browser:</p>
    <div style="background:#f4f6f9;border:1px solid #dde3ea;border-radius:4px;padding:12px 14px;margin:0 0 24px;word-break:break-all;font-size:12px;color:#5a6474;font-family:'Courier New',monospace;">${deletionLink}</div>
    <div style="background:#fff8f0;border-left:3px solid #e65100;padding:14px 18px;border-radius:0 4px 4px 0;margin:0 0 24px;">
      <p style="margin:0;font-size:13px;color:#3d4852;line-height:1.6;">This confirmation link expires in <strong>24 hours</strong>. If you do not click it, your account will remain active and unchanged.</p>
    </div>
    <p style="margin:0;font-size:13px;color:#6c7a89;line-height:1.6;">If you did not request this, please contact <a href="mailto:support@pholders.co.za" style="color:#6DD0D8;text-decoration:none;">support@pholders.co.za</a> immediately.</p>
  </td></tr>
  <tr><td style="background:#f8f9fb;border-top:1px solid #e8edf2;padding:20px 40px;text-align:center;">
    <p style="margin:0;font-size:12px;color:#9aa3ae;">&copy; 2026 Pholders Healthcare. All rights reserved.</p>
    <p style="margin:4px 0 0;font-size:12px;color:#9aa3ae;">This is an automated message — please do not reply to this email.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`,
      text: `Hello ${firstName},

We received a request to permanently delete your Pholders Healthcare account. This action is permanent and cannot be undone.

Deletion will permanently remove your account, all personal data, medical records, appointments, and files.

To confirm, visit this link within 24 hours:
${deletionLink}

If you do not click this link, your account will remain active and unchanged.

If you did not make this request, please contact support@pholders.co.za immediately.`,
      attachments: [
        {
          filename: 'logo.png',
          path: path.join(__dirname, '..', 'images', 'PHolders 2.png'),
          cid: 'logo'
        }
      ]
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Account deletion confirmation email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Account deletion confirmation email sending failed:', error);
      throw error;
    }
  }

  /**
   * Send threat notification email
   */
  async sendThreatNotification(email, firstName, alert) {
    const mailOptions = {
      from: `"Pholders Security" <${this.getNotificationFromAddress()}>`,
      to: email,
      subject: 'Security Alert: Suspicious Activity Detected on Your Account',
      html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:6px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.1);">
  <tr><td style="background:#B71C1C;padding:28px 40px;">
    <span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:1px;">PHOLDERS</span><span style="color:#ef9a9a;font-size:18px;font-weight:300;"> HEALTHCARE</span>
  </td></tr>
  <tr><td style="background:#ef5350;height:3px;font-size:0;">&nbsp;</td></tr>
  <tr><td style="padding:40px;">
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#B71C1C;">Account Security Alert</h2>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#3d4852;">Hello ${firstName}, our security system has detected and confirmed suspicious activity on your Pholders Healthcare account.</p>
    <div style="background:#fff5f5;border:1px solid #ffcdd2;border-radius:4px;padding:16px 18px;margin:0 0 20px;">
      <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#B71C1C;">Incident Summary</p>
      <p style="margin:0;font-size:13px;color:#3d4852;line-height:1.6;">${alert.alert_message || 'Unauthorized access detected'}</p>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;border:1px solid #dde3ea;border-radius:4px;margin:0 0 20px;">
      <tr><td style="padding:10px 16px;border-bottom:1px solid #dde3ea;"><span style="font-size:12px;color:#6c7a89;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Alert Type</span></td><td style="padding:10px 16px;border-bottom:1px solid #dde3ea;"><span style="font-size:13px;color:#3d4852;">${alert.alert_type || 'Unknown'}</span></td></tr>
      <tr><td style="padding:10px 16px;border-bottom:1px solid #dde3ea;"><span style="font-size:12px;color:#6c7a89;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Risk Level</span></td><td style="padding:10px 16px;border-bottom:1px solid #dde3ea;"><span style="font-size:13px;color:#3d4852;">${alert.severity || 'Unknown'}</span></td></tr>
      <tr><td style="padding:10px 16px;border-bottom:1px solid #dde3ea;"><span style="font-size:12px;color:#6c7a89;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Timestamp</span></td><td style="padding:10px 16px;border-bottom:1px solid #dde3ea;"><span style="font-size:13px;color:#3d4852;">${new Date(alert.created_at).toLocaleString()}</span></td></tr>
      <tr><td style="padding:10px 16px;"><span style="font-size:12px;color:#6c7a89;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">IP Address</span></td><td style="padding:10px 16px;"><span style="font-size:13px;color:#3d4852;">${alert.ip_address || 'Unknown'}</span></td></tr>
    </table>
    <div style="background:#fff8f0;border-left:3px solid #e65100;padding:14px 18px;border-radius:0 4px 4px 0;margin:0 0 24px;">
      <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#3d4852;">Immediate Action Required</p>
      <ul style="margin:0;padding:0 0 0 18px;">
        <li style="font-size:13px;color:#3d4852;line-height:1.8;"><strong>Change your password immediately</strong></li>
        <li style="font-size:13px;color:#3d4852;line-height:1.8;">Review and sign out of all unrecognised active sessions</li>
        <li style="font-size:13px;color:#3d4852;line-height:1.8;">Contact our support team if you did not authorise this activity</li>
      </ul>
    </div>
    <table cellpadding="0" cellspacing="0"><tr><td style="border-radius:4px;background:#B71C1C;"><a href="${process.env.FRONTEND_URL}/settings/security" style="display:inline-block;padding:12px 32px;color:#fff;text-decoration:none;font-size:14px;font-weight:600;">Review Security Settings</a></td></tr></table>
  </td></tr>
  <tr><td style="background:#f8f9fb;border-top:1px solid #e8edf2;padding:20px 40px;text-align:center;">
    <p style="margin:0;font-size:12px;color:#9aa3ae;">&copy; 2026 Pholders Healthcare. All rights reserved.</p>
    <p style="margin:4px 0 0;font-size:12px;color:#9aa3ae;">This is an automated message — please do not reply to this email.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`,
      text: `SECURITY ALERT — Pholders Healthcare

Hello ${firstName},

Our security system has detected and confirmed suspicious activity on your account.

Incident: ${alert.alert_message || 'Unauthorized access detected'}
Alert Type: ${alert.alert_type || 'Unknown'}
Risk Level: ${alert.severity || 'Unknown'}
Timestamp: ${new Date(alert.created_at).toLocaleString()}
IP Address: ${alert.ip_address || 'Unknown'}

Immediate action required:
1. Change your password immediately
2. Review and sign out of all unrecognised active sessions
3. Contact support if you did not authorise this activity

Review your security settings: ${process.env.FRONTEND_URL}/settings/security`
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Threat notification sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Failed to send threat notification:', error);
      throw error;
    }
  }

  /**
   * Verify email configuration
   */
  async verifyConnection() {
    try {
      await this.transporter.verify();
      console.log('✅ Email service is ready');
      return true;
    } catch (error) {
      console.error('❌ Email service configuration error:', error);
      return false;
    }
  }

  /**
   * Send email-change verification link to the NEW address.
   * The patient must click it before the email column is updated.
   */
  async sendEmailChangeVerification(newEmail, firstName, verifyLink) {
    const mailOptions = {
      from: `"Pholders" <${this.getAuthFromAddress()}>`,
      to: newEmail,
      subject: 'Confirm Your New Email Address - Pholders Healthcare',
      html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:6px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.1);">
  <tr><td style="background:#1C2B4B;padding:28px 40px;">
    <span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:1px;">PHOLDERS</span><span style="color:#6DD0D8;font-size:18px;font-weight:300;"> HEALTHCARE</span>
  </td></tr>
  <tr><td style="background:#6DD0D8;height:3px;font-size:0;">&nbsp;</td></tr>
  <tr><td style="padding:40px;">
    <h2 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#1C2B4B;">Confirm Your New Email Address</h2>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#3d4852;">Hello ${firstName || ''},</p>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#3d4852;">We received a request to change the email address on your Pholders Healthcare account to this address. Click the button below to confirm. Your current email will continue to work until you do so.</p>
    <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;"><tr><td style="border-radius:4px;background:#6DD0D8;"><a href="${verifyLink}" style="display:inline-block;padding:13px 36px;color:#fff;text-decoration:none;font-size:14px;font-weight:600;">Confirm New Email</a></td></tr></table>
    <div style="background:#fff8f0;border-left:3px solid #e65100;padding:14px 18px;border-radius:0 4px 4px 0;margin:0 0 24px;">
      <p style="margin:0;font-size:13px;color:#3d4852;line-height:1.6;">This link expires in <strong>60 minutes</strong>. If you did not request this change, please ignore this email — your current email address will remain unchanged.</p>
    </div>
  </td></tr>
  <tr><td style="background:#f8f9fb;border-top:1px solid #e8edf2;padding:20px 40px;text-align:center;">
    <p style="margin:0;font-size:12px;color:#9aa3ae;">&copy; 2026 Pholders Healthcare. All rights reserved.</p>
    <p style="margin:4px 0 0;font-size:12px;color:#9aa3ae;">This is an automated message — please do not reply to this email.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`,
      text: `Hello ${firstName || ''},\n\nWe received a request to change the email address on your Pholders Healthcare account.\n\nConfirm your new email address by visiting:\n${verifyLink}\n\nThis link expires in 60 minutes. If you did not request this change, please ignore this email.`
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Email-change verification sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Email-change verification failed:', error);
      throw error;
    }
  }

  /**
   * Notify patient their account has been frozen.
   */
  async sendAccountFreezeConfirmation(email, firstName, unfreezeLink) {
    const mailOptions = {
      from: `"Pholders Security" <${this.getNotificationFromAddress()}>`,
      to: email,
      subject: 'Your Account Has Been Frozen - Pholders Healthcare',
      html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:6px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.1);">
  <tr><td style="background:#1C2B4B;padding:28px 40px;">
    <span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:1px;">PHOLDERS</span><span style="color:#6DD0D8;font-size:18px;font-weight:300;"> HEALTHCARE</span>
  </td></tr>
  <tr><td style="background:#6DD0D8;height:3px;font-size:0;">&nbsp;</td></tr>
  <tr><td style="padding:40px;">
    <h2 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#1C2B4B;">Account Frozen</h2>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#3d4852;">Hello ${firstName || ''},</p>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#3d4852;">Your Pholders Healthcare account has been frozen at your request. All active sessions have been signed out for your security.</p>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#3d4852;">To unfreeze your account, click the button below within 7 days:</p>
    <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;"><tr><td style="border-radius:4px;background:#6DD0D8;"><a href="${unfreezeLink}" style="display:inline-block;padding:13px 36px;color:#fff;text-decoration:none;font-size:14px;font-weight:600;">Unfreeze Account</a></td></tr></table>
    <p style="margin:0;font-size:13px;color:#6c7a89;line-height:1.6;">If you did not request this, please contact <a href="mailto:support@pholders.co.za" style="color:#6DD0D8;text-decoration:none;">support@pholders.co.za</a> immediately.</p>
  </td></tr>
  <tr><td style="background:#f8f9fb;border-top:1px solid #e8edf2;padding:20px 40px;text-align:center;">
    <p style="margin:0;font-size:12px;color:#9aa3ae;">&copy; 2026 Pholders Healthcare. All rights reserved.</p>
    <p style="margin:4px 0 0;font-size:12px;color:#9aa3ae;">This is an automated message — please do not reply to this email.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`,
      text: `Hello ${firstName || ''},\n\nYour Pholders Healthcare account has been frozen and all active sessions have been signed out.\n\nTo unfreeze your account, visit:\n${unfreezeLink}\n\nThis link expires in 7 days. If you did not request this, please contact support@pholders.co.za immediately.`
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Freeze confirmation sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Freeze confirmation failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Alias for clarity — same content as freeze confirmation but called separately
   * if you want to re-send the unfreeze link without resending the freeze notice.
   */
  async sendAccountUnfreezeLink(email, firstName, unfreezeLink) {
    return this.sendAccountFreezeConfirmation(email, firstName, unfreezeLink);
  }

  /**
   * Email the compiled security audit log (CSV) to the patient.
   */
  async sendSecurityAuditLog(email, firstName, csvContent) {
    const mailOptions = {
      from: `"Pholders Healthcare" <${this.getNotificationFromAddress()}>`,
      to: email,
      subject: 'Your Security Audit Log - Pholders Healthcare',
      html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:6px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.1);">
  <tr><td style="background:#1C2B4B;padding:28px 40px;">
    <span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:1px;">PHOLDERS</span><span style="color:#6DD0D8;font-size:18px;font-weight:300;"> HEALTHCARE</span>
  </td></tr>
  <tr><td style="background:#6DD0D8;height:3px;font-size:0;">&nbsp;</td></tr>
  <tr><td style="padding:40px;">
    <h2 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#1C2B4B;">Security Audit Log</h2>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#3d4852;">Hello ${firstName || ''},</p>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#3d4852;">Attached is the security audit log you requested. It includes recent login activity, password changes, session history, and device activity on your account.</p>
    <div style="background:#fff8f0;border-left:3px solid #e65100;padding:14px 18px;border-radius:0 4px 4px 0;">
      <p style="margin:0;font-size:13px;color:#3d4852;line-height:1.6;">If you did not request this export, please change your password immediately and contact <a href="mailto:support@pholders.co.za" style="color:#6DD0D8;text-decoration:none;">support@pholders.co.za</a>.</p>
    </div>
  </td></tr>
  <tr><td style="background:#f8f9fb;border-top:1px solid #e8edf2;padding:20px 40px;text-align:center;">
    <p style="margin:0;font-size:12px;color:#9aa3ae;">&copy; 2026 Pholders Healthcare. All rights reserved.</p>
    <p style="margin:4px 0 0;font-size:12px;color:#9aa3ae;">This is an automated message — please do not reply to this email.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`,
      text: `Hello ${firstName || ''},\n\nAttached is the security audit log you requested, including recent login activity, password changes, and device sessions.\n\nIf you did not request this export, please change your password immediately and contact support@pholders.co.za.`,

      attachments: [
        {
          filename: `security-audit-${new Date().toISOString().split('T')[0]}.csv`,
          content: csvContent,
          contentType: 'text/csv'
        }
      ]
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Security audit log emailed:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Audit log email failed:', error);
      throw error;
    }
  }

  /**
   * Forward a support ticket to the support inbox.
   */
  async sendSupportTicket(ticket, patient) {
    const supportInbox = this.getSupportFromAddress();
    const mailOptions = {
      from: `"Pholders Support" <${this.getSupportFromAddress()}>`,
      to: supportInbox,
      replyTo: patient?.email,
      subject: `[Support][${ticket.type}] ${ticket.subject || 'New ticket'}`,
      html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:32px 16px;">
<tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#fff;border-radius:6px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.1);">
  <tr><td style="background:#1C2B4B;padding:24px 40px;">
    <span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:1px;">PHOLDERS</span><span style="color:#6DD0D8;font-size:18px;font-weight:300;"> HEALTHCARE</span>
    <span style="display:block;color:#9aa3ae;font-size:12px;margin-top:4px;letter-spacing:1px;text-transform:uppercase;">Support Ticket</span>
  </td></tr>
  <tr><td style="background:#6DD0D8;height:3px;font-size:0;">&nbsp;</td></tr>
  <tr><td style="padding:32px 40px;">
    <h2 style="margin:0 0 20px;font-size:18px;font-weight:600;color:#1C2B4B;">New ${ticket.type} Ticket</h2>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;border:1px solid #dde3ea;border-radius:4px;margin:0 0 20px;">
      <tr><td style="padding:10px 16px;border-bottom:1px solid #dde3ea;"><span style="font-size:12px;color:#6c7a89;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">From</span></td><td style="padding:10px 16px;border-bottom:1px solid #dde3ea;"><span style="font-size:13px;color:#3d4852;">${patient?.first_name || ''} ${patient?.last_name || ''} &lt;${patient?.email || ''}&gt;</span></td></tr>
      <tr><td style="padding:10px 16px;border-bottom:1px solid #dde3ea;"><span style="font-size:12px;color:#6c7a89;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Patient ID</span></td><td style="padding:10px 16px;border-bottom:1px solid #dde3ea;"><span style="font-size:13px;color:#3d4852;">${patient?.id || 'n/a'}</span></td></tr>
      <tr><td style="padding:10px 16px;"><span style="font-size:12px;color:#6c7a89;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Subject</span></td><td style="padding:10px 16px;"><span style="font-size:13px;color:#3d4852;">${ticket.subject || '(none)'}</span></td></tr>
    </table>
    <div style="background:#f4f6f9;border:1px solid #dde3ea;border-radius:4px;padding:16px;margin:0 0 20px;">
      <pre style="margin:0;white-space:pre-wrap;font-family:inherit;font-size:13px;color:#3d4852;line-height:1.7;">${ticket.body || ''}</pre>
    </div>
    <p style="margin:0;font-size:12px;color:#9aa3ae;">Ticket ID: ${ticket.id || 'n/a'} &nbsp;&middot;&nbsp; Created: ${ticket.created_at || new Date().toISOString()}</p>
  </td></tr>
  <tr><td style="background:#f8f9fb;border-top:1px solid #e8edf2;padding:20px 40px;text-align:center;">
    <p style="margin:0;font-size:12px;color:#9aa3ae;">&copy; 2026 Pholders Healthcare. All rights reserved.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`,
      text: `New ${ticket.type} ticket\nFrom: ${patient?.first_name || ''} ${patient?.last_name || ''} <${patient?.email}>\nPatient ID: ${patient?.id || 'n/a'}\nSubject: ${ticket.subject}\n\n${ticket.body}\n\nTicket ID: ${ticket.id || 'n/a'}`
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Support ticket forwarded:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Support ticket forward failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Forward a suspicious-activity report to the security inbox.
   */
  async sendSuspiciousActivityReport(report, patient) {
    const securityInbox = this.getSupportFromAddress();
    const mailOptions = {
      from: `"Pholders Security" <${this.getSupportFromAddress()}>`,
      to: securityInbox,
      replyTo: patient?.email,
      subject: `[Security] Suspicious Activity Report — ${patient?.email || 'unknown'}`,
      html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:32px 16px;">
<tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#fff;border-radius:6px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.1);">
  <tr><td style="background:#B71C1C;padding:24px 40px;">
    <span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:1px;">PHOLDERS</span><span style="color:#ef9a9a;font-size:18px;font-weight:300;"> HEALTHCARE</span>
    <span style="display:block;color:#ef9a9a;font-size:12px;margin-top:4px;letter-spacing:1px;text-transform:uppercase;">Security Report</span>
  </td></tr>
  <tr><td style="background:#ef5350;height:3px;font-size:0;">&nbsp;</td></tr>
  <tr><td style="padding:32px 40px;">
    <h2 style="margin:0 0 20px;font-size:18px;font-weight:600;color:#B71C1C;">Patient-Reported Suspicious Activity</h2>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;border:1px solid #dde3ea;border-radius:4px;margin:0 0 20px;">
      <tr><td style="padding:10px 16px;border-bottom:1px solid #dde3ea;"><span style="font-size:12px;color:#6c7a89;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Patient</span></td><td style="padding:10px 16px;border-bottom:1px solid #dde3ea;"><span style="font-size:13px;color:#3d4852;">${patient?.first_name || ''} ${patient?.last_name || ''} &lt;${patient?.email || ''}&gt;</span></td></tr>
      <tr><td style="padding:10px 16px;border-bottom:1px solid #dde3ea;"><span style="font-size:12px;color:#6c7a89;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Patient ID</span></td><td style="padding:10px 16px;border-bottom:1px solid #dde3ea;"><span style="font-size:13px;color:#3d4852;">${patient?.id || 'n/a'}</span></td></tr>
      <tr><td style="padding:10px 16px;border-bottom:1px solid #dde3ea;"><span style="font-size:12px;color:#6c7a89;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Subject</span></td><td style="padding:10px 16px;border-bottom:1px solid #dde3ea;"><span style="font-size:13px;color:#3d4852;">${report.subject || '(none)'}</span></td></tr>
      <tr><td style="padding:10px 16px;"><span style="font-size:12px;color:#6c7a89;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Session ID</span></td><td style="padding:10px 16px;"><span style="font-size:13px;color:#3d4852;">${report.related_session_id || 'n/a'}</span></td></tr>
    </table>
    <div style="background:#f4f6f9;border:1px solid #dde3ea;border-radius:4px;padding:16px;margin:0 0 20px;">
      <pre style="margin:0;white-space:pre-wrap;font-family:inherit;font-size:13px;color:#3d4852;line-height:1.7;">${report.body || ''}</pre>
    </div>
    <p style="margin:0;font-size:12px;color:#9aa3ae;">Ticket ID: ${report.id || 'n/a'} &nbsp;&middot;&nbsp; Reported: ${report.created_at || new Date().toISOString()}</p>
  </td></tr>
  <tr><td style="background:#f8f9fb;border-top:1px solid #e8edf2;padding:20px 40px;text-align:center;">
    <p style="margin:0;font-size:12px;color:#9aa3ae;">&copy; 2026 Pholders Healthcare. All rights reserved.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`,
      text: `Suspicious activity report\nFrom: ${patient?.first_name || ''} ${patient?.last_name || ''} <${patient?.email}>\nPatient ID: ${patient?.id || 'n/a'}\nSubject: ${report.subject}\nSession ID: ${report.related_session_id || 'n/a'}\n\n${report.body}\n\nTicket ID: ${report.id || 'n/a'}`
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Suspicious activity report forwarded:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Suspicious activity report forward failed:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new EmailService();
