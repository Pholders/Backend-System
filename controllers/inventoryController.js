const InventoryItem = require('../models/InventoryItem');

/**
 * InventoryController
 *
 *   GET    /api/inventory                         list (search, filters, pagination)
 *   GET    /api/inventory/meta/summary            dashboard counts
 *   POST   /api/inventory                         create a stock item
 *   GET    /api/inventory/:id                     detail
 *   PATCH  /api/inventory/:id                     update non-quantity fields
 *   POST   /api/inventory/:id/adjust              apply stock delta (with reason)
 *   GET    /api/inventory/:id/adjustments         audit log for an item
 *   DELETE /api/inventory/:id                     soft delete (sets is_active = false)
 *
 * All routes are scoped to the authenticated pharmacy's own rows.
 */

function getPharmacyId(req) {
  return req.user && (req.user.id || req.user.pharmacyId);
}

class InventoryController {
  static async list(req, res) {
    try {
      const pharmacyId = getPharmacyId(req);
      const {
        search,
        low_stock,
        expiring_within_days,
        include_inactive,
        limit,
        offset,
      } = req.query;

      const result = await InventoryItem.list(pharmacyId, {
        search: search || null,
        lowStockOnly: low_stock === 'true' || low_stock === '1',
        expiringWithinDays: expiring_within_days != null
          ? parseInt(expiring_within_days, 10)
          : null,
        includeInactive: include_inactive === 'true' || include_inactive === '1',
        limit,
        offset,
      });

      res.json({
        success: true,
        data: {
          items: result.items,
          pagination: {
            total: result.total,
            limit: result.limit,
            offset: result.offset,
            returned: result.items.length,
          },
        },
      });
    } catch (err) {
      console.error('inventory.list error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static async summary(req, res) {
    try {
      const pharmacyId = getPharmacyId(req);
      const days = req.query.expiring_within_days
        ? parseInt(req.query.expiring_within_days, 10)
        : 30;
      const data = await InventoryItem.summary(pharmacyId, { expiringWithinDays: days });
      res.json({ success: true, data });
    } catch (err) {
      console.error('inventory.summary error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static async create(req, res) {
    try {
      const pharmacyId = getPharmacyId(req);
      const item = await InventoryItem.create(pharmacyId, req.body || {});
      res.status(201).json({ success: true, data: { item } });
    } catch (err) {
      console.error('inventory.create error:', err);
      if (err.code === '23505') {
        return res.status(409).json({
          success: false,
          message: 'An item with this SKU already exists for your pharmacy.',
        });
      }
      const status = /required|must|Invalid/i.test(err.message) ? 400 : 500;
      res.status(status).json({ success: false, message: err.message });
    }
  }

  static async getOne(req, res) {
    try {
      const pharmacyId = getPharmacyId(req);
      const id = parseInt(req.params.id, 10);
      if (!id) return res.status(400).json({ success: false, message: 'Invalid id' });

      const item = await InventoryItem.findById(id, pharmacyId);
      if (!item) return res.status(404).json({ success: false, message: 'Inventory item not found' });
      res.json({ success: true, data: { item } });
    } catch (err) {
      console.error('inventory.getOne error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static async update(req, res) {
    try {
      const pharmacyId = getPharmacyId(req);
      const id = parseInt(req.params.id, 10);
      if (!id) return res.status(400).json({ success: false, message: 'Invalid id' });

      const item = await InventoryItem.update(id, pharmacyId, req.body || {});
      if (!item) return res.status(404).json({ success: false, message: 'Inventory item not found' });
      res.json({ success: true, data: { item } });
    } catch (err) {
      console.error('inventory.update error:', err);
      if (err.code === '23505') {
        return res.status(409).json({
          success: false,
          message: 'An item with this SKU already exists for your pharmacy.',
        });
      }
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * Body: { delta: integer (may be negative), reason: string, notes?, related_order_id? }
   */
  static async adjust(req, res) {
    try {
      const pharmacyId = getPharmacyId(req);
      const actorId = req.user && req.user.id;
      const id = parseInt(req.params.id, 10);
      if (!id) return res.status(400).json({ success: false, message: 'Invalid id' });

      const { delta, reason, notes, related_order_id } = req.body || {};
      if (delta == null || !Number.isInteger(Number(delta))) {
        return res.status(400).json({
          success: false, message: 'delta (integer) is required',
        });
      }
      if (!reason) {
        return res.status(400).json({
          success: false,
          message: `reason is required. Allowed: ${InventoryItem.ADJUSTMENT_REASONS.join(', ')}`,
        });
      }

      const result = await InventoryItem.adjust({
        id,
        pharmacy_id: pharmacyId,
        delta: parseInt(delta, 10),
        reason,
        actor_id: actorId,
        related_order_id: related_order_id || null,
        notes: notes || null,
      });

      res.json({ success: true, data: result });
    } catch (err) {
      console.error('inventory.adjust error:', err);
      if (/not found/i.test(err.message)) {
        return res.status(404).json({ success: false, message: err.message });
      }
      if (/Insufficient stock|Invalid|delta must/i.test(err.message)) {
        return res.status(400).json({ success: false, message: err.message });
      }
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static async listAdjustments(req, res) {
    try {
      const pharmacyId = getPharmacyId(req);
      const id = parseInt(req.params.id, 10);
      if (!id) return res.status(400).json({ success: false, message: 'Invalid id' });

      const item = await InventoryItem.findById(id, pharmacyId);
      if (!item) return res.status(404).json({ success: false, message: 'Inventory item not found' });

      const adjustments = await InventoryItem.listAdjustments(id, pharmacyId, {
        limit: req.query.limit,
        offset: req.query.offset,
      });
      res.json({ success: true, data: { adjustments } });
    } catch (err) {
      console.error('inventory.listAdjustments error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static async softDelete(req, res) {
    try {
      const pharmacyId = getPharmacyId(req);
      const id = parseInt(req.params.id, 10);
      if (!id) return res.status(400).json({ success: false, message: 'Invalid id' });

      const item = await InventoryItem.update(id, pharmacyId, { is_active: false });
      if (!item) return res.status(404).json({ success: false, message: 'Inventory item not found' });
      res.json({ success: true, data: { item } });
    } catch (err) {
      console.error('inventory.softDelete error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }
}

module.exports = InventoryController;
