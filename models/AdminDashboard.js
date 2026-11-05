const { query } = require('../config/db');

/**
 * Read-only aggregates behind the admin dashboard.
 *
 * Timestamps: created_at columns are `timestamp without time zone` filled by
 * CURRENT_TIMESTAMP on a database whose session time zone is UTC, so they
 * hold UTC wall-clock time. Every "today"/"this month"/bucket boundary is
 * worked out by converting them to South African time in SQL (SA() below),
 * and every timestamp returned is converted to a real instant
 * (`AT TIME ZONE 'UTC'`) so it serialises as an unambiguous ISO string no
 * matter what time zone the Node process runs in.
 *
 * Postgres returns COUNT/SUM as strings; everything numeric is cast to int or
 * float8 so the JSON carries numbers.
 */

const TZ = 'Africa/Johannesburg';
const SA = (col) => `((${col} AT TIME ZONE 'UTC') AT TIME ZONE '${TZ}')`;
const SA_TODAY = `(now() AT TIME ZONE '${TZ}')::date`;
const UTC_NOW = `(now() AT TIME ZONE 'UTC')`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Chart ranges. Fixed fragments only — the request's `range` picks a key,
 * it never reaches the SQL text.
 */
const RANGES = {
  daily: {
    unit: 'day',
    step: '1 day',
    first: 'today - 29',
    last: 'today',
    label: (y, m, d) => `${d} ${MONTHS[m - 1]}`
  },
  monthly: {
    unit: 'month',
    step: '1 month',
    first: "date_trunc('year', today)::date",
    last: "(date_trunc('year', today) + interval '11 months')::date",
    label: (y, m) => MONTHS[m - 1]
  },
  yearly: {
    unit: 'year',
    step: '1 year',
    first: "(date_trunc('year', today) - interval '4 years')::date",
    last: "date_trunc('year', today)::date",
    label: (y) => String(y)
  }
};

/**
 * Per-role SELECTs for the recent-users feed. Only directory columns — no
 * password hashes, ID numbers or clinical fields.
 */
const RECENT_USER_SOURCES = {
  patient: `SELECT id, 'patient' AS role,
                   TRIM(CONCAT_WS(' ', first_name, last_name)) AS name,
                   email, status, avatar_url AS profile_image, created_at
              FROM patients`,
  doctor: `SELECT id, 'doctor' AS role,
                  TRIM(CONCAT_WS(' ', first_name, last_name)) AS name,
                  email, status, profile_image, created_at
             FROM doctors`,
  pharmacy: `SELECT id, 'pharmacy' AS role,
                    COALESCE(NULLIF(TRIM(pharmacy_name), ''), TRIM(CONCAT_WS(' ', first_name, last_name))) AS name,
                    email, status, profile_image, created_at
               FROM pharmacies`
};

class AdminDashboard {
  static get RANGES() { return Object.keys(RANGES); }
  static get ROLES() { return Object.keys(RECENT_USER_SOURCES); }

  /**
   * Stat cards, distribution donut and alert tiles.
   *
   * Definitions (agreed defaults — change here if the product decides
   * otherwise):
   *  - patients/doctors/pharmacies: every registered account, whatever its
   *    status.
   *  - active_prescriptions: signed, not revoked, not dispensed, and not
   *    attached to an order that was picked up. A cancelled or rejected
   *    order does not use the script up — the patient can still take it to
   *    another pharmacy — so those stay active.
   *  - orders_today: orders created today, SA time.
   *  - revenue: completed payments created this calendar month (SA time),
   *    all payment methods, with a per-method breakdown.
   *  - pending_verifications: pharmacies and doctors with status 'pending'.
   *  - failed_payments: payments with status 'failed' in the last 7 days.
   *  - flagged_prescriptions: null — prescriptions have no flag yet.
   */
  static async summary() {
    const countsResult = await query(`
      SELECT
        (SELECT COUNT(*) FROM patients)::int   AS patients,
        (SELECT COUNT(*) FROM doctors)::int    AS doctors,
        (SELECT COUNT(*) FROM pharmacies)::int AS pharmacies,
        (SELECT COUNT(*)
           FROM prescriptions p
          WHERE p.signature_status = 'signed'
            AND NOT COALESCE(p.is_revoked, false)
            AND NOT COALESCE(p.is_dispensed, false)
            AND NOT EXISTS (
              SELECT 1 FROM orders o
               WHERE o.prescription_id = p.id AND o.status = 'picked_up'
            ))::int AS active_prescriptions,
        (SELECT COUNT(*) FROM orders
          WHERE ${SA('created_at')}::date = ${SA_TODAY})::int AS orders_today
    `);

    const revenueResult = await query(`
      SELECT payment_method, COALESCE(SUM(amount), 0)::float8 AS amount
        FROM payments
       WHERE payment_status = 'completed'
         AND ${SA('created_at')} >= date_trunc('month', now() AT TIME ZONE '${TZ}')
       GROUP BY payment_method
    `);

    const alertsResult = await query(`
      WITH pending AS (
        SELECT 'pharmacy' AS kind, created_at FROM pharmacies WHERE status = 'pending'
        UNION ALL
        SELECT 'doctor', created_at FROM doctors WHERE status = 'pending'
      )
      SELECT
        (SELECT COUNT(*) FROM pending)::int                          AS pending_count,
        (SELECT COUNT(*) FROM pending WHERE kind = 'pharmacy')::int  AS pending_pharmacies,
        (SELECT COUNT(*) FROM pending WHERE kind = 'doctor')::int    AS pending_doctors,
        (SELECT MAX(created_at) AT TIME ZONE 'UTC' FROM pending)     AS pending_latest,
        (SELECT COUNT(*) FROM payments
          WHERE payment_status = 'failed'
            AND created_at >= ${UTC_NOW} - interval '7 days')::int   AS failed_count,
        (SELECT MAX(created_at) AT TIME ZONE 'UTC' FROM payments
          WHERE payment_status = 'failed'
            AND created_at >= ${UTC_NOW} - interval '7 days')        AS failed_latest
    `);

    const counts = countsResult.rows[0];
    counts.total_users = counts.patients + counts.doctors + counts.pharmacies;

    const byMethod = {};
    let revenueTotal = 0;
    for (const row of revenueResult.rows) {
      byMethod[row.payment_method || 'unknown'] = row.amount;
      revenueTotal += row.amount;
    }

    const a = alertsResult.rows[0];

    return {
      counts: {
        patients: counts.patients,
        doctors: counts.doctors,
        pharmacies: counts.pharmacies,
        total_users: counts.total_users,
        active_prescriptions: counts.active_prescriptions,
        orders_today: counts.orders_today
      },
      revenue: {
        amount: Math.round(revenueTotal * 100) / 100,
        currency: 'ZAR',
        period: 'month',
        by_method: byMethod
      },
      alerts: {
        pending_verifications: {
          count: a.pending_count,
          pharmacies: a.pending_pharmacies,
          doctors: a.pending_doctors,
          latest_at: a.pending_latest
        },
        failed_payments: {
          count: a.failed_count,
          window_days: 7,
          latest_at: a.failed_latest
        },
        flagged_prescriptions: null
      }
    };
  }

  /**
   * Prescriptions and orders created per bucket, every bucket present
   * (empty ones as 0) so the chart has no gaps.
   */
  static async activity(range) {
    const r = RANGES[range];
    if (!r) throw new Error(`Unknown range: ${range}`);

    const bucketCounts = (table) => `
      SELECT date_trunc('${r.unit}', ${SA('created_at')})::date AS k, COUNT(*) AS c
        FROM ${table}, bounds
       WHERE ${SA('created_at')} >= bounds.first
         AND ${SA('created_at')} <  bounds.last + interval '${r.step}'
       GROUP BY 1`;

    const result = await query(`
      WITH t AS (SELECT ${SA_TODAY} AS today),
      bounds AS (SELECT ${r.first} AS first, ${r.last} AS last FROM t),
      b AS (
        SELECT gs::date AS start
          FROM bounds, generate_series(bounds.first::timestamp, bounds.last::timestamp, interval '${r.step}') gs
      ),
      p AS (${bucketCounts('prescriptions')}),
      o AS (${bucketCounts('orders')})
      SELECT to_char(b.start, 'YYYY-MM-DD') AS start,
             COALESCE(p.c, 0)::int AS prescriptions,
             COALESCE(o.c, 0)::int AS orders
        FROM b
        LEFT JOIN p ON p.k = b.start
        LEFT JOIN o ON o.k = b.start
       ORDER BY b.start
    `);

    return result.rows.map((row) => {
      const [y, m, d] = row.start.split('-').map(Number);
      return {
        label: r.label(y, m, d),
        start: row.start,
        prescriptions: row.prescriptions,
        orders: row.orders
      };
    });
  }

  /**
   * Newest sign-ups across patients, doctors and pharmacies. `id` is only
   * unique together with `role`.
   */
  static async recentUsers({ role, limit = 10 } = {}) {
    const sources = role ? [RECENT_USER_SOURCES[role]] : Object.values(RECENT_USER_SOURCES);
    if (sources.some((s) => !s)) throw new Error(`Unknown role: ${role}`);

    const result = await query(
      `SELECT id, role, name, email, status, profile_image,
              created_at AT TIME ZONE 'UTC' AS created_at
         FROM (${sources.join(' UNION ALL ')}) u
        ORDER BY u.created_at DESC NULLS LAST, id DESC
        LIMIT $1`,
      [limit]
    );
    return result.rows;
  }
}

module.exports = AdminDashboard;
