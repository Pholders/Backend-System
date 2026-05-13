const Payment = require('../models/Payment');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const AuditLog = require('../models/AuditLog');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || '');

class PaymentController {
  /**
   * Initialize payment (used before confirming appointment)
   * Validates payment method and returns payment details
   */
  static async initializePayment(req, res) {
    try {
      const { appointmentId, paymentMethod, medicalAidNumber = null, medicalAidProvider = null } = req.body;
      const patientId = req.user.id;

      // Validate required fields
      if (!appointmentId || !paymentMethod) {
        return res.status(400).json({
          success: false,
          message: 'Appointment ID and payment method are required'
        });
      }

      // Get appointment details
      const appointment = await Appointment.findById(appointmentId);
      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: 'Appointment not found'
        });
      }

      // Verify appointment belongs to patient
      if (appointment.patient_id !== patientId) {
        await AuditLog.logSecurityEvent(
          req,
          patientId,
          'patient',
          req.user.email,
          'payment_init',
          'failed',
          `Unauthorized attempt to initialize payment for appointment ${appointmentId}`
        );

        return res.status(403).json({
          success: false,
          message: 'This appointment does not belong to you'
        });
      }

      // Validate payment method
      const validMethods = ['stripe', 'cash_on_arrival', 'medical_aid'];
      if (!validMethods.includes(paymentMethod)) {
        return res.status(400).json({
          success: false,
          message: `Invalid payment method. Must be one of: ${validMethods.join(', ')}`
        });
      }

      // Validate medical aid method for returning patients only
      if (paymentMethod === 'medical_aid') {
        // Check if patient has completed appointments before (is returning)
        const completedAppointments = await Appointment.getByPatientIdAndStatus(patientId, 'completed');
        
        if (!completedAppointments || completedAppointments.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Medical aid payment is only available for returning patients with completed appointments'
          });
        }

        // Validate medical aid details
        if (!medicalAidNumber || !medicalAidProvider) {
          return res.status(400).json({
            success: false,
            message: 'Medical aid number and provider are required for medical aid payment'
          });
        }
      }

      const doctor = await Doctor.getById(appointment.doctor_id);
      const consultationFee = doctor.consultation_fee || 0;

      // Create payment record
      const paymentData = {
        appointment_id: appointmentId,
        patient_id: patientId,
        doctor_id: appointment.doctor_id,
        amount: consultationFee,
        payment_method: paymentMethod,
        medical_aid_number: medicalAidNumber,
        medical_aid_provider: medicalAidProvider
      };

      const payment = await Payment.create(paymentData);

      // If Stripe, create Stripe intent
      let stripeIntent = null;
      if (paymentMethod === 'stripe') {
        try {
          stripeIntent = await stripe.paymentIntents.create({
            amount: Math.round(consultationFee * 100), // Convert to cents
            currency: 'zar',
            metadata: {
              appointmentId: appointmentId,
              patientId: patientId,
              doctorId: appointment.doctor_id,
              paymentId: payment.id
            }
          });

          // Update payment record with Stripe intent ID
          await Payment.updatePaymentStatus(payment.id, 'pending', {
            stripe_transaction_id: stripeIntent.id
          });
        } catch (stripeError) {
          console.error('Stripe error:', stripeError);
          return res.status(500).json({
            success: false,
            message: 'Failed to initialize Stripe payment',
            error: stripeError.message
          });
        }
      }

      await AuditLog.logSecurityEvent(
        req,
        patientId,
        'patient',
        req.user.email,
        'payment_init',
        'success',
        `Payment initialized for appointment ${appointmentId} - Method: ${paymentMethod}`
      );

      return res.status(200).json({
        success: true,
        message: 'Payment initialized successfully',
        data: {
          paymentId: payment.id,
          appointmentId: appointmentId,
          amount: consultationFee,
          paymentMethod: paymentMethod,
          status: 'pending',
          stripeClientSecret: stripeIntent ? stripeIntent.client_secret : null,
          stripePublicKey: process.env.STRIPE_PUBLIC_KEY || null
        }
      });
    } catch (error) {
      console.error('Error initializing payment:', error);
      return res.status(500).json({
        success: false,
        message: 'Error initializing payment',
        error: error.message
      });
    }
  }

  /**
   * Confirm Stripe payment
   */
  static async confirmStripePayment(req, res) {
    try {
      const { paymentId, stripePaymentIntentId } = req.body;
      const patientId = req.user.id;

      if (!paymentId || !stripePaymentIntentId) {
        return res.status(400).json({
          success: false,
          message: 'Payment ID and Stripe Payment Intent ID are required'
        });
      }

      const payment = await Payment.getById(paymentId);
      if (!payment) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
      }

      // Verify payment belongs to patient
      if (payment.patient_id !== patientId) {
        await AuditLog.logSecurityEvent(
          req,
          patientId,
          'patient',
          req.user.email,
          'payment_confirm',
          'failed',
          `Unauthorized attempt to confirm payment ${paymentId}`
        );

        return res.status(403).json({
          success: false,
          message: 'This payment does not belong to you'
        });
      }

      try {
        const intent = await stripe.paymentIntents.retrieve(stripePaymentIntentId);

        if (intent.status === 'succeeded') {
          // Update payment status to completed
          const updatedPayment = await Payment.updatePaymentStatus(paymentId, 'completed', {
            stripe_transaction_id: intent.charges.data[0].id,
            receipt_url: intent.charges.data[0].receipt_url
          });

          // Confirm payment and change appointment status from pending_payment to scheduled
          await Appointment.confirmPaymentAndSchedule(payment.appointment_id);

          await AuditLog.logSecurityEvent(
            req,
            patientId,
            'patient',
            req.user.email,
            'payment_confirm',
            'success',
            `Stripe payment confirmed for appointment ${payment.appointment_id}`
          );

          return res.status(200).json({
            success: true,
            message: 'Payment confirmed successfully',
            data: {
              paymentId: updatedPayment.id,
              status: 'completed',
              transactionId: updatedPayment.stripe_transaction_id,
              receiptUrl: updatedPayment.receipt_url
            }
          });
        } else if (intent.status === 'processing') {
          return res.status(200).json({
            success: true,
            message: 'Payment is processing',
            data: {
              paymentId: payment.id,
              status: 'pending'
            }
          });
        } else {
          return res.status(400).json({
            success: false,
            message: `Payment failed with status: ${intent.status}`
          });
        }
      } catch (stripeError) {
        console.error('Stripe verification error:', stripeError);
        return res.status(500).json({
          success: false,
          message: 'Failed to verify Stripe payment',
          error: stripeError.message
        });
      }
    } catch (error) {
      console.error('Error confirming payment:', error);
      return res.status(500).json({
        success: false,
        message: 'Error confirming payment',
        error: error.message
      });
    }
  }

  /**
   * Complete cash on arrival payment
   */
  static async completeCashPayment(req, res) {
    try {
      const { paymentId } = req.body;
      const patientId = req.user.id;

      if (!paymentId) {
        return res.status(400).json({
          success: false,
          message: 'Payment ID is required'
        });
      }

      const payment = await Payment.getById(paymentId);
      if (!payment) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
      }

      // Verify payment belongs to patient
      if (payment.patient_id !== patientId) {
        await AuditLog.logSecurityEvent(
          req,
          patientId,
          'patient',
          req.user.email,
          'payment_cash',
          'failed',
          `Unauthorized attempt to process cash payment ${paymentId}`
        );

        return res.status(403).json({
          success: false,
          message: 'This payment does not belong to you'
        });
      }

      // Verify it's a cash payment
      if (payment.payment_method !== 'cash_on_arrival') {
        return res.status(400).json({
          success: false,
          message: 'This payment is not marked as cash on arrival'
        });
      }

      // Update payment status to completed
      const updatedPayment = await Payment.updatePaymentStatus(paymentId, 'completed');

      // Confirm payment and change appointment status from pending_payment to scheduled
      await Appointment.confirmPaymentAndSchedule(payment.appointment_id);

      await AuditLog.logSecurityEvent(
        req,
        patientId,
        'patient',
        req.user.email,
        'payment_cash',
        'success',
        `Cash on arrival payment confirmed for appointment ${payment.appointment_id}`
      );

      return res.status(200).json({
        success: true,
        message: 'Cash payment confirmed. You will pay during the appointment.',
        data: {
          paymentId: updatedPayment.id,
          status: 'completed',
          amount: payment.amount,
          appointmentId: payment.appointment_id
        }
      });
    } catch (error) {
      console.error('Error completing cash payment:', error);
      return res.status(500).json({
        success: false,
        message: 'Error completing cash payment',
        error: error.message
      });
    }
  }

  /**
   * Complete medical aid payment
   */
  static async completeMedicalAidPayment(req, res) {
    try {
      const { paymentId, medicalAidNumber, medicalAidProvider } = req.body;
      const patientId = req.user.id;

      if (!paymentId || !medicalAidNumber || !medicalAidProvider) {
        return res.status(400).json({
          success: false,
          message: 'Payment ID, medical aid number, and provider are required'
        });
      }

      const payment = await Payment.getById(paymentId);
      if (!payment) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
      }

      // Verify payment belongs to patient
      if (payment.patient_id !== patientId) {
        await AuditLog.logSecurityEvent(
          req,
          patientId,
          'patient',
          req.user.email,
          'payment_medical_aid',
          'failed',
          `Unauthorized attempt to process medical aid payment ${paymentId}`
        );

        return res.status(403).json({
          success: false,
          message: 'This payment does not belong to you'
        });
      }

      // Verify it's a medical aid payment
      if (payment.payment_method !== 'medical_aid') {
        return res.status(400).json({
          success: false,
          message: 'This payment is not marked as medical aid'
        });
      }

      // Update payment with medical aid details
      const query = `
        UPDATE payments
        SET 
          payment_status = 'completed',
          medical_aid_number = $2,
          medical_aid_provider = $3,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *;
      `;

      const { query: dbQuery } = require('../config/db');
      const result = await dbQuery(query, [paymentId, medicalAidNumber, medicalAidProvider]);
      const updatedPayment = result.rows[0];

      // Confirm payment and change appointment status from pending_payment to scheduled
      await Appointment.confirmPaymentAndSchedule(payment.appointment_id);

      await AuditLog.logSecurityEvent(
        req,
        patientId,
        'patient',
        req.user.email,
        'payment_medical_aid',
        'success',
        `Medical aid payment confirmed - Provider: ${medicalAidProvider}`
      );

      return res.status(200).json({
        success: true,
        message: 'Medical aid payment confirmed. Claim will be submitted to your provider.',
        data: {
          paymentId: updatedPayment.id,
          status: 'completed',
          amount: payment.amount,
          appointmentId: payment.appointment_id,
          medicalAidProvider: medicalAidProvider,
          medicalAidNumber: medicalAidNumber
        }
      });
    } catch (error) {
      console.error('Error completing medical aid payment:', error);
      return res.status(500).json({
        success: false,
        message: 'Error completing medical aid payment',
        error: error.message
      });
    }
  }

  /**
   * Get payment status
   */
  static async getPaymentStatus(req, res) {
    try {
      const { appointmentId } = req.params;
      const patientId = req.user.id;

      const appointment = await Appointment.findById(appointmentId);
      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: 'Appointment not found'
        });
      }

      // Verify appointment belongs to patient
      if (appointment.patient_id !== patientId) {
        return res.status(403).json({
          success: false,
          message: 'This appointment does not belong to you'
        });
      }

      const payment = await Payment.getByAppointmentId(appointmentId);
      if (!payment) {
        return res.status(404).json({
          success: false,
          message: 'No payment found for this appointment'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Payment status retrieved successfully',
        data: {
          paymentId: payment.id,
          appointmentId: payment.appointment_id,
          amount: payment.amount,
          paymentMethod: payment.payment_method,
          paymentStatus: payment.payment_status,
          createdAt: payment.created_at
        }
      });
    } catch (error) {
      console.error('Error fetching payment status:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching payment status',
        error: error.message
      });
    }
  }

  /**
   * Get patient payment history
   */
  static async getPaymentHistory(req, res) {
    try {
      const patientId = req.user.id;
      const limit = parseInt(req.query.limit) || 20;
      const offset = parseInt(req.query.offset) || 0;

      const payments = await Payment.getByPatientId(patientId, limit, offset);

      return res.status(200).json({
        success: true,
        message: 'Payment history retrieved successfully',
        data: {
          payments: payments.map(p => ({
            paymentId: p.id,
            appointmentId: p.appointment_id,
            doctorName: `${p.doctor_first_name} ${p.doctor_last_name}`,
            specialization: p.specialization,
            appointmentDate: p.appointment_date,
            amount: p.amount,
            paymentMethod: p.payment_method,
            paymentStatus: p.payment_status,
            createdAt: p.created_at
          })),
          pagination: {
            limit,
            offset,
            total: payments.length
          }
        }
      });
    } catch (error) {
      console.error('Error fetching payment history:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching payment history',
        error: error.message
      });
    }
  }

  /**
   * Get payment methods available for patient
   */
  static async getAvailablePaymentMethods(req, res) {
    try {
      const patientId = req.user.id;

      // Check if patient has completed appointments (is returning)
      const completedAppointments = await Appointment.getByPatientIdAndStatus(patientId, 'completed');
      const isReturningPatient = completedAppointments && completedAppointments.length > 0;

      const availableMethods = [
        {
          method: 'stripe',
          label: 'Credit/Debit Card (Stripe)',
          description: 'Pay securely with your credit or debit card',
          available: true
        },
        {
          method: 'cash_on_arrival',
          label: 'Cash on Arrival',
          description: 'Pay in cash when you arrive at the clinic',
          available: true
        },
        {
          method: 'medical_aid',
          label: 'Medical Aid',
          description: 'Use your medical aid for payment',
          available: isReturningPatient,
          restricted: !isReturningPatient ? 'Only available for returning patients with completed appointments' : null
        }
      ];

      return res.status(200).json({
        success: true,
        message: 'Available payment methods retrieved successfully',
        data: {
          isReturningPatient,
          availableMethods
        }
      });
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching payment methods',
        error: error.message
      });
    }
  }
}

module.exports = PaymentController;
