// backend/models/Help.js

import mongoose from 'mongoose';

const helpSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true
  },
  content: {
    type: String,
    required: [true, 'Content is required']
  },
  category: {
    type: String,
    required: true,
    enum: ['getting-started', 'problems', 'contests', 'mcq', 'rapid-fire', 'potd', 'profile', 'general'],
    default: 'general'
  },
  tags: [{
    type: String,
    trim: true
  }],
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true
    // REMOVED required: true → we generate it automatically
  },
  order: {
    type: Number,
    default: 0
  },
  isPublished: {
    type: Boolean,
    default: true
  },
  views: {
    type: Number,
    default: 0
  },
  helpful: {
    type: Number,
    default: 0
  },
  notHelpful: {
    type: Number,
    default: 0
  },
  relatedArticles: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Help'
  }],
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Slug generation function
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')   // Remove special chars
    .trim()
    .replace(/\s+/g, '-')          // Spaces → hyphens
    .replace(/-+/g, '-')           // Multiple hyphens → single
    .substring(0, 100);            // Max length
}

// Pre-save middleware: Auto-generate slug + update lastUpdated
helpSchema.pre('save', async function(next) {
  try {
    // Always update lastUpdated
    this.lastUpdated = Date.now();

    // Generate slug if title changed OR slug doesn't exist
    if (this.isModified('title') || !this.slug) {
      let baseSlug = generateSlug(this.title);
      let slug = baseSlug;
      let counter = 1;

      // Check for duplicates safely
      while (true) {
        const query = { slug };
        if (this._id) {
          query._id = { $ne: this._id }; // Exclude current document on update
        }

        const existing = await this.constructor.findOne(query);
        if (!existing) {
          this.slug = slug;
          break;
        }

        slug = `${baseSlug}-${counter}`;
        counter++;
      }
    }

    next();
  } catch (error) {
    next(error);
  }
});

// Indexes for performance & search
helpSchema.index({ title: 'text', content: 'text', tags: 'text' });
helpSchema.index({ category: 1, order: 1 });
helpSchema.index({ slug: 1 });
helpSchema.index({ isPublished: 1, views: -1 });

const Help = mongoose.model('Help', helpSchema);

export default Help;