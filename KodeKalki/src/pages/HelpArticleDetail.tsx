// src/pages/HelpArticleDetail.tsx - FIXED THEME BUG

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios, { AxiosError } from 'axios';
import { useTheme } from '../contexts/ThemeContext';

const API_URL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, '') || 'http://localhost:5000/api';

interface Article {
  _id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  helpful: number;
  notHelpful: number;
  views: number;
  author?: { username: string };
  relatedArticles?: Array<{ _id: string; title: string; slug: string; category: string }>;
  createdAt: string;
  lastUpdated: string;
}

const categoryLabels: Record<string, string> = {
  'getting-started': 'Getting Started',
  problems: 'Problems',
  contests: 'Contests',
  mcq: 'MCQ',
  'rapid-fire': 'Rapid Fire',
  potd: 'Problem of the Day',
  profile: 'Profile',
  general: 'General',
};

const categoryIcons: Record<string, string> = {
  'getting-started': '🚀',
  problems: '💻',
  contests: '🏆',
  mcq: '📝',
  'rapid-fire': '⚡',
  potd: '📅',
  profile: '👤',
  general: '📚',
};

const HelpArticleDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [suggestedArticles, setSuggestedArticles] = useState<
    Array<{ slug: string; title: string }>
  >([]);
  const [feedbackSent, setFeedbackSent] = useState<boolean>(false);

  const { isDark } = useTheme(); // ✅ FIXED: Now correctly destructures isDark

  useEffect(() => {
    if (slug) fetchArticle();
  }, [slug]);

  const fetchArticle = async () => {
    if (!slug) {
      setError('No article slug provided.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setSuggestedArticles([]);

    try {
      console.log('🔍 Fetching article:', slug);
      const response = await axios.get<Article>(
        `${API_URL}/help/article/${slug}`
      );
      setArticle(response.data);
    } catch (err) {
      const axiosError = err as AxiosError<any>;
      console.error('❌ Failed to fetch article:', axiosError.message);

      if (axiosError.response?.status === 404) {
        const data = axiosError.response?.data;
        const msg = data?.message || 'Article not found.';
        const suggestions = data?.availableSlugs || [];

        setError(msg);
        if (Array.isArray(suggestions) && suggestions.length > 0) {
          setSuggestedArticles(suggestions);
        }
      } else if (axiosError.response?.status === 403) {
        setError('This article is not published yet.');
      } else {
        setError('Something went wrong. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async (helpful: boolean) => {
    if (!article || feedbackSent) return;

    try {
      await axios.post(`${API_URL}/help/feedback/${article._id}`, { helpful });
      setFeedbackSent(true);
      setArticle(prev =>
        prev
          ? {
              ...prev,
              helpful: helpful ? prev.helpful + 1 : prev.helpful,
              notHelpful: !helpful ? prev.notHelpful + 1 : prev.notHelpful,
            }
          : null
      );
    } catch (err) {
      console.error('Feedback failed:', err);
      alert('Could not submit feedback.');
    }
  };

  if (loading) {
    return (
      <div
        className={
          'min-h-screen flex items-center justify-center transition-colors duration-300 ' +
          (isDark ? 'bg-slate-950 text-white' : 'bg-gray-50 text-slate-900')
        }
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-600 mx-auto mb-4" />
          <p className={isDark ? 'text-gray-300 text-xl' : 'text-gray-600 text-xl'}>
            Loading article...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={
          'min-h-screen flex items-center justify-center px-4 transition-colors duration-300 ' +
          (isDark ? 'bg-slate-950 text-white' : 'bg-gray-50 text-slate-900')
        }
      >
        <div
          className={
            'text-center max-w-2xl rounded-3xl p-8 sm:p-10 shadow-2xl border ' +
            (isDark
              ? 'bg-slate-900/80 border-slate-700'
              : 'bg-white/90 border-slate-200')
          }
        >
          <div className="text-8xl mb-6">😕</div>
          <h1
            className={
              'text-3xl sm:text-4xl font-bold mb-4 ' +
              (isDark ? 'text-white' : 'text-gray-900')
            }
          >
            {error}
          </h1>
          <p
            className={
              'text-lg mb-8 ' +
              (isDark ? 'text-gray-300' : 'text-gray-600')
            }
          >
            We couldn&apos;t find the article you&apos;re looking for.
          </p>

          {suggestedArticles.length > 0 && (
            <div
              className={
                'mb-8 p-6 rounded-2xl shadow-lg border text-left ' +
                (isDark
                  ? 'bg-slate-900/80 border-slate-700'
                  : 'bg-gray-50 border-slate-200')
              }
            >
              <p
                className={
                  'text-lg font-semibold mb-4 ' +
                  (isDark ? 'text-white' : 'text-gray-900')
                }
              >
                Maybe you meant one of these?
              </p>
              <div className="space-y-3">
                {suggestedArticles.map(item => (
                  <Link
                    key={item.slug}
                    to={`/help/${item.slug}`}
                    className={
                      'block p-4 rounded-xl transition ' +
                      (isDark
                        ? 'bg-slate-800 hover:bg-slate-700 text-gray-100'
                        : 'bg-white hover:bg-slate-100 text-gray-900 border border-slate-200')
                    }
                  >
                    <span className="font-medium">{item.title}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <Link
            to="/help"
            className={
              'inline-flex items-center px-8 py-4 rounded-2xl text-lg font-medium transition shadow-lg ' +
              (isDark
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white')
            }
          >
            <svg
              className="w-6 h-6 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Help Center
          </Link>
        </div>
      </div>
    );
  }

  if (!article) return null;

  const viewsText =
    article.views === 1
      ? '1 view'
      : `${article.views.toLocaleString()} views`;

  return (
    <div
      className={
        'min-h-screen py-12 transition-colors duration-300 ' +
        (isDark
          ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white'
          : 'bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900')
      }
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="mb-8">
          <Link
            to="/help"
            className={
              'inline-flex items-center text-lg font-medium transition ' +
              (isDark
                ? 'text-blue-300 hover:text-blue-200'
                : 'text-blue-600 hover:text-blue-800')
            }
          >
            <svg
              className="w-6 h-6 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Help Center
          </Link>
        </nav>

        {/* Card wrapper */}
        <article
          className={
            'rounded-3xl shadow-2xl overflow-hidden border transition-colors duration-300 ' +
            (isDark
              ? 'bg-slate-900/90 border-slate-800'
              : 'bg-white border-slate-200')
          }
        >
          {/* Top gradient strip */}
          <div
            className={
              'h-2 w-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500'
            }
          />

          <div className="p-6 sm:p-10 lg:p-14">
            {/* Icon + category */}
            <div className="flex items-center gap-6 mb-8">
              <span className="text-5xl sm:text-6xl">
                {categoryIcons[article.category] || '📄'}
              </span>
              <div
                className={
                  'px-4 py-2 text-sm sm:text-base font-bold rounded-full border ' +
                  (isDark
                    ? 'bg-blue-500/10 border-blue-400/50 text-blue-100'
                    : 'bg-blue-50 border-blue-200 text-blue-800')
                }
              >
                {categoryLabels[article.category] || article.category}
              </div>
            </div>

            {/* Title */}
            <h1
              className={
                'text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-8 leading-tight ' +
                (isDark ? 'text-white' : 'text-gray-900')
              }
            >
              {article.title}
            </h1>

            {/* Meta info */}
            <div
              className={
                'flex flex-wrap gap-6 text-sm sm:text-base mb-10 ' +
                (isDark ? 'text-gray-300' : 'text-gray-600')
              }
            >
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                <span>{article.author?.username || 'KodeKalki Team'}</span>
              </div>

              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
                <span>
                  {viewsText}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>
                  Updated {new Date(article.lastUpdated).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Tags */}
            {article.tags.length > 0 && (
              <div className="flex flex-wrap gap-3 mb-10">
                {article.tags.map(tag => (
                  <span
                    key={tag}
                    className={
                      'px-4 py-1.5 text-xs sm:text-sm font-semibold rounded-full border ' +
                      (isDark
                        ? 'bg-slate-800 text-gray-200 border-slate-600'
                        : 'bg-gray-100 text-gray-700 border-gray-200')
                    }
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Content */}
            <div
              className={
                'prose max-w-none leading-relaxed ' +
                (isDark ? 'prose-invert prose-headings:text-white' : '')
              }
              dangerouslySetInnerHTML={{ __html: article.content }}
            />
          </div>

          {/* Feedback */}
          <div
            className={
              'border-t px-6 sm:px-10 lg:px-14 py-10 ' +
              (isDark
                ? 'border-slate-800 bg-gradient-to-r from-slate-900 to-slate-950'
                : 'border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50')
            }
          >
            <h3
              className={
                'text-2xl sm:text-3xl font-bold mb-6 text-center ' +
                (isDark ? 'text-white' : 'text-gray-900')
              }
            >
              Was this article helpful?
            </h3>
            {feedbackSent ? (
              <p
                className={
                  'text-center text-xl font-semibold ' +
                  (isDark ? 'text-green-400' : 'text-green-600')
                }
              >
                Thank you for your feedback! 🎉
              </p>
            ) : (
              <div className="flex flex-wrap justify-center gap-6">
                <button
                  onClick={() => handleFeedback(true)}
                  className={
                    'flex flex-col items-center gap-2 px-8 py-5 rounded-2xl text-lg font-bold transition transform hover:scale-105 shadow-lg ' +
                    (isDark
                      ? 'bg-green-600 hover:bg-green-500 text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white')
                  }
                >
                  <span className="text-4xl">👍</span>
                  <span>Yes</span>
                  <span className="text-base opacity-90">
                    ({article.helpful})
                  </span>
                </button>
                <button
                  onClick={() => handleFeedback(false)}
                  className={
                    'flex flex-col items-center gap-2 px-8 py-5 rounded-2xl text-lg font-bold transition transform hover:scale-105 shadow-lg ' +
                    (isDark
                      ? 'bg-red-600 hover:bg-red-500 text-white'
                      : 'bg-red-600 hover:bg-red-700 text-white')
                  }
                >
                  <span className="text-4xl">👎</span>
                  <span>No</span>
                  <span className="text-base opacity-90">
                    ({article.notHelpful})
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Related Articles */}
          {article.relatedArticles && article.relatedArticles.length > 0 && (
            <div
              className={
                'border-t px-6 sm:px-10 lg:px-14 py-10 ' +
                (isDark ? 'border-slate-800' : 'border-gray-200')
              }
            >
              <h3
                className={
                  'text-2xl sm:text-3xl font-bold mb-8 text-center ' +
                  (isDark ? 'text-white' : 'text-gray-900')
                }
              >
                Related Articles
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                {article.relatedArticles.map(related => (
                  <Link
                    key={related._id}
                    to={`/help/${related.slug}`}
                    className={
                      'group block p-6 rounded-2xl border-2 transition shadow-lg hover:shadow-2xl ' +
                      (isDark
                        ? 'bg-slate-900 border-slate-700 hover:border-blue-400'
                        : 'bg-white border-gray-200 hover:border-blue-500')
                    }
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-4xl group-hover:scale-110 transition-transform">
                        {categoryIcons[related.category] || '📄'}
                      </span>
                      <div>
                        <h4
                          className={
                            'text-lg font-bold mb-1 transition-colors ' +
                            (isDark
                              ? 'text-white group-hover:text-blue-300'
                              : 'text-gray-900 group-hover:text-blue-600')
                          }
                        >
                          {related.title}
                        </h4>
                        <p
                          className={
                            'text-sm ' +
                            (isDark ? 'text-gray-400' : 'text-gray-500')
                          }
                        >
                          {categoryLabels[related.category] || related.category}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </article>
      </div>
    </div>
  );
};

export default HelpArticleDetail;