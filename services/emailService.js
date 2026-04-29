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
      console.error('❌ Email sending failed:', error);
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
}

module.exports = new EmailService();
