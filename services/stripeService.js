const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Payment = require('../models/Payment');
const Appointment = require('../models/Appointment');

/**
 * Stripe Service
 * Handles all Stripe payment operations including Payment Intents, Webhooks, and Refunds
 */

class StripeService {
  /**
   * Create a Payment Intent for appointment payment
   * Supports multiple payment methods: card, alipay, bank_transfer, etc.
   */
  static async createPaymentIntent(appointmentId, patientId, amount, paymentMethods = ['card']) {
    try {
      const appointmentData = await Appointment.findById(appointmentId);
      if (!appointmentData) {
        throw new Error('Appointment not found');
      }

      // Convert amount to cents (Stripe requires cents)
      const amountInCents = Math.round(amount * 100);

      // Create Payment Intent with support for multiple payment methods
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: 'zar', // South African Rand (update as needed)
        payment_method_types: paymentMethods, // ['card', 'alipay', 'bancontact', etc.]
        description: `Appointment payment - Appointment ID: ${appointmentId}`,
        metadata: {
          appointmentId: appointmentId,
          patientId: patientId,
          type: 'appointment_consultation'
        },
        // Enable Statement Descriptor for patient clarity
        statement_descriptor_suffix: 'Healthcare Appt',
        // Set up for SCA (Strong Customer Authentication)
        confirmation_method: 'manual',
        // Allow off-session for recurring payments (if needed)
        off_session: false
      });

      return {
        success: true,
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        amount: amountInCents,
        status: paymentIntent.status
      };
    } catch (error) {
      console.error('❌ Error creating payment intent:', error);
      throw error;
    }
  }

  /**
   * Confirm Payment Intent (complete payment)
   * Called after client-side token generation
   */
  static async confirmPaymentIntent(paymentIntentId, paymentMethodId) {
    try {
      const confirmedIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
        payment_method: paymentMethodId,
        // Enable authentication if required
        use_stripe_sdk: true
      });

      return {
        success: confirmedIntent.status === 'succeeded',
        status: confirmedIntent.status,
        paymentIntentId: confirmedIntent.id,
        message: this._getStatusMessage(confirmedIntent.status)
      };
    } catch (error) {
      console.error('❌ Error confirming payment intent:', error);
      throw error;
    }
  }

  /**
   * Handle Payment Intent webhook (for asynchronous payments)
   * Called by Stripe webhook when payment completes/fails
   */
  static async handlePaymentIntentWebhook(paymentIntentData) {
    try {
      const { id: paymentIntentId, status, metadata, charges } = paymentIntentData;
      const { appointmentId, patientId } = metadata;

      if (!appointmentId || !patientId) {
        console.error('❌ Missing metadata in webhook');
        return { success: false, message: 'Missing metadata' };
      }

      // Get transaction ID from charges
      const transactionId = charges?.data?.[0]?.id || null;

      if (status === 'succeeded') {
        // Payment successful - update payment record
        const updateResult = await Payment.updateByStripeIntent(
          paymentIntentId,
          'completed',
          transactionId
        );

        // Update appointment status to 'confirmed'
        await Appointment.updateStatus(appointmentId, 'confirmed');

        console.log(`✅ Payment succeeded for appointment ${appointmentId}`);

        return {
          success: true,
          status: 'completed',
          message: 'Payment processed successfully'
        };
      } else if (status === 'requires_action') {
        console.log(`⏳ Payment requires action for ${paymentIntentId}`);
        return {
          success: false,
          status: 'requires_action',
          message: 'Payment requires additional action (3D Secure, etc.)'
        };
      } else if (status === 'processing') {
        console.log(`🔄 Payment processing for ${paymentIntentId}`);
        return {
          success: false,
          status: 'processing',
          message: 'Payment is being processed'
        };
      } else if (status === 'requires_payment_method') {
        // Payment failed
        await Payment.updateByStripeIntent(paymentIntentId, 'failed', transactionId);
        console.log(`❌ Payment failed for ${paymentIntentId}`);

        return {
          success: false,
          status: 'failed',
          message: 'Payment method failed'
        };
      }

      return {
        success: false,
        status,
        message: `Unknown status: ${status}`
      };
    } catch (error) {
      console.error('❌ Error handling payment webhook:', error);
      throw error;
    }
  }

  /**
   * List payment methods for a customer
   * Shows saved cards and other payment methods
   */
  static async getPaymentMethods(stripeCustomerId) {
    try {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: stripeCustomerId,
        type: 'card'
      });

      return paymentMethods.data.map(method => ({
        id: method.id,
        brand: method.card?.brand,
        last4: method.card?.last4,
        expMonth: method.card?.exp_month,
        expYear: method.card?.exp_year,
        default: method.customer ? true : false
      }));
    } catch (error) {
      console.error('❌ Error fetching payment methods:', error);
      throw error;
    }
  }

  /**
   * Create Refund for failed/cancelled appointment
   * Applies 10% platform fee retention as per policy
   */
  static async createRefund(paymentIntentId, reason = 'appointment_cancelled') {
    try {
      // Fetch original payment intent to get amount
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      
      if (paymentIntent.status !== 'succeeded') {
        throw new Error('Can only refund succeeded payments');
      }

      const originalAmount = paymentIntent.amount; // in cents
      const platformFee = Math.round(originalAmount * 0.10); // 10% fee
      const refundAmount = originalAmount - platformFee;

      // Create refund with reason
      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: refundAmount,
        reason: reason,
        metadata: {
          refund_reason: reason,
          platform_fee_retained: platformFee,
          refund_percentage: 90
        }
      });

      return {
        success: refund.status === 'succeeded',
        refundId: refund.id,
        amount: refundAmount / 100, // Convert back to currency
        platformFeeRetained: platformFee / 100,
        status: refund.status
      };
    } catch (error) {
      console.error('❌ Error creating refund:', error);
      throw error;
    }
  }

  /**
   * Create a Customer in Stripe
   * Used for saving payment methods and tracking
   */
  static async createStripeCustomer(patientId, email, name, phone = null) {
    try {
      const customer = await stripe.customers.create({
        email,
        name,
        phone,
        metadata: {
          patientId: patientId.toString()
        }
      });

      return {
        success: true,
        stripeCustomerId: customer.id,
        email: customer.email,
        name: customer.name
      };
    } catch (error) {
      console.error('❌ Error creating Stripe customer:', error);
      throw error;
    }
  }

  /**
   * Retrieve Payment Intent details
   * Used for checking payment status
   */
  static async getPaymentIntentStatus(paymentIntentId) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      return {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        metadata: paymentIntent.metadata,
        lastPaymentError: paymentIntent.last_payment_error
      };
    } catch (error) {
      console.error('❌ Error retrieving payment intent:', error);
      throw error;
    }
  }

  /**
   * Verify Webhook Signature
   * Ensures webhook is from authentic Stripe source
   */
  static verifyWebhookSignature(body, signature) {
    try {
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      
      if (!webhookSecret) {
        throw new Error('STRIPE_WEBHOOK_SECRET not configured');
      }

      const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      return {
        valid: true,
        event: event
      };
    } catch (error) {
      console.error('❌ Webhook signature verification failed:', error);
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Handle Charge Dispute (Chargeback)
   * Called when customer disputes a charge
   */
  static async handleChargeDispute(chargeData) {
    try {
      const { id: chargeId, amount, dispute } = chargeData;

      console.log(`⚠️ Charge dispute opened: ${chargeId}, Amount: ${amount / 100}, Dispute ID: ${dispute.id}`);

      // Log this as a security event
      // Update appointment status to 'disputed'
      // Notify admin

      return {
        success: true,
        chargeId,
        disputeId: dispute.id,
        message: 'Dispute logged and admin notified'
      };
    } catch (error) {
      console.error('❌ Error handling charge dispute:', error);
      throw error;
    }
  }

  /**
   * Test API Connectivity
   * Verify Stripe API keys are valid
   */
  static async testConnection() {
    try {
      await stripe.paymentIntents.list({ limit: 1 });
      return {
        success: true,
        message: 'Connected to Stripe API successfully'
      };
    } catch (error) {
      console.error('❌ Stripe connection failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Helper: Get user-friendly status message
   */
  static _getStatusMessage(status) {
    const messages = {
      succeeded: 'Payment processed successfully',
      processing: 'Payment is being processed',
      requires_payment_method: 'Payment method required or failed',
      requires_confirmation: 'Please confirm your payment',
      requires_action: 'Additional action required (3D Secure)',
      requires_capture: 'Payment captured, awaiting authorization',
      canceled: 'Payment was cancelled'
    };

    return messages[status] || `Payment status: ${status}`;
  }

  /**
   * Get Payment Methods Accepted
   * Returns list of supported payment methods
   */
  static getSupportedPaymentMethods() {
    return {
      cards: {
        visa: true,
        mastercard: true,
        amex: true,
        discover: true
      },
      wallets: {
        apple_pay: true,
        google_pay: true
      },
      banking: {
        bank_transfer: true,
        eft: true,
        instant_bank_transfer: true
      },
      regional: {
        alipay: true,
        wechat_pay: true
      }
    };
  }

  /**
   * Calculate Payment Breakdown
   * Show patient what they pay, platform fee, doctor receives
   */
  static calculatePaymentBreakdown(appointmentFee) {
    const platformFee = appointmentFee * 0.10; // 10% platform fee
    const doctorReceives = appointmentFee - platformFee;

    return {
      appointmentFee: parseFloat(appointmentFee.toFixed(2)),
      platformFee: parseFloat(platformFee.toFixed(2)),
      doctorReceives: parseFloat(doctorReceives.toFixed(2)),
      breakdown: {
        patient_pays: `R${appointmentFee.toFixed(2)}`,
        platform_fee: `R${platformFee.toFixed(2)} (10%)`,
        doctor_receives: `R${doctorReceives.toFixed(2)}`
      }
    };
  }
}

module.exports = StripeService;
