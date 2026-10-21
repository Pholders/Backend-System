const ReminderNotificationService = require('./reminderNotificationService');

/**
 * Appointment Reminder Scheduler Service
 * Handles periodic processing and sending of appointment reminders
 */

class ReminderSchedulerService {
  static intervalId = null;
  static isRunning = false;
  static checkIntervalMinutes = 5; // Check for due reminders every 5 minutes

  /**
   * Initialize the reminder scheduler
   * Starts a recurring job to check and send reminders
   */
  static initialize() {
    try {
      console.log('📅 Initializing Appointment Reminder Scheduler...');

      // Set reminder check interval (default: every 5 minutes)
      const intervalMs = this.checkIntervalMinutes * 60 * 1000;

      // Run immediately on startup
      this.runReminderCheck();

      // Then schedule recurring checks
      this.intervalId = setInterval(() => {
        this.runReminderCheck();
      }, intervalMs);

      this.isRunning = true;
      console.log(`✅ Reminder Scheduler initialized (checks every ${this.checkIntervalMinutes} minutes)`);

      return true;
    } catch (error) {
      console.error('❌ Error initializing reminder scheduler:', error);
      return false;
    }
  }

  /**
   * Run a single reminder check cycle
   */
  static async runReminderCheck() {
    try {
      const startTime = Date.now();

      // Process all due reminders
      const result = await ReminderNotificationService.processDueReminders();

      const duration = Date.now() - startTime;

      if (result.sentCount > 0 || result.failedCount > 0) {
        console.log(
          `⏱️  Reminder check completed in ${duration}ms - Sent: ${result.sentCount}, Failed: ${result.failedCount}`
        );
      }

      return result;
    } catch (error) {
      console.error('❌ Error in reminder check cycle:', error);
    }
  }

  /**
   * Manually trigger a reminder check (for testing/admin)
   */
  static async triggerReminderCheck() {
    try {
      console.log('🔔 Manually triggering reminder check...');
      const result = await this.runReminderCheck();
      console.log('✅ Manual reminder check completed:', result);
      return result;
    } catch (error) {
      console.error('❌ Error during manual reminder check:', error);
      throw error;
    }
  }

  /**
   * Get current scheduler status
   */
  static getStatus() {
    return {
      isRunning: this.isRunning,
      intervalMs: this.checkIntervalMinutes * 60 * 1000,
      checkIntervalMinutes: this.checkIntervalMinutes,
      nextCheckIn: this.isRunning ? `${this.checkIntervalMinutes} minutes` : 'Not running'
    };
  }

  /**
   * Stop the reminder scheduler
   */
  static stop() {
    try {
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
        this.isRunning = false;
        console.log('✅ Reminder Scheduler stopped');
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Error stopping reminder scheduler:', error);
      return false;
    }
  }

  /**
   * Restart the reminder scheduler
   */
  static restart() {
    try {
      console.log('🔄 Restarting Reminder Scheduler...');
      this.stop();
      this.initialize();
      return true;
    } catch (error) {
      console.error('❌ Error restarting reminder scheduler:', error);
      return false;
    }
  }

  /**
   * Set check interval
   */
  static setCheckInterval(minutes) {
    try {
      if (minutes < 1 || minutes > 60) {
        throw new Error('Check interval must be between 1 and 60 minutes');
      }

      this.checkIntervalMinutes = minutes;

      // Restart scheduler with new interval
      if (this.isRunning) {
        this.restart();
      }

      console.log(`✅ Reminder check interval set to ${minutes} minutes`);
      return true;
    } catch (error) {
      console.error('❌ Error setting check interval:', error);
      return false;
    }
  }

  /**
   * Get pending reminders (debug info)
   */
  static async getPendingReminders() {
    try {
      return await ReminderNotificationService.getPendingReminders();
    } catch (error) {
      console.error('❌ Error fetching pending reminders:', error);
      return [];
    }
  }

  /**
   * Send test reminder
   */
  static async sendTestReminder(method, testEmail = null) {
    try {
      console.log(`📧 Sending test ${method} reminder...`);
      const result = await ReminderNotificationService.testReminder(method, testEmail);
      console.log(`✅ Test reminder sent successfully`);
      return result;
    } catch (error) {
      console.error(`❌ Error sending test reminder:`, error);
      throw error;
    }
  }

  /**
   * Get scheduler statistics
   */
  static async getStatistics() {
    try {
      const { query } = require('../config/db');

      // Get total reminders set
      const totalReminders = await query(
        `SELECT COUNT(*) as count FROM appointment_reminders WHERE is_enabled = true`
      );

      // Get sent reminders today
      const sentToday = await query(
        `SELECT COUNT(*) as count FROM reminder_notification_history 
         WHERE status = 'sent' AND DATE(sent_at) = CURRENT_DATE`
      );

      // Get failed reminders today
      const failedToday = await query(
        `SELECT COUNT(*) as count FROM reminder_notification_history 
         WHERE status = 'failed' AND DATE(sent_at) = CURRENT_DATE`
      );

      // Get reminders by method
      const byMethod = await query(
        `SELECT reminder_method, COUNT(*) as count 
         FROM reminder_notification_history 
         WHERE DATE(sent_at) = CURRENT_DATE 
         GROUP BY reminder_method`
      );

      return {
        totalRemindersSet: parseInt(totalReminders.rows[0].count),
        sentToday: parseInt(sentToday.rows[0].count),
        failedToday: parseInt(failedToday.rows[0].count),
        successRate: totalReminders.rows[0].count > 0 
          ? ((parseInt(sentToday.rows[0].count) / (parseInt(sentToday.rows[0].count) + parseInt(failedToday.rows[0].count))) * 100).toFixed(2) + '%'
          : 'N/A',
        remindersPerMethod: byMethod.rows.reduce((acc, row) => {
          acc[row.reminder_method] = parseInt(row.count);
          return acc;
        }, {})
      };
    } catch (error) {
      console.error('❌ Error getting scheduler statistics:', error);
      return {
        error: error.message
      };
    }
  }
}

module.exports = ReminderSchedulerService;
