// src/components/HelpWidget.tsx - FIXED
import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || 'http://localhost:5000/api';

interface QuickLink {
  title: string;
  slug: string;
  category: string;
}

const HelpWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [popularArticles, setPopularArticles] = useState<QuickLink[]>([]);
  const widgetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetchPopularArticles();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (widgetRef.current && !widgetRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const fetchPopularArticles = async () => {
    try {
      const response = await axios.get(`${API_URL}/help`, {
        params: { limit: 5 }
      });
      setPopularArticles(response.data);
    } catch (error) {
      console.error('Error fetching popular articles:', error);
    }
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

  return (
    <div ref={widgetRef} className="relative">
      {/* Help Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        aria-label="Help"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 z-50">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Need Help?
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Find answers to common questions
            </p>
          </div>

          {/* Quick Links */}
          <div className="p-4">
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              Popular Articles
            </h4>
            <div className="space-y-2">
              {popularArticles.length > 0 ? (
                popularArticles.map((article) => (
                  <Link
                    key={article.slug}
                    to={`/help/${article.slug}`}
                    onClick={() => setIsOpen(false)}
                    className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group"
                  >
                    <span className="text-lg flex-shrink-0">
                      {categoryIcons[article.category] || '📚'}
                    </span>
                    <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      {article.title}
                    </span>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  Loading articles...
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
            <Link
              to="/help"
              onClick={() => setIsOpen(false)}
              className="block w-full px-4 py-2 text-center text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            >
              View All Help Articles →
            </Link>
            
            <a
              href="mailto:Kodekalki@gmail.com"
              className="block w-full px-4 py-2 text-center text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              📧 Contact Support
            </a>
          </div>

          {/* Quick Search */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <Link
              to="/help"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Search all help articles
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default HelpWidget;