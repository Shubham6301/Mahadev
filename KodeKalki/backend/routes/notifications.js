/**
 * routes/notifications.js
 * ────────────────────────
 * REST endpoints for the notification system.
 *
 * Mounted at /api/notifications in index.js
 */

import express from 'express';
import Notification from '../models/Notification.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// ─── Helper: build query for "what this user can see" ────────────────────────
const userQuery = (userId, role) => ({
  deletedByAdmin: false,
  $or: [
    { recipient: userId },                                     // personal
    { recipient: null, audience: 'all' },                     // broadcast to all
    ...(role === 'admin'
      ? [{ recipient: null, audience: 'admin' }]              // admin broadcasts
      : []),
  ],
});

// ─── GET /api/notifications  ─────────────────────────────────────────────────
// Fetch paginated notifications for the logged-in user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    const userId = req.user._id;
    const role   = req.user.role;

    const query = userQuery(userId, role);
    if (unreadOnly === 'true') query.isRead = false;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
      Notification.countDocuments(query),
      Notification.countDocuments({ ...userQuery(userId, role), isRead: false }),
    ]);

    res.json({ success: true, notifications, total, unreadCount, page: Number(page) });
  } catch (err) {
    console.error('❌ GET /notifications error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─── GET /api/notifications/unread-count ─────────────────────────────────────
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      ...userQuery(req.user._id, req.user.role),
      isRead: false,
    });
    res.json({ success: true, count });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─── PATCH /api/notifications/:id/read ────────────────────────────────────────
// Mark a single notification as read
router.patch('/:id/read', authenticateToken, async (req, res) => {
  try {
    const notif = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        deletedByAdmin: false,
        $or: [
          { recipient: req.user._id },
          { recipient: null },
        ],
      },
      { isRead: true },
      { new: true }
    );
    if (!notif) return res.status(404).json({ message: 'Notification not found' });
    res.json({ success: true, notification: notif });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─── PATCH /api/notifications/read-all ────────────────────────────────────────
// Mark all of this user's notifications as read
router.patch('/read-all', authenticateToken, async (req, res) => {
  try {
    await Notification.updateMany(
      {
        ...userQuery(req.user._id, req.user.role),
        isRead: false,
      },
      { isRead: true }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─── DELETE /api/notifications/:id  (user-side delete = mark read) ───────────
// Users can dismiss a notification (mark read); actual removal is admin-only
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const notif = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        $or: [{ recipient: req.user._id }, { recipient: null }],
        deletedByAdmin: false,
      },
      { isRead: true },
      { new: true }
    );
    if (!notif) return res.status(404).json({ message: 'Notification not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  ADMIN ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GET /api/notifications/admin/all ──────────────────────────────────────────
// Admin sees ALL notifications in the system
router.get('/admin/all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 30, type, audience } = req.query;
    const filter = {};
    if (type)     filter.type     = type;
    if (audience) filter.audience = audience;

    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .populate('recipient', 'username email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
      Notification.countDocuments(filter),
    ]);
    res.json({ success: true, notifications, total });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─── POST /api/notifications/admin/broadcast ───────────────────────────────────
// Admin manually sends a broadcast notification
router.post('/admin/broadcast', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { type = 'announcement', title, message, link, audience = 'all', metadata } = req.body;
    if (!title || !message)
      return res.status(400).json({ message: 'title and message are required' });

    const { notifyBroadcast, notifyAdmin } = await import('../utils/notificationHelper.js');
    const notif = audience === 'admin'
      ? await notifyAdmin(type, title, message, link, metadata)
      : await notifyBroadcast(type, title, message, link, metadata);

    res.json({ success: true, notification: notif });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─── DELETE /api/notifications/admin/:id ───────────────────────────────────────
// Admin hard-deletes (soft) a notification — hides it from all users
router.delete('/admin/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const notif = await Notification.findByIdAndUpdate(
      req.params.id,
      { deletedByAdmin: true },
      { new: true }
    );
    if (!notif) return res.status(404).json({ message: 'Notification not found' });
    res.json({ success: true, message: 'Notification hidden from all users' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─── DELETE /api/notifications/admin/clear-old ─────────────────────────────────
// Admin clears notifications older than N days
router.delete('/admin/clear-old', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const days = Number(req.query.days) || 30;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result = await Notification.deleteMany({ createdAt: { $lt: cutoff } });
    res.json({ success: true, deleted: result.deletedCount });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

export default router;
