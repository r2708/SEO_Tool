'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { apiClient } from '@/lib/api-client';
import { LoadingSpinner } from '@/components/shared';
import type { ContentScore } from '@seo-saas/shared-types';
import ContentOptimizationResults from '@/components/content/ContentOptimizationResults';

export default function ContentPage() {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [targetKeyword, setTargetKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ContentScore | null>(null);

  const isPro = user?.role === 'Pro' || user?.role === 'Admin';

  if (!isPro) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Content Optimizer</h1>
          <p className="text-gray-600 mt-1">AI-powered content optimization</p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-12 text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Pro Feature
          </h2>
          <p className="text-gray-600 mb-6">
            Upgrade to Pro to access AI-powered content optimization
          </p>
          <button className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
            Upgrade to Pro
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!content.trim()) {
      setError('Please enter content to analyze');
      return;
    }

    if (!targetKeyword.trim()) {
      setError('Please enter a target keyword');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setResult(null);

      const response = await apiClient.post<ContentScore>('/api/content/score', {
        content: content.trim(),
        targetKeyword: targetKeyword.trim(),
      });

      setResult(response);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze content');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setContent('');
    setTargetKeyword('');
    setResult(null);
    setError(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Content Optimizer</h1>
        <p className="text-gray-600 mt-1">AI-powered content optimization</p>
      </div>

      {/* Content Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="targetKeyword" className="block text-sm font-medium text-gray-700 mb-1">
              Target Keyword
            </label>
            <input
              type="text"
              id="targetKeyword"
              value={targetKeyword}
              onChange={(e) => setTargetKeyword(e.target.value)}
              placeholder="e.g., SEO optimization"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
              required
            />
          </div>

          <div>
            <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">
              Content to Analyze
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste your blog post or article content here..."
              rows={12}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              disabled={loading}
              required
            />
            <p className="text-sm text-gray-500 mt-1">
              {content.length} characters
            </p>
          </div>

          <div className="flex space-x-3">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Analyzing...' : 'Analyze Content'}
            </button>
            {result && (
              <button
                type="button"
                onClick={handleReset}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors font-medium"
              >
                New Analysis
              </button>
            )}
          </div>
        </form>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <span className="text-xl mr-2">⚠️</span>
              <p className="text-red-800">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
          <LoadingSpinner size="large" text="Analyzing content..." />
          <p className="text-gray-500 text-sm text-center mt-4">This may take a few moments</p>
        </div>
      )}

      {/* Optimization Results */}
      {result && !loading && (
        <ContentOptimizationResults result={result} targetKeyword={targetKeyword} />
      )}
    </div>
  );
}
