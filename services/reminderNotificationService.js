const { query } = require('../config/db');
const EmailService = require('./emailService');

/**
 * Appointment Reminder Notification Service
 * Handles sending reminder notifications via email, SMS, push, and in-app methods
 */

class ReminderNotificationService {
  /**
   * Send appointment reminder via specified methods
   */
  static async sendReminder(appointmentData, reminderMethod, minutesBefore) {
    try {
      const {
        reminder_id,
        appointment_id,
        patient_id,
        patient_email,
        patient_phone,
        patient_first_name,
        patient_last_name,
        doctor_first_name,
        doctor_last_name,
        specialization,
        clinic_name,
        appointment_date,
        time_slot
      } = appointmentData;

      let notificationStatus = 'sent';
      let errorMessage = null;

      try {
        switch (reminderMethod) {
          case 'email':
            await this.sendEmailReminder({
              patientEmail: patient_email,
              patientName: `${patient_first_name} ${patient_last_name}`,
              doctorName: `${doctor_first_name} ${doctor_last_name}`,
              specialization,
              clinicName: clinic_name,
              appointmentDate: appointment_date,
              appointmentTime: time_slot,
              minutesBefore
            });
            break;

          case 'sms':
            await this.sendSmsReminder({
              patientPhone: patient_phone,
              patientName: `${patient_first_name} ${patient_last_name}`,
              doctorName: `${doctor_first_name} ${doctor_last_name}`,
              appointmentTime: time_slot,
              minutesBefore
            });
            break;

          case 'push':
            await this.sendPushReminder({
              patientId: patient_id,
              patientName: `${patient_first_name} ${patient_last_name}`,
              doctorName: `${doctor_first_name} ${doctor_last_name}`,
              appointmentDate: appointment_date,
              appointmentTime: time_slot,
              minutesBefore
            });
            break;

          case 'in-app':
            await this.sendInAppReminder({
              patientId: patient_id,
              appointmentId: appointment_id,
              doctorName: `${doctor_first_name} ${doctor_last_name}`,
              specialization,
              appointmentDate: appointment_date,
              appointmentTime: time_slot,
              minutesBefore
            });
            break;

          default:
            throw new Error(`Unknown reminder method: ${reminderMethod}`);
        }
      } catch (error) {
        notificationStatus = 'failed';
        errorMessage = error.message;
        console.error(`❌ Error sending ${reminderMethod} reminder:`, error);
      }

      // Record notification history
      const AppointmentReminder = require('../models/AppointmentReminder');
      await AppointmentReminder.recordNotificationHistory(
        reminder_id,
        appointment_id,
        patient_id,
        reminderMethod,
        minutesBefore,
        notificationStatus,
        errorMessage
      );

      return {
        success: notificationStatus === 'sent',
        method: reminderMethod,
        status: notificationStatus,
        error: errorMessage
      };
    } catch (error) {
      console.error('❌ Error in sendReminder:', error);
      throw error;
    }
  }

  /**
   * Send email reminder
   */
  static async sendEmailReminder(data) {
    const {
      patientEmail,
      patientName,
      doctorName,
      specialization,
      clinicName,
      appointmentDate,
      appointmentTime,
      minutesBefore
    } = data;

    const timeString = this.formatReminderTime(minutesBefore);

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #1e40af; color: white; padding: 20px; text-align: center;">
          <h1>📅 Appointment Reminder</h1>
        </div>
        
        <div style="padding: 20px; background-color: #f9fafb; border: 1px solid #e5e7eb;">
          <p>Hi ${patientName},</p>
          
          <p style="margin-top: 20px;">You have an upcoming appointment <strong>${timeString}</strong>:</p>
          
          <div style="background-color: white; padding: 15px; border-left: 4px solid #1e40af; margin: 20px 0;">
            <p><strong>Doctor:</strong> ${doctorName}</p>
            <p><strong>Specialization:</strong> ${specialization}</p>
            <p><strong>Clinic:</strong> ${clinicName}</p>
            <p><strong>Date & Time:</strong> ${appointmentDate} at ${appointmentTime}</p>
          </div>
          
          <p style="margin-top: 20px; color: #666;">Please make sure to arrive on time. If you need to reschedule or cancel, please log into your account.</p>
          
          <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #999; font-size: 12px;">
            This is an automated reminder. Please do not reply to this email.
          </p>
        </div>
      </div>
    `;

    const textContent = `Appointment Reminder\n\nHi ${patientName},\n\nYou have an upcoming appointment ${timeString}:\n\nDoctor: ${doctorName}\nSpecialization: ${specialization}\nClinic: ${clinicName}\nDate & Time: ${appointmentDate} at ${appointmentTime}\n\nPlease make sure to arrive on time.`;

    try {
      await EmailService.sendEmail(
        patientEmail,
        'Appointment Reminder',
        htmlContent,
        textContent
      );
      console.log(`✅ Email reminder sent to ${patientEmail}`);
    } catch (error) {
      console.error(`❌ Failed to send email reminder to ${patientEmail}:`, error);
      throw error;
    }
  }

  /**
   * Send SMS reminder
   */
  static async sendSmsReminder(data) {
    const {
      patientPhone,
      patientName,
      doctorName,
      appointmentTime,
      minutesBefore
    } = data;

    const timeString = this.formatReminderTime(minutesBefore);

    const smsMessage = `Hi ${patientName}, reminder: You have an appointment with Dr. ${doctorName} ${timeString} at ${appointmentTime}. Please arrive on time.`;

    try {
      // TODO: Integrate with SMS service provider (Twilio, AWS SNS, etc.)
      console.log(`✅ SMS reminder would be sent to ${patientPhone}: ${smsMessage}`);
      // Placeholder - implement actual SMS sending
      // await twilioClient.messages.create({
      //   body: smsMessage,
      //   from: process.env.TWILIO_PHONE_NUMBER,
      //   to: patientPhone
      // });
    } catch (error) {
      console.error(`❌ Failed to send SMS reminder to ${patientPhone}:`, error);
      throw error;
    }
  }

  /**
   * Send push notification
   */
  static async sendPushReminder(data) {
    const {
      patientId,
      patientName,
      doctorName,
      appointmentDate,
      appointmentTime,
      minutesBefore
    } = data;

    const timeString = this.formatReminderTime(minutesBefore);

    const pushPayload = {
      title: 'Appointment Reminder',
      body: `${timeString}: You have an appointment with Dr. ${doctorName} on ${appointmentDate} at ${appointmentTime}`,
      data: {
        appointmentId: data.appointmentId,
        action: 'view_appointment'
      }
    };

    try {
      // TODO: Integrate with push notification service (Firebase Cloud Messaging, OneSignal, etc.)
      console.log(`✅ Push notification would be sent to patient ${patientId}: ${JSON.stringify(pushPayload)}`);
      // Placeholder - implement actual push notification sending
      // await firebaseAdmin.messaging().sendToDevice(deviceToken, pushPayload);
    } catch (error) {
      console.error(`❌ Failed to send push notification to patient ${patientId}:`, error);
      throw error;
    }
  }

  /**
   * Send in-app reminder notification
   */
  static async sendInAppReminder(data) {
    const {
      patientId,
      appointmentId,
      doctorName,
      specialization,
      appointmentDate,
      appointmentTime,
      minutesBefore
    } = data;

    const timeString = this.formatReminderTime(minutesBefore);

    try {
      // Store in-app notification in database
      await query(
        `INSERT INTO in_app_notifications (patient_id, appointment_id, title, message, notification_type, is_read)
         VALUES ($1, $2, $3, $4, $5, FALSE)`,
        [
          patientId,
          appointmentId,
          'Appointment Reminder',
          `${timeString}: Dr. ${doctorName} (${specialization}) on ${appointmentDate} at ${appointmentTime}`,
          'appointment_reminder'
        ]
      );
      console.log(`✅ In-app notification recorded for patient ${patientId}`);
    } catch (error) {
      // If in-app notifications table doesn't exist, log but don't fail
      console.warn(`⚠️  Could not store in-app notification:`, error.message);
    }
  }

  /**
   * Format reminder time text
   */
  static formatReminderTime(minutesBefore) {
    if (minutesBefore === 1440) {
      return 'tomorrow';
    } else if (minutesBefore === 720) {
      return 'in 12 hours';
    } else if (minutesBefore === 60) {
      return 'in 1 hour';
    } else if (minutesBefore === 30) {
      return 'in 30 minutes';
    } else if (minutesBefore === 15) {
      return 'in 15 minutes';
    } else if (minutesBefore < 60) {
      return `in ${minutesBefore} minutes`;
    } else {
      const hours = Math.floor(minutesBefore / 60);
      return `in ${hours} hour${hours > 1 ? 's' : ''}`;
    }
  }

  /**
   * Process and send all due reminders
   * Called by the scheduler service
   */
  static async processDueReminders() {
    try {
      const AppointmentReminder = require('../models/AppointmentReminder');
      const remindersToSend = await AppointmentReminder.getRemindersToSend();

      let sentCount = 0;
      let failedCount = 0;

      for (const reminder of remindersToSend) {
        // Check if reminder is still enabled
        if (!reminder.reminder_methods || reminder.reminder_methods.length === 0) {
          continue;
        }

        // For each reminder time, check if it matches the current time
        const appointmentDateTime = new Date(reminder.appointment_date);
        // Parse time_slot to get the actual appointment time
        const [hours, minutes] = reminder.time_slot.split(':');
        appointmentDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

        const now = new Date();
        const minutesUntilAppointment = Math.floor((appointmentDateTime - now) / 60000);

        // Check if any reminder time matches
        for (const reminderMinutes of reminder.reminder_times) {
          // Allow 2-minute window for reminder (e.g., if reminder is 60 minutes, send between 60-62 minutes)
          if (Math.abs(minutesUntilAppointment - reminderMinutes) <= 2) {
            // Send reminder via all configured methods
            for (const method of reminder.reminder_methods) {
              try {
                const result = await this.sendReminder(reminder, method, reminderMinutes);
                if (result.success) {
                  sentCount++;
                } else {
                  failedCount++;
                }
              } catch (error) {
                failedCount++;
                console.error(`Failed to send ${method} reminder:`, error);
              }
            }
          }
        }
      }

      if (sentCount > 0 || failedCount > 0) {
        console.log(`📨 Reminder processing: ${sentCount} sent, ${failedCount} failed`);
      }

      return { sentCount, failedCount };
    } catch (error) {
      console.error('❌ Error processing due reminders:', error);
      throw error;
    }
  }

  /**
   * Get pending reminders (for debugging/admin purposes)
   */
  static async getPendingReminders() {
    try {
      const AppointmentReminder = require('../models/AppointmentReminder');
      const reminders = await AppointmentReminder.getRemindersToSend();
      return reminders.map(r => ({
        reminderId: r.id,
        appointmentId: r.appointment_id,
        patientName: `${r.patient_first_name} ${r.patient_last_name}`,
        doctorName: `${r.doctor_first_name} ${r.doctor_last_name}`,
        appointmentDate: r.appointment_date,
        appointmentTime: r.time_slot,
        reminderTimes: r.reminder_times,
        reminderMethods: r.reminder_methods
      }));
    } catch (error) {
      console.error('Error fetching pending reminders:', error);
      return [];
    }
  }

  /**
   * Test reminder notification
   */
  static async testReminder(method, testEmail = null) {
    try {
      const testData = {
        reminder_id: 0,
        appointment_id: 0,
        patient_id: 0,
        patient_email: testEmail || process.env.TEST_EMAIL,
        patient_phone: '+1234567890',
        patient_first_name: 'Test',
        patient_last_name: 'Patient',
        doctor_first_name: 'Dr.',
        doctor_last_name: 'Smith',
        specialization: 'General Practitioner',
        clinic_name: 'Test Clinic',
        appointment_date: new Date().toISOString().split('T')[0],
        time_slot: '14:00'
      };

      const result = await this.sendReminder(testData, method, 60);
      console.log(`✅ Test ${method} reminder sent`);
      return result;
    } catch (error) {
      console.error(`❌ Failed to send test ${method} reminder:`, error);
      throw error;
    }
  }
}

module.exports = ReminderNotificationService;
