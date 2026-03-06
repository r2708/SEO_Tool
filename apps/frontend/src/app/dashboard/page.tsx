'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { LoadingSpinner } from '@/components/shared';
import type { DashboardMetrics } from '@seo-saas/shared-types';

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.get<DashboardMetrics>('/api/dashboard');
      setMetrics(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner size="large" text="Loading dashboard..." />;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center">
          <span className="text-2xl mr-3">⚠️</span>
          <div>
            <h3 className="text-lg font-semibold text-red-900">Error Loading Dashboard</h3>
            <p className="text-red-700 mt-1">{error}</p>
            <button
              onClick={loadDashboardData}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">No data available</p>
      </div>
    );
  }

  const formatRankChange = (change: number) => {
    if (change === 0) return '0%';
    const sign = change > 0 ? '+' : '';
    return `${sign}${change.toFixed(1)}%`;
  };

  const getRankChangeColor = (change: number) => {
    if (change > 0) return 'text-green-600';
    if (change < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Overview of your SEO performance</p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Keywords */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Keywords</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {metrics.totalKeywords}
              </p>
            </div>
            <div className="text-4xl">🔑</div>
          </div>
        </div>

        {/* Average Rank */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Average Rank</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {metrics.averageRank > 0 ? metrics.averageRank.toFixed(1) : 'N/A'}
              </p>
            </div>
            <div className="text-4xl">📈</div>
          </div>
        </div>

        {/* Rank Change */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Rank Change</p>
              <p className={`text-3xl font-bold mt-2 ${getRankChangeColor(metrics.rankChange)}`}>
                {formatRankChange(metrics.rankChange)}
              </p>
            </div>
            <div className="text-4xl">
              {metrics.rankChange > 0 ? '📊' : metrics.rankChange < 0 ? '📉' : '➖'}
            </div>
          </div>
        </div>

        {/* Total Projects */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Projects</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {metrics.totalProjects}
              </p>
            </div>
            <div className="text-4xl">📁</div>
          </div>
        </div>
      </div>

      {/* Recent SEO Scores */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent SEO Scores</h2>
        </div>
        <div className="p-6">
          {metrics.recentScores.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No SEO audits performed yet
            </div>
          ) : (
            <div className="space-y-4">
              {metrics.recentScores.map((score) => (
                <div
                  key={`${score.projectId}-${score.date}`}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{score.projectName}</h3>
                    <p className="text-sm text-gray-500">
                      {new Date(score.date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900">{score.score}</div>
                      <div className="text-xs text-gray-500">SEO Score</div>
                    </div>
                    <div className="w-16 h-16">
                      <svg className="transform -rotate-90" viewBox="0 0 36 36">
                        <circle
                          cx="18"
                          cy="18"
                          r="16"
                          fill="none"
                          stroke="#e5e7eb"
                          strokeWidth="3"
                        />
                        <circle
                          cx="18"
                          cy="18"
                          r="16"
                          fill="none"
                          stroke={score.score >= 70 ? '#10b981' : score.score >= 40 ? '#f59e0b' : '#ef4444'}
                          strokeWidth="3"
                          strokeDasharray={`${score.score} 100`}
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
