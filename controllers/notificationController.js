const Notification = require('../models/Notification');
const NotificationPreferences = require('../models/NotificationPreferences');
const DeviceToken = require('../models/DeviceToken');

/**
 * NotificationController - patient-facing inbox + settings endpoints.
 * All routes require an authenticated patient.
 */

function getPatientId(req) {
  // userController.login signs JWTs with the patient id under `id` (and role 'patient').
  return req.user && (req.user.id || req.user.userId || req.user.patientId);
}

class NotificationController {
  /**
   * GET /api/notifications
   * Query: ?type=medication|prescription|appointment|message
   *        ?limit=50&offset=0
   * Returns notifications (newest first) and the unread count.
   */
  static async list(req, res) {
    try {
      const patientId = getPatientId(req);
      const { type } = req.query;
      const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
      const offset = parseInt(req.query.offset, 10) || 0;

      if (type && !Notification.VALID_TYPES.includes(type)) {
        return res.status(400).json({
          success: false,
          message: `Invalid type. Allowed: ${Notification.VALID_TYPES.join(', ')}`,
        });
      }

      const [items, unreadCount] = await Promise.all([
        Notification.listForPatient(patientId, { type: type || null, limit, offset }),
        Notification.unreadCount(patientId),
      ]);

      res.json({
        success: true,
        data: {
          notifications: items,
          unreadCount,
          pagination: { limit, offset, returned: items.length },
        },
      });
    } catch (err) {
      console.error('list notifications error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * PATCH /api/notifications/:id/read
   * Marks a single notification as read. Patient must own it.
   */
  static async markRead(req, res) {
    try {
      const patientId = getPatientId(req);
      const id = parseInt(req.params.id, 10);
      if (!id) return res.status(400).json({ success: false, message: 'Invalid id' });

      const updated = await Notification.markRead(id, patientId);
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Notification not found' });
      }
      const unreadCount = await Notification.unreadCount(patientId);
      res.json({ success: true, data: { notification: updated, unreadCount } });
    } catch (err) {
      console.error('markRead error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * PATCH /api/notifications/read-all
   * Bonus: mark every notification read.
   */
  static async markAllRead(req, res) {
    try {
      const patientId = getPatientId(req);
      const count = await Notification.markAllRead(patientId);
      res.json({ success: true, data: { updated: count, unreadCount: 0 } });
    } catch (err) {
      console.error('markAllRead error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * GET /api/notifications/settings
   * Returns the patient's preferences row.
   */
  static async getSettings(req, res) {
    try {
      const patientId = getPatientId(req);
      const prefs = await NotificationPreferences.get(patientId);
      res.json({ success: true, data: { preferences: prefs } });
    } catch (err) {
      console.error('getSettings error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * PUT /api/notifications/settings
   * Body: full preferences object (any subset of the columns).
   */
  static async updateSettings(req, res) {
    try {
      const patientId = getPatientId(req);
      const prefs = await NotificationPreferences.update(patientId, req.body || {});
      res.json({
        success: true,
        message: 'Preferences updated',
        data: { preferences: prefs },
      });
    } catch (err) {
      console.error('updateSettings error:', err);
      res.status(400).json({ success: false, message: err.message });
    }
  }

  /**
   * POST /api/notifications/device-token
   * Body: { token, platform: 'ios' | 'android' }
   * Called by the mobile app after the user grants notification permission.
   */
  static async registerDeviceToken(req, res) {
    try {
      const patientId = getPatientId(req);
      const { token, platform } = req.body || {};
      if (!token || !platform) {
        return res.status(400).json({
          success: false,
          message: 'token and platform are required',
        });
      }
      const row = await DeviceToken.register(patientId, token, platform);
      res.json({ success: true, data: { device: row } });
    } catch (err) {
      console.error('registerDeviceToken error:', err);
      res.status(400).json({ success: false, message: err.message });
    }
  }

  /**
   * DELETE /api/notifications/device-token
   * Body: { token }
   * Called on logout or when the OS revokes the token.
   */
  static async removeDeviceToken(req, res) {
    try {
      const { token } = req.body || {};
      if (!token) return res.status(400).json({ success: false, message: 'token required' });
      await DeviceToken.remove(token);
      res.json({ success: true });
    } catch (err) {
      console.error('removeDeviceToken error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }
}

module.exports = NotificationController;
