import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    // Recipient: null = broadcast (all users / all admins)
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // null means broadcast
    },
    // 'user' | 'admin' | 'all'
    audience: {
      type: String,
      enum: ['user', 'admin', 'all'],
      default: 'user',
    },

    type: {
      type: String,
      enum: [
        // ── User notifications ──────────────────────────────
        'announcement',          // New announcement posted
        'problem_added',         // New public problem added
        'potd_solved',           // User solved POTD → coins earned
        'contest_added',         // New contest created
        'contest_starting',      // Contest starting soon (registered users)
        'contest_status_change', // Contest status changed (registered user)
        'game_result',           // Game winner / result
        'order_update',          // Order: pending → shipped → delivered
        'help_article_added',    // New help article published

        // ── Admin notifications ──────────────────────────────
        'admin_new_order',       // Someone placed an order
        'admin_user_blocked',    // A user was blocked
        'admin_new_user',        // New user registered
        'admin_contest_registration', // User registered for a contest
        'admin_chatroom_created',     // Chat room created
        'admin_discussion_created',   // New discussion posted
        'admin_document_added',       // Document uploaded
        'admin_order_status_change',  // Order status changed (admin side)
      ],
      required: true,
    },

    title: { type: String, required: true },
    message: { type: String, required: true },

    // Optional deep-link (e.g. '/contest/abc123')
    link: { type: String, default: null },

    // Flexible metadata (problem id, contest id, order id, etc.)
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },

    isRead: { type: Boolean, default: false },

    // Allow admin to hard-delete via panel
    deletedByAdmin: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Index for fast per-user queries
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ audience: 1, isRead: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
