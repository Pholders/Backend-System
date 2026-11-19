/**
 * How the admin tracks an order through the pickup flow.
 *
 * For every status an order can wait in:
 *   - overdue_after_hours: how long it may sit in that status before the
 *     admin sees it flagged as overdue.
 *   - waiting_on: who has to act next to move it on.
 *
 * Final statuses (picked_up, cancelled, rejected) are not here: nothing is
 * waiting on them, so they are never overdue.
 *
 * Change the hours here; every admin tracking query reads them from this file.
 */
const ORDER_STAGES = {
  pending:        { overdue_after_hours: 24, waiting_on: 'pharmacy' },   // pharmacy hasn't accepted or rejected
  accepted:       { overdue_after_hours: 24, waiting_on: 'pharmacy' },   // not yet preparing / claim not submitted
  awaiting_claim: { overdue_after_hours: 72, waiting_on: 'medical_aid' },// scheme hasn't decided
  claim_approved: { overdue_after_hours: 24, waiting_on: 'pharmacy' },   // not yet preparing
  claim_rejected: { overdue_after_hours: 48, waiting_on: 'patient' },    // pay in full or cancel
  preparing:      { overdue_after_hours: 24, waiting_on: 'pharmacy' },   // not yet ready
  ready:          { overdue_after_hours: 72, waiting_on: 'patient' },    // not collected
};

const WAITING_ON = ['pharmacy', 'medical_aid', 'patient'];

for (const [status, stage] of Object.entries(ORDER_STAGES)) {
  // These numbers are written into SQL, so they must be plain positive integers.
  if (!Number.isInteger(stage.overdue_after_hours) || stage.overdue_after_hours <= 0) {
    throw new Error(`orderTracking: overdue_after_hours for ${status} must be a positive integer`);
  }
  if (!WAITING_ON.includes(stage.waiting_on)) {
    throw new Error(`orderTracking: waiting_on for ${status} must be one of ${WAITING_ON.join(', ')}`);
  }
}

module.exports = { ORDER_STAGES, WAITING_ON };
