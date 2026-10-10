const { query } = require('../config/db');

/**
 * InventoryItem Model
 *
 * Per-pharmacy stock of medicines. Scoped strictly to pharmacy_id — a pharmacy
 * only ever sees / writes its own rows.
 *
 * Design notes:
 *   - Field names below are safe defaults. Rename any labelled `TBD` after the
 *     frontend design lands.
 *   - `is_active` is used for soft-delete so historical order dispenses can
 *     still reference the row.
 *   - `inventory_adjustments` is an audit log of every stock change (create,
 *     manual adjust, dispense, etc.). It's the source of truth for "why did
 *     quantity_on_hand drop?".
 */

const ADJUSTMENT_REASONS = [
  'initial_stock',
  'restock',
  'manual_adjust',
  'dispense',
  'expired',
  'damaged',
  'return',
  'correction',
];

class InventoryItem {
  static get ADJUSTMENT_REASONS() { return ADJUSTMENT_REASONS; }

  static async createTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS inventory_items (
        id SERIAL PRIMARY KEY,
        pharmacy_id INTEGER NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,

        sku VARCHAR(100),                         -- pharmacy's own SKU/code
        medication_name VARCHAR(255) NOT NULL,
        generic_name VARCHAR(255),
        dosage VARCHAR(100),                      -- combined form+strength e.g. "500mg tablet"
        pack_size INTEGER,                        -- units per pack
        unit VARCHAR(50),                         -- e.g. "tablets", "ml"

        quantity_on_hand INTEGER NOT NULL DEFAULT 0
          CHECK (quantity_on_hand >= 0),
        low_stock_threshold INTEGER NOT NULL DEFAULT 0
          CHECK (low_stock_threshold >= 0),
        unit_price DECIMAL(10, 2),
        expiry_date DATE,
        supplier VARCHAR(255),
        notes TEXT,

        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

        UNIQUE (pharmacy_id, sku)
      );

      CREATE INDEX IF NOT EXISTS idx_inventory_pharmacy_active
        ON inventory_items(pharmacy_id, is_active);
      CREATE INDEX IF NOT EXISTS idx_inventory_pharmacy_medication
        ON inventory_items(pharmacy_id, LOWER(medication_name));
      CREATE INDEX IF NOT EXISTS idx_inventory_expiry
        ON inventory_items(pharmacy_id, expiry_date);
    `;
    await query(sql);

    const adjSql = `
      CREATE TABLE IF NOT EXISTS inventory_adjustments (
        id SERIAL PRIMARY KEY,
        inventory_item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
        pharmacy_id INTEGER NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
        quantity_delta INTEGER NOT NULL,       -- + for restock, - for dispense
        quantity_after INTEGER NOT NULL,
        reason VARCHAR(32) NOT NULL
          CHECK (reason IN (
            'initial_stock','restock','manual_adjust','dispense',
            'expired','damaged','return','correction'
          )),
        related_order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
        related_prescription_item_id INTEGER,
        actor_id INTEGER,                      -- pharmacy user who made the change
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE inventory_adjustments
        ADD COLUMN IF NOT EXISTS related_prescription_item_id INTEGER;

      CREATE INDEX IF NOT EXISTS idx_inventory_adj_item
        ON inventory_adjustments(inventory_item_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_inventory_adj_pharmacy
        ON inventory_adjustments(pharmacy_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_inventory_adj_order
        ON inventory_adjustments(related_order_id) WHERE related_order_id IS NOT NULL;

      -- Prevent double-dispensing the same prescription line for the same order.
      CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_adj_unique_dispense
        ON inventory_adjustments(related_order_id, related_prescription_item_id)
        WHERE reason = 'dispense'
          AND related_order_id IS NOT NULL
          AND related_prescription_item_id IS NOT NULL;
    `;
    await query(adjSql);

    // Attach the FK to prescription_items only if that table exists. Keeps the
    // inventory migration runnable on DBs where prescription_items hasn't been
    // created yet (run `npm run migrate:prescriptions` to add it).
    await query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
           WHERE table_name = 'prescription_items'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
           WHERE constraint_name = 'inventory_adj_rx_item_fk'
        ) THEN
          ALTER TABLE inventory_adjustments
            ADD CONSTRAINT inventory_adj_rx_item_fk
            FOREIGN KEY (related_prescription_item_id)
            REFERENCES prescription_items(id) ON DELETE SET NULL;
        END IF;
      END$$;
    `);

    console.log('✅ inventory_items + inventory_adjustments tables ready');
  }

  static async create(pharmacy_id, fields) {
    const {
      sku = null,
      medication_name,
      generic_name = null,
      dosage = null,
      pack_size = null,
      unit = null,
      quantity_on_hand = 0,
      low_stock_threshold = 0,
      unit_price = null,
      expiry_date = null,
      supplier = null,
      notes = null,
    } = fields;

    if (!medication_name) throw new Error('medication_name is required');

    const sql = `
      INSERT INTO inventory_items (
        pharmacy_id, sku, medication_name, generic_name, dosage,
        pack_size, unit, quantity_on_hand, low_stock_threshold,
        unit_price, expiry_date, supplier, notes
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *
    `;
    const result = await query(sql, [
      pharmacy_id, sku, medication_name, generic_name, dosage,
      pack_size, unit, quantity_on_hand, low_stock_threshold,
      unit_price, expiry_date, supplier, notes,
    ]);
    const item = result.rows[0];

    if (quantity_on_hand > 0) {
      await this.recordAdjustment({
        inventory_item_id: item.id,
        pharmacy_id,
        quantity_delta: quantity_on_hand,
        quantity_after: quantity_on_hand,
        reason: 'initial_stock',
        notes: 'Item created with starting stock',
      });
    }

    return item;
  }

  static async findById(id, pharmacy_id) {
    const result = await query(
      'SELECT * FROM inventory_items WHERE id = $1 AND pharmacy_id = $2',
      [id, pharmacy_id]
    );
    return result.rows[0] || null;
  }

  /**
   * List items for a pharmacy with search + filters + offset pagination.
   *
   * @param {number} pharmacy_id
   * @param {object} opts
   * @param {string} [opts.search]                free-text on medication_name / generic_name / sku
   * @param {boolean} [opts.lowStockOnly=false]   quantity_on_hand <= low_stock_threshold
   * @param {number}  [opts.expiringWithinDays]   expiry_date within N days from today
   * @param {boolean} [opts.includeInactive=false]
   * @param {number}  [opts.limit=50]
   * @param {number}  [opts.offset=0]
   */
  static async list(pharmacy_id, opts = {}) {
    const {
      search = null,
      lowStockOnly = false,
      expiringWithinDays = null,
      includeInactive = false,
      limit = 50,
      offset = 0,
    } = opts;

    const params = [pharmacy_id];
    const where = ['pharmacy_id = $1'];

    if (!includeInactive) where.push('is_active = TRUE');

    if (search) {
      params.push(`%${search}%`);
      const p = `$${params.length}`;
      where.push(`(medication_name ILIKE ${p} OR generic_name ILIKE ${p} OR sku ILIKE ${p})`);
    }

    if (lowStockOnly) {
      where.push('quantity_on_hand <= low_stock_threshold');
    }

    if (expiringWithinDays != null) {
      params.push(parseInt(expiringWithinDays, 10));
      where.push(`expiry_date IS NOT NULL AND expiry_date <= (CURRENT_DATE + ($${params.length} || ' days')::interval)`);
    }

    const cap = Math.min(parseInt(limit, 10) || 50, 200);
    const off = parseInt(offset, 10) || 0;
    params.push(cap, off);

    const listSql = `
      SELECT * FROM inventory_items
      WHERE ${where.join(' AND ')}
      ORDER BY medication_name ASC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;
    const countSql = `
      SELECT COUNT(*)::int AS total FROM inventory_items
      WHERE ${where.join(' AND ')}
    `;

    // Slice off the limit/offset params for the count query.
    const countParams = params.slice(0, params.length - 2);

    const [listRes, countRes] = await Promise.all([
      query(listSql, params),
      query(countSql, countParams),
    ]);

    return {
      items: listRes.rows,
      total: countRes.rows[0].total,
      limit: cap,
      offset: off,
    };
  }

  /**
   * Update non-quantity fields. Stock changes go through `adjust`.
   */
  static async update(id, pharmacy_id, fields = {}) {
    const ALLOWED = [
      'sku','medication_name','generic_name','dosage',
      'pack_size','unit','low_stock_threshold','unit_price',
      'expiry_date','supplier','notes','is_active',
    ];
    const sets = [];
    const values = [id, pharmacy_id];
    for (const col of ALLOWED) {
      if (fields[col] !== undefined) {
        values.push(fields[col]);
        sets.push(`${col} = $${values.length}`);
      }
    }
    if (sets.length === 0) return this.findById(id, pharmacy_id);
    sets.push('updated_at = CURRENT_TIMESTAMP');

    const sql = `
      UPDATE inventory_items
         SET ${sets.join(', ')}
       WHERE id = $1 AND pharmacy_id = $2
      RETURNING *
    `;
    const result = await query(sql, values);
    return result.rows[0] || null;
  }

  /**
   * Apply a stock delta and write an audit row. Delta may be negative.
   */
  static async adjust({
    id, pharmacy_id, delta, reason, actor_id = null,
    related_order_id = null, notes = null,
  }) {
    if (!ADJUSTMENT_REASONS.includes(reason)) {
      throw new Error(`Invalid reason. Allowed: ${ADJUSTMENT_REASONS.join(', ')}`);
    }
    if (!Number.isInteger(delta) || delta === 0) {
      throw new Error('delta must be a non-zero integer');
    }

    const client = await require('../config/db').pool.connect();
    try {
      await client.query('BEGIN');

      const lockRes = await client.query(
        'SELECT quantity_on_hand FROM inventory_items WHERE id = $1 AND pharmacy_id = $2 FOR UPDATE',
        [id, pharmacy_id]
      );
      if (lockRes.rows.length === 0) {
        throw new Error('Inventory item not found');
      }
      const current = lockRes.rows[0].quantity_on_hand;
      const next = current + delta;
      if (next < 0) {
        throw new Error(`Insufficient stock. On hand: ${current}, requested delta: ${delta}`);
      }

      const updateRes = await client.query(
        `UPDATE inventory_items
            SET quantity_on_hand = $1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2 AND pharmacy_id = $3
          RETURNING *`,
        [next, id, pharmacy_id]
      );

      const adjRes = await client.query(
        `INSERT INTO inventory_adjustments (
           inventory_item_id, pharmacy_id, quantity_delta, quantity_after,
           reason, related_order_id, actor_id, notes
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING *`,
        [id, pharmacy_id, delta, next, reason, related_order_id, actor_id, notes]
      );

      await client.query('COMMIT');
      return { item: updateRes.rows[0], adjustment: adjRes.rows[0] };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Internal helper — used by `create` to write the initial-stock audit row.
   * Callers should prefer `adjust`.
   */
  static async recordAdjustment({
    inventory_item_id, pharmacy_id, quantity_delta, quantity_after,
    reason, related_order_id = null, actor_id = null, notes = null,
  }) {
    const result = await query(
      `INSERT INTO inventory_adjustments (
         inventory_item_id, pharmacy_id, quantity_delta, quantity_after,
         reason, related_order_id, actor_id, notes
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [inventory_item_id, pharmacy_id, quantity_delta, quantity_after,
       reason, related_order_id, actor_id, notes]
    );
    return result.rows[0];
  }

  static async listAdjustments(id, pharmacy_id, { limit = 50, offset = 0 } = {}) {
    const cap = Math.min(parseInt(limit, 10) || 50, 200);
    const off = parseInt(offset, 10) || 0;
    const result = await query(
      `SELECT * FROM inventory_adjustments
        WHERE inventory_item_id = $1 AND pharmacy_id = $2
        ORDER BY created_at DESC
        LIMIT $3 OFFSET $4`,
      [id, pharmacy_id, cap, off]
    );
    return result.rows;
  }

  /**
   * Suggest inventory rows that could fulfil a prescription line, ranked by
   * confidence (exact > name+dose > name-only) and then FEFO (earliest expiry
   * first). Only returns rows with stock on hand.
   *
   * @param {number} pharmacy_id
   * @param {object} rxItem       shape: { medicine_name, generic_name?, dosage? }
   * @param {number} [limit=5]
   */
  static async suggestForItem(pharmacy_id, rxItem, limit = 5) {
    const name = (rxItem.medicine_name || '').trim();
    const generic = (rxItem.generic_name || '').trim();
    const dosage = (rxItem.dosage || '').trim();
    if (!name && !generic) return [];

    const nameLower = name.toLowerCase();
    const genericLower = generic.toLowerCase();
    const dosageLower = dosage.toLowerCase();

    // Confidence tiers as SQL CASE — higher = better match.
    //   3 = exact name AND dosage substring both match
    //   2 = name matches (medication or generic)
    //   1 = generic-only match (weak)
    const sql = `
      SELECT *,
        CASE
          WHEN LOWER(medication_name) = $2
               AND $4 <> ''
               AND LOWER(COALESCE(dosage,'')) LIKE '%' || $4 || '%'
            THEN 3
          WHEN LOWER(medication_name) = $2
            THEN 2
          WHEN $3 <> '' AND LOWER(COALESCE(generic_name,'')) = $3
            THEN 2
          WHEN $2 <> '' AND LOWER(medication_name) LIKE '%' || $2 || '%'
            THEN 1
          WHEN $3 <> '' AND LOWER(COALESCE(generic_name,'')) LIKE '%' || $3 || '%'
            THEN 1
          ELSE 0
        END AS confidence
      FROM inventory_items
      WHERE pharmacy_id = $1
        AND is_active = TRUE
        AND quantity_on_hand > 0
        AND (
          ($2 <> '' AND LOWER(medication_name) LIKE '%' || $2 || '%')
          OR ($3 <> '' AND LOWER(COALESCE(generic_name,'')) LIKE '%' || $3 || '%')
        )
      ORDER BY confidence DESC,
               expiry_date ASC NULLS LAST,
               quantity_on_hand DESC
      LIMIT $5
    `;
    const result = await query(sql, [
      pharmacy_id, nameLower, genericLower, dosageLower, limit,
    ]);
    return result.rows;
  }

  /**
   * Return the dispense audit rows already recorded against this order for
   * this pharmacy. Used to prevent double-dispensing and to render the
   * "already dispensed" view.
   */
  static async listDispensedForOrder(pharmacy_id, order_id) {
    const result = await query(
      `SELECT a.*, i.medication_name, i.dosage, i.sku, i.unit
         FROM inventory_adjustments a
         JOIN inventory_items i ON i.id = a.inventory_item_id
        WHERE a.pharmacy_id = $1
          AND a.related_order_id = $2
          AND a.reason = 'dispense'
        ORDER BY a.created_at ASC`,
      [pharmacy_id, order_id]
    );
    return result.rows;
  }

  /**
   * Commit a set of confirmed dispenses for an order in a single transaction.
   *
   * All-or-nothing: any per-line failure (insufficient stock, item not found,
   * already dispensed, etc.) rolls back the entire batch.
   *
   * @param {object} args
   * @param {number} args.pharmacy_id
   * @param {number} args.order_id
   * @param {Array<{inventory_item_id:number, prescription_item_id:number, quantity:number}>} args.lines
   * @param {number} [args.actor_id]
   * @param {string} [args.notes]
   * @returns {Promise<Array<{item:object, adjustment:object}>>}
   */
  static async dispenseForOrder({ pharmacy_id, order_id, lines, actor_id = null, notes = null }) {
    if (!Array.isArray(lines) || lines.length === 0) {
      throw new Error('lines must be a non-empty array');
    }

    const client = await require('../config/db').pool.connect();
    try {
      await client.query('BEGIN');
      const results = [];

      for (const line of lines) {
        const invId = parseInt(line.inventory_item_id, 10);
        const rxItemId = parseInt(line.prescription_item_id, 10);
        const qty = parseInt(line.quantity, 10);

        if (!invId || !rxItemId || !qty || qty <= 0) {
          throw new Error('Each line requires inventory_item_id, prescription_item_id and a positive quantity');
        }

        const lockRes = await client.query(
          'SELECT quantity_on_hand FROM inventory_items WHERE id = $1 AND pharmacy_id = $2 FOR UPDATE',
          [invId, pharmacy_id]
        );
        if (lockRes.rows.length === 0) {
          throw new Error(`Inventory item ${invId} not found`);
        }
        const current = lockRes.rows[0].quantity_on_hand;
        if (current < qty) {
          throw new Error(`Insufficient stock for inventory item ${invId}. On hand: ${current}, requested: ${qty}`);
        }

        const next = current - qty;
        const updateRes = await client.query(
          `UPDATE inventory_items
              SET quantity_on_hand = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2 AND pharmacy_id = $3
            RETURNING *`,
          [next, invId, pharmacy_id]
        );

        const adjRes = await client.query(
          `INSERT INTO inventory_adjustments (
             inventory_item_id, pharmacy_id, quantity_delta, quantity_after,
             reason, related_order_id, related_prescription_item_id, actor_id, notes
           ) VALUES ($1,$2,$3,$4,'dispense',$5,$6,$7,$8)
           RETURNING *`,
          [invId, pharmacy_id, -qty, next, order_id, rxItemId, actor_id, notes]
        );

        results.push({ item: updateRes.rows[0], adjustment: adjRes.rows[0] });
      }

      await client.query('COMMIT');
      return results;
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.code === '23505') {
        const dupeErr = new Error('One or more prescription lines have already been dispensed for this order.');
        dupeErr.code = 'ALREADY_DISPENSED';
        throw dupeErr;
      }
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Dashboard summary: counts for the inventory landing page.
   */
  static async summary(pharmacy_id, { expiringWithinDays = 30 } = {}) {
    const result = await query(
      `SELECT
         COUNT(*) FILTER (WHERE is_active) AS total_active,
         COUNT(*) FILTER (WHERE is_active AND quantity_on_hand <= low_stock_threshold) AS low_stock,
         COUNT(*) FILTER (WHERE is_active AND quantity_on_hand = 0) AS out_of_stock,
         COUNT(*) FILTER (
           WHERE is_active
             AND expiry_date IS NOT NULL
             AND expiry_date <= (CURRENT_DATE + ($2 || ' days')::interval)
             AND expiry_date >= CURRENT_DATE
         ) AS expiring_soon,
         COUNT(*) FILTER (
           WHERE is_active
             AND expiry_date IS NOT NULL
             AND expiry_date < CURRENT_DATE
         ) AS expired
       FROM inventory_items
       WHERE pharmacy_id = $1`,
      [pharmacy_id, expiringWithinDays]
    );
    const row = result.rows[0];
    return {
      totalActive: parseInt(row.total_active, 10),
      lowStock: parseInt(row.low_stock, 10),
      outOfStock: parseInt(row.out_of_stock, 10),
      expiringSoon: parseInt(row.expiring_soon, 10),
      expired: parseInt(row.expired, 10),
      expiringWithinDays,
    };
  }
}

module.exports = InventoryItem;
