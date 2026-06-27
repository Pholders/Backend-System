const { query } = require('../config/db');

/**
 * Order Model
 *
 * Represents the lifecycle of a patient ordering a prescription from a pharmacy.
 * v1 scope: pickup-only fulfillment, cash + medical-aid payment paths.
 *
 * Schema lives alongside the existing prescriptions / pharmacies / medical_aid_claims
 * tables — we add `order_id` to medical_aid_claims via migration so each order can
 * own a claim row without duplicating that table.
 */

const VALID_STATUSES = [
  'pending',          // patient created the order, awaiting pharmacy response
  'accepted',         // pharmacy accepted (will quote / submit claim next)
  'awaiting_claim',   // medical-aid order, claim submitted, awaiting outcome
  'claim_approved',   // claim came back; gap (if any) is the patient's to pay
  'claim_rejected',   // medical aid declined; patient must pay full or cancel
  'preparing',        // pharmacy is filling the order
  'ready',            // ready for pickup
  'picked_up',        // terminal success
  'cancelled',        // patient cancelled before ready
  'rejected',         // pharmacy declined (out of stock, can't fill, etc.)
];

const VALID_PAYMENT_TYPES = ['cash', 'medical_aid'];
const VALID_FULFILLMENT_TYPES = ['pickup']; // v1 = pickup only

const TERMINAL_STATUSES = ['picked_up', 'cancelled', 'rejected'];
const ACTIVE_STATUSES = VALID_STATUSES.filter((s) => !TERMINAL_STATUSES.includes(s));

class Order {
  static get VALID_STATUSES() { return VALID_STATUSES; }
  static get VALID_PAYMENT_TYPES() { return VALID_PAYMENT_TYPES; }
  static get VALID_FULFILLMENT_TYPES() { return VALID_FULFILLMENT_TYPES; }
  static get TERMINAL_STATUSES() { return TERMINAL_STATUSES; }
  static get ACTIVE_STATUSES() { return ACTIVE_STATUSES; }

  /**
   * Create the orders table. Idempotent.
   */
  static async createTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        prescription_id INTEGER NOT NULL REFERENCES prescriptions(id) ON DELETE RESTRICT,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        pharmacy_id INTEGER NOT NULL REFERENCES pharmacies(id) ON DELETE RESTRICT,

        payment_type VARCHAR(20) NOT NULL
          CHECK (payment_type IN ('cash', 'medical_aid')),
        fulfillment_type VARCHAR(20) NOT NULL DEFAULT 'pickup'
          CHECK (fulfillment_type IN ('pickup')),

        status VARCHAR(32) NOT NULL DEFAULT 'pending'
          CHECK (status IN (
            'pending','accepted','awaiting_claim','claim_approved','claim_rejected',
            'preparing','ready','picked_up','cancelled','rejected'
          )),

        -- Pricing (null until pharmacy quotes at acceptance)
        total_amount DECIMAL(10, 2),
        patient_responsibility DECIMAL(10, 2),

        -- Free text for pharmacy notes / cancellation reason / rejection reason
        pharmacy_notes TEXT,
        cancellation_reason TEXT,
        rejection_reason TEXT,
        restocking_fee_amount DECIMAL(10, 2),

        -- Payment linkage
        stripe_payment_intent_id VARCHAR(255),
        payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL,

        -- Lifecycle timestamps
        accepted_at  TIMESTAMP,
        prepared_at  TIMESTAMP,
        ready_at     TIMESTAMP,
        completed_at TIMESTAMP,
        cancelled_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_orders_patient_created
        ON orders(patient_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_orders_pharmacy_status_created
        ON orders(pharmacy_id, status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_orders_prescription
        ON orders(prescription_id);

      -- Only one ACTIVE order per prescription at a time. Historical/terminal
      -- orders (picked_up/cancelled/rejected) can coexist for the same prescription.
      CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_one_active_per_prescription
        ON orders(prescription_id)
        WHERE status NOT IN ('picked_up', 'cancelled', 'rejected');
    `;
    await query(sql);
    console.log('✅ orders table ready');
  }

  /**
   * Insert a new order. Always created in 'pending' status — workflow transitions
   * must go through orderStateMachine.transition().
   */
  static async create({
    prescription_id,
    patient_id,
    pharmacy_id,
    payment_type,
    fulfillment_type = 'pickup',
  }) {
    if (!VALID_PAYMENT_TYPES.includes(payment_type)) {
      throw new Error(`Invalid payment_type. Allowed: ${VALID_PAYMENT_TYPES.join(', ')}`);
    }
    if (!VALID_FULFILLMENT_TYPES.includes(fulfillment_type)) {
      throw new Error(`Invalid fulfillment_type. Allowed: ${VALID_FULFILLMENT_TYPES.join(', ')}`);
    }

    const sql = `
      INSERT INTO orders (
        prescription_id, patient_id, pharmacy_id,
        payment_type, fulfillment_type, status
      )
      VALUES ($1, $2, $3, $4, $5, 'pending')
      RETURNING *
    `;
    const result = await query(sql, [
      prescription_id, patient_id, pharmacy_id, payment_type, fulfillment_type,
    ]);
    return result.rows[0];
  }

  static async findById(id) {
    const result = await query('SELECT * FROM orders WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  /**
   * Find an active order for a prescription (the one blocking new orders).
   * Returns null if none.
   */
  static async findActiveForPrescription(prescription_id) {
    const sql = `
      SELECT * FROM orders
      WHERE prescription_id = $1
        AND status NOT IN ('picked_up', 'cancelled', 'rejected')
      LIMIT 1
    `;
    const result = await query(sql, [prescription_id]);
    return result.rows[0] || null;
  }

  /**
   * Patient inbox: list orders for a patient, optionally filtered by status.
   */
  static async listForPatient(patient_id, { status = null, limit = 50, offset = 0 } = {}) {
    const params = [patient_id];
    let where = 'patient_id = $1';
    if (status) {
      params.push(status);
      where += ` AND status = $${params.length}`;
    }
    params.push(limit, offset);
    const sql = `
      SELECT * FROM orders
      WHERE ${where}
      ORDER BY created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;
    const result = await query(sql, params);
    return result.rows;
  }

  /**
   * Pharmacy queue: list orders for a pharmacy.
   */
  static async listForPharmacy(pharmacy_id, { status = null, limit = 50, offset = 0 } = {}) {
    const params = [pharmacy_id];
    let where = 'pharmacy_id = $1';
    if (status) {
      params.push(status);
      where += ` AND status = $${params.length}`;
    }
    params.push(limit, offset);
    const sql = `
      SELECT * FROM orders
      WHERE ${where}
      ORDER BY created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;
    const result = await query(sql, params);
    return result.rows;
  }

  /**
   * Patch a small set of fields on an order. Status changes MUST go through
   * the state machine — this is for ancillary updates (notes, pricing, payment refs).
   *
   * Allowed fields: total_amount, patient_responsibility, pharmacy_notes,
   *   cancellation_reason, rejection_reason, restocking_fee_amount,
   *   stripe_payment_intent_id, payment_id.
   */
  static async updateFields(id, fields = {}) {
    const ALLOWED = [
      'total_amount',
      'patient_responsibility',
      'pharmacy_notes',
      'cancellation_reason',
      'rejection_reason',
      'restocking_fee_amount',
      'stripe_payment_intent_id',
      'payment_id',
    ];
    const sets = [];
    const values = [id];
    for (const col of ALLOWED) {
      if (fields[col] !== undefined) {
        values.push(fields[col]);
        sets.push(`${col} = $${values.length}`);
      }
    }
    if (sets.length === 0) return this.findById(id);
    sets.push('updated_at = CURRENT_TIMESTAMP');
    const sql = `UPDATE orders SET ${sets.join(', ')} WHERE id = $1 RETURNING *`;
    const result = await query(sql, values);
    return result.rows[0] || null;
  }

  /**
   * Internal — used only by the state machine. Updates status + the matching
   * lifecycle timestamp. Does NOT validate the transition (that's the state
   * machine's job).
   */
  static async _setStatus(id, newStatus) {
    const timestampColumn = ({
      accepted:        'accepted_at',
      preparing:       'prepared_at',
      ready:           'ready_at',
      picked_up:       'completed_at',
      cancelled:       'cancelled_at',
      rejected:        'cancelled_at', // share the cancelled_at column
    })[newStatus];

    const sets = ['status = $2', 'updated_at = CURRENT_TIMESTAMP'];
    if (timestampColumn) sets.push(`${timestampColumn} = CURRENT_TIMESTAMP`);

    const sql = `UPDATE orders SET ${sets.join(', ')} WHERE id = $1 RETURNING *`;
    const result = await query(sql, [id, newStatus]);
    return result.rows[0] || null;
  }
}

module.exports = Order;
