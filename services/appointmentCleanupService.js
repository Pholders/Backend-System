/**
 * Appointment Cleanup Service
 * Automatically cancels pending payments that have expired
 * Runs periodically in the background
 */

const Appointment = require('../models/Appointment');
const StripeService = require('./stripeService');

class AppointmentCleanupService {
  static intervalId = null;
  static isRunning = false;

  /**
   * Start the cleanup scheduler
   * @param {number} intervalMinutes - How often to run cleanup (default: 15 minutes)
   * @param {number} timeoutMinutes - Auto-cancel pending payments older than this (default: 30 minutes)
   */
  static start(intervalMinutes = 15, timeoutMinutes = 30) {
    if (this.intervalId) {
      console.log('⚠️ Appointment cleanup service is already running');
      return;
    }

    console.log(`🔄 Starting appointment cleanup service (runs every ${intervalMinutes} minutes, timeout: ${timeoutMinutes} minutes)`);

    // Run immediately on start
    this.runCleanup(timeoutMinutes);

    // Then schedule recurring cleanup
    this.intervalId = setInterval(() => {
      this.runCleanup(timeoutMinutes);
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Stop the cleanup scheduler
   */
  static stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('✅ Appointment cleanup service stopped');
    }
  }

  /**
   * Run the cleanup operation
   */
  static async runCleanup(timeoutMinutes = 30) {
    if (this.isRunning) {
      return; // Prevent overlapping executions
    }

    this.isRunning = true;

    try {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`[${timestamp}] 🧹 Running appointment cleanup...`);

      const cancelledCount = await this.cancelExpiredPendingPayments(timeoutMinutes);

      if (cancelledCount > 0) {
        console.log(`[${timestamp}] ✅ Auto-cancelled ${cancelledCount} expired pending payment appointments`);
      } else {
        console.log(`[${timestamp}] ℹ️ No expired appointments to cancel`);
      }
    } catch (error) {
      console.error(`❌ Error during appointment cleanup: ${error.message}`);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Cancel appointments left in pending_payment past the timeout, together with
   * their pending payment and its Stripe PaymentIntent, so a later
   * /payments/initialize can't resume a payment for a cancelled booking.
   * Returns count of cancelled appointments
   */
  static async cancelExpiredPendingPayments(timeoutMinutes = 30) {
    const expired = await Appointment.findExpiredPendingPayments(timeoutMinutes);
    let cancelledCount = 0;

    for (const { id } of expired) {
      try {
        const outcome = await StripeService.cancelPendingPaymentForAppointment(id);

        // Paid at the last moment (now scheduled), or Stripe is still settling it:
        // either way the booking must stay. A processing one is retried next run.
        if (outcome === 'completed' || outcome === 'processing') continue;

        if (await Appointment.cancelIfPendingPayment(id)) {
          cancelledCount++;
        }
      } catch (error) {
        // Leave the appointment alone if we couldn't confirm its payment is dead
        console.error(`❌ Could not auto-cancel appointment ${id}: ${error.message}`);
      }
    }

    return cancelledCount;
  }

  /**
   * Get current status
   */
  static getStatus() {
    return {
      isRunning: this.intervalId !== null,
      lastRun: this.lastRun || null
    };
  }
}

module.exports = AppointmentCleanupService;
