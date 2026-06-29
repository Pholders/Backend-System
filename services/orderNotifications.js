/**
 * Order Notifications
 *
 * Maps each order status transition to a patient-facing notification.
 * Calls notificationService.sendToPatient — which respects the
 * `order_updates` preference column, so patients who muted order updates
 * still flip the status but won't get a push.
 *
 * Keep this module thin — copy templates here, business logic in the
 * state machine.
 */

const notificationService = require('./notificationService');

// title + body builders per terminal-for-this-transition status.
// `data` always carries orderId so the mobile app can deep-link.
const TEMPLATES = {
  accepted: (o) => ({
    title: 'Pharmacy accepted your order',
    body: 'Your pharmacy has accepted the order and will get back to you with the next steps.',
  }),
  awaiting_claim: (o) => ({
    title: 'Claim submitted to your medical aid',
    body: 'We\u2019ve submitted your claim. You\u2019ll be notified as soon as we have a decision.',
  }),
  claim_approved: (o) => {
    const gap = Number(o.patient_responsibility || 0);
    return {
      title: 'Claim approved',
      body: gap > 0
        ? `Your medical aid approved the claim. You\u2019ll pay R${gap.toFixed(2)} on pickup.`
        : 'Your medical aid approved the claim in full \u2014 nothing to pay on pickup.',
    };
  },
  claim_rejected: (o) => ({
    title: 'Claim rejected',
    body: 'Your medical aid rejected the claim. You can choose to pay for the order yourself or cancel it.',
  }),
  preparing: (o) => ({
    title: 'Pharmacy is preparing your order',
    body: 'Your medication is being prepared. We\u2019ll let you know as soon as it\u2019s ready.',
  }),
  ready: (o) => ({
    title: 'Your order is ready for pickup',
    body: 'You can collect your medication from the pharmacy now.',
  }),
  picked_up: (o) => ({
    title: 'Order completed',
    body: 'Thanks for collecting your order. We hope you feel better soon.',
  }),
  cancelled: (o) => ({
    title: 'Order cancelled',
    body: o.cancellation_reason
      ? `Your order has been cancelled. Reason: ${o.cancellation_reason}`
      : 'Your order has been cancelled.',
  }),
  rejected: (o) => ({
    title: 'Pharmacy could not fulfil your order',
    body: o.rejection_reason
      ? `The pharmacy was unable to fulfil your order. Reason: ${o.rejection_reason}`
      : 'The pharmacy was unable to fulfil your order. You can try another pharmacy.',
  }),
};

/**
 * Send the right notification for a status transition.
 * No-ops silently for statuses we don't notify on (e.g. 'pending' creation —
 * that's notified by the controller when the order is first created).
 */
async function notifyStatusChange({ order, fromStatus, toStatus }) {
  const template = TEMPLATES[toStatus];
  if (!template) return { delivered: false, reason: 'no_template' };
  const { title, body } = template(order);
  return notificationService.sendToPatient({
    patientId: order.patient_id,
    type: 'order',
    title,
    body,
    data: {
      orderId: order.id,
      status: toStatus,
      previousStatus: fromStatus,
      pharmacyId: order.pharmacy_id,
      screen: 'OrderDetail',
    },
  });
}

/**
 * Notify the patient that their order was placed (called from the controller
 * after Order.create, since "pending" itself isn't a transition).
 */
async function notifyOrderPlaced(order) {
  return notificationService.sendToPatient({
    patientId: order.patient_id,
    type: 'order',
    title: 'Order placed',
    body: 'Your order has been sent to the pharmacy. You\u2019ll be notified when they respond.',
    data: {
      orderId: order.id,
      status: order.status,
      pharmacyId: order.pharmacy_id,
      screen: 'OrderDetail',
    },
  });
}

module.exports = {
  notifyStatusChange,
  notifyOrderPlaced,
};
