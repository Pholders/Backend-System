const AuditLog = require('../models/AuditLog');
const LoginLocation = require('../models/LoginLocation');
const emailService = require('./emailService');

/**
 * Security Alert Service
 * Detects suspicious activities and sends enterprise-level alerts
 * Features:
 * - Impossible travel detection
 * - New device/location detection
 * - Multiple failed attempts
 * - Unusual location patterns
 * - Risk scoring system
 */

class SecurityAlertService {
  /**
   * Analyze login for suspicious activity
   */
  static async analyzeLoginActivity({
    userId,
    userType,
    email,
    firstName,
    lastName,
    ipAddress,
    geolocation,
    deviceFingerprint,
    deviceName,
    browser,
    os,
    userAgent
  }) {
    const alerts = [];
    let riskScore = 0;

    try {
      // 1. Check for impossible travel
      const recentLogins = await LoginLocation.getRecentLogins(userId, 2); // Last 2 hours
      if (recentLogins.length > 0) {
        const impossibleTravel = this.detectImpossibleTravel(
          recentLogins[0],
          { ipAddress, country: geolocation?.country, city: geolocation?.city, latitude: geolocation?.latitude, longitude: geolocation?.longitude }
        );

        if (impossibleTravel.detected) {
          alerts.push({
            type: 'IMPOSSIBLE_TRAVEL',
            severity: 'CRITICAL',
            message: `Login from ${geolocation?.city}, ${geolocation?.country} just ${impossibleTravel.timeDiffMinutes} minutes after login from ${recentLogins[0].city}, ${recentLogins[0].country}`,
            riskScore: 95
          });
          riskScore += 95;
        }
      }

      // 2. Check if location is known
      const similarLocation = await LoginLocation.findSimilarLocation(userId, ipAddress, deviceFingerprint);
      if (!similarLocation) {
        alerts.push({
          type: 'NEW_LOCATION',
          severity: 'MEDIUM',
          message: `Login from new location: ${geolocation?.city}, ${geolocation?.country} (${geolocation?.isp})`,
          riskScore: 40
        });
        riskScore += 40;
      } else {
        // Update login count and last activity
        const updateQuery = `
          UPDATE login_locations
          SET login_count = login_count + 1, last_login_at = NOW(), updated_at = NOW()
          WHERE id = $1
        `;
        const { query } = require('../config/db');
        await query(updateQuery, [similarLocation.id]);
      }

      // 3. Check for new device
      if (!deviceFingerprint || !similarLocation?.device_fingerprint || similarLocation.device_fingerprint !== deviceFingerprint) {
        alerts.push({
          type: 'NEW_DEVICE',
          severity: 'LOW',
          message: `Login from new device: ${deviceName || 'Unknown'} (${browser} on ${os})`,
          riskScore: 25
        });
        riskScore += 25;
      }

      // 4. Check for multiple suspicious locations in short time
      const suspiciousCount = await LoginLocation.getSuspiciousLocationsCount(userId, 24);
      if (suspiciousCount >= 3) {
        alerts.push({
          type: 'PATTERN_ANOMALY',
          severity: 'HIGH',
          message: `Multiple unusual logins detected: ${suspiciousCount} suspicious locations in 24 hours`,
          riskScore: 60
        });
        riskScore += 60;
      }

      // 5. Check for unusual country access pattern
      const recentCountries = await LoginLocation.getRecentCountries(userId, 30);
      if (recentCountries.length > 5) {
        alerts.push({
          type: 'UNUSUAL_COUNTRY_PATTERN',
          severity: 'MEDIUM',
          message: `Account accessed from ${recentCountries.length} different countries in 30 days`,
          riskScore: 35
        });
        riskScore += 35;
      }

      // 6. Check for time-zone anomaly (quick context change)
      if (recentLogins.length > 0 && geolocation?.timezone && recentLogins[0].timezone) {
        const tzDiff = this.calculateTimezoneDifference(recentLogins[0].timezone, geolocation.timezone);
        if (tzDiff > 12) { // More than 12 hours difference
          alerts.push({
            type: 'TIMEZONE_ANOMALY',
            severity: 'MEDIUM',
            message: `Large timezone change: ${Math.abs(tzDiff)} hours between consecutive logins`,
            riskScore: 30
          });
          riskScore += 30;
        }
      }

      // Normalize risk score (max 100)
      riskScore = Math.min(riskScore, 100);

      // Record location
      const locationRecord = await LoginLocation.recordLogin({
        userId,
        userType,
        ipAddress,
        country: geolocation?.country,
        region: geolocation?.region,
        city: geolocation?.city,
        latitude: geolocation?.latitude,
        longitude: geolocation?.longitude,
        deviceFingerprint,
        deviceName,
        browser,
        os
      });

      // Mark as suspicious if risk score is high
      if (riskScore > 50) {
        const flagReason = alerts.map(a => a.message).join(' | ');
        await LoginLocation.markAsSuspicious(locationRecord.id, riskScore, flagReason);
      }

      return {
        locationRecordId: locationRecord.id,
        alerts,
        riskScore,
        requiresReview: riskScore > 70,
        requiresUserVerification: riskScore > 50
      };
    } catch (error) {
      console.error('❌ Error analyzing login activity:', error);
      return {
        alerts: [],
        riskScore: 0,
        error: error.message
      };
    }
  }

  /**
   * Send security alert email
   */
  static async sendSecurityAlert({
    email,
    firstName,
    lastName,
    eventType,
    details,
    location,
    deviceInfo,
    timestamp,
    riskLevel,
    actionRequired = false,
    verificationLink = null
  }) {
    try {
      const severeAlerts = details?.alerts?.filter(a => a.severity === 'CRITICAL' || a.severity === 'HIGH') || [];
      const alertMessage = details?.alerts?.map(a => `• ${a.type}: ${a.message}`).join('\n') || 'Unusual activity detected';

      const mailOptions = {
        from: `"Pholders Security" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `🔒 Security Alert: ${eventType} - ${riskLevel} Risk`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f9; color: #333; }
              .container { max-width: 600px; margin: 20px auto; background: #fff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden; }
              .header { background: linear-gradient(135deg, #d32f2f, #f57c00); color: #fff; padding: 30px; text-align: center; }
              .header h1 { margin: 0; font-size: 24px; }
              .alert-icon { font-size: 48px; margin: 10px 0; }
              .risk-badge { display: inline-block; padding: 8px 15px; border-radius: 20px; font-weight: bold; margin-top: 10px; background: rgba(255,255,255,0.2); }
              .content { padding: 25px; }
              .section { margin-bottom: 20px; padding: 15px; background: #f9f9f9; border-left: 4px solid #d32f2f; border-radius: 4px; }
              .section-title { font-weight: bold; color: #d32f2f; margin-bottom: 10px; }
              .alert-item { padding: 8px 0; margin: 8px 0; border-bottom: 1px solid #eee; }
              .alert-critical { color: #d32f2f; font-weight: bold; }
              .alert-high { color: #f57c00; font-weight: bold; }
              .alert-medium { color: #ff9800; }
              .detail-row { display: flex; padding: 8px 0; }
              .detail-label { font-weight: bold; width: 150px; color: #666; }
              .detail-value { flex: 1; }
              .action-button { display: inline-block; margin-top: 10px; padding: 12px 25px; background: #d32f2f; color: #fff; text-decoration: none; border-radius: 4px; font-weight: bold; }
              .warning-box { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 4px; margin: 15px 0; }
              .warning-box strong { color: #ff9800; }
              .footer { background: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eee; }
              .icon { display: inline-block; margin-right: 8px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="alert-icon">🔒</div>
                <h1>Security Alert</h1>
                <div class="risk-badge">${riskLevel} Risk - ${eventType}</div>
              </div>

              <div class="content">
                <h2 style="color: #333; margin-top: 0;">Hi ${firstName},</h2>

                <p>We detected <strong>unusual activity</strong> on your Pholders Healthcare account. Please review the details below:</p>

                <div class="section">
                  <div class="section-title">⚠️ Security Alerts</div>
                  ${details?.alerts?.map(alert => `
                    <div class="alert-item">
                      <span class="alert-${alert.severity.toLowerCase()}">${alert.type}:</span><br>
                      ${alert.message}
                    </div>
                  `).join('') || 'Activity review required'}
                </div>

                <div class="section">
                  <div class="section-title">📍 Login Details</div>
                  <div class="detail-row">
                    <div class="detail-label">Time:</div>
                    <div class="detail-value">${new Date(timestamp).toLocaleString()}</div>
                  </div>
                  <div class="detail-row">
                    <div class="detail-label">IP Address:</div>
                    <div class="detail-value">${location?.ipAddress || 'Unknown'}</div>
                  </div>
                  <div class="detail-row">
                    <div class="detail-label">Location:</div>
                    <div class="detail-value">${location?.city || 'Unknown'}, ${location?.country || 'Unknown'} (${location?.isp || 'N/A'})</div>
                  </div>
                  <div class="detail-row">
                    <div class="detail-label">Device:</div>
                    <div class="detail-value">${deviceInfo?.name || 'Unknown'} - ${deviceInfo?.browser || 'Unknown'} on ${deviceInfo?.os || 'Unknown'}</div>
                  </div>
                </div>

                ${actionRequired ? `
                  <div class="warning-box">
                    <strong>⚠️ Action Required:</strong><br>
                    This activity requires verification. Click the button below to verify this login was authorized.
                  </div>
                  <center>
                    <a href="${verificationLink}" class="action-button">Verify This Activity</a>
                  </center>
                ` : ''}

                <div class="section" style="border-left-color: #4caf50;">
                  <div class="section-title" style="color: #4caf50;">✓ What To Do</div>
                  <ul style="margin: 10px 0; padding-left: 20px;">
                    <li>If this was you, you can safely ignore this alert</li>
                    <li>If you don't recognize this activity, <strong>change your password immediately</strong></li>
                    <li>Enable two-factor authentication for added security</li>
                    <li>Review your active sessions and revoke suspicious ones</li>
                  </ul>
                </div>

                <p style="font-size: 12px; color: #999; margin-top: 20px;">
                  This is an automated security alert. Your account security is our priority.
                </p>
              </div>

              <div class="footer">
                <p>&copy; 2026 Pholders Healthcare. All rights reserved.</p>
                <p>This is an automated security email. Please do not reply.</p>
                <p><a href="${process.env.FRONTEND_URL}/settings/security" style="color: #d32f2f; text-decoration: none;">View Security Settings</a></p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `
SECURITY ALERT: ${eventType}

Risk Level: ${riskLevel}

Alerts:
${details?.alerts?.map(a => `- ${a.type}: ${a.message}`).join('\n')}

Location: ${location?.city}, ${location?.country}
IP Address: ${location?.ipAddress}
Device: ${deviceInfo?.name} - ${deviceInfo?.browser} on ${deviceInfo?.os}
Time: ${new Date(timestamp).toLocaleString()}

${actionRequired ? `
Action Required: Verify this activity by clicking the link below:
${verificationLink}
` : ''}

What To Do:
- If this was you, you can safely ignore this alert
- If not, change your password immediately
- Enable two-factor authentication
- Review your active sessions

Pholders Healthcare
        `
      };

      const info = await emailService.transporter.sendMail(mailOptions);
      console.log('✅ Security alert email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Failed to send security alert:', error);
      throw error;
    }
  }

  /**
   * Send password change alert
   */
  static async sendPasswordChangeAlert({
    email,
    firstName,
    lastName,
    timestamp,
    ipAddress,
    location,
    deviceInfo
  }) {
    try {
      const mailOptions = {
        from: `"Pholders Security" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '🔐 Your Password Has Been Changed',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f9; }
              .container { max-width: 600px; margin: 20px auto; background: #fff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden; }
              .header { background: linear-gradient(135deg, #2e7d32, #4caf50); color: #fff; padding: 30px; text-align: center; }
              .header h1 { margin: 0; font-size: 24px; }
              .content { padding: 25px; }
              .detail-box { background: #f5f5f5; padding: 15px; border-radius: 4px; margin: 15px 0; }
              .detail-row { padding: 8px 0; }
              .detail-label { font-weight: bold; color: #666; }
              .footer { background: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eee; }
              .warning { background: #fff3cd; padding: 15px; border-left: 4px solid #ff9800; margin: 15px 0; border-radius: 4px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div style="font-size: 48px; margin: 10px 0;">🔐</div>
                <h1>Password Changed</h1>
              </div>

              <div class="content">
                <h2 style="color: #333; margin-top: 0;">Hi ${firstName},</h2>

                <p>Your Pholders Healthcare account password was successfully changed.</p>

                <div class="detail-box">
                  <div class="detail-row"><span class="detail-label">Time:</span> ${new Date(timestamp).toLocaleString()}</div>
                  <div class="detail-row"><span class="detail-label">IP Address:</span> ${ipAddress || 'Unknown'}</div>
                  <div class="detail-row"><span class="detail-label">Location:</span> ${location?.city}, ${location?.country}</div>
                  <div class="detail-row"><span class="detail-label">Device:</span> ${deviceInfo?.browser} on ${deviceInfo?.os}</div>
                </div>

                <div class="warning">
                  <strong>⚠️ Didn't make this change?</strong><br>
                  If you didn't change your password, your account may be compromised. 
                  <a href="${process.env.FRONTEND_URL}/reset-password" style="color: #d32f2f; font-weight: bold;">Reset your password immediately</a>
                </div>

                <p style="color: #666; font-size: 14px;">
                  This is a security notification. We notify you of important account changes to keep your data safe.
                </p>
              </div>

              <div class="footer">
                <p>&copy; 2026 Pholders Healthcare. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `
      };

      const info = await emailService.transporter.sendMail(mailOptions);
      console.log('✅ Password change alert sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Failed to send password change alert:', error);
      throw error;
    }
  }

  /**
   * Detect impossible travel between two locations
   * If travel speed > 900 km/h, it's physically impossible
   */
  static detectImpossibleTravel(previousLogin, currentLogin) {
    if (!previousLogin.latitude || !previousLogin.longitude || !currentLogin.latitude || !currentLogin.longitude) {
      return { detected: false };
    }

    const distance = this.calculateDistance(
      previousLogin.latitude,
      previousLogin.longitude,
      currentLogin.latitude,
      currentLogin.longitude
    );

    const previousTime = new Date(previousLogin.last_login_at || previousLogin.created_at);
    const currentTime = new Date();
    const timeDiffHours = (currentTime - previousTime) / (1000 * 60 * 60);
    const timeDiffMinutes = Math.round((currentTime - previousTime) / (1000 * 60));

    // Calculate speed (km/h)
    const speed = distance / timeDiffHours;

    // Impossible if speed > 900 km/h (roughly speed of commercial flight)
    const isImpossible = speed > 900;

    return {
      detected: isImpossible,
      distance,
      timeDiffHours,
      timeDiffMinutes,
      speed,
      previousLocation: `${previousLogin.city}, ${previousLogin.country}`,
      currentLocation: `${currentLogin.city}, ${currentLogin.country}`
    };
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   * Returns distance in kilometers
   */
  static calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  static toRad(deg) {
    return deg * (Math.PI / 180);
  }

  /**
   * Calculate timezone difference
   */
  static calculateTimezoneDifference(tz1, tz2) {
    try {
      const dt1 = new Date().toLocaleString('en-US', { timeZone: tz1 });
      const dt2 = new Date().toLocaleString('en-US', { timeZone: tz2 });
      const offset1 = new Date(dt1).getTime() - new Date().getTime();
      const offset2 = new Date(dt2).getTime() - new Date().getTime();
      return Math.abs(offset1 - offset2) / (1000 * 60 * 60);
    } catch {
      return 0;
    }
  }

  /**
   * Get risk level label
   */
  static getRiskLevel(riskScore) {
    if (riskScore >= 80) return 'CRITICAL';
    if (riskScore >= 60) return 'HIGH';
    if (riskScore >= 40) return 'MEDIUM';
    if (riskScore >= 20) return 'LOW';
    return 'MINIMAL';
  }
}

module.exports = SecurityAlertService;
