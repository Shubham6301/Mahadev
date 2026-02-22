// src/pages/Help.tsx - FIXED VERSION
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useTheme } from '../contexts/ThemeContext';

const API_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || 'http://localhost:5000/api';

interface Article {
  _id: string;
  title: string;
  slug: string;
  category: string;
  tags: string[];
  views: number;
  createdAt: string;
}

const categoryLabels: Record<string, string> = {
  'getting-started': 'Getting Started',
  'problems': 'Problems',
  'contests': 'Contests',
  'mcq': 'MCQ',
  'rapid-fire': 'Rapid Fire',
  'potd': 'Problem of the Day',
  'profile': 'Profile',
  'general': 'General'
};

const categoryIcons: Record<string, string> = {
  'getting-started': '🚀',
  'problems': '💻',
  'contests': '🏆',
  'mcq': '📝',
  'rapid-fire': '⚡',
  'potd': '📅',
  'profile': '👤',
  'general': '📚'
};

const Help: React.FC = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [filteredArticles, setFilteredArticles] = useState<Article[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const { isDark } = useTheme(); // ✅ Correct: destructure isDark from useTheme()

  // Fetch articles from backend
  useEffect(() => {
    fetchArticles();
  }, []);

  // Filter articles when category or search changes
  useEffect(() => {
    filterArticles();
  }, [selectedCategory, searchQuery, articles]);

  const fetchArticles = async () => {
    try {
      setLoading(true);
      setError('');
      console.log('📥 Fetching articles from:', `${API_URL}/help`);
      
      const response = await axios.get<Article[]>(`${API_URL}/help`, {
        params: { limit: 100 } // Fetch all articles
      });
      
      console.log('✅ Fetched articles:', response.data.length);
      setArticles(response.data);
      setFilteredArticles(response.data);
    } catch (err) {
      console.error('❌ Error fetching articles:', err);
      setError('Failed to load help articles. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const filterArticles = () => {
    let filtered = [...articles];

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(a => a.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(a =>
        a.title.toLowerCase().includes(query) ||
        a.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    setFilteredArticles(filtered);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    filterArticles();
  };

  return (
    <div
      className={
        `min-h-screen relative overflow-hidden transition-colors duration-300 ` +
        (isDark
          ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white'
          : 'bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900')
      }
    >
      {/* Soft blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {isDark ? (
          <>
            <div className="absolute -top-24 -left-16 w-80 h-80 bg-gradient-to-br from-blue-500/35 via-indigo-500/25 to-purple-500/25 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-[-6rem] right-[-4rem] w-96 h-96 bg-gradient-to-tr from-emerald-400/25 via-cyan-500/25 to-blue-500/25 rounded-full blur-3xl animate-[pulse_10s_ease-in-out_infinite]" />
            <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-gradient-to-br from-pink-500/20 to-amber-400/20 rounded-full blur-2xl" />
          </>
        ) : (
          <>
            <div className="absolute -top-24 -left-16 w-80 h-80 bg-gradient-to-br from-blue-300/35 via-indigo-300/25 to-purple-300/25 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-[-6rem] right-[-4rem] w-96 h-96 bg-gradient-to-tr from-emerald-300/25 via-cyan-300/25 to-blue-300/25 rounded-full blur-3xl animate-[pulse_10s_ease-in-out_infinite]" />
            <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-gradient-to-br from-pink-300/20 to-amber-300/20 rounded-full blur-2xl" />
          </>
        )}
      </div>

      {/* Particles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-40">
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            className={
              'absolute w-1 h-1 rounded-full animate-[float_5s_ease-in-out_infinite] ' +
              (isDark ? 'bg-slate-500' : 'bg-slate-300')
            }
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`
            }}
          />
        ))}
      </div>

      <div className="relative z-10 py-10 sm:py-12 lg:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Hero */}
          <div className="text-center mb-10 lg:mb-12">
            <div
              className={
                'inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4 border backdrop-blur-md ' +
                (isDark
                  ? 'bg-slate-900/80 border-slate-700 text-blue-200'
                  : 'bg-white/80 border-slate-200 text-blue-600')
              }
            >
              <span className="text-lg">🛟</span>
              <span className="text-[11px] sm:text-xs font-semibold tracking-wide uppercase">
                KodeKalki Help Center
              </span>
            </div>
            <h1
              className={
                'text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight mb-3 leading-tight ' +
                (isDark ? 'text-white' : 'text-slate-900')
              }
            >
              Get unstuck{' '}
              <span className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                in seconds
              </span>
            </h1>
          </div>

          {/* Search */}
          <div className="mb-8 max-w-2xl mx-auto">
            <form onSubmit={handleSearch}>
              <div className="relative group">
                <div
                  className={
                    'absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-400/35 via-purple-400/25 to-pink-400/25 blur-xl opacity-40 group-focus-within:opacity-70 transition-opacity'
                  }
                />
                <div
                  className={
                    'relative flex items-center rounded-2xl border px-4 sm:px-5 py-3 sm:py-3.5 backdrop-blur-xl shadow-md ' +
                    (isDark
                      ? 'border-slate-700 bg-slate-900/90'
                      : 'border-slate-200 bg-white/90')
                  }
                >
                  <svg
                    className={
                      'h-5 w-5 mr-3 flex-shrink-0 ' +
                      (isDark ? 'text-slate-400' : 'text-slate-400')
                    }
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search: contests, streak, submissions, profile..."
                    className={
                      'w-full bg-transparent outline-none text-sm sm:text-base ' +
                      (isDark
                        ? 'text-white placeholder:text-slate-500'
                        : 'text-slate-900 placeholder:text-slate-400')
                    }
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className={
                        'ml-2 text-xs ' +
                        (isDark
                          ? 'text-slate-400 hover:text-slate-200'
                          : 'text-slate-400 hover:text-slate-700')
                      }
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>

          {/* Category pills */}
          <div className="mb-10 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => setSelectedCategory('all')}
              className={
                'px-5 py-2.5 rounded-full text-xs sm:text-sm font-medium flex items-center gap-2 transition-all border ' +
                (selectedCategory === 'all'
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white border-transparent shadow-lg scale-[1.03]'
                  : isDark
                  ? 'bg-slate-900/90 text-slate-200 border-slate-700 hover:bg-slate-800 hover:border-blue-400/70'
                  : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-blue-400/70')
              }
            >
              <span className="text-base">✨</span>
              All Articles
            </button>

            {Object.keys(categoryLabels).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={
                  'px-5 py-2.5 rounded-full text-xs sm:text-sm font-medium flex items-center gap-2 transition-all border ' +
                  (selectedCategory === cat
                    ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white border-transparent shadow-lg scale-[1.03]'
                    : isDark
                    ? 'bg-slate-900/90 text-slate-200 border-slate-700 hover:bg-slate-800 hover:border-blue-400/70'
                    : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-blue-400/70')
                }
              >
                <span className="text-base">{categoryIcons[cat]}</span>
                {categoryLabels[cat]}
              </button>
            ))}
          </div>

          {/* Content states */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="relative">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-blue-500 text-lg">?</span>
                </div>
              </div>
              <p className={isDark ? 'text-slate-400 text-sm' : 'text-slate-500 text-sm'}>
                Loading help articles...
              </p>
            </div>
          ) : error ? (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">⚠️</div>
              <h3 className={`text-2xl font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {error}
              </h3>
              <button
                onClick={fetchArticles}
                className="mt-4 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
              >
                Retry
              </button>
            </div>
          ) : filteredArticles.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">🔍</div>
              <h3
                className={
                  'text-2xl font-semibold mb-2 ' +
                  (isDark ? 'text-white' : 'text-slate-900')
                }
              >
                No articles found
              </h3>
              <p
                className={
                  'text-sm sm:text-base ' +
                  (isDark ? 'text-slate-400' : 'text-slate-500')
                }
              >
                Try a different category or search term.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7 lg:gap-8">
              {filteredArticles.map((article) => {
                const viewsText =
                  article.views === 1
                    ? '1 view'
                    : `${article.views.toLocaleString()} views`;
                const isPopular = article.views >= 3000;

                return (
                  <Link
                    key={article._id}
                    to={`/help/${article.slug}`}
                    className={
                      'group relative block rounded-2xl border p-5 sm:p-6 shadow-md transition-all duration-300 overflow-hidden ' +
                      (isDark
                        ? 'border-slate-700 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 hover:shadow-xl hover:border-blue-400/80'
                        : 'border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 hover:shadow-xl hover:border-blue-400/70')
                    }
                  >
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-400/20 via-purple-400/15 to-pink-400/15 opacity-0 group-hover:opacity-100 blur-2xl transition-opacity duration-300" />
                    <div className="relative">
                      <div className="flex items-start gap-4 mb-4">
                        <div
                          className={
                            'flex items-center justify-center w-12 h-12 rounded-xl text-2xl shadow-sm ' +
                            (isDark
                              ? 'bg-gradient-to-br from-blue-500/30 via-indigo-500/30 to-purple-500/30'
                              : 'bg-gradient-to-br from-blue-100 via-indigo-100 to-purple-100')
                          }
                        >
                          {categoryIcons[article.category] || '📘'}
                        </div>
                        <div>
                          <h3
                            className={
                              'text-lg sm:text-xl font-semibold transition-colors line-clamp-2 ' +
                              (isDark
                                ? 'text-white group-hover:text-blue-200'
                                : 'text-slate-900 group-hover:text-blue-600')
                            }
                          >
                            {article.title}
                          </h3>
                          <span
                            className={
                              'inline-flex mt-2 px-3 py-1 text-[11px] font-medium rounded-full border ' +
                              (isDark
                                ? 'bg-blue-500/10 text-blue-100 border-blue-400/40'
                                : 'bg-blue-50 text-blue-700 border-blue-200')
                            }
                          >
                            {categoryLabels[article.category]}
                          </span>
                        </div>
                      </div>

                      {article.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-4">
                          {article.tags.map((tag) => (
                            <span
                              key={tag}
                              className={
                                'text-[11px] px-2 py-1 rounded-full border ' +
                                (isDark
                                  ? 'bg-slate-800/80 text-slate-200 border-slate-600/80'
                                  : 'bg-slate-100 text-slate-700 border-slate-200')
                              }
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs sm:text-sm">
                        <span className="flex items-center gap-1">
                          <svg
                            className={
                              'w-4 h-4 ' +
                              (isDark ? 'text-slate-400' : 'text-slate-400')
                            }
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                          </svg>
                          <span
                            className={
                              isPopular
                                ? isDark
                                  ? 'text-blue-300 font-semibold'
                                  : 'text-blue-600 font-semibold'
                                : isDark
                                ? 'text-slate-300'
                                : 'text-slate-500'
                            }
                          >
                            {viewsText}
                          </span>
                        </span>
                        <span
                          className={
                            'font-medium flex items-center gap-1 group-hover:translate-x-0.5 transition-transform ' +
                            (isDark ? 'text-blue-300' : 'text-blue-600')
                          }
                        >
                          Read article →
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Help;