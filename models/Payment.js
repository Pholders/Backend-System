const pool = require('../config/db');

class Payment {
  /**
   * Create payments table if it doesn't exist
   */
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
        amount DECIMAL(10, 2) NOT NULL,
        payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('stripe', 'cash_on_arrival', 'medical_aid')),
        payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'cancelled')),
        stripe_payment_intent_id VARCHAR(255),
        stripe_transaction_id VARCHAR(255),
        medical_aid_number VARCHAR(100),
        medical_aid_provider VARCHAR(255),
        receipt_url VARCHAR(500),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_payments_appointment_id ON payments(appointment_id);
      CREATE INDEX IF NOT EXISTS idx_payments_patient_id ON payments(patient_id);
      CREATE INDEX IF NOT EXISTS idx_payments_doctor_id ON payments(doctor_id);
      CREATE INDEX IF NOT EXISTS idx_payments_payment_method ON payments(payment_method);
      CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(payment_status);
      CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);
    `;

    try {
      await pool.query(query);
      console.log('✅ Payments table created successfully');
    } catch (error) {
      console.error('❌ Error creating payments table:', error);
      throw error;
    }
  }

  /**
   * Create a new payment record
   */
  static async create(paymentData) {
    const {
      appointment_id,
      patient_id,
      doctor_id,
      amount,
      payment_method,
      stripe_payment_intent_id = null,
      stripe_transaction_id = null,
      medical_aid_number = null,
      medical_aid_provider = null,
      notes = null
    } = paymentData;

    const query = `
      INSERT INTO payments (
        appointment_id,
        patient_id,
        doctor_id,
        amount,
        payment_method,
        payment_status,
        stripe_payment_intent_id,
        stripe_transaction_id,
        medical_aid_number,
        medical_aid_provider,
        notes
      )
      VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8, $9, $10)
      RETURNING *;
    `;

    try {
      const result = await pool.query(query, [
        appointment_id,
        patient_id,
        doctor_id,
        amount,
        payment_method,
        stripe_payment_intent_id,
        stripe_transaction_id,
        medical_aid_number,
        medical_aid_provider,
        notes
      ]);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating payment record:', error);
      throw error;
    }
  }

  /**
   * Get payment by appointment ID
   */
  static async getByAppointmentId(appointmentId) {
    const query = `
      SELECT * FROM payments WHERE appointment_id = $1;
    `;

    try {
      const result = await pool.query(query, [appointmentId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error fetching payment:', error);
      throw error;
    }
  }

  /**
   * Get payment by ID
   */
  static async getById(paymentId) {
    const query = `
      SELECT * FROM payments WHERE id = $1;
    `;

    try {
      const result = await pool.query(query, [paymentId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error fetching payment:', error);
      throw error;
    }
  }

  /**
   * Get patient's payments
   */
  static async getByPatientId(patientId, limit = 20, offset = 0) {
    const query = `
      SELECT 
        p.*,
        a.appointment_date,
        a.time_period,
        a.time_slot,
        d.first_name as doctor_first_name,
        d.last_name as doctor_last_name,
        d.specialization
      FROM payments p
      LEFT JOIN appointments a ON p.appointment_id = a.id
      LEFT JOIN doctors d ON p.doctor_id = d.id
      WHERE p.patient_id = $1
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    try {
      const result = await pool.query(query, [patientId, limit, offset]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching patient payments:', error);
      throw error;
    }
  }

  /**
   * Update payment status and stripe details
   */
  static async updatePaymentStatus(paymentId, paymentStatus, stripeDetails = {}) {
    const {
      stripe_transaction_id = null,
      receipt_url = null
    } = stripeDetails;

    const query = `
      UPDATE payments
      SET 
        payment_status = $2,
        stripe_transaction_id = $3,
        receipt_url = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *;
    `;

    try {
      const result = await pool.query(query, [
        paymentId,
        paymentStatus,
        stripe_transaction_id,
        receipt_url
      ]);
      return result.rows[0];
    } catch (error) {
      console.error('Error updating payment status:', error);
      throw error;
    }
  }

  /**
   * Check if payment exists and get its status
   */
  static async getPaymentStatus(appointmentId) {
    const query = `
      SELECT id, payment_status, payment_method, amount FROM payments 
      WHERE appointment_id = $1;
    `;

    try {
      const result = await pool.query(query, [appointmentId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error checking payment status:', error);
      throw error;
    }
  }

  /**
   * Get payment statistics for doctor
   */
  static async getDoctorPaymentStats(doctorId, startDate = null, endDate = null) {
    let query = `
      SELECT 
        COUNT(*) as total_payments,
        SUM(CASE WHEN payment_status = 'completed' THEN amount ELSE 0 END) as total_completed,
        SUM(CASE WHEN payment_status = 'pending' THEN amount ELSE 0 END) as total_pending,
        COUNT(CASE WHEN payment_method = 'stripe' THEN 1 END) as stripe_count,
        COUNT(CASE WHEN payment_method = 'cash_on_arrival' THEN 1 END) as cash_count,
        COUNT(CASE WHEN payment_method = 'medical_aid' THEN 1 END) as medical_aid_count
      FROM payments
      WHERE doctor_id = $1
    `;

    const params = [doctorId];

    if (startDate && endDate) {
      query += ` AND created_at >= $2 AND created_at <= $3`;
      params.push(startDate, endDate);
    }

    try {
      const result = await pool.query(query, params);
      return result.rows[0];
    } catch (error) {
      console.error('Error fetching payment stats:', error);
      throw error;
    }
  }

  /**
   * Get all payments for a doctor
   */
  static async getByDoctorId(doctorId, limit = 50, offset = 0) {
    const query = `
      SELECT 
        p.*,
        a.appointment_date,
        a.time_period,
        a.time_slot,
        u.first_name as patient_first_name,
        u.last_name as patient_last_name,
        u.email as patient_email
      FROM payments p
      LEFT JOIN appointments a ON p.appointment_id = a.id
      LEFT JOIN patients u ON p.patient_id = u.id
      WHERE p.doctor_id = $1
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    try {
      const result = await pool.query(query, [doctorId, limit, offset]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching doctor payments:', error);
      throw error;
    }
  }

  /**
   * Cancel payment
   */
  static async cancelPayment(paymentId) {
    const query = `
      UPDATE payments
      SET payment_status = 'cancelled', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *;
    `;

    try {
      const result = await pool.query(query, [paymentId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error cancelling payment:', error);
      throw error;
    }
  }

  /**
   * Update payment by Stripe Payment Intent ID
   * Called from webhook when Stripe payment succeeds/fails
   */
  static async updateByStripeIntent(stripePaymentIntentId, paymentStatus, stripeTransactionId = null) {
    const query = `
      UPDATE payments
      SET 
        payment_status = $2,
        stripe_transaction_id = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE stripe_payment_intent_id = $1
      RETURNING *;
    `;

    try {
      const result = await pool.query(query, [
        stripePaymentIntentId,
        paymentStatus,
        stripeTransactionId
      ]);
      return result.rows[0];
    } catch (error) {
      console.error('Error updating payment by Stripe intent:', error);
      throw error;
    }
  }

  /**
   * Get payment by Stripe Payment Intent ID
   */
  static async getByStripeIntent(stripePaymentIntentId) {
    const query = `
      SELECT * FROM payments WHERE stripe_payment_intent_id = $1;
    `;

    try {
      const result = await pool.query(query, [stripePaymentIntentId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error fetching payment by Stripe intent:', error);
      throw error;
    }
  }

  /**
   * Get refund statistics for a doctor
   * Shows total refunds and retained fees
   */
  static async getRefundStatistics(doctorId, startDate = null, endDate = null) {
    let query = `
      SELECT 
        COUNT(*) as total_refunds,
        SUM(CAST(amount AS NUMERIC)) as total_refunded,
        AVG(CAST(amount AS NUMERIC)) as avg_refund,
        COUNT(CASE WHEN payment_status = 'completed' THEN 1 END) as completed_payments,
        COUNT(CASE WHEN payment_status = 'cancelled' THEN 1 END) as cancelled_payments
      FROM payments
      WHERE doctor_id = $1
    `;

    const params = [doctorId];

    if (startDate && endDate) {
      query += ` AND created_at BETWEEN $2 AND $3`;
      params.push(startDate, endDate);
    }

    try {
      const result = await pool.query(query, params);
      return result.rows[0];
    } catch (error) {
      console.error('Error fetching refund statistics:', error);
      throw error;
    }
  }

  /**
   * Get payment history with filters
   */
  static async getPaymentHistory(filters = {}) {
    const { patientId, doctorId, status, paymentMethod, startDate, endDate, limit = 50, offset = 0 } = filters;

    let query = `
      SELECT 
        p.*,
        a.appointment_date,
        a.time_period,
        d.first_name as doctor_first_name,
        d.last_name as doctor_last_name,
        u.first_name as patient_first_name,
        u.last_name as patient_last_name
      FROM payments p
      LEFT JOIN appointments a ON p.appointment_id = a.id
      LEFT JOIN doctors d ON p.doctor_id = d.id
      LEFT JOIN patients u ON p.patient_id = u.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (patientId) {
      query += ` AND p.patient_id = $${paramIndex++}`;
      params.push(patientId);
    }
    if (doctorId) {
      query += ` AND p.doctor_id = $${paramIndex++}`;
      params.push(doctorId);
    }
    if (status) {
      query += ` AND p.payment_status = $${paramIndex++}`;
      params.push(status);
    }
    if (paymentMethod) {
      query += ` AND p.payment_method = $${paramIndex++}`;
      params.push(paymentMethod);
    }
    if (startDate) {
      query += ` AND p.created_at >= $${paramIndex++}`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND p.created_at <= $${paramIndex++}`;
      params.push(endDate);
    }

    query += ` ORDER BY p.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    try {
      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error fetching payment history:', error);
      throw error;
    }
  }

  /**
   * Record refund in database
   * Tracks partial refunds and fees retained
   */
  static async recordRefund(paymentId, refundAmount, platformFeeRetained, refundReason) {
    const query = `
      UPDATE payments
      SET 
        payment_status = 'refunded',
        notes = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *;
    `;

    const refundNote = `Refund: ${refundAmount}, Platform Fee Retained: ${platformFeeRetained}, Reason: ${refundReason}`;

    try {
      const result = await pool.query(query, [paymentId, refundNote]);
      return result.rows[0];
    } catch (error) {
      console.error('Error recording refund:', error);
      throw error;
    }
  }
}

module.exports = Payment;
