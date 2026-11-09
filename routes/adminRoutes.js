const express = require('express');
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');
const C = require('../controllers/adminRecordsController');

/**
 * Admin records: orders, payments, appointments, prescriptions, support
 * tickets, reviews and security alerts.
 *
 * Mounted at /api/users/admin, next to the admin routes in userRoutes.js.
 * The guard is on each route, not router.use(): a router-level guard would
 * also run for /admin/login and the other userRoutes admin paths that pass
 * through this router unmatched, and refuse them.
 */
const router = express.Router();
const admin = [authMiddleware, requireRole('admin')];

/**
 * @swagger
 * tags:
 *   name: Admin records
 *   description: Platform-wide records for the admin app. Every list takes limit (1-200, default 50) and offset, and returns total over the whole filtered set. from/to are inclusive South African calendar days (YYYY-MM-DD).
 */

/**
 * @swagger
 * /api/users/admin/orders:
 *   get:
 *     summary: List orders
 *     tags: [Admin records]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: status, schema: { type: string, enum: [pending, accepted, awaiting_claim, claim_approved, claim_rejected, preparing, ready, picked_up, cancelled, rejected] } }
 *       - { in: query, name: payment_type, schema: { type: string, enum: [cash, medical_aid] } }
 *       - { in: query, name: pharmacy_id, schema: { type: integer } }
 *       - { in: query, name: patient_id, schema: { type: integer } }
 *       - { in: query, name: from, schema: { type: string, format: date } }
 *       - { in: query, name: to, schema: { type: string, format: date } }
 *       - { in: query, name: limit, schema: { type: integer } }
 *       - { in: query, name: offset, schema: { type: integer } }
 *     responses:
 *       200: { description: Orders }
 *       400: { description: Bad filter value }
 * /api/users/admin/orders/{orderId}:
 *   get:
 *     summary: One order with its status history
 *     tags: [Admin records]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: orderId, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: Order }
 *       404: { description: Not found }
 */
router.get('/orders', admin, C.listOrders);
router.get('/orders/:orderId', admin, C.getOrder);

/**
 * @swagger
 * /api/users/admin/payments:
 *   get:
 *     summary: List payments, with amount per status over the filtered set
 *     tags: [Admin records]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: status, schema: { type: string, enum: [pending, completed, failed, cancelled] } }
 *       - { in: query, name: method, schema: { type: string, enum: [stripe, cash_on_arrival, medical_aid] } }
 *       - { in: query, name: patient_id, schema: { type: integer } }
 *       - { in: query, name: doctor_id, schema: { type: integer } }
 *       - { in: query, name: from, schema: { type: string, format: date } }
 *       - { in: query, name: to, schema: { type: string, format: date } }
 *     responses:
 *       200: { description: Payments and totals.by_status }
 * /api/users/admin/payments/{paymentId}:
 *   get:
 *     summary: One payment (no medical-aid number)
 *     tags: [Admin records]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: paymentId, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: Payment }
 *       404: { description: Not found }
 */
router.get('/payments', admin, C.listPayments);
router.get('/payments/:paymentId', admin, C.getPayment);

/**
 * @swagger
 * /api/users/admin/appointments:
 *   get:
 *     summary: List appointments (no reason for visit or notes). from/to filter the appointment date.
 *     tags: [Admin records]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: status, schema: { type: string, enum: [pending_payment, scheduled, completed, cancelled, no-show, rescheduled] } }
 *       - { in: query, name: payment_status, schema: { type: string, enum: [pending, completed, failed, cancelled] } }
 *       - { in: query, name: doctor_id, schema: { type: integer } }
 *       - { in: query, name: patient_id, schema: { type: integer } }
 *       - { in: query, name: from, schema: { type: string, format: date } }
 *       - { in: query, name: to, schema: { type: string, format: date } }
 *     responses:
 *       200: { description: Appointments }
 * /api/users/admin/appointments/{appointmentId}:
 *   get:
 *     summary: One appointment with its payments and prescriptions
 *     tags: [Admin records]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: appointmentId, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: Appointment }
 *       404: { description: Not found }
 */
router.get('/appointments', admin, C.listAppointments);
router.get('/appointments/:appointmentId', admin, C.getAppointment);

/**
 * @swagger
 * /api/users/admin/prescriptions:
 *   get:
 *     summary: List prescriptions (no diagnosis, notes, medicines or patient ID fields)
 *     tags: [Admin records]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: state, schema: { type: string, enum: [pending, active, dispensed, revoked] } }
 *       - { in: query, name: doctor_id, schema: { type: integer } }
 *       - { in: query, name: patient_id, schema: { type: integer } }
 *       - { in: query, name: from, schema: { type: string, format: date } }
 *       - { in: query, name: to, schema: { type: string, format: date } }
 *     responses:
 *       200: { description: Prescriptions }
 * /api/users/admin/prescriptions/{prescriptionId}:
 *   get:
 *     summary: One prescription with its orders. The view is audit-logged.
 *     tags: [Admin records]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: prescriptionId, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: Prescription }
 *       404: { description: Not found }
 */
router.get('/prescriptions', admin, C.listPrescriptions);
router.get('/prescriptions/:prescriptionId', admin, C.getPrescription);

/**
 * @swagger
 * /api/users/admin/support/tickets:
 *   get:
 *     summary: Support inbox, open and urgent first
 *     tags: [Admin records]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: status, schema: { type: string, enum: [open, in_progress, resolved, closed] } }
 *       - { in: query, name: priority, schema: { type: string, enum: [low, normal, high, urgent] } }
 *       - { in: query, name: category, schema: { type: string, enum: [general, billing, medical, technical, account, contact] } }
 *       - { in: query, name: search, description: Matches subject or email, schema: { type: string } }
 *     responses:
 *       200: { description: Tickets }
 * /api/users/admin/support/tickets/{ticketId}:
 *   get:
 *     summary: One ticket with its message and replies
 *     tags: [Admin records]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: ticketId, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: Ticket }
 *       404: { description: Not found }
 *   patch:
 *     summary: Change a ticket's status and/or priority
 *     tags: [Admin records]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: ticketId, required: true, schema: { type: integer } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: { type: string, enum: [open, in_progress, resolved, closed] }
 *               priority: { type: string, enum: [low, normal, high, urgent] }
 *     responses:
 *       200: { description: Updated ticket }
 * /api/users/admin/support/tickets/{ticketId}/replies:
 *   post:
 *     summary: Reply to the ticket's sender by email. An open ticket moves to in_progress.
 *     tags: [Admin records]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: ticketId, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message: { type: string, maxLength: 5000 }
 *     responses:
 *       201: { description: Reply saved; data.email_sent says whether the email went }
 *       409: { description: Ticket is closed }
 */
router.get('/support/tickets', admin, C.listTickets);
router.get('/support/tickets/:ticketId', admin, C.getTicket);
router.patch('/support/tickets/:ticketId', admin, C.updateTicket);
router.post('/support/tickets/:ticketId/replies', admin, C.replyToTicket);

/**
 * @swagger
 * /api/users/admin/reviews:
 *   get:
 *     summary: List doctor reviews, hidden ones included
 *     tags: [Admin records]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: doctor_id, schema: { type: integer } }
 *       - { in: query, name: patient_id, schema: { type: integer } }
 *       - { in: query, name: rating, schema: { type: integer, minimum: 1, maximum: 5 } }
 *       - { in: query, name: hidden, schema: { type: boolean } }
 *     responses:
 *       200: { description: Reviews }
 * /api/users/admin/reviews/{reviewId}/visibility:
 *   patch:
 *     summary: Hide a review from the doctor's public page and rating, or show it again
 *     tags: [Admin records]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: reviewId, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [hidden]
 *             properties:
 *               hidden: { type: boolean }
 *               reason: { type: string, description: Required when hiding }
 *     responses:
 *       200: { description: Updated review }
 * /api/users/admin/reviews/{reviewId}:
 *   delete:
 *     summary: Delete a review permanently
 *     tags: [Admin records]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: reviewId, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: Deleted }
 *       404: { description: Not found }
 */
router.get('/reviews', admin, C.listReviews);
router.patch('/reviews/:reviewId/visibility', admin, C.setReviewVisibility);
router.delete('/reviews/:reviewId', admin, C.deleteReview);

/**
 * @swagger
 * /api/users/admin/security/alerts/stats:
 *   get:
 *     summary: Alert counts for the last 24 hours and 7 days
 *     tags: [Admin records]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Stats }
 * /api/users/admin/security/alerts:
 *   get:
 *     summary: List security alerts, most severe first
 *     tags: [Admin records]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: status, schema: { type: string, enum: [unreviewed, verified_legit, verified_threat, dismissed] } }
 *       - { in: query, name: severity, schema: { type: string, enum: [CRITICAL, HIGH, MEDIUM, LOW] } }
 *       - { in: query, name: alert_type, schema: { type: string } }
 *       - { in: query, name: user_type, schema: { type: string, enum: [patient, doctor, pharmacy, admin] } }
 *       - { in: query, name: user_id, description: Needs user_type, schema: { type: integer } }
 *       - { in: query, name: hours, description: Only alerts from the last N hours, schema: { type: integer } }
 *     responses:
 *       200: { description: Alerts }
 * /api/users/admin/security/alerts/bulk-review:
 *   post:
 *     summary: Review many alerts at once (verified_threat signs the accounts out)
 *     tags: [Admin records]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [alertIds, status]
 *             properties:
 *               alertIds: { type: array, items: { type: integer }, maxItems: 200 }
 *               status: { type: string, enum: [verified_legit, verified_threat, dismissed] }
 *               actionReason: { type: string }
 *     responses:
 *       200: { description: Counts updated and not found }
 * /api/users/admin/security/alerts/{alertId}:
 *   get:
 *     summary: One alert
 *     tags: [Admin records]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: alertId, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: Alert }
 *       404: { description: Not found }
 * /api/users/admin/security/alerts/{alertId}/review:
 *   post:
 *     summary: Record a verdict. verified_threat signs the account out everywhere and emails its owner.
 *     tags: [Admin records]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: alertId, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [verified_legit, verified_threat, dismissed] }
 *               adminNotes: { type: string }
 *               actionTaken: { type: string }
 *     responses:
 *       200: { description: Updated alert with sessions_revoked }
 * /api/users/admin/security/suspicious-users:
 *   get:
 *     summary: Accounts with at least `threshold` unreviewed critical alerts in the last `hours`
 *     tags: [Admin records]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: hours, schema: { type: integer, default: 24 } }
 *       - { in: query, name: threshold, schema: { type: integer, default: 3 } }
 *     responses:
 *       200: { description: Accounts }
 * /api/users/admin/security/report:
 *   get:
 *     summary: Alert counts per day, type and severity (default last 30 days)
 *     tags: [Admin records]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: from, schema: { type: string, format: date } }
 *       - { in: query, name: to, schema: { type: string, format: date } }
 *     responses:
 *       200: { description: Report rows }
 */
router.get('/security/alerts/stats', admin, C.getAlertStats);
router.get('/security/alerts', admin, C.listAlerts);
router.post('/security/alerts/bulk-review', admin, C.bulkReviewAlerts);
router.get('/security/alerts/:alertId', admin, C.getAlert);
router.post('/security/alerts/:alertId/review', admin, C.reviewAlert);
router.get('/security/suspicious-users', admin, C.getSuspiciousUsers);
router.get('/security/report', admin, C.getAlertReport);

module.exports = router;
