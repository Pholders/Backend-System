const { query, pool } = require('../config/db');
const { ORDER_STAGES, WAITING_ON } = require('../config/orderTracking');

/**
 * Admin read/write access to platform records: orders, payments,
 * appointments, prescriptions, support tickets, doctor reviews and security
 * alerts.
 *
 * Conventions shared with the other admin queries (see AdminDashboard):
 *  - Columns are always named. Clinical text (diagnosis, clinical notes,
 *    reason for visit, doctor notes, medicine names), ID numbers, medical-aid
 *    numbers, OTP hashes, signatures and QR tokens never leave the database.
 *  - created_at-style columns hold UTC wall-clock time without a zone; they
 *    are returned `AT TIME ZONE 'UTC'` so they serialise as real instants,
 *    and the from/to date filters are South African calendar days.
 *  - Every list is filtered and counted in SQL, so `total` covers the whole
 *    filtered set, not just the page.
 *  - Filter values only ever reach SQL as bound parameters. The fragments
 *    picked by a filter's *name* are fixed strings in this file.
 */

const TZ = 'Africa/Johannesburg';
const SA_DATE = (col) => `((${col} AT TIME ZONE 'UTC') AT TIME ZONE '${TZ}')::date`;
const TS = (col, as) => `${col} AT TIME ZONE 'UTC' AS ${as}`;
const NAME = (alias) => `TRIM(CONCAT_WS(' ', ${alias}.first_name, ${alias}.last_name))`;
const PHARMACY_NAME = (alias) =>
  `COALESCE(NULLIF(TRIM(${alias}.pharmacy_name), ''), ${NAME(alias)})`;

/**
 * Collects WHERE clauses and their parameters.
 */
class Where {
  constructor() {
    this.clauses = [];
    this.params = [];
  }

  /** `sql` uses `?` where the value goes. Skipped when value is undefined. */
  add(sql, value) {
    if (value === undefined) return this;
    this.params.push(value);
    this.clauses.push(sql.replace('?', `$${this.params.length}`));
    return this;
  }

  /** A fixed fragment with no parameter. */
  raw(sql) {
    this.clauses.push(sql);
    return this;
  }

  /** from/to are inclusive SA calendar days. */
  dateRange(col, from, to) {
    this.add(`${SA_DATE(col)} >= ?::date`, from);
    this.add(`${SA_DATE(col)} <= ?::date`, to);
    return this;
  }

  get sql() {
    return this.clauses.length ? `WHERE ${this.clauses.join(' AND ')}` : '';
  }
}

/**
 * Count and one page of `select` over `from`, sharing one WHERE.
 */
async function page({ select, from, where, orderBy, limit, offset }) {
  const count = await query(`SELECT COUNT(*)::int AS total FROM ${from} ${where.sql}`, where.params);
  const params = [...where.params, limit, offset];
  const rows = await query(
    `SELECT ${select} FROM ${from} ${where.sql}
      ORDER BY ${orderBy}
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return { total: count.rows[0].total, rows: rows.rows };
}

/* ------------------------------------------------------------------ orders */

const ORDER_STATUSES = [
  'pending', 'accepted', 'awaiting_claim', 'claim_approved', 'claim_rejected',
  'preparing', 'ready', 'picked_up', 'cancelled', 'rejected'
];

const ORDER_COLUMNS = `
  o.id, o.status, o.payment_type, o.fulfillment_type,
  o.total_amount::float8 AS total_amount,
  o.patient_responsibility::float8 AS patient_responsibility,
  o.prescription_id, p.prescription_number,
  o.patient_id, ${NAME('pt')} AS patient_name, pt.email AS patient_email,
  o.pharmacy_id, ${PHARMACY_NAME('ph')} AS pharmacy_name,
  ${TS('o.created_at', 'created_at')},
  ${TS('o.updated_at', 'updated_at')},
  ${TS('o.completed_at', 'completed_at')},
  ${TS('o.cancelled_at', 'cancelled_at')}`;

const ORDER_FROM = `
  orders o
  LEFT JOIN patients pt ON pt.id = o.patient_id
  LEFT JOIN pharmacies ph ON ph.id = o.pharmacy_id
  LEFT JOIN prescriptions p ON p.id = o.prescription_id`;

/* ---------------------------------------------------------- order tracking */

// Where an order is in the pickup flow: how long it has been in its current
// status, who has to act next, and whether it has waited too long. The rules
// live in config/orderTracking.js; the CASEs below are built from that file's
// fixed keys and integer hours, never from request input.

const NOW_UTC = `(now() AT TIME ZONE 'UTC')`;
const FINAL_ORDER_STATUSES = ['picked_up', 'cancelled', 'rejected'];
const ACTIVE_ORDER_STATUSES = ORDER_STATUSES.filter((s) => !FINAL_ORDER_STATUSES.includes(s));
const SQL_LIST = (values) => values.map((v) => `'${v}'`).join(', ');

const stageCase = (pick) => `CASE o.status ${Object.entries(ORDER_STAGES)
  .map(([status, stage]) => `WHEN '${status}' THEN ${pick(stage)}`)
  .join(' ')} ELSE NULL END`;

const OVERDUE_AFTER_HOURS = stageCase((s) => s.overdue_after_hours);
const WAITING_ON_SQL = stageCase((s) => `'${s.waiting_on}'`);

// Every status change, creation included, writes a history row, so the
// latest one is when the order entered its current status.
const LAST_MOVE_JOIN = `
  LEFT JOIN LATERAL (
    SELECT h.created_at FROM order_status_history h
     WHERE h.order_id = o.id
     ORDER BY h.created_at DESC, h.id DESC
     LIMIT 1
  ) lm ON true`;
const STATUS_SINCE = `COALESCE(lm.created_at, o.created_at)`;
const HOURS = (a, b) => `ROUND((EXTRACT(EPOCH FROM (${b} - ${a})) / 3600)::numeric, 1)::float8`;
const IS_OVERDUE = `COALESCE(${NOW_UTC} - ${STATUS_SINCE} > ${OVERDUE_AFTER_HOURS} * interval '1 hour', false)`;

const ORDER_TRACKING_COLUMNS = `
  ${STATUS_SINCE} AT TIME ZONE 'UTC' AS status_since,
  CASE WHEN o.status IN (${SQL_LIST(FINAL_ORDER_STATUSES)}) THEN NULL
       ELSE ${HOURS(STATUS_SINCE, NOW_UTC)} END AS hours_in_status,
  ${WAITING_ON_SQL} AS waiting_on,
  ${OVERDUE_AFTER_HOURS} AS overdue_after_hours,
  ${IS_OVERDUE} AS is_overdue`;

const ORDER_TRACKING_FROM = `${ORDER_FROM}${LAST_MOVE_JOIN}`;

const ORDER_SORTS = {
  newest: 'o.created_at DESC, o.id DESC',
  // Longest in its current status first: the order to chase.
  longest_waiting: `${STATUS_SINCE} ASC, o.id ASC`
};

// Average hours between two lifecycle timestamps, over orders that have both.
const AVG_HOURS = (a, b) =>
  `ROUND((AVG(EXTRACT(EPOCH FROM (${b} - ${a}))) FILTER (WHERE ${a} IS NOT NULL AND ${b} IS NOT NULL) / 3600)::numeric, 1)::float8`;

// from/to default to the last 30 SA calendar days, today included.
const PERIOD = (col) => `
  ${SA_DATE(col)} >= COALESCE($1::date, (now() AT TIME ZONE '${TZ}')::date - 29)
  AND ${SA_DATE(col)} <= COALESCE($2::date, (now() AT TIME ZONE '${TZ}')::date)`;

/* ---------------------------------------------------------------- payments */

const PAYMENT_STATUSES = ['pending', 'completed', 'failed', 'cancelled'];
const PAYMENT_METHODS = ['stripe', 'cash_on_arrival', 'medical_aid'];

// medical_aid_number is left out: the provider is enough to follow up.
const PAYMENT_COLUMNS = `
  pay.id, pay.amount::float8 AS amount, pay.payment_method, pay.payment_status,
  pay.appointment_id,
  pay.patient_id, ${NAME('pt')} AS patient_name, pt.email AS patient_email,
  pay.doctor_id, ${NAME('d')} AS doctor_name,
  pay.medical_aid_provider, pay.stripe_payment_intent_id, pay.stripe_transaction_id,
  pay.receipt_url,
  ${TS('pay.created_at', 'created_at')},
  ${TS('pay.updated_at', 'updated_at')}`;

const PAYMENT_FROM = `
  payments pay
  LEFT JOIN patients pt ON pt.id = pay.patient_id
  LEFT JOIN doctors d ON d.id = pay.doctor_id`;

/* ------------------------------------------------------------ appointments */

const APPOINTMENT_STATUSES = ['pending_payment', 'scheduled', 'completed', 'cancelled', 'no-show', 'rescheduled'];

// reason_for_visit, notes and doctor_notes are clinical and left out.
const APPOINTMENT_COLUMNS = `
  a.id, to_char(a.appointment_date, 'YYYY-MM-DD') AS appointment_date,
  a.time_period, a.time_slot, a.status,
  a.consultation_fee::float8 AS consultation_fee,
  a.payment_status, a.payment_method, a.doctor_accepted,
  ${TS('a.doctor_accepted_at', 'doctor_accepted_at')},
  a.patient_id, ${NAME('pt')} AS patient_name, pt.email AS patient_email,
  a.doctor_id, ${NAME('d')} AS doctor_name,
  ${TS('a.created_at', 'created_at')},
  ${TS('a.updated_at', 'updated_at')}`;

const APPOINTMENT_FROM = `
  appointments a
  LEFT JOIN patients pt ON pt.id = a.patient_id
  LEFT JOIN doctors d ON d.id = a.doctor_id`;

/* ----------------------------------------------------------- prescriptions */

/**
 * One state per prescription, matching the dashboard's definition of
 * "active": signed, not revoked, not dispensed and not picked up through an
 * order. The keys are the filter values; the SQL is fixed.
 */
const PRESCRIPTION_STATE_SQL = {
  revoked: `(COALESCE(rx.is_revoked, false) OR rx.signature_status = 'revoked')`,
  dispensed: `(NOT COALESCE(rx.is_revoked, false) AND rx.signature_status <> 'revoked'
               AND (COALESCE(rx.is_dispensed, false)
                    OR EXISTS (SELECT 1 FROM orders po WHERE po.prescription_id = rx.id AND po.status = 'picked_up')))`,
  pending: `(NOT COALESCE(rx.is_revoked, false) AND rx.signature_status = 'pending')`,
  active: `(rx.signature_status = 'signed' AND NOT COALESCE(rx.is_revoked, false)
            AND NOT COALESCE(rx.is_dispensed, false)
            AND NOT EXISTS (SELECT 1 FROM orders po WHERE po.prescription_id = rx.id AND po.status = 'picked_up'))`
};
const PRESCRIPTION_STATES = Object.keys(PRESCRIPTION_STATE_SQL);

// Left out: diagnosis, clinical_notes, the patient's ID number, date of
// birth and contact details, OTP hash, signature material, QR tokens,
// claim location and the PDF path. Medicines are reported as a count.
const PRESCRIPTION_COLUMNS = `
  rx.id, rx.prescription_number, rx.signature_status,
  CASE
    WHEN ${PRESCRIPTION_STATE_SQL.revoked} THEN 'revoked'
    WHEN ${PRESCRIPTION_STATE_SQL.dispensed} THEN 'dispensed'
    WHEN ${PRESCRIPTION_STATE_SQL.pending} THEN 'pending'
    ELSE 'active'
  END AS state,
  COALESCE(rx.is_revoked, false) AS is_revoked, rx.revoke_reason,
  ${TS('rx.revoke_timestamp', 'revoked_at')},
  COALESCE(rx.is_dispensed, false) AS is_dispensed,
  ${TS('rx.dispensed_at', 'dispensed_at')},
  rx.dispensed_by_pharmacy_id, rx.dispensed_by_pharmacy_name,
  COALESCE(rx.claimed, false) AS claimed,
  ${TS('rx.claimed_at', 'claimed_at')},
  ${TS('rx.claim_expires_at', 'claim_expires_at')},
  rx.claimed_by_pharmacy_id, rx.claimed_by_pharmacy_name,
  (SELECT COUNT(*)::int FROM prescription_items i WHERE i.prescription_id = rx.id) AS item_count,
  rx.appointment_id,
  rx.patient_id, ${NAME('pt')} AS patient_name,
  rx.doctor_id, ${NAME('d')} AS doctor_name,
  ${TS('rx.signature_timestamp', 'signed_at')},
  ${TS('rx.created_at', 'created_at')},
  ${TS('rx.updated_at', 'updated_at')}`;

const PRESCRIPTION_FROM = `
  prescriptions rx
  LEFT JOIN patients pt ON pt.id = rx.patient_id
  LEFT JOIN doctors d ON d.id = rx.doctor_id`;

/* --------------------------------------------------------- support tickets */

const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];
const TICKET_PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const TICKET_CATEGORIES = ['general', 'billing', 'medical', 'technical', 'account', 'contact'];

const TICKET_LIST_COLUMNS = `
  t.id, t.patient_id, t.email, t.first_name, t.last_name,
  t.category, t.subject, t.status, t.priority,
  (SELECT COUNT(*)::int FROM support_ticket_replies r WHERE r.ticket_id = t.id) AS reply_count,
  ${TS('t.resolved_at', 'resolved_at')},
  ${TS('t.created_at', 'created_at')},
  ${TS('t.updated_at', 'updated_at')}`;

/* ----------------------------------------------------------------- reviews */

const REVIEW_COLUMNS = `
  dr.id, dr.rating, dr.review_text, dr.is_verified,
  dr.is_hidden, ${TS('dr.hidden_at', 'hidden_at')}, dr.hidden_by, dr.hidden_reason,
  dr.doctor_id, ${NAME('d')} AS doctor_name,
  dr.patient_id, ${NAME('pt')} AS patient_name,
  ${TS('dr.created_at', 'created_at')},
  ${TS('dr.updated_at', 'updated_at')}`;

const REVIEW_FROM = `
  doctor_reviews dr
  LEFT JOIN doctors d ON d.id = dr.doctor_id
  LEFT JOIN patients pt ON pt.id = dr.patient_id`;

/* --------------------------------------------------------- security alerts */

const ALERT_STATUSES = ['unreviewed', 'verified_legit', 'verified_threat', 'dismissed'];
const ALERT_REVIEW_STATUSES = ['verified_legit', 'verified_threat', 'dismissed'];
const ALERT_SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const USER_TYPES = ['patient', 'doctor', 'pharmacy', 'admin'];

// verification_token is a live secret for the user's own confirm link.
const ALERT_COLUMNS = `
  id, user_id, user_type, email, alert_type, severity, risk_score, alert_message,
  location_data, device_data, ip_address, status, user_response,
  ${TS('user_response_at', 'user_response_at')},
  admin_notes, ${TS('admin_action_at', 'admin_action_at')}, action_taken,
  email_sent, requires_user_verification, ${TS('verified_at', 'verified_at')},
  ${TS('created_at', 'created_at')}, ${TS('updated_at', 'updated_at')}`;

// Severity sorts by meaning, not alphabetically.
const SEVERITY_RANK = `CASE severity WHEN 'CRITICAL' THEN 4 WHEN 'HIGH' THEN 3 WHEN 'MEDIUM' THEN 2 ELSE 1 END`;

class AdminRecords {
  static get ORDER_STATUSES() { return ORDER_STATUSES; }
  static get ORDER_SORTS() { return Object.keys(ORDER_SORTS); }
  static get ORDER_WAITING_ON() { return WAITING_ON; }
  static get PAYMENT_STATUSES() { return PAYMENT_STATUSES; }
  static get PAYMENT_METHODS() { return PAYMENT_METHODS; }
  static get APPOINTMENT_STATUSES() { return APPOINTMENT_STATUSES; }
  static get PRESCRIPTION_STATES() { return PRESCRIPTION_STATES; }
  static get TICKET_STATUSES() { return TICKET_STATUSES; }
  static get TICKET_PRIORITIES() { return TICKET_PRIORITIES; }
  static get TICKET_CATEGORIES() { return TICKET_CATEGORIES; }
  static get ALERT_STATUSES() { return ALERT_STATUSES; }
  static get ALERT_REVIEW_STATUSES() { return ALERT_REVIEW_STATUSES; }
  static get ALERT_SEVERITIES() { return ALERT_SEVERITIES; }
  static get USER_TYPES() { return USER_TYPES; }

  /* ---------------------------------------------------------------- orders */

  /**
   * A page of orders, each with where it is in the flow (status_since,
   * hours_in_status, waiting_on, is_overdue).
   *
   * active: true = still in progress, false = finished.
   * overdue / waiting_on: filter on the tracking fields.
   * sort: 'newest' (default) or 'longest_waiting'.
   */
  static async listOrders({
    limit, offset, status, payment_type, pharmacy_id, patient_id, from, to,
    active, overdue, waiting_on, sort = 'newest'
  }) {
    const where = new Where()
      .add('o.status = ?', status)
      .add('o.payment_type = ?', payment_type)
      .add('o.pharmacy_id = ?', pharmacy_id)
      .add('o.patient_id = ?', patient_id)
      .add(`${IS_OVERDUE} = ?`, overdue)
      .add(`${WAITING_ON_SQL} = ?`, waiting_on)
      .dateRange('o.created_at', from, to);
    if (active === true) where.raw(`o.status IN (${SQL_LIST(ACTIVE_ORDER_STATUSES)})`);
    if (active === false) where.raw(`o.status IN (${SQL_LIST(FINAL_ORDER_STATUSES)})`);

    const { total, rows } = await page({
      select: `${ORDER_COLUMNS}, ${ORDER_TRACKING_COLUMNS}`,
      from: ORDER_TRACKING_FROM, where,
      orderBy: ORDER_SORTS[sort], limit, offset
    });
    return { total, orders: rows };
  }

  /**
   * One order with its status timeline and the reasons it was cancelled or
   * rejected. Medicines are not listed — see the prescription's item_count.
   */
  static async getOrder(id) {
    const result = await query(
      `SELECT ${ORDER_COLUMNS}, ${ORDER_TRACKING_COLUMNS},
              o.pharmacy_notes, o.cancellation_reason, o.rejection_reason,
              o.restocking_fee_amount::float8 AS restocking_fee_amount,
              o.payment_id, o.stripe_payment_intent_id,
              ${TS('o.accepted_at', 'accepted_at')},
              ${TS('o.prepared_at', 'prepared_at')},
              ${TS('o.ready_at', 'ready_at')}
         FROM ${ORDER_TRACKING_FROM}
        WHERE o.id = $1`,
      [id]
    );
    const order = result.rows[0];
    if (!order) return null;

    // Each step with how long the order stayed in it: until the next step,
    // or until now for the current one. A final status has no duration.
    const history = await query(
      `SELECT id, from_status, to_status, actor_type, actor_id, notes,
              ${TS('created_at', 'created_at')},
              CASE
                WHEN next_at IS NULL AND to_status IN (${SQL_LIST(FINAL_ORDER_STATUSES)}) THEN NULL
                ELSE ${HOURS('h_at', `COALESCE(next_at, ${NOW_UTC})`)}
              END AS hours_in_status
         FROM (
           SELECT *, created_at AS h_at,
                  LEAD(created_at) OVER (ORDER BY created_at, id) AS next_at
             FROM order_status_history
            WHERE order_id = $1
         ) h
        ORDER BY created_at, id`,
      [id]
    );
    order.status_history = history.rows;
    return order;
  }

  /**
   * Every order overdue right now, for the admin notification job. No
   * patient details: the notification names the pharmacy and the order.
   * status_since_ms tells one overdue spell from a later one in the same
   * status.
   */
  static async overdueOrders() {
    const result = await query(
      `SELECT o.id, o.status, o.pharmacy_id, ${PHARMACY_NAME('ph')} AS pharmacy_name,
              (EXTRACT(EPOCH FROM ${STATUS_SINCE}) * 1000)::bigint::text AS status_since_ms,
              ${HOURS(STATUS_SINCE, NOW_UTC)} AS hours_in_status,
              ${WAITING_ON_SQL} AS waiting_on,
              ${OVERDUE_AFTER_HOURS} AS overdue_after_hours
         FROM orders o
         LEFT JOIN pharmacies ph ON ph.id = o.pharmacy_id
         ${LAST_MOVE_JOIN}
        WHERE o.status IN (${SQL_LIST(ACTIVE_ORDER_STATUSES)})
          AND ${IS_OVERDUE}
        ORDER BY ${STATUS_SINCE}`
    );
    return result.rows;
  }

  /**
   * The order tracking header.
   *
   * active: every order still in progress right now (not date-filtered),
   *   counted per status and per who it's waiting on, with how many are
   *   overdue.
   * period: orders created between from and to (default the last 30 days):
   *   how they ended and the average hours each step took.
   */
  static async orderTrackingStats({ pharmacy_id, from, to }) {
    const activeWhere = new Where()
      .raw(`o.status IN (${SQL_LIST(ACTIVE_ORDER_STATUSES)})`)
      .add('o.pharmacy_id = ?', pharmacy_id);

    const [active, period] = await Promise.all([
      query(
        `SELECT o.status, ${WAITING_ON_SQL} AS waiting_on,
                COUNT(*)::int AS count,
                COUNT(*) FILTER (WHERE ${IS_OVERDUE})::int AS overdue,
                MAX(${HOURS(STATUS_SINCE, NOW_UTC)}) AS longest_wait_hours
           FROM orders o ${LAST_MOVE_JOIN}
           ${activeWhere.sql}
          GROUP BY o.status`,
        activeWhere.params
      ),
      query(
        `SELECT COUNT(*)::int AS created,
                COUNT(*) FILTER (WHERE o.status = 'picked_up')::int AS picked_up,
                COUNT(*) FILTER (WHERE o.status = 'cancelled')::int AS cancelled,
                COUNT(*) FILTER (WHERE o.status = 'rejected')::int AS rejected,
                COUNT(*) FILTER (WHERE o.status IN (${SQL_LIST(ACTIVE_ORDER_STATUSES)}))::int AS still_active,
                ${AVG_HOURS('o.created_at', 'o.accepted_at')} AS to_accept,
                ${AVG_HOURS('o.accepted_at', 'o.ready_at')} AS accept_to_ready,
                ${AVG_HOURS('o.ready_at', 'o.completed_at')} AS ready_to_collect,
                ${AVG_HOURS('o.created_at', 'o.completed_at')} AS order_to_collect,
                COALESCE($1::date, (now() AT TIME ZONE '${TZ}')::date - 29)::text AS from_date,
                COALESCE($2::date, (now() AT TIME ZONE '${TZ}')::date)::text AS to_date
           FROM orders o
          WHERE ${PERIOD('o.created_at')}
            AND ($3::int IS NULL OR o.pharmacy_id = $3)`,
        [from ?? null, to ?? null, pharmacy_id ?? null]
      )
    ]);

    // Every active status and every party appear, at zero if nothing is there.
    const by_status = Object.fromEntries(ACTIVE_ORDER_STATUSES.map((s) => [s, {
      count: 0, overdue: 0, longest_wait_hours: null,
      waiting_on: ORDER_STAGES[s].waiting_on,
      overdue_after_hours: ORDER_STAGES[s].overdue_after_hours
    }]));
    const by_waiting_on = Object.fromEntries(WAITING_ON.map((w) => [w, { count: 0, overdue: 0 }]));
    let total = 0;
    let overdue = 0;
    for (const row of active.rows) {
      Object.assign(by_status[row.status], {
        count: row.count, overdue: row.overdue, longest_wait_hours: row.longest_wait_hours
      });
      by_waiting_on[row.waiting_on].count += row.count;
      by_waiting_on[row.waiting_on].overdue += row.overdue;
      total += row.count;
      overdue += row.overdue;
    }

    const p = period.rows[0];
    const finished = p.picked_up + p.cancelled + p.rejected;
    return {
      active: { total, overdue, by_status, by_waiting_on },
      period: {
        from: p.from_date,
        to: p.to_date,
        created: p.created,
        picked_up: p.picked_up,
        cancelled: p.cancelled,
        rejected: p.rejected,
        still_active: p.still_active,
        // Share of finished orders that were collected.
        collection_rate: finished ? Math.round((p.picked_up / finished) * 1000) / 10 : null,
        avg_hours: {
          to_accept: p.to_accept,
          accept_to_ready: p.accept_to_ready,
          ready_to_collect: p.ready_to_collect,
          order_to_collect: p.order_to_collect
        }
      }
    };
  }

  /**
   * Per pharmacy: its orders in progress now (and how many are overdue),
   * plus how its orders created in the period ended and how fast it worked.
   * Pharmacies with no orders in progress and none in the period are left
   * out. Most overdue first.
   */
  static async orderTrackingByPharmacy({ limit, offset, from, to }) {
    const result = await query(
      `WITH now_active AS (
         SELECT o.pharmacy_id,
                COUNT(*)::int AS active,
                COUNT(*) FILTER (WHERE ${IS_OVERDUE})::int AS overdue,
                COUNT(*) FILTER (WHERE o.status = 'pending')::int AS awaiting_response,
                COUNT(*) FILTER (WHERE o.status = 'ready')::int AS awaiting_collection
           FROM orders o ${LAST_MOVE_JOIN}
          WHERE o.status IN (${SQL_LIST(ACTIVE_ORDER_STATUSES)})
          GROUP BY o.pharmacy_id
       ), in_period AS (
         SELECT o.pharmacy_id,
                COUNT(*)::int AS created,
                COUNT(*) FILTER (WHERE o.status = 'picked_up')::int AS picked_up,
                COUNT(*) FILTER (WHERE o.status = 'cancelled')::int AS cancelled,
                COUNT(*) FILTER (WHERE o.status = 'rejected')::int AS rejected,
                ${AVG_HOURS('o.created_at', 'o.accepted_at')} AS avg_hours_to_accept,
                ${AVG_HOURS('o.accepted_at', 'o.ready_at')} AS avg_hours_accept_to_ready
           FROM orders o
          WHERE ${PERIOD('o.created_at')}
          GROUP BY o.pharmacy_id
       ), merged AS (
         SELECT COALESCE(a.pharmacy_id, p.pharmacy_id) AS pharmacy_id,
                COALESCE(a.active, 0) AS active,
                COALESCE(a.overdue, 0) AS overdue,
                COALESCE(a.awaiting_response, 0) AS awaiting_response,
                COALESCE(a.awaiting_collection, 0) AS awaiting_collection,
                COALESCE(p.created, 0) AS created,
                COALESCE(p.picked_up, 0) AS picked_up,
                COALESCE(p.cancelled, 0) AS cancelled,
                COALESCE(p.rejected, 0) AS rejected,
                p.avg_hours_to_accept, p.avg_hours_accept_to_ready
           FROM now_active a
           FULL JOIN in_period p ON p.pharmacy_id = a.pharmacy_id
       )
       SELECT COUNT(*) OVER ()::int AS total_rows,
              m.*, ${PHARMACY_NAME('ph')} AS pharmacy_name, ph.email AS pharmacy_email
         FROM merged m
         LEFT JOIN pharmacies ph ON ph.id = m.pharmacy_id
        ORDER BY m.overdue DESC, m.active DESC, m.created DESC, m.pharmacy_id
        LIMIT $3 OFFSET $4`,
      [from ?? null, to ?? null, limit, offset]
    );

    // COUNT(*) OVER () rides on each row; an offset past the end has none.
    let total = result.rows[0]?.total_rows;
    if (total === undefined) {
      total = offset === 0 ? 0 : (await this.orderTrackingByPharmacy({ limit: 1, offset: 0, from, to })).total;
    }
    const pharmacies = result.rows.map(({ total_rows, ...row }) => row);
    return { total, pharmacies };
  }

  /* -------------------------------------------------------------- payments */

  /**
   * A page of payments plus the amount per status over the whole filtered
   * set, so the screen can show "R x completed, R y failed" for the filter.
   */
  static async listPayments({ limit, offset, status, method, patient_id, doctor_id, from, to }) {
    const where = new Where()
      .add('pay.payment_status = ?', status)
      .add('pay.payment_method = ?', method)
      .add('pay.patient_id = ?', patient_id)
      .add('pay.doctor_id = ?', doctor_id)
      .dateRange('pay.created_at', from, to);
    const { total, rows } = await page({
      select: PAYMENT_COLUMNS, from: PAYMENT_FROM, where,
      orderBy: 'pay.created_at DESC, pay.id DESC', limit, offset
    });

    const totals = await query(
      `SELECT pay.payment_status AS status, COUNT(*)::int AS count,
              COALESCE(SUM(pay.amount), 0)::float8 AS amount
         FROM ${PAYMENT_FROM} ${where.sql}
        GROUP BY pay.payment_status`,
      where.params
    );
    const by_status = {};
    for (const row of totals.rows) by_status[row.status] = { count: row.count, amount: row.amount };

    return { total, totals: { currency: 'ZAR', by_status }, payments: rows };
  }

  static async getPayment(id) {
    const result = await query(
      `SELECT ${PAYMENT_COLUMNS}, pay.notes FROM ${PAYMENT_FROM} WHERE pay.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  /* ---------------------------------------------------------- appointments */

  /** from/to filter on the appointment's own date, not when it was booked. */
  static async listAppointments({ limit, offset, status, payment_status, doctor_id, patient_id, from, to }) {
    const where = new Where()
      .add('a.status = ?', status)
      .add('a.payment_status = ?', payment_status)
      .add('a.doctor_id = ?', doctor_id)
      .add('a.patient_id = ?', patient_id)
      .add('a.appointment_date >= ?::date', from)
      .add('a.appointment_date <= ?::date', to);
    const { total, rows } = await page({
      select: APPOINTMENT_COLUMNS, from: APPOINTMENT_FROM, where,
      orderBy: 'a.appointment_date DESC, a.id DESC', limit, offset
    });
    return { total, appointments: rows };
  }

  /** One appointment with its payments and the prescriptions written for it. */
  static async getAppointment(id) {
    const result = await query(
      `SELECT ${APPOINTMENT_COLUMNS} FROM ${APPOINTMENT_FROM} WHERE a.id = $1`,
      [id]
    );
    const appointment = result.rows[0];
    if (!appointment) return null;

    const [payments, prescriptions] = await Promise.all([
      query(
        `SELECT id, amount::float8 AS amount, payment_method, payment_status,
                ${TS('created_at', 'created_at')}
           FROM payments WHERE appointment_id = $1 ORDER BY created_at, id`,
        [id]
      ),
      query(
        `SELECT id, prescription_number, signature_status,
                ${TS('created_at', 'created_at')}
           FROM prescriptions WHERE appointment_id = $1 ORDER BY created_at, id`,
        [id]
      )
    ]);
    appointment.payments = payments.rows;
    appointment.prescriptions = prescriptions.rows;
    return appointment;
  }

  /* --------------------------------------------------------- prescriptions */

  static async listPrescriptions({ limit, offset, state, doctor_id, patient_id, from, to }) {
    const where = new Where()
      .add('rx.doctor_id = ?', doctor_id)
      .add('rx.patient_id = ?', patient_id)
      .dateRange('rx.created_at', from, to);
    if (state) where.raw(PRESCRIPTION_STATE_SQL[state]);
    const { total, rows } = await page({
      select: PRESCRIPTION_COLUMNS, from: PRESCRIPTION_FROM, where,
      orderBy: 'rx.created_at DESC, rx.id DESC', limit, offset
    });
    return { total, prescriptions: rows };
  }

  /** One prescription with the orders placed against it. */
  static async getPrescription(id) {
    const result = await query(
      `SELECT ${PRESCRIPTION_COLUMNS} FROM ${PRESCRIPTION_FROM} WHERE rx.id = $1`,
      [id]
    );
    const prescription = result.rows[0];
    if (!prescription) return null;

    const orders = await query(
      `SELECT o.id, o.status, o.pharmacy_id, ${PHARMACY_NAME('ph')} AS pharmacy_name,
              ${TS('o.created_at', 'created_at')}
         FROM orders o LEFT JOIN pharmacies ph ON ph.id = o.pharmacy_id
        WHERE o.prescription_id = $1
        ORDER BY o.created_at, o.id`,
      [id]
    );
    prescription.orders = orders.rows;
    return prescription;
  }

  /* ------------------------------------------------------- support tickets */

  static async listTickets({ limit, offset, status, priority, category, search }) {
    const where = new Where()
      .add('t.status = ?', status)
      .add('t.priority = ?', priority)
      .add('t.category = ?', category);
    if (search) {
      // One parameter, used for subject and email.
      where.add(`(t.subject ILIKE ? OR t.email ILIKE $${where.params.length + 1})`, `%${search}%`);
    }
    const { total, rows } = await page({
      select: TICKET_LIST_COLUMNS, from: 'support_tickets t', where,
      // Unanswered and urgent first.
      orderBy: `CASE t.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
                CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
                t.created_at DESC, t.id DESC`,
      limit, offset
    });
    return { total, tickets: rows };
  }

  static async getTicket(id) {
    const result = await query(
      `SELECT ${TICKET_LIST_COLUMNS}, t.message, t.ip_address, t.user_agent
         FROM support_tickets t WHERE t.id = $1`,
      [id]
    );
    const ticket = result.rows[0];
    if (!ticket) return null;

    const replies = await query(
      `SELECT r.id, r.admin_id, TRIM(CONCAT_WS(' ', ad.first_name, ad.last_name)) AS admin_name,
              r.message, r.email_sent, ${TS('r.created_at', 'created_at')}
         FROM support_ticket_replies r
         LEFT JOIN admins ad ON ad.id = r.admin_id
        WHERE r.ticket_id = $1
        ORDER BY r.created_at, r.id`,
      [id]
    );
    ticket.replies = replies.rows;
    return ticket;
  }

  /**
   * Set status and/or priority. resolved_at follows the status: stamped when
   * a ticket becomes resolved or closed, cleared when it is reopened.
   */
  static async updateTicket(id, { status, priority }) {
    const result = await query(
      `UPDATE support_tickets
          SET status = COALESCE($2, status),
              priority = COALESCE($3, priority),
              resolved_at = CASE
                WHEN $2::text IS NULL THEN resolved_at
                WHEN $2 IN ('resolved', 'closed') THEN COALESCE(resolved_at, CURRENT_TIMESTAMP)
                ELSE NULL
              END,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id`,
      [id, status ?? null, priority ?? null]
    );
    return result.rowCount > 0;
  }

  /**
   * Store an admin's reply. An open ticket moves to in_progress, since
   * somebody is now on it; any other status is left alone.
   */
  static async addTicketReply(ticketId, adminId, message) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const reply = await client.query(
        `INSERT INTO support_ticket_replies (ticket_id, admin_id, message)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [ticketId, adminId, message]
      );
      await client.query(
        `UPDATE support_tickets
            SET status = CASE WHEN status = 'open' THEN 'in_progress' ELSE status END,
                updated_at = CURRENT_TIMESTAMP
          WHERE id = $1`,
        [ticketId]
      );
      await client.query('COMMIT');
      return reply.rows[0].id;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async markReplyEmailed(replyId) {
    await query('UPDATE support_ticket_replies SET email_sent = true WHERE id = $1', [replyId]);
  }

  /* --------------------------------------------------------------- reviews */

  static async listReviews({ limit, offset, doctor_id, patient_id, rating, hidden }) {
    const where = new Where()
      .add('dr.doctor_id = ?', doctor_id)
      .add('dr.patient_id = ?', patient_id)
      .add('dr.rating = ?', rating)
      .add('dr.is_hidden = ?', hidden);
    const { total, rows } = await page({
      select: REVIEW_COLUMNS, from: REVIEW_FROM, where,
      orderBy: 'dr.created_at DESC, dr.id DESC', limit, offset
    });
    return { total, reviews: rows };
  }

  static async getReview(id) {
    const result = await query(`SELECT ${REVIEW_COLUMNS} FROM ${REVIEW_FROM} WHERE dr.id = $1`, [id]);
    return result.rows[0] || null;
  }

  static async setReviewHidden(id, hidden, adminId, reason) {
    const result = await query(
      `UPDATE doctor_reviews
          SET is_hidden = $2,
              hidden_at = CASE WHEN $2 THEN CURRENT_TIMESTAMP ELSE NULL END,
              hidden_by = CASE WHEN $2 THEN $3::int ELSE NULL END,
              hidden_reason = CASE WHEN $2 THEN $4::text ELSE NULL END
        WHERE id = $1
        RETURNING id`,
      [id, hidden, adminId, reason ?? null]
    );
    return result.rowCount > 0;
  }

  static async deleteReview(id) {
    const result = await query('DELETE FROM doctor_reviews WHERE id = $1 RETURNING id', [id]);
    return result.rowCount > 0;
  }

  /* ------------------------------------------------------- security alerts */

  static async listAlerts({ limit, offset, status, severity, alert_type, user_type, user_id, hours }) {
    const where = new Where()
      .add('status = ?', status)
      .add('severity = ?', severity)
      .add('alert_type = ?', alert_type)
      .add('user_type = ?', user_type)
      .add('user_id = ?', user_id)
      .add(`created_at > (now() AT TIME ZONE 'UTC') - make_interval(hours => ?)`, hours);
    const { total, rows } = await page({
      select: ALERT_COLUMNS, from: 'security_alerts', where,
      orderBy: `${SEVERITY_RANK} DESC, created_at DESC, id DESC`, limit, offset
    });
    return { total, alerts: rows };
  }

  static async getAlert(id) {
    const result = await query(`SELECT ${ALERT_COLUMNS} FROM security_alerts WHERE id = $1`, [id]);
    return result.rows[0] || null;
  }

  /**
   * Record an admin's verdict on one or more alerts. Returns the updated
   * rows so the caller can act on each affected account.
   */
  static async reviewAlerts(ids, { status, adminNotes, actionTaken }) {
    const result = await query(
      `UPDATE security_alerts
          SET status = $2, admin_notes = $3, action_taken = $4,
              admin_action_at = NOW(), updated_at = NOW()
        WHERE id = ANY($1::int[])
        RETURNING id, user_id, user_type, email, alert_type, severity, alert_message,
                  location_data, ip_address, created_at`,
      [ids, status, adminNotes ?? null, actionTaken ?? null]
    );
    return result.rows;
  }

  /**
   * Accounts with at least `threshold` unreviewed CRITICAL alerts in the
   * window. Grouped by user_type too: a patient and a doctor can share an id.
   */
  static async suspiciousUsers({ hours, threshold }) {
    const result = await query(
      `SELECT user_id, user_type, MAX(email) AS email,
              COUNT(*)::int AS alert_count,
              COUNT(*) FILTER (WHERE severity = 'CRITICAL')::int AS critical_count,
              ROUND(AVG(risk_score))::int AS avg_risk_score,
              MAX(created_at) AT TIME ZONE 'UTC' AS latest_alert,
              ARRAY_AGG(DISTINCT alert_type) AS alert_types
         FROM security_alerts
        WHERE created_at > (now() AT TIME ZONE 'UTC') - make_interval(hours => $1)
          AND status = 'unreviewed'
        GROUP BY user_id, user_type
       HAVING COUNT(*) FILTER (WHERE severity = 'CRITICAL') >= $2
        ORDER BY critical_count DESC, alert_count DESC`,
      [hours, threshold]
    );
    return result.rows;
  }

  /** Alert counts per day, type and severity between two SA dates. */
  static async alertReport({ from, to }) {
    const result = await query(
      `SELECT to_char(${SA_DATE('created_at')}, 'YYYY-MM-DD') AS date,
              alert_type, severity,
              COUNT(*)::int AS count,
              COUNT(*) FILTER (WHERE status = 'verified_threat')::int AS confirmed_threats,
              ROUND(AVG(risk_score))::int AS avg_risk_score
         FROM security_alerts
        WHERE ${SA_DATE('created_at')} BETWEEN $1::date AND $2::date
        GROUP BY 1, alert_type, severity
        ORDER BY 1 DESC, alert_type,
                 CASE severity WHEN 'CRITICAL' THEN 4 WHEN 'HIGH' THEN 3 WHEN 'MEDIUM' THEN 2 ELSE 1 END DESC`,
      [from, to]
    );
    return result.rows;
  }

  /** Counts for the security alerts header: last 24 hours and last 7 days. */
  static async alertStats() {
    const window = (hours) => `
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE status = 'unreviewed')::int AS unreviewed,
             COUNT(*) FILTER (WHERE severity = 'CRITICAL')::int AS critical,
             COUNT(*) FILTER (WHERE severity = 'HIGH')::int AS high,
             COUNT(DISTINCT (user_type, user_id))::int AS affected_users
        FROM security_alerts
       WHERE created_at > (now() AT TIME ZONE 'UTC') - interval '${hours} hours'`;
    const [day, week, open] = await Promise.all([
      query(window(24)),
      query(window(168)),
      query(`SELECT COUNT(*)::int AS n FROM security_alerts
              WHERE status = 'unreviewed' AND severity IN ('CRITICAL', 'HIGH')`)
    ]);
    return {
      last_24_hours: day.rows[0],
      last_7_days: week.rows[0],
      unreviewed_critical_or_high: open.rows[0].n
    };
  }
}

module.exports = AdminRecords;
