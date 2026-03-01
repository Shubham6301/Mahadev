import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';
import passport from 'passport';
import { notifyAdmin } from '../utils/notificationHelper.js'; // 🔔
import session from 'express-session';
import '../services/passport.js';

const router = express.Router();

// Session middleware for passport (required for OAuth)
router.use(session({
  secret: process.env.JWT_SECRET || 'secret',
  resave: false,
  saveUninitialized: false,
}));
router.use(passport.initialize());
router.use(passport.session());

// ──────────────────────────────────────────────────────────────────────────────
// GET /auth/check-username?username=xxx
// Returns { available: true/false }
// Used by Register page for real-time uniqueness check
// ──────────────────────────────────────────────────────────────────────────────
router.get('/check-username', async (req, res) => {
  try {
    const { username } = req.query;

    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      return res.status(400).json({ available: false, message: 'Username must be at least 3 characters' });
    }

    const exists = await User.findOne({
      username: { $regex: new RegExp(`^${username.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    });

    return res.json({ available: !exists });
  } catch (error) {
    console.error('check-username error:', error);
    return res.status(500).json({ available: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /auth/check-email?email=xxx
// Returns { available: true/false }
// Used by Register page for real-time existence check
// ──────────────────────────────────────────────────────────────────────────────
router.get('/check-email', async (req, res) => {
  try {
    const { email } = req.query;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ available: false, message: 'Email is required' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const emailRegex   = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({ available: false, message: 'Invalid email format' });
    }

    const exists = await User.findOne({ email: trimmedEmail });

    return res.json({ available: !exists });
  } catch (error) {
    console.error('check-email error:', error);
    return res.status(500).json({ available: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /auth/register
// ──────────────────────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  console.log('📝 Registration attempt started');
  try {
    const { username, email, password, role = 'user', googleId } = req.body;

    if (!username || !email) {
      return res.status(400).json({ message: 'Username and email are required' });
    }
    if (!googleId && !password) {
      return res.status(400).json({ message: 'Password is required' });
    }

    // ── Server-side uniqueness check (never trust only client) ───────────────
    const existingUsername = await User.findOne({
      username: { $regex: new RegExp(`^${username.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    });
    if (existingUsername) {
      return res.status(409).json({ message: 'Username is already taken' });
    }

    const existingEmail = await User.findOne({ email: email.trim().toLowerCase() });
    if (existingEmail) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    // ── Create user ───────────────────────────────────────────────────────────
    const userData = {
      username: username.trim(),
      email:    email.trim().toLowerCase(),
      password: googleId ? undefined : password,
      role:     'user',          // Registration always creates a regular user
      googleId: googleId || undefined,
      coins:    0,
      profile: {
        firstName: '', lastName: '', linkedIn: '', github: '',
        avatar: `default:${username.trim().charAt(0).toUpperCase()}`,
        bio: '', location: '', college: '', branch: '', graduationYear: null
      }
    };

    const user = new User(userData);

    try {
      await user.save();
    } catch (saveError) {
      if (saveError.code === 11000) {
        const field = Object.keys(saveError.keyPattern)[0];
        return res.status(409).json({ message: `A user with this ${field} already exists.` });
      }
      throw saveError;
    }

    // ── Generate JWT ──────────────────────────────────────────────────────────
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('✅ Registration successful for:', user.username);
    // 🔔 Notify admin — new user registered
    notifyAdmin(
      'admin_new_user',
      '👤 New User Registered',
      `${user.username} (${user.email}) just created an account.`,
      '/admin',
      { userId: user._id }
    ).catch(() => {}); // fire-and-forget
    return res.status(201).json({
      message: 'User created successfully',
      token,
      user: { id: user._id, username: user.username, email: user.email, role: user.role }
    });
  } catch (error) {
    console.error('❌ Registration error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /auth/login
// role field = 'user' or 'admin' (sent by frontend to indicate which panel)
// ──────────────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  console.log('🔐 Login attempt started');
  try {
    const { username, password, role: expectedPanel = 'user' } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    // Find by username OR email
    const user = await User.findOne({
      $or: [
        { username: { $regex: new RegExp(`^${username.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
        { email: username.trim().toLowerCase() }
      ]
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // ── Role-based Panel Guard ────────────────────────────────────────────────
    //
    //  User Panel  ('user')  → only role='user' accounts allowed
    //  Admin Panel ('admin') → only role='admin' accounts allowed
    //
    if (expectedPanel === 'admin' && user.role !== 'admin') {
      console.log(`❌ Non-admin tried to access admin panel: ${user.username}`);
      return res.status(403).json({
        message: 'Your current account does not have access to the Admin Panel'
      });
    }

    if (expectedPanel === 'user' && user.role === 'admin') {
      console.log(`❌ Admin tried to login through user panel: ${user.username}`);
      return res.status(403).json({
        message: 'Please ensure you are signing in through the correct login page'
      });
    }

    // ── Password check ────────────────────────────────────────────────────────
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      console.log('❌ Password mismatch for:', user.username);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // ── Generate JWT ──────────────────────────────────────────────────────────
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log(`✅ Login successful for: ${user.username} (role: ${user.role}, panel: ${expectedPanel})`);
    return res.json({
      message: 'Login successful',
      token,
      user: { id: user._id, username: user.username, email: user.email, role: user.role }
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /auth/me  (unchanged)
// ──────────────────────────────────────────────────────────────────────────────
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Calculate streak from submissions (IST)
    const submissions         = user.submissions || [];
    const acceptedSubmissions = submissions
      .filter(sub => sub.status === 'accepted')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    let currentStreak = 0;
    if (acceptedSubmissions.length > 0) {
      const istOffset  = 5.5 * 60;
      const now        = new Date();
      const todayIST   = new Date(now.getTime() + istOffset * 60 * 1000);
      const todayLocal = new Date(todayIST.getFullYear(), todayIST.getMonth(), todayIST.getDate());

      const submissionDates = new Set();
      acceptedSubmissions.forEach(sub => {
        const subDate = new Date(sub.date);
        const istDate = new Date(subDate.getTime() + istOffset * 60 * 1000);
        submissionDates.add(new Date(istDate.getFullYear(), istDate.getMonth(), istDate.getDate()).getTime());
      });

      const sortedDates = Array.from(submissionDates)
        .map(ts => new Date(ts))
        .sort((a, b) => b.getTime() - a.getTime());

      if (sortedDates.length > 0) {
        const daysSinceLast = Math.floor((todayLocal.getTime() - sortedDates[0].getTime()) / 86400000);
        if (daysSinceLast <= 1) {
          currentStreak = 1;
          let lastDate = sortedDates[0];
          for (let i = 1; i < sortedDates.length; i++) {
            if (Math.floor((lastDate.getTime() - sortedDates[i].getTime()) / 86400000) === 1) {
              currentStreak++;
              lastDate = sortedDates[i];
            } else break;
          }
        }
      }
    }

    if (!user.stats) {
      user.stats = {
        problemsSolved: { total: 0, easy: 0, medium: 0, hard: 0 },
        problemsAttempted: 0,
        totalSubmissions: submissions.length,
        correctSubmissions: acceptedSubmissions.length,
        accuracy: submissions.length > 0 ? (acceptedSubmissions.length / submissions.length) * 100 : 0,
        currentStreak,
        maxStreak: currentStreak,
      };
    } else {
      user.stats.currentStreak = currentStreak;
      if (currentStreak > (user.stats.maxStreak || 0)) user.stats.maxStreak = currentStreak;
    }

    await user.save();

    if (!user.profile) {
      user.profile = { firstName: '', lastName: '', linkedIn: '', github: '', avatar: `default:${user.username.charAt(0).toUpperCase()}`, bio: '', location: '', college: '', branch: '', graduationYear: null };
    } else if (!user.profile.avatar || user.profile.avatar.trim() === '') {
      user.profile.avatar = `default:${user.username.charAt(0).toUpperCase()}`;
    }

    return res.json(user);
  } catch (error) {
    console.error('❌ Get user error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// Google OAuth (unchanged)
// ──────────────────────────────────────────────────────────────────────────────
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login', session: false }),
  async (req, res) => {
    const user  = req.user;
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });
    const frontendUrl = process.env.NODE_ENV === 'production'
      ? 'https://KodeKalki.netlify.app'
      : 'https://KodeKalki.netlify.app';
    res.redirect(`${frontendUrl}/oauth?token=${encodeURIComponent(token)}`);
  }
);

export default router;
