const nodemailer = require('nodemailer');
const path = require('path');

/**
 * Email Service
 * Handles sending emails for OTP and other notifications
 */

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }

  /**
   * Send OTP email
   */
  async sendOTP(email, otpCode, firstName) {
    const mailOptions = {
      from: `"Pholders Healthcare" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your Login OTP Code',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              background-color: #f4f4f9;
              margin: 0;
              padding: 0;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 20px auto;
              background: #ffffff;
              border-radius: 8px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              overflow: hidden;
            }
            .header {
              background-color: #6DD0D8;
              color: #ffffff;
              text-align: center;
              padding: 30px 20px;
              border-bottom: 5px solid #4bb7c0;
            }
            .header img {
              max-width: 80px;
              margin-bottom: 10px;
            }
            .header h1 {
              font-size: 24px;
              margin: 0;
            }
            .header p {
              font-size: 14px;
              margin: 5px 0 0;
              color: #e0f7fa;
            }
            .content {
              padding: 20px;
            }
            .content h2 {
              color: #333;
            }
            .otp-code {
              font-size: 24px;
              font-weight: bold;
              color: #6DD0D8;
              text-align: center;
              padding: 15px;
              background-color: #e6f7f9;
              border-radius: 5px;
              margin: 20px 0;
            }
            .footer {
              text-align: center;
              padding: 15px;
              font-size: 12px;
              color: #888;
              background-color: #f9f9f9;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <img src="cid:logo" alt="Pholders Healthcare">
              <h1>Pholders Healthcare</h1>
              <p>Your Trusted Partner in Health</p>
            </div>
            <div class="content">
              <h2>Hello ${firstName},</h2>
              <p>We received a request to log in to your Pholders Healthcare account. Use the OTP below to complete your login:</p>
              <div class="otp-code">${otpCode}</div>
              <p><strong>Note:</strong> This code will expire in 10 minutes. If you did not request this, please ignore this email or contact support.</p>
              <p>Thank you for trusting Pholders Healthcare for your medical needs!</p>
            </div>
            <div class="footer">
              <p>&copy; 2026 Pholders Healthcare. All rights reserved.</p>
              <p>This is an automated email. Please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Hello ${firstName},

We received a request to log in to your Pholders Healthcare account.

Your OTP Code: ${otpCode}

This code will expire in 10 minutes.

If you didn't request this code, please ignore this email.

Thank you for trusting Pholders Healthcare for your medical needs!
      `,
      attachments: [
        {
          filename: 'logo.png',
          path: path.join(__dirname, '..', 'images', 'PHolders 2.png'),
          cid: 'logo' // This matches the src="cid:logo" in the HTML
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
      from: `"Pholders Healthcare" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Verify Your Email - Pholders Healthcare',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f9; margin: 0; padding: 0; color: #333; }
            .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden; }
            .header { background-color: #6DD0D8; color: #ffffff; text-align: center; padding: 30px 20px; border-bottom: 5px solid #4bb7c0; }
            .header img { max-width: 80px; margin-bottom: 10px; }
            .header h1 { font-size: 24px; margin: 0; }
            .content { padding: 20px; }
            .otp-code { font-size: 24px; font-weight: bold; color: #6DD0D8; text-align: center; padding: 15px; background-color: #e6f7f9; border-radius: 5px; margin: 20px 0; letter-spacing: 4px; }
            .footer { text-align: center; padding: 15px; font-size: 12px; color: #888; background-color: #f9f9f9; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <img src="cid:logo" alt="Pholders Healthcare">
              <h1>Verify Your Email</h1>
            </div>
            <div class="content">
              <h2>Hello ${firstName},</h2>
              <p>Welcome to Pholders Healthcare! To activate your account, please confirm your email address using the verification code below:</p>
              <div class="otp-code">${otpCode}</div>
              <p><strong>This code expires in 15 minutes.</strong></p>
              <p>You will not be able to log in until your email is verified. If you did not create an account with us, please ignore this email.</p>
            </div>
            <div class="footer">
              <p>&copy; 2026 Pholders Healthcare. All rights reserved.</p>
              <p>This is an automated email. Please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Hello ${firstName},

Welcome to Pholders Healthcare!

Your email verification code: ${otpCode}

This code expires in 15 minutes. You will not be able to log in until your email is verified.

If you did not create an account, please ignore this email.`,
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
      from: `"Pholders Healthcare" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Welcome to Pholders Healthcare',
      html: `
        <h2>Welcome ${userName}!</h2>
        <p>Thank you for registering with Pholders Healthcare.</p>
        <p>Your account has been successfully created.</p>
      `,
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
      from: `"Pholders Healthcare" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Reset Your Password - Pholders Healthcare',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              background-color: #f4f4f9;
              margin: 0;
              padding: 0;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 20px auto;
              background: #ffffff;
              border-radius: 8px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              overflow: hidden;
            }
            .header {
              background-color: #6DD0D8;
              color: #ffffff;
              text-align: center;
              padding: 30px 20px;
              border-bottom: 5px solid #4bb7c0;
            }
            .header img {
              max-width: 80px;
              margin-bottom: 10px;
            }
            .header h1 {
              font-size: 24px;
              margin: 0;
            }
            .header p {
              font-size: 14px;
              margin: 5px 0 0;
              color: #e0f7fa;
            }
            .content {
              padding: 30px;
            }
            .content h2 {
              color: #333;
              margin-top: 0;
            }
            .reset-button {
              display: inline-block;
              background-color: #6DD0D8;
              color: #ffffff;
              padding: 12px 30px;
              text-decoration: none;
              border-radius: 5px;
              margin: 20px 0;
              font-weight: bold;
            }
            .reset-button:hover {
              background-color: #4bb7c0;
            }
            .warning {
              background-color: #fff3cd;
              border-left: 4px solid #ffc107;
              padding: 15px;
              margin: 20px 0;
              border-radius: 3px;
            }
            .token-info {
              background-color: #f0f0f0;
              padding: 15px;
              border-radius: 5px;
              margin: 15px 0;
              font-size: 12px;
              color: #666;
              word-break: break-all;
            }
            .footer {
              text-align: center;
              padding: 15px;
              font-size: 12px;
              color: #888;
              background-color: #f9f9f9;
            }
            .expiry-warning {
              color: #d9534f;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <img src="cid:logo" alt="Pholders Healthcare">
              <h1>Pholders Healthcare</h1>
              <p>Secure Password Reset</p>
            </div>
            <div class="content">
              <h2>Hello ${firstName},</h2>
              <p>We received a request to reset the password for your Pholders Healthcare account.</p>
              
              <p>Click the button below to reset your password:</p>
              <a href="${resetLink}" class="reset-button">Reset Password</a>
              
              <p>Or copy and paste this link in your browser:</p>
              <div class="token-info">${resetLink}</div>
              
              <div class="warning">
                <strong>⚠️ Security Notice:</strong>
                <p>This password reset link will expire in <span class="expiry-warning">24 hours</span>.</p>
                <p>If you did not request this password reset, please ignore this email or contact our support team immediately.</p>
              </div>
              
              <p><strong>For your security:</strong></p>
              <ul>
                <li>Never share this link with anyone</li>
                <li>Make sure to create a strong password</li>
                <li>If you didn't make this request, your account may be compromised</li>
              </ul>
              
              <p>Thank you for choosing Pholders Healthcare!</p>
            </div>
            <div class="footer">
              <p>&copy; 2026 Pholders Healthcare. All rights reserved.</p>
              <p>This is an automated email. Please do not reply.</p>
              <p>If you need help, visit our support center.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Hello ${firstName},

We received a request to reset the password for your Pholders Healthcare account.

Click the link below to reset your password:
${resetLink}

This link will expire in 24 hours.

If you did not request this, please ignore this email.

Security Tips:
- Never share this link with anyone
- Make sure to create a strong password
- If you didn't make this request, your account may be compromised

Thank you for choosing Pholders Healthcare!
      `,
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
      from: `"Pholders Healthcare" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Password Reset Successful - Pholders Healthcare',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              background-color: #f4f4f9;
              margin: 0;
              padding: 0;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 20px auto;
              background: #ffffff;
              border-radius: 8px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              overflow: hidden;
            }
            .header {
              background-color: #5cb85c;
              color: #ffffff;
              text-align: center;
              padding: 30px 20px;
              border-bottom: 5px solid #4cae4c;
            }
            .header h1 {
              font-size: 24px;
              margin: 0;
            }
            .content {
              padding: 30px;
            }
            .success-icon {
              text-align: center;
              font-size: 48px;
              margin-bottom: 15px;
            }
            .footer {
              text-align: center;
              padding: 15px;
              font-size: 12px;
              color: #888;
              background-color: #f9f9f9;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Password Reset Successful</h1>
            </div>
            <div class="content">
              <h2>Hello ${firstName},</h2>
              <p>Your password has been successfully reset.</p>
              
              <p>You can now log in to your Pholders Healthcare account using your new password.</p>
              
              <p><strong>If you did not make this change:</strong></p>
              <p>Please contact our support team immediately if you did not request this password reset.</p>
              
              <p>Thank you for using Pholders Healthcare!</p>
            </div>
            <div class="footer">
              <p>&copy; 2026 Pholders Healthcare. All rights reserved.</p>
              <p>This is an automated email. Please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Hello ${firstName},

Your password has been successfully reset.

You can now log in to your Pholders Healthcare account using your new password.

If you did not make this change, please contact our support team immediately.

Thank you for using Pholders Healthcare!
      `
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
      from: `"Pholders Healthcare" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Confirm Account Deletion - Pholders Healthcare',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              background-color: #f4f4f9;
              margin: 0;
              padding: 0;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 20px auto;
              background: #ffffff;
              border-radius: 8px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              overflow: hidden;
            }
            .header {
              background-color: #d9534f;
              color: #ffffff;
              text-align: center;
              padding: 30px 20px;
              border-bottom: 5px solid #c9302c;
            }
            .header img {
              max-width: 80px;
              margin-bottom: 10px;
            }
            .header h1 {
              font-size: 24px;
              margin: 0;
            }
            .header p {
              font-size: 14px;
              margin: 5px 0 0;
              color: #ffcccc;
            }
            .content {
              padding: 30px;
            }
            .content h2 {
              color: #333;
              margin-top: 0;
            }
            .warning-box {
              background-color: #fff3cd;
              border-left: 5px solid #d9534f;
              padding: 15px;
              margin: 20px 0;
              border-radius: 3px;
            }
            .warning-box strong {
              color: #d9534f;
            }
            .action-buttons {
              margin: 30px 0;
              text-align: center;
            }
            .confirm-button {
              display: inline-block;
              background-color: #d9534f;
              color: #ffffff;
              padding: 12px 30px;
              text-decoration: none;
              border-radius: 5px;
              margin: 10px 5px;
              font-weight: bold;
            }
            .confirm-button:hover {
              background-color: #c9302c;
            }
            .cancel-button {
              display: inline-block;
              background-color: #5cb85c;
              color: #ffffff;
              padding: 12px 30px;
              text-decoration: none;
              border-radius: 5px;
              margin: 10px 5px;
              font-weight: bold;
            }
            .cancel-button:hover {
              background-color: #4cae4c;
            }
            .token-info {
              background-color: #f0f0f0;
              padding: 15px;
              border-radius: 5px;
              margin: 15px 0;
              font-size: 12px;
              color: #666;
              word-break: break-all;
              max-height: 100px;
              overflow-y: auto;
            }
            .footer {
              text-align: center;
              padding: 15px;
              font-size: 12px;
              color: #888;
              background-color: #f9f9f9;
            }
            .expiry-warning {
              color: #d9534f;
              font-weight: bold;
            }
            .info-list {
              background-color: #f5f5f5;
              padding: 15px;
              border-radius: 5px;
              margin: 15px 0;
            }
            .info-list li {
              margin: 8px 0;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <img src="cid:logo" alt="Pholders Healthcare">
              <h1>Pholders Healthcare</h1>
              <p>Account Deletion Request</p>
            </div>
            <div class="content">
              <h2>Hello ${firstName},</h2>
              
              <div class="warning-box">
                <strong>⚠️ IMPORTANT:</strong> You have requested to delete your Pholders Healthcare account.
              </div>
              
              <p><strong>This action is permanent and cannot be undone.</strong></p>
              
              <p>When you confirm the deletion, we will:</p>
              <ul class="info-list">
                <li>✓ Permanently delete your account and all personal data</li>
                <li>✓ Remove all your medical records and health information</li>
                <li>✓ Delete all appointments and consultations</li>
                <li>✓ Clear all stored communications and files</li>
              </ul>
              
              <p><strong>To confirm account deletion, click the button below:</strong></p>
              
              <div class="action-buttons">
                <a href="${deletionLink}" class="confirm-button">Confirm Deletion</a>
              </div>
              
              <p>Or copy and paste this link in your browser:</p>
              <div class="token-info">${deletionLink}</div>
              
              <div class="warning-box">
                <strong>⏰ Action Required:</strong>
                <p>This confirmation link will expire in <span class="expiry-warning">24 hours</span>.</p>
                <p>If you do not click this link, your account will NOT be deleted.</p>
              </div>
              
              <p><strong>Changed your mind?</strong></p>
              <p>If you no longer want to delete your account, simply ignore this email. Your account will remain active.</p>
              
              <p><strong>For your security:</strong></p>
              <ul class="info-list">
                <li>✓ Never share this link with anyone</li>
                <li>✓ Only click this link if you requested account deletion</li>
                <li>✓ If you didn't request this, please contact support immediately</li>
              </ul>
              
              <p>Thank you for using Pholders Healthcare.</p>
            </div>
            <div class="footer">
              <p>&copy; 2026 Pholders Healthcare. All rights reserved.</p>
              <p>This is an automated email. Please do not reply.</p>
              <p>For support, contact: support@pholders.com</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Hello ${firstName},

⚠️ IMPORTANT: You have requested to delete your Pholders Healthcare account.

THIS ACTION IS PERMANENT AND CANNOT BE UNDONE.

When you confirm deletion, we will:
✓ Permanently delete your account and all personal data
✓ Remove all your medical records and health information
✓ Delete all appointments and consultations
✓ Clear all stored communications and files

To confirm account deletion, click the link below:
${deletionLink}

This link will expire in 24 hours.

If you do not click this link, your account will NOT be deleted.

CHANGED YOUR MIND?
If you no longer want to delete your account, simply ignore this email. Your account will remain active.

SECURITY NOTICE:
- Never share this link with anyone
- Only click this link if you requested account deletion
- If you didn't request this, contact support immediately

Thank you for using Pholders Healthcare.

---
© 2026 Pholders Healthcare. All rights reserved.
      `,
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
      from: `"Pholders Security" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🚨 URGENT: Suspicious Activity Confirmed on Your Account',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f9; color: #333; }
            .container { max-width: 600px; margin: 20px auto; background: #fff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden; }
            .header { background: linear-gradient(135deg, #d32f2f, #b71c1c); color: #fff; padding: 30px; text-align: center; }
            .alert-icon { font-size: 60px; margin: 10px 0; }
            .content { padding: 25px; }
            .threat-box { background: #ffebee; border: 2px solid #d32f2f; padding: 15px; border-radius: 4px; margin: 15px 0; }
            .threat-box strong { color: #d32f2f; }
            .action-required { background: #fff3cd; padding: 15px; border-left: 4px solid #ff9800; margin: 15px 0; }
            .button { display: inline-block; padding: 12px 25px; background: #d32f2f; color: #fff; text-decoration: none; border-radius: 4px; font-weight: bold; margin-top: 15px; }
            .detail { padding: 8px 0; border-bottom: 1px solid #eee; }
            .footer { background: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eee; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="alert-icon">🚨</div>
              <h1>Account Security Alert</h1>
            </div>
            <div class="content">
              <h2 style="color: #d32f2f;">Suspicious Activity Confirmed</h2>
              <p>Hi ${firstName},</p>
              <p>Our security team has detected and <strong>confirmed suspicious activity</strong> on your Pholders Healthcare account.</p>
              
              <div class="threat-box">
                <strong>⚠️ What Happened:</strong><br>
                ${alert.alert_message || 'Unauthorized access detected'}
              </div>

              <div class="action-required">
                <strong>🔴 IMMEDIATE ACTION REQUIRED:</strong><br>
                <ul style="margin: 10px 0;">
                  <li><strong>Change your password immediately</strong></li>
                  <li>Review all active sessions and sign out of unrecognized devices</li>
                  <li>Contact our support team if this wasn't you</li>
                  <li>Consider enabling two-factor authentication</li>
                </ul>
              </div>

              <div style="background: #f5f5f5; padding: 15px; border-radius: 4px; margin: 15px 0;">
                <strong>Alert Details:</strong>
                <div class="detail"><strong>Alert Type:</strong> ${alert.alert_type || 'Unknown'}</div>
                <div class="detail"><strong>Risk Level:</strong> ${alert.severity || 'Unknown'}</div>
                <div class="detail"><strong>Timestamp:</strong> ${new Date(alert.created_at).toLocaleString()}</div>
                <div class="detail"><strong>IP Address:</strong> ${alert.ip_address || 'Unknown'}</div>
              </div>

              <center>
                <a href="${process.env.FRONTEND_URL}/settings/security" class="button">Review Security Settings</a>
              </center>

              <p style="font-size: 12px; color: #999; margin-top: 20px;">
                If you believe this is a mistake or didn't authorize these activities, please contact our support team immediately.
              </p>
            </div>
            <div class="footer">
              <p>&copy; 2026 Pholders Healthcare. Your security is our priority.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
URGENT: SUSPICIOUS ACTIVITY CONFIRMED

Hi ${firstName},

Our security team has detected and confirmed suspicious activity on your account.

Alert: ${alert.alert_message || 'Unauthorized access'}
Alert Type: ${alert.alert_type}
Risk Level: ${alert.severity}
Timestamp: ${new Date(alert.created_at).toLocaleString()}
IP Address: ${alert.ip_address || 'Unknown'}

IMMEDIATE ACTION REQUIRED:
1. Change your password immediately
2. Review all active sessions
3. Contact support if this wasn't you
4. Enable two-factor authentication

Visit your security settings: ${process.env.FRONTEND_URL}/settings/security

Pholders Healthcare Security Team
      `
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
      from: `"Pholders Healthcare" <${process.env.EMAIL_USER}>`,
      to: newEmail,
      subject: 'Confirm your new email address',
      html: `
        <div style="font-family: Segoe UI, Tahoma, sans-serif; max-width: 600px; margin: 20px auto; background: #fff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.08); overflow: hidden;">
          <div style="background:#6DD0D8; color:#fff; padding:24px; text-align:center;">
            <h1 style="margin:0;">Confirm Your New Email</h1>
          </div>
          <div style="padding:24px;">
            <p>Hi ${firstName || ''},</p>
            <p>We received a request to change the email on your Pholders Healthcare account to this address.</p>
            <p>Click the button below within 60 minutes to confirm. Your current email will keep working until you do.</p>
            <p style="text-align:center; margin: 24px 0;">
              <a href="${verifyLink}" style="display:inline-block; padding:12px 24px; background:#6DD0D8; color:#fff; text-decoration:none; border-radius:4px; font-weight:bold;">Confirm New Email</a>
            </p>
            <p style="color:#666; font-size:13px;">If you didn't request this change, ignore this email.</p>
          </div>
        </div>
      `,
      text: `Hi ${firstName || ''},\n\nConfirm your new email by visiting:\n${verifyLink}\n\nLink expires in 60 minutes. If you didn't request this, ignore this email.`
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
      from: `"Pholders Security" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🔒 Your account has been frozen',
      html: `
        <div style="font-family: Segoe UI, Tahoma, sans-serif; max-width: 600px; margin: 20px auto; background:#fff; border-radius:8px; box-shadow:0 4px 6px rgba(0,0,0,0.08); overflow:hidden;">
          <div style="background:#d32f2f; color:#fff; padding:24px; text-align:center;">
            <h1 style="margin:0;">Account Frozen</h1>
          </div>
          <div style="padding:24px;">
            <p>Hi ${firstName || ''},</p>
            <p>Your Pholders Healthcare account has been frozen at your request. All active sessions have been logged out.</p>
            <p>If you didn't do this, or you want to unfreeze your account, click below within 7 days:</p>
            <p style="text-align:center; margin: 24px 0;">
              <a href="${unfreezeLink}" style="display:inline-block; padding:12px 24px; background:#6DD0D8; color:#fff; text-decoration:none; border-radius:4px; font-weight:bold;">Unfreeze Account</a>
            </p>
            <p style="color:#666; font-size:13px;">For help, contact our support team.</p>
          </div>
        </div>
      `,
      text: `Hi ${firstName || ''},\n\nYour account has been frozen and all sessions logged out.\n\nUnfreeze: ${unfreezeLink}\nLink expires in 7 days.`
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
      from: `"Pholders Healthcare" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your Pholders Healthcare security audit log',
      html: `
        <div style="font-family: Segoe UI, Tahoma, sans-serif; max-width: 600px; margin: 20px auto; background:#fff; border-radius:8px; box-shadow:0 4px 6px rgba(0,0,0,0.08); overflow:hidden;">
          <div style="background:#6DD0D8; color:#fff; padding:24px; text-align:center;">
            <h1 style="margin:0;">Security Audit Log</h1>
          </div>
          <div style="padding:24px;">
            <p>Hi ${firstName || ''},</p>
            <p>Attached is the security audit log you requested. It includes recent login activity, password changes, and device sessions.</p>
            <p style="color:#666; font-size:13px;">If you didn't request this export, please change your password immediately and contact support.</p>
          </div>
        </div>
      `,
      text: `Hi ${firstName || ''},\n\nAttached is your requested security audit log.`,
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
    const supportInbox = process.env.SUPPORT_EMAIL || process.env.EMAIL_USER;
    const mailOptions = {
      from: `"Pholders Support" <${process.env.EMAIL_USER}>`,
      to: supportInbox,
      replyTo: patient?.email,
      subject: `[Support][${ticket.type}] ${ticket.subject || 'New ticket'}`,
      html: `
        <div style="font-family: Segoe UI, Tahoma, sans-serif; max-width: 640px; margin: 20px auto;">
          <h2>New ${ticket.type} ticket</h2>
          <p><strong>From:</strong> ${patient?.first_name || ''} ${patient?.last_name || ''} (${patient?.email || ''})</p>
          <p><strong>Patient ID:</strong> ${patient?.id || ''}</p>
          <p><strong>Subject:</strong> ${ticket.subject || '(none)'}</p>
          <hr>
          <pre style="white-space: pre-wrap; font-family: inherit;">${ticket.body || ''}</pre>
          <hr>
          <p style="color:#888; font-size:12px;">Ticket ID: ${ticket.id || 'n/a'} • Created: ${ticket.created_at || new Date().toISOString()}</p>
        </div>
      `,
      text: `New ${ticket.type} ticket\nFrom: ${patient?.email}\nSubject: ${ticket.subject}\n\n${ticket.body}`
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
    const securityInbox = process.env.SECURITY_EMAIL || process.env.SUPPORT_EMAIL || process.env.EMAIL_USER;
    const mailOptions = {
      from: `"Pholders Security" <${process.env.EMAIL_USER}>`,
      to: securityInbox,
      replyTo: patient?.email,
      subject: `[Security] Suspicious activity report — ${patient?.email || 'unknown'}`,
      html: `
        <div style="font-family: Segoe UI, Tahoma, sans-serif; max-width: 640px; margin: 20px auto;">
          <h2 style="color:#d32f2f;">Patient-reported suspicious activity</h2>
          <p><strong>Patient:</strong> ${patient?.first_name || ''} ${patient?.last_name || ''} (${patient?.email || ''})</p>
          <p><strong>Patient ID:</strong> ${patient?.id || ''}</p>
          <p><strong>Subject:</strong> ${report.subject || '(none)'}</p>
          <p><strong>Related session ID:</strong> ${report.related_session_id || 'n/a'}</p>
          <hr>
          <pre style="white-space: pre-wrap; font-family: inherit;">${report.body || ''}</pre>
          <hr>
          <p style="color:#888; font-size:12px;">Ticket ID: ${report.id || 'n/a'} • Reported: ${report.created_at || new Date().toISOString()}</p>
        </div>
      `,
      text: `Suspicious activity report\nFrom: ${patient?.email}\n${report.subject}\n\n${report.body}`
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
