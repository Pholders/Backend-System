const { query } = require('../config/db');

/**
 * OrderStatusHistory Model
 *
 * Append-only audit log of every status transition on an order. Used for
 * dispute resolution ("when did the pharmacy actually accept this?"),
 * patient-facing timelines, and analytics.
 *
 * Rows are written by the orderStateMachine — never by controllers directly.
 */

const VALID_ACTOR_TYPES = ['patient', 'pharmacy', 'system', 'admin'];

class OrderStatusHistory {
  static get VALID_ACTOR_TYPES() { return VALID_ACTOR_TYPES; }

  static async createTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS order_status_history (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        from_status VARCHAR(32),
        to_status VARCHAR(32) NOT NULL,
        actor_type VARCHAR(20) NOT NULL
          CHECK (actor_type IN ('patient', 'pharmacy', 'system', 'admin')),
        actor_id INTEGER,
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_order_status_history_order_created
        ON order_status_history(order_id, created_at);
    `;
    await query(sql);
    console.log('✅ order_status_history table ready');
  }

  /**
   * Record a transition. Called by the state machine after the order row is updated.
   */
  static async record({ order_id, from_status, to_status, actor_type, actor_id = null, notes = null }) {
    if (!VALID_ACTOR_TYPES.includes(actor_type)) {
      throw new Error(`Invalid actor_type. Allowed: ${VALID_ACTOR_TYPES.join(', ')}`);
    }
    const sql = `
      INSERT INTO order_status_history
        (order_id, from_status, to_status, actor_type, actor_id, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const result = await query(sql, [
      order_id, from_status, to_status, actor_type, actor_id, notes,
    ]);
    return result.rows[0];
  }

  /**
   * Full timeline for an order, oldest first.
   */
  static async listForOrder(order_id) {
    const result = await query(
      'SELECT * FROM order_status_history WHERE order_id = $1 ORDER BY created_at ASC',
      [order_id]
    );
    return result.rows;
  }
}

module.exports = OrderStatusHistory;
