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
