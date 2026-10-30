const DoctorNotification = require('../models/DoctorNotification');

/**
 * The signed-in doctor's inbox: /api/users/doctor/notifications.
 */
class DoctorNotificationController {
  static async list(req, res) {
    try {
      const doctorId = req.user.id;
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
      const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
      const unreadOnly = req.query.unread === 'true';

      const [notifications, unreadCount] = await Promise.all([
        DoctorNotification.listForDoctor(doctorId, { limit, offset, unreadOnly }),
        DoctorNotification.unreadCount(doctorId),
      ]);

      res.json({ success: true, data: { notifications, unreadCount } });
    } catch (error) {
      console.error('Error listing doctor notifications:', error);
      res.status(500).json({ success: false, message: 'Error loading notifications' });
    }
  }

  /** Body { read: false } marks it unread again; anything else marks it read. */
  static async setRead(req, res) {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ success: false, message: 'Invalid notification id' });
      }
      const read = req.body?.read !== false;
      const notification = await DoctorNotification.setRead(id, req.user.id, read);
      if (!notification) {
        return res.status(404).json({ success: false, message: 'Notification not found' });
      }
      res.json({ success: true, data: notification });
    } catch (error) {
      console.error('Error updating doctor notification:', error);
      res.status(500).json({ success: false, message: 'Error updating notification' });
    }
  }

  static async markAllRead(req, res) {
    try {
      const updated = await DoctorNotification.markAllRead(req.user.id);
      res.json({ success: true, data: { updated } });
    } catch (error) {
      console.error('Error marking doctor notifications read:', error);
      res.status(500).json({ success: false, message: 'Error updating notifications' });
    }
  }

  static async remove(req, res) {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ success: false, message: 'Invalid notification id' });
      }
      const removed = await DoctorNotification.remove(id, req.user.id);
      if (!removed) {
        return res.status(404).json({ success: false, message: 'Notification not found' });
      }
      res.json({ success: true, data: { id } });
    } catch (error) {
      console.error('Error deleting doctor notification:', error);
      res.status(500).json({ success: false, message: 'Error deleting notification' });
    }
  }
}

module.exports = DoctorNotificationController;
