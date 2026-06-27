/**
 * Order State Machine
 *
 * The ONLY place that mutates `orders.status`. Controllers must call
 * `transition()` — never update status directly.
 *
 * Responsibilities:
 *   1. Validate the requested transition against ALLOWED_TRANSITIONS.
 *   2. Validate the actor is allowed to make this transition.
 *   3. Update the order row (via Order._setStatus).
 *   4. Append an OrderStatusHistory row.
 *   5. Fire the matching notification to the patient.
 *   6. (Future) emit a Socket.IO event for real-time UI updates.
 *
 * Payment-path branching:
 *   - cash orders:        pending -> accepted -> preparing -> ready -> picked_up
 *   - medical_aid orders: pending -> accepted -> awaiting_claim ->
 *                            (claim_approved | claim_rejected) -> preparing -> ready -> picked_up
 *
 * Any active status can transition to cancelled (patient) or rejected (pharmacy)
 * subject to policy checks (see canPatientCancel / canPharmacyReject).
 */

const Order = require('../models/Order');
const OrderStatusHistory = require('../models/OrderStatusHistory');
const orderNotifications = require('./orderNotifications');
const realtimeService = require('./realtimeService');

// status -> array of statuses it may transition to.
// Note: cash orders go straight pending -> accepted -> preparing.
// Medical-aid orders go pending -> accepted -> awaiting_claim -> claim_*.
// The state machine accepts both paths; payment_type guards which apply.
const ALLOWED_TRANSITIONS = {
  pending:         ['accepted', 'cancelled', 'rejected'],
  accepted:        ['awaiting_claim', 'preparing', 'cancelled', 'rejected'],
  awaiting_claim:  ['claim_approved', 'claim_rejected', 'cancelled'],
  claim_approved:  ['preparing', 'cancelled'],
  claim_rejected:  ['preparing', 'cancelled'], // patient may choose to pay full and proceed
  preparing:       ['ready', 'cancelled'],
  ready:           ['picked_up', 'cancelled'], // patient cancel after ready is blocked by policy below
  picked_up:       [],
  cancelled:       [],
  rejected:        [],
};

// Which actor types are permitted to drive each transition.
const TRANSITION_ACTORS = {
  accepted:        ['pharmacy'],
  awaiting_claim:  ['pharmacy'],
  claim_approved:  ['pharmacy'],
  claim_rejected:  ['pharmacy'],
  preparing:       ['pharmacy'],
  ready:           ['pharmacy'],
  picked_up:       ['pharmacy'],            // pharmacy confirms handover
  cancelled:       ['patient', 'admin'],    // patient initiates; admin override
  rejected:        ['pharmacy'],
};

class TransitionError extends Error {
  constructor(message, code = 'INVALID_TRANSITION') {
    super(message);
    this.name = 'TransitionError';
    this.code = code;
  }
}

/**
 * Patient cancellation policy:
 *   - free before pharmacy accepts (pending)
 *   - restocking fee while preparing (preparing) — caller is responsible for setting it
 *   - blocked once order is ready
 *   - allowed in any other pre-ready active state
 */
function canPatientCancel(currentStatus) {
  if (currentStatus === 'ready') {
    return { ok: false, reason: 'Order is already ready for pickup. Contact the pharmacy directly.' };
  }
  if (Order.TERMINAL_STATUSES.includes(currentStatus)) {
    return { ok: false, reason: `Order is already ${currentStatus}.` };
  }
  return { ok: true, requiresFee: currentStatus === 'preparing' };
}

function canPharmacyReject(currentStatus) {
  // Pharmacy can only reject before they've started preparing.
  if (!['pending', 'accepted', 'awaiting_claim'].includes(currentStatus)) {
    return { ok: false, reason: `Cannot reject an order in status "${currentStatus}".` };
  }
  return { ok: true };
}

/**
 * Validate a payment-path-aware transition.
 * Throws TransitionError if the move is invalid for this order.
 */
function assertPathValid(order, toStatus) {
  // Medical-aid orders MUST go through awaiting_claim before preparing.
  if (order.payment_type === 'medical_aid' && toStatus === 'preparing') {
    if (!['claim_approved', 'claim_rejected'].includes(order.status)) {
      throw new TransitionError(
        'Medical-aid orders must have a claim decision before preparing.',
        'CLAIM_REQUIRED'
      );
    }
  }
  // Cash orders should not enter the claim states.
  if (order.payment_type === 'cash'
      && ['awaiting_claim', 'claim_approved', 'claim_rejected'].includes(toStatus)) {
    throw new TransitionError(
      'Cash orders do not use medical-aid claim states.',
      'INVALID_PATH'
    );
  }
}

/**
 * Perform a status transition.
 *
 * @param {object} args
 * @param {number} args.orderId
 * @param {string} args.toStatus
 * @param {'patient'|'pharmacy'|'system'|'admin'} args.actorType
 * @param {number} [args.actorId]
 * @param {string} [args.notes]   recorded on the history row
 * @returns {Promise<{order: object, history: object}>}
 */
async function transition({ orderId, toStatus, actorType, actorId = null, notes = null }) {
  if (!OrderStatusHistory.VALID_ACTOR_TYPES.includes(actorType)) {
    throw new TransitionError(`Invalid actor_type: ${actorType}`, 'INVALID_ACTOR_TYPE');
  }
  if (!Order.VALID_STATUSES.includes(toStatus)) {
    throw new TransitionError(`Unknown target status: ${toStatus}`, 'UNKNOWN_STATUS');
  }

  const order = await Order.findById(orderId);
  if (!order) throw new TransitionError('Order not found', 'NOT_FOUND');

  const fromStatus = order.status;

  // 1. Allowed at all?
  if (!ALLOWED_TRANSITIONS[fromStatus]?.includes(toStatus)) {
    throw new TransitionError(
      `Cannot move from "${fromStatus}" to "${toStatus}".`,
      'INVALID_TRANSITION'
    );
  }

  // 2. Is this actor allowed to make this transition?
  const permittedActors = TRANSITION_ACTORS[toStatus] || [];
  if (!permittedActors.includes(actorType) && actorType !== 'system') {
    throw new TransitionError(
      `${actorType} is not permitted to set status "${toStatus}". Allowed: ${permittedActors.join(', ')}.`,
      'ACTOR_NOT_PERMITTED'
    );
  }

  // 3. Payment-path validity.
  assertPathValid(order, toStatus);

  // 4. Policy: patient cancellation.
  if (toStatus === 'cancelled' && actorType === 'patient') {
    const policy = canPatientCancel(fromStatus);
    if (!policy.ok) {
      throw new TransitionError(policy.reason, 'CANCEL_NOT_ALLOWED');
    }
  }

  // 5. Policy: pharmacy rejection.
  if (toStatus === 'rejected' && actorType === 'pharmacy') {
    const policy = canPharmacyReject(fromStatus);
    if (!policy.ok) {
      throw new TransitionError(policy.reason, 'REJECT_NOT_ALLOWED');
    }
  }

  // 6. Apply the status update.
  const updated = await Order._setStatus(orderId, toStatus);

  // 7. Record history.
  const history = await OrderStatusHistory.record({
    order_id: orderId,
    from_status: fromStatus,
    to_status: toStatus,
    actor_type: actorType,
    actor_id: actorId,
    notes,
  });

  // 8. Fire patient notification (best-effort — never block the transition).
  try {
    await orderNotifications.notifyStatusChange({
      order: updated,
      fromStatus,
      toStatus,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[orderStateMachine] notification failed for order ${orderId}:`, err.message);
  }

  // 9. Emit real-time event (silent no-op if Socket.IO isn't initialized).
  try {
    const event = (toStatus === 'cancelled' || toStatus === 'rejected')
      ? 'order:cancelled'
      : 'order:updated';
    realtimeService.emitOrderEvent(event, {
      order: updated,
      fromStatus,
      toStatus,
      historyEntry: history,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[orderStateMachine] realtime emit failed for order ${orderId}:`, err.message);
  }

  return { order: updated, history };
}

module.exports = {
  transition,
  canPatientCancel,
  canPharmacyReject,
  ALLOWED_TRANSITIONS,
  TRANSITION_ACTORS,
  TransitionError,
};
