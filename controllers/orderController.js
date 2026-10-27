/**
 * OrderController
 *
 * Patient endpoints:
 *   POST   /api/orders                       create order from a prescription
 *   GET    /api/orders                       list my orders (?status=)
 *   GET    /api/orders/:id                   single order (+ status history)
 *   PATCH  /api/orders/:id/cancel            patient-initiated cancel
 *   POST   /api/orders/:id/confirm-pickup    deprecated path; pharmacy confirms via status (kept off router for now)
 *
 * Pharmacy endpoints:
 *   GET    /api/orders/pharmacy/queue        my incoming queue (?status=)
 *   PATCH  /api/orders/:id/accept            quote + accept (body: total_amount, patient_responsibility?, notes?)
 *   PATCH  /api/orders/:id/reject            reject (body: reason)
 *   PATCH  /api/orders/:id/status            generic transition (body: status, notes?)
 *   POST   /api/orders/:id/claim             record/update the medical-aid claim outcome
 *
 * All routes require an authenticated user. Role gating is on the routes file.
 */

const Order = require('../models/Order');
const OrderStatusHistory = require('../models/OrderStatusHistory');
const Prescription = require('../models/Prescription');
const InventoryItem = require('../models/InventoryItem');
const orderStateMachine = require('../services/orderStateMachine');
const orderNotifications = require('../services/orderNotifications');
const realtimeService = require('../services/realtimeService');
const { pool } = require('../config/db');

// ---- helpers ----

// Enrich a single order with prescription + patient snapshot. Never throws.
async function enrichOne(order) {
  if (!order) return order;
  try {
    const [enriched] = await Order.enrichOrders([order]);
    return enriched;
  } catch (e) {
    console.error('enrichOne failed:', e.message);
    return order;
  }
}

function getUserId(req) {
  return req.user && (req.user.id || req.user.userId);
}

function getPharmacyId(req) {
  // Pharmacy JWTs put the pharmacy row id in `id` and role 'pharmacy'.
  return req.user && (req.user.id || req.user.pharmacyId);
}

function isOwner(order, patientId) {
  return order && Number(order.patient_id) === Number(patientId);
}

function isPharmacyFor(order, pharmacyId) {
  return order && Number(order.pharmacy_id) === Number(pharmacyId);
}

// ---- controller ----

class OrderController {
  // ============================================================
  // PATIENT
  // ============================================================

  /**
   * POST /api/orders
   * Body: { prescription_id, pharmacy_id, payment_type: 'cash' | 'medical_aid' }
   */
  static async create(req, res) {
    try {
      const patientId = getUserId(req);
      const { prescription_id, pharmacy_id, payment_type } = req.body || {};

      if (!prescription_id || !pharmacy_id || !payment_type) {
        return res.status(400).json({
          success: false,
          message: 'prescription_id, pharmacy_id and payment_type are required',
        });
      }
      if (!Order.VALID_PAYMENT_TYPES.includes(payment_type)) {
        return res.status(400).json({
          success: false,
          message: `Invalid payment_type. Allowed: ${Order.VALID_PAYMENT_TYPES.join(', ')}`,
        });
      }

      // Ownership check on the prescription.
      const rx = await Prescription.findById
        ? await Prescription.findById(prescription_id)
        : (await pool.query('SELECT * FROM prescriptions WHERE id = $1', [prescription_id])).rows[0];

      if (!rx) {
        return res.status(404).json({ success: false, message: 'Prescription not found' });
      }
      if (Number(rx.patient_id) !== Number(patientId)) {
        return res.status(403).json({ success: false, message: 'You do not own this prescription' });
      }

      // Block double-active orders for the same prescription.
      const active = await Order.findActiveForPrescription(prescription_id);
      if (active) {
        return res.status(409).json({
          success: false,
          message: 'You already have an active order for this prescription.',
          data: { activeOrderId: active.id, status: active.status },
        });
      }

      const order = await Order.create({
        prescription_id,
        patient_id: patientId,
        pharmacy_id,
        payment_type,
      });

      // Record creation in the audit log too (from_status null means "created").
      await OrderStatusHistory.record({
        order_id: order.id,
        from_status: null,
        to_status: order.status,
        actor_type: 'patient',
        actor_id: patientId,
        notes: 'Order placed',
      });

      // Patient-side "we sent it" notification (best-effort).
      orderNotifications.notifyOrderPlaced(order).catch((e) => {
        console.error('notifyOrderPlaced failed:', e.message);
      });

      const enriched = await enrichOne(order);

      // Real-time events. Patient sees 'order:placed'; pharmacy queue sees 'order:incoming'.
      try {
        realtimeService.emitToPatient(order.patient_id, 'order:placed', { order: enriched });
        realtimeService.emitToPharmacy(order.pharmacy_id, 'order:incoming', { order: enriched });
      } catch (e) {
        console.error('realtime emit on create failed:', e.message);
      }

      res.status(201).json({ success: true, data: { order: enriched } });
    } catch (err) {
      console.error('orders.create error:', err);
      if (err.code === '23505') {
        return res.status(409).json({
          success: false,
          message: 'An active order for this prescription already exists.',
        });
      }
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * GET /api/orders
   * Query: ?status=&search=&limit=&offset=
   */
  static async listMine(req, res) {
    try {
      const patientId = getUserId(req);
      const { status, search } = req.query;
      const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
      const offset = parseInt(req.query.offset, 10) || 0;

      if (status && !Order.VALID_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Allowed: ${Order.VALID_STATUSES.join(', ')}`,
        });
      }

      const filters = { status: status || null, search: search || null };
      const [rows, total] = await Promise.all([
        Order.listForPatient(patientId, { ...filters, limit, offset }),
        Order.countForPatient(patientId, filters),
      ]);
      const orders = await Order.enrichOrders(rows);
      res.json({
        success: true,
        data: { orders, pagination: { limit, offset, returned: orders.length, total } },
      });
    } catch (err) {
      console.error('orders.listMine error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * GET /api/orders/:id
   * Returns the order + its full status history. Patient must own, OR the
   * requester is the pharmacy that owns the order (pharmacies can hit the
   * same URL to see detail; role middleware on the route restricts entry).
   */
  static async getOne(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      if (!id) return res.status(400).json({ success: false, message: 'Invalid id' });

      const order = await Order.findById(id);
      if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

      const role = req.user?.role;
      const myId = getUserId(req);
      if (role === 'patient' && !isOwner(order, myId)) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }
      if (role === 'pharmacy' && !isPharmacyFor(order, myId)) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }

      const [enriched, history] = await Promise.all([
        enrichOne(order),
        OrderStatusHistory.listForOrder(id),
      ]);
      res.json({ success: true, data: { order: enriched, history } });
    } catch (err) {
      console.error('orders.getOne error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * PATCH /api/orders/:id/cancel
   * Body: { reason? }
   */
  static async patientCancel(req, res) {
    try {
      const patientId = getUserId(req);
      const id = parseInt(req.params.id, 10);
      if (!id) return res.status(400).json({ success: false, message: 'Invalid id' });

      const order = await Order.findById(id);
      if (!order || !isOwner(order, patientId)) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }

      const reason = (req.body && req.body.reason) || null;
      const policy = orderStateMachine.canPatientCancel(order.status);
      if (!policy.ok) {
        return res.status(409).json({ success: false, message: policy.reason });
      }

      // If a restocking fee applies, capture the order's existing total
      // amount * fee percent. v1: simple flat 15% if total_amount is set.
      if (policy.requiresFee && order.total_amount) {
        const fee = Math.round(Number(order.total_amount) * 0.15 * 100) / 100;
        await Order.updateFields(id, { restocking_fee_amount: fee, cancellation_reason: reason });
      } else if (reason) {
        await Order.updateFields(id, { cancellation_reason: reason });
      }

      const { order: updated, history } = await orderStateMachine.transition({
        orderId: id,
        toStatus: 'cancelled',
        actorType: 'patient',
        actorId: patientId,
        notes: reason,
      });

      const enriched = await enrichOne(updated);
      res.json({ success: true, data: { order: enriched, history } });
    } catch (err) {
      if (err.name === 'TransitionError') {
        return res.status(409).json({ success: false, message: err.message, code: err.code });
      }
      console.error('orders.patientCancel error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // ============================================================
  // PHARMACY
  // ============================================================

  /**
   * GET /api/orders/pharmacy/queue
   * Query: ?status=&search=&limit=&offset=
   */
  static async pharmacyQueue(req, res) {
    try {
      const pharmacyId = getPharmacyId(req);
      const { status, search } = req.query;
      const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
      const offset = parseInt(req.query.offset, 10) || 0;

      if (status && !Order.VALID_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Allowed: ${Order.VALID_STATUSES.join(', ')}`,
        });
      }

      const filters = { status: status || null, search: search || null };
      const [rows, total] = await Promise.all([
        Order.listForPharmacy(pharmacyId, { ...filters, limit, offset }),
        Order.countForPharmacy(pharmacyId, filters),
      ]);
      const orders = await Order.enrichOrders(rows);
      res.json({
        success: true,
        data: { orders, pagination: { limit, offset, returned: orders.length, total } },
      });
    } catch (err) {
      console.error('orders.pharmacyQueue error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * PATCH /api/orders/:id/accept
   * Body: { total_amount, patient_responsibility?, notes? }
   * For cash orders this transitions pending -> accepted. For medical-aid,
   * the pharmacy then calls /:id/status with awaiting_claim, or /:id/claim
   * to record the decision.
   */
  static async pharmacyAccept(req, res) {
    try {
      const pharmacyId = getPharmacyId(req);
      const id = parseInt(req.params.id, 10);
      if (!id) return res.status(400).json({ success: false, message: 'Invalid id' });

      const order = await Order.findById(id);
      if (!order || !isPharmacyFor(order, pharmacyId)) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }

      const { total_amount, patient_responsibility, notes } = req.body || {};
      if (total_amount == null || isNaN(Number(total_amount))) {
        return res.status(400).json({
          success: false,
          message: 'total_amount (numeric) is required when accepting',
        });
      }

      await Order.updateFields(id, {
        total_amount: Number(total_amount),
        patient_responsibility:
          patient_responsibility != null ? Number(patient_responsibility) : null,
        pharmacy_notes: notes || null,
      });

      const { order: updated, history } = await orderStateMachine.transition({
        orderId: id,
        toStatus: 'accepted',
        actorType: 'pharmacy',
        actorId: pharmacyId,
        notes: notes || null,
      });

      const enriched = await enrichOne(updated);
      res.json({ success: true, data: { order: enriched, history } });
    } catch (err) {
      if (err.name === 'TransitionError') {
        return res.status(409).json({ success: false, message: err.message, code: err.code });
      }
      console.error('orders.pharmacyAccept error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * PATCH /api/orders/:id/reject
   * Body: { reason }
   */
  static async pharmacyReject(req, res) {
    try {
      const pharmacyId = getPharmacyId(req);
      const id = parseInt(req.params.id, 10);
      if (!id) return res.status(400).json({ success: false, message: 'Invalid id' });

      const order = await Order.findById(id);
      if (!order || !isPharmacyFor(order, pharmacyId)) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }

      const reason = req.body && req.body.reason;
      if (!reason) {
        return res.status(400).json({ success: false, message: 'reason is required' });
      }

      await Order.updateFields(id, { rejection_reason: reason });

      const { order: updated, history } = await orderStateMachine.transition({
        orderId: id,
        toStatus: 'rejected',
        actorType: 'pharmacy',
        actorId: pharmacyId,
        notes: reason,
      });

      const enriched = await enrichOne(updated);
      res.json({ success: true, data: { order: enriched, history } });
    } catch (err) {
      if (err.name === 'TransitionError') {
        return res.status(409).json({ success: false, message: err.message, code: err.code });
      }
      console.error('orders.pharmacyReject error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * PATCH /api/orders/:id/status
   * Body: { status, notes? }
   * Generic transition driver — used for awaiting_claim, preparing, ready, picked_up.
   */
  static async pharmacySetStatus(req, res) {
    try {
      const pharmacyId = getPharmacyId(req);
      const id = parseInt(req.params.id, 10);
      if (!id) return res.status(400).json({ success: false, message: 'Invalid id' });

      const order = await Order.findById(id);
      if (!order || !isPharmacyFor(order, pharmacyId)) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }

      const { status, notes } = req.body || {};
      if (!status) {
        return res.status(400).json({ success: false, message: 'status is required' });
      }

      const { order: updated, history } = await orderStateMachine.transition({
        orderId: id,
        toStatus: status,
        actorType: 'pharmacy',
        actorId: pharmacyId,
        notes: notes || null,
      });

      const enriched = await enrichOne(updated);
      res.json({ success: true, data: { order: enriched, history } });
    } catch (err) {
      if (err.name === 'TransitionError') {
        return res.status(409).json({ success: false, message: err.message, code: err.code });
      }
      console.error('orders.pharmacySetStatus error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * POST /api/orders/:id/claim
   * Body: {
   *   claim_number?, amount_claimed, amount_paid, status: 'approved' | 'rejected' | 'partial' | 'paid',
   *   rejection_reason?, notes?
   * }
   *
   * Records the medical-aid claim outcome (no integration — pharmacy enters
   * the result manually after submitting via Discovery/Bonitas portal).
   * Drives the order through awaiting_claim -> (claim_approved | claim_rejected).
   */
  static async pharmacyRecordClaim(req, res) {
    try {
      const pharmacyId = getPharmacyId(req);
      const id = parseInt(req.params.id, 10);
      if (!id) return res.status(400).json({ success: false, message: 'Invalid id' });

      const order = await Order.findById(id);
      if (!order || !isPharmacyFor(order, pharmacyId)) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }
      if (order.payment_type !== 'medical_aid') {
        return res.status(409).json({
          success: false,
          message: 'Only medical-aid orders carry a claim.',
        });
      }

      const {
        claim_number, amount_claimed, amount_paid,
        status: claimStatus, rejection_reason, notes,
      } = req.body || {};

      const VALID_CLAIM = ['approved', 'rejected', 'partial', 'paid'];
      if (!VALID_CLAIM.includes(claimStatus)) {
        return res.status(400).json({
          success: false,
          message: `status must be one of: ${VALID_CLAIM.join(', ')}`,
        });
      }
      if (amount_claimed == null || isNaN(Number(amount_claimed))) {
        return res.status(400).json({
          success: false, message: 'amount_claimed (numeric) is required',
        });
      }

      const claimed = Number(amount_claimed);
      const paid = amount_paid != null ? Number(amount_paid) : 0;
      const outstanding = Math.max(0, claimed - paid);

      // Ensure the order is in (or moves into) awaiting_claim before recording.
      if (order.status === 'accepted') {
        await orderStateMachine.transition({
          orderId: id,
          toStatus: 'awaiting_claim',
          actorType: 'pharmacy',
          actorId: pharmacyId,
          notes: claim_number ? `Claim ${claim_number} submitted` : 'Claim submitted',
        });
      }

      // Persist the claim row, linked to this order.
      const claimSql = `
        INSERT INTO medical_aid_claims (
          patient_id, order_id, claim_number, service_date, submitted_date,
          provider_name, service_description,
          amount_claimed, amount_paid, amount_outstanding,
          status, rejection_reason
        )
        VALUES (
          $1, $2, $3, CURRENT_DATE, CURRENT_DATE,
          $4, $5,
          $6, $7, $8,
          $9, $10
        )
        RETURNING *
      `;
      const claimResult = await pool.query(claimSql, [
        order.patient_id, order.id, claim_number || null,
        'Pharmacy', `Order #${order.id}`,
        claimed, paid, outstanding,
        claimStatus, rejection_reason || null,
      ]);
      const claim = claimResult.rows[0];

      // Patient owes the outstanding gap.
      await Order.updateFields(id, {
        patient_responsibility: outstanding,
        pharmacy_notes: notes || order.pharmacy_notes,
      });

      // Drive the order to claim_approved or claim_rejected.
      const targetStatus =
        claimStatus === 'rejected' ? 'claim_rejected' : 'claim_approved';

      const { order: updated, history } = await orderStateMachine.transition({
        orderId: id,
        toStatus: targetStatus,
        actorType: 'pharmacy',
        actorId: pharmacyId,
        notes: claimStatus === 'rejected'
          ? `Claim rejected: ${rejection_reason || 'no reason given'}`
          : `Claim ${claimStatus}; outstanding R${outstanding.toFixed(2)}`,
      });

      const enriched = await enrichOne(updated);
      res.json({ success: true, data: { order: enriched, claim, history } });
    } catch (err) {
      if (err.name === 'TransitionError') {
        return res.status(409).json({ success: false, message: err.message, code: err.code });
      }
      console.error('orders.pharmacyRecordClaim error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // ============================================================
  // META
  // ============================================================

  /**
   * GET /api/orders/meta/statuses
   * Public reference the frontend calls once at startup to build tabs +
   * action buttons. Returns the enum, terminal set, and the allowed-transitions map.
   */
  static async getStatuses(req, res) {
    try {
      res.json({
        success: true,
        data: {
          statuses: Order.VALID_STATUSES,
          terminalStatuses: Order.TERMINAL_STATUSES,
          activeStatuses: Order.ACTIVE_STATUSES,
          paymentTypes: Order.VALID_PAYMENT_TYPES,
          fulfillmentTypes: Order.VALID_FULFILLMENT_TYPES,
          allowedTransitions: orderStateMachine.ALLOWED_TRANSITIONS,
          transitionActors: orderStateMachine.TRANSITION_ACTORS,
        },
      });
    } catch (err) {
      console.error('orders.getStatuses error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // ============================================================
  // DISPENSING (option C: auto-suggest, pharmacist confirms)
  // ============================================================

  /**
   * GET /api/orders/:id/dispense-suggestions
   * For each prescription line, return ranked inventory candidates + a flag
   * when nothing matches or the line has already been dispensed.
   */
  static async dispenseSuggestions(req, res) {
    try {
      const pharmacyId = getPharmacyId(req);
      const id = parseInt(req.params.id, 10);
      if (!id) return res.status(400).json({ success: false, message: 'Invalid id' });

      const order = await Order.findById(id);
      if (!order || !isPharmacyFor(order, pharmacyId)) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }

      const rx = await Prescription.getById(order.prescription_id);
      const rxItems = (rx && rx.items) || [];

      const alreadyDispensed = await InventoryItem.listDispensedForOrder(pharmacyId, id);
      const dispensedByLine = new Map();
      for (const row of alreadyDispensed) {
        if (row.related_prescription_item_id != null) {
          dispensedByLine.set(row.related_prescription_item_id, row);
        }
      }

      const suggestions = await Promise.all(rxItems.map(async (line) => {
        const already = dispensedByLine.get(line.id) || null;
        const candidates = already
          ? []
          : await InventoryItem.suggestForItem(pharmacyId, {
              medicine_name: line.medicine_name,
              generic_name: line.generic_name,
              dosage: line.dosage,
            });
        return {
          prescriptionItemId: line.id,
          medicationName: line.medicine_name,
          genericName: line.generic_name,
          dosage: line.dosage,
          quantityRequired: line.quantity,
          quantityUnit: line.quantity_unit,
          alreadyDispensed: !!already,
          dispensedFrom: already
            ? {
                inventoryItemId: already.inventory_item_id,
                medicationName: already.medication_name,
                dosage: already.dosage,
                quantityDispensed: Math.abs(already.quantity_delta),
                dispensedAt: already.created_at,
              }
            : null,
          candidates: candidates.map((c) => ({
            inventoryItemId: c.id,
            sku: c.sku,
            medicationName: c.medication_name,
            genericName: c.generic_name,
            dosage: c.dosage,
            packSize: c.pack_size,
            unit: c.unit,
            quantityOnHand: c.quantity_on_hand,
            expiryDate: c.expiry_date,
            unitPrice: c.unit_price,
            confidence: c.confidence,
          })),
          noMatch: !already && candidates.length === 0,
        };
      }));

      res.json({ success: true, data: { orderId: id, suggestions } });
    } catch (err) {
      console.error('orders.dispenseSuggestions error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * POST /api/orders/:id/dispense-items
   * Body: { items: [{ prescription_item_id, inventory_item_id, quantity }, ...], notes? }
   * Confirmed dispenses committed atomically. Does NOT change order status
   * — pharmacist explicitly transitions to `ready` when packing is complete.
   */
  static async dispenseItems(req, res) {
    try {
      const pharmacyId = getPharmacyId(req);
      const actorId = req.user && req.user.id;
      const id = parseInt(req.params.id, 10);
      if (!id) return res.status(400).json({ success: false, message: 'Invalid id' });

      const order = await Order.findById(id);
      if (!order || !isPharmacyFor(order, pharmacyId)) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }

      // Guardrail: only sensible to dispense while the pharmacy is actively working the order.
      const ALLOWED_STATES = ['accepted', 'claim_approved', 'preparing'];
      if (!ALLOWED_STATES.includes(order.status)) {
        return res.status(409).json({
          success: false,
          message: `Cannot dispense items on an order in status "${order.status}". Allowed: ${ALLOWED_STATES.join(', ')}.`,
        });
      }

      const { items, notes } = req.body || {};
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'items must be a non-empty array of { prescription_item_id, inventory_item_id, quantity }',
        });
      }

      const results = await InventoryItem.dispenseForOrder({
        pharmacy_id: pharmacyId,
        order_id: id,
        lines: items,
        actor_id: actorId,
        notes: notes || null,
      });

      // Notify listeners so the patient app and other pharmacy tabs stay in sync.
      try {
        realtimeService.emitOrderEvent('order:dispensed', {
          order,
          dispensedCount: results.length,
        });
      } catch (e) {
        console.error('realtime emit on dispense failed:', e.message);
      }

      res.json({
        success: true,
        data: {
          orderId: id,
          dispensed: results.map((r) => ({
            inventoryItemId: r.item.id,
            medicationName: r.item.medication_name,
            quantityDispensed: Math.abs(r.adjustment.quantity_delta),
            quantityOnHandAfter: r.item.quantity_on_hand,
            prescriptionItemId: r.adjustment.related_prescription_item_id,
            adjustmentId: r.adjustment.id,
            dispensedAt: r.adjustment.created_at,
          })),
        },
      });
    } catch (err) {
      if (err.code === 'ALREADY_DISPENSED') {
        return res.status(409).json({ success: false, message: err.message, code: err.code });
      }
      if (/Insufficient stock|not found|non-empty|Each line/i.test(err.message)) {
        return res.status(400).json({ success: false, message: err.message });
      }
      console.error('orders.dispenseItems error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * GET /api/orders/:id/dispensed
   * Audit view: what has already been dispensed against this order.
   */
  static async getDispensed(req, res) {
    try {
      const pharmacyId = getPharmacyId(req);
      const id = parseInt(req.params.id, 10);
      if (!id) return res.status(400).json({ success: false, message: 'Invalid id' });

      const order = await Order.findById(id);
      if (!order || !isPharmacyFor(order, pharmacyId)) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }

      const rows = await InventoryItem.listDispensedForOrder(pharmacyId, id);
      res.json({
        success: true,
        data: {
          orderId: id,
          dispensed: rows.map((r) => ({
            adjustmentId: r.id,
            inventoryItemId: r.inventory_item_id,
            prescriptionItemId: r.related_prescription_item_id,
            medicationName: r.medication_name,
            dosage: r.dosage,
            sku: r.sku,
            unit: r.unit,
            quantityDispensed: Math.abs(r.quantity_delta),
            quantityOnHandAfter: r.quantity_after,
            notes: r.notes,
            actorId: r.actor_id,
            dispensedAt: r.created_at,
          })),
        },
      });
    } catch (err) {
      console.error('orders.getDispensed error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }
}

module.exports = OrderController;
