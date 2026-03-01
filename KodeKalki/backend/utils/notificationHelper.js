/**
 * notificationHelper.js
 * ─────────────────────
 * Central helper to create notifications from any route / service.
 * Import this and call one of the exported functions — it handles
 * DB insert + optional socket.io real-time push.
 *
 * Usage:
 *   import { notify, notifyAdmin, notifyBroadcast } from '../utils/notificationHelper.js';
 *
 *   // Personal (one user):
 *   await notify(userId, 'potd_solved', '🎉 POTD Solved!', 'You earned 50 coins.', '/problems', { coins: 50 });
 *
 *   // All admins:
 *   await notifyAdmin('admin_new_user', '👤 New User', `${username} just registered.`);
 *
 *   // Broadcast to all users:
 *   await notifyBroadcast('problem_added', '📝 New Problem', 'A new Hard problem was added!', '/problems');
 */

import Notification from '../models/Notification.js';
import User from '../models/User.js';

let _io = null; // Will be set once via setIO()

/**
 * Call this once from index.js after creating Socket.IO server:
 *   import { setIO } from './utils/notificationHelper.js';
 *   setIO(io);
 */
export const setIO = (ioInstance) => {
  _io = ioInstance;
};

// ─── Internal emitter ─────────────────────────────────────────────────────────
const _emit = (notification) => {
  if (!_io) return;

  if (notification.recipient) {
    // Personal: emit to user's socket room
    _io.to(`user:${notification.recipient.toString()}`).emit(
      'notification:new',
      notification
    );
  } else if (notification.audience === 'admin') {
    _io.to('room:admins').emit('notification:new', notification);
  } else {
    // Broadcast to everyone
    _io.emit('notification:new', notification);
  }
};

// ─── Core creator ─────────────────────────────────────────────────────────────
const _create = async ({
  recipient = null,
  audience = 'user',
  type,
  title,
  message,
  link = null,
  metadata = {},
}) => {
  try {
    const notif = await Notification.create({
      recipient,
      audience,
      type,
      title,
      message,
      link,
      metadata,
    });
    _emit(notif);
    return notif;
  } catch (err) {
    console.error('❌ notificationHelper._create error:', err.message);
    return null;
  }
};

// ─── Public API ───────────────────────────────────────────────────────────────

/** Personal notification for a single user */
export const notify = (userId, type, title, message, link = null, metadata = {}) =>
  _create({ recipient: userId, audience: 'user', type, title, message, link, metadata });

/** Broadcast to all users */
export const notifyBroadcast = (type, title, message, link = null, metadata = {}) =>
  _create({ recipient: null, audience: 'all', type, title, message, link, metadata });

/** Notify all admins */
export const notifyAdmin = (type, title, message, link = null, metadata = {}) =>
  _create({ recipient: null, audience: 'admin', type, title, message, link, metadata });

/** Notify all users registered for a specific contest */
export const notifyContestParticipants = async (contestId, participantIds, type, title, message, link = null, metadata = {}) => {
  const results = [];
  for (const uid of participantIds) {
    const n = await _create({ recipient: uid, audience: 'user', type, title, message, link, metadata: { ...metadata, contestId } });
    if (n) results.push(n);
  }
  return results;
};
