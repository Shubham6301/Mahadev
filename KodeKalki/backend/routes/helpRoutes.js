import express from 'express';
import Help from '../models/Help.js';
import { authenticateToken } from '../middleware/auth.js';
import { notifyBroadcast } from '../utils/notificationHelper.js'; // 🔔

const router = express.Router();

// ==================== PUBLIC ROUTES ====================

// Get all published articles (with filters)
router.get('/', async (req, res) => {
  try {
    const { category, search, limit = 10 } = req.query;
    
    let query = { isPublished: true };
    
    if (category && category !== 'all') {
      query.category = category;
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
        { content: { $regex: search, $options: 'i' } }
      ];
    }
    
    const articles = await Help.find(query)
      .sort({ views: -1, order: 1 })
      .limit(parseInt(limit))
      .select('title slug category tags views createdAt');
    
    console.log(`✅ Fetched ${articles.length} articles`);
    res.json(articles);
  } catch (error) {
    console.error('❌ Error fetching articles:', error);
    res.status(500).json({ 
      message: 'Error fetching articles',
      error: error.message 
    });
  }
});

// Get single article by slug
router.get('/article/:slug', async (req, res) => {
  try {
    const slug = req.params.slug.toLowerCase().trim();
    console.log('🔍 Fetching article with slug:', slug);
    
    const article = await Help.findOne({ 
      slug: slug,
      isPublished: true 
    })
      .populate('author', 'username')
      .populate('relatedArticles', 'title slug category');
    
    if (!article) {
      console.log('❌ Article not found:', slug);
      
      // Check if article exists but is unpublished
      const unpublished = await Help.findOne({ slug: slug });
      if (unpublished) {
        return res.status(403).json({ 
          message: 'This article is not published yet' 
        });
      }
      
      // Get list of available slugs for debugging
      const availableSlugs = await Help.find({ isPublished: true })
        .select('slug title')
        .limit(10);
      
      return res.status(404).json({ 
        message: 'Article not found',
        requestedSlug: slug,
        availableSlugs: availableSlugs.map(a => ({ 
          slug: a.slug, 
          title: a.title 
        }))
      });
    }
    
    console.log('✅ Article found:', article.title);
    
    // Increment views asynchronously (don't wait)
    Help.findByIdAndUpdate(article._id, { $inc: { views: 1 } }).exec();
    
    res.json(article);
  } catch (error) {
    console.error('❌ Error fetching article:', error);
    res.status(500).json({ 
      message: 'Error fetching article',
      error: error.message 
    });
  }
});

// Record feedback
router.post('/feedback/:id', async (req, res) => {
  try {
    const { helpful } = req.body;
    const update = helpful ? { $inc: { helpful: 1 } } : { $inc: { notHelpful: 1 } };
    
    const article = await Help.findByIdAndUpdate(
      req.params.id, 
      update, 
      { new: true }
    );
    
    if (!article) {
      return res.status(404).json({ message: 'Article not found' });
    }
    
    console.log(`✅ Feedback recorded for: ${article.title}`);
    res.json({ 
      message: 'Feedback recorded', 
      helpful: article.helpful, 
      notHelpful: article.notHelpful 
    });
  } catch (error) {
    console.error('❌ Error recording feedback:', error);
    res.status(500).json({ 
      message: 'Error recording feedback',
      error: error.message 
    });
  }
});

// Get articles by category
router.get('/category/:category', async (req, res) => {
  try {
    const articles = await Help.find({
      category: req.params.category,
      isPublished: true
    })
      .sort({ order: 1, createdAt: -1 })
      .select('title slug tags views createdAt');
    
    console.log(`✅ Fetched ${articles.length} articles for category: ${req.params.category}`);
    res.json(articles);
  } catch (error) {
    console.error('❌ Error fetching category articles:', error);
    res.status(500).json({ 
      message: 'Error fetching articles',
      error: error.message 
    });
  }
});

// Search articles
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({ message: 'Search query required' });
    }
    
    const articles = await Help.find({
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { tags: { $in: [new RegExp(q, 'i')] } },
        { content: { $regex: q, $options: 'i' } }
      ],
      isPublished: true
    })
      .limit(20)
      .select('title slug category tags views');
    
    console.log(`✅ Search for "${q}" found ${articles.length} articles`);
    res.json(articles);
  } catch (error) {
    console.error('❌ Error searching articles:', error);
    res.status(500).json({ 
      message: 'Error searching articles',
      error: error.message 
    });
  }
});

// ==================== ADMIN ROUTES ====================

// Get all articles including unpublished (admin only)
router.get('/admin/all', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const articles = await Help.find()
      .sort({ category: 1, order: 1, createdAt: -1 })
      .populate('author', 'username');
    
    console.log(`✅ Admin fetched ${articles.length} articles`);
    res.json(articles);
  } catch (error) {
    console.error('❌ Error fetching articles:', error);
    res.status(500).json({ 
      message: 'Error fetching articles',
      error: error.message 
    });
  }
});

// Create new article (admin only)
router.post('/admin/create', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Create article - author field is optional now
    const articleData = {
      ...req.body,
      lastUpdated: Date.now()
    };
    
    // Only add author if available
    if (req.user && req.user.userId) {
      articleData.author = req.user.userId;
    }
    
    const article = new Help(articleData);
    await article.save();
    
    console.log('✅ Article created:', article.title, '| Slug:', article.slug);

    // 🔔 Notify all users — new help article (only if published)
    if (article.isPublished) {
      notifyBroadcast(
        'help_article_added',
        '📖 New Help Article',
        `"${article.title}" is now available in Help Center`,
        `/help/${article.slug}`,
        { articleId: article._id, slug: article.slug }
      ).catch(() => {});
    }

    res.status(201).json(article);
  } catch (error) {
    console.error('❌ Error creating article:', error);
    
    // Handle duplicate slug error
    if (error.code === 11000) {
      return res.status(400).json({ 
        message: 'An article with this title already exists. Please use a different title.',
        error: 'Duplicate slug'
      });
    }
    
    res.status(500).json({ 
      message: 'Error creating article', 
      error: error.message 
    });
  }
});

// Update article (admin only)
router.put('/admin/update/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const article = await Help.findByIdAndUpdate(
      req.params.id,
      { 
        ...req.body, 
        lastUpdated: Date.now() 
      },
      { new: true, runValidators: true }
    );
    
    if (!article) {
      return res.status(404).json({ message: 'Article not found' });
    }
    
    console.log('✅ Article updated:', article.title);
    res.json(article);
  } catch (error) {
    console.error('❌ Error updating article:', error);
    
    // Handle duplicate slug error
    if (error.code === 11000) {
      return res.status(400).json({ 
        message: 'An article with this title already exists.',
        error: 'Duplicate slug'
      });
    }
    
    res.status(500).json({ 
      message: 'Error updating article',
      error: error.message 
    });
  }
});

// Delete article (admin only)
router.delete('/admin/delete/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const article = await Help.findByIdAndDelete(req.params.id);
    
    if (!article) {
      return res.status(404).json({ message: 'Article not found' });
    }
    
    console.log('✅ Article deleted:', article.title);
    res.json({ 
      message: 'Article deleted successfully',
      deletedArticle: {
        id: article._id,
        title: article.title
      }
    });
  } catch (error) {
    console.error('❌ Error deleting article:', error);
    res.status(500).json({ 
      message: 'Error deleting article',
      error: error.message 
    });
  }
});

// Get article stats (admin only)
router.get('/admin/stats', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const stats = await Help.aggregate([
      {
        $group: {
          _id: null,
          totalArticles: { $sum: 1 },
          publishedArticles: {
            $sum: { $cond: ['$isPublished', 1, 0] }
          },
          totalViews: { $sum: '$views' },
          totalHelpful: { $sum: '$helpful' },
          totalNotHelpful: { $sum: '$notHelpful' }
        }
      }
    ]);
    
    const categoryStats = await Help.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          views: { $sum: '$views' }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    res.json({
      overall: stats[0] || {},
      byCategory: categoryStats
    });
  } catch (error) {
    console.error('❌ Error fetching stats:', error);
    res.status(500).json({ 
      message: 'Error fetching stats',
      error: error.message 
    });
  }
});

export default router;
