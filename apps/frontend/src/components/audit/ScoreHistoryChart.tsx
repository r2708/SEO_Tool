'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { LoadingSpinner } from '@/components/shared';
import type { ScoreHistory } from '@seo-saas/shared-types';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface ScoreHistoryChartProps {
  projectId: string;
}

interface ScoreHistoryResponse {
  scores: Array<{
    score: number;
    url: string;
    createdAt: string;
    scoreChange?: number | null;
  }>;
}

export default function ScoreHistoryChart({ projectId }: ScoreHistoryChartProps) {
  const [scores, setScores] = useState<ScoreHistoryResponse['scores']>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    start: '',
    end: '',
  });

  useEffect(() => {
    loadScoreHistory();
  }, [projectId, dateRange.start, dateRange.end]);

  const loadScoreHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (dateRange.start) params.append('startDate', dateRange.start);
      if (dateRange.end) params.append('endDate', dateRange.end);

      const queryString = params.toString();
      const url = `/api/audit/history/${projectId}${queryString ? `?${queryString}` : ''}`;

      const response = await apiClient.get<ScoreHistoryResponse>(url);
      setScores(response.scores);
    } catch (err: any) {
      setError(err.message || 'Failed to load score history');
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (field: 'start' | 'end', value: string) => {
    setDateRange((prev) => ({ ...prev, [field]: value }));
  };

  const handleClearFilters = () => {
    setDateRange({ start: '', end: '' });
  };

  const calculateScoreChange = () => {
    if (scores.length < 2) return null;
    
    const latestScore = scores[0].score;
    const previousScore = scores[1].score;
    const change = latestScore - previousScore;
    const percentage = ((change / previousScore) * 100).toFixed(1);
    
    return {
      change,
      percentage: parseFloat(percentage),
      isPositive: change > 0,
    };
  };

  const scoreChange = calculateScoreChange();

  // Transform data for chart
  const chartData = scores
    .slice()
    .reverse()
    .map((score) => ({
      date: new Date(score.createdAt).toLocaleDateString(),
      score: score.score,
      fullDate: score.createdAt,
    }));

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Score History</h3>
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Score History</h3>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
          <button
            onClick={loadScoreHistory}
            className="mt-2 text-red-600 hover:text-red-700 font-medium text-sm"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (scores.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Score History</h3>
        <div className="text-center py-8 text-gray-500">
          No score history available for this project yet
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Score History</h3>
        {scoreChange && (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Latest change:</span>
            <span
              className={`text-lg font-semibold ${
                scoreChange.isPositive ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {scoreChange.isPositive ? '+' : ''}
              {scoreChange.change} ({scoreChange.isPositive ? '+' : ''}
              {scoreChange.percentage}%)
            </span>
            <span className="text-2xl">
              {scoreChange.isPositive ? '📈' : '📉'}
            </span>
          </div>
        )}
      </div>

      {/* Date Range Filters */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => handleDateChange('start', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => handleDateChange('end', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        {(dateRange.start || dateRange.end) && (
          <button
            onClick={handleClearFilters}
            className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Chart */}
      <div className="pt-4">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 12 }}
              label={{ value: 'SEO Score', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#3b82f6"
              strokeWidth={3}
              dot={{ r: 5, fill: '#3b82f6' }}
              activeDot={{ r: 7 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Score List */}
      <div className="pt-4 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Recent Audits</h4>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {scores.map((score, index) => (
            <div
              key={`${score.url}-${score.createdAt}`}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {score.url}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(score.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="ml-4 flex items-center space-x-3">
                <div
                  className={`text-2xl font-bold ${
                    score.score >= 80
                      ? 'text-green-600'
                      : score.score >= 60
                      ? 'text-yellow-600'
                      : 'text-red-600'
                  }`}
                >
                  {score.score}
                </div>
                {index > 0 && (
                  <div className="text-sm">
                    {score.score > scores[index - 1].score ? (
                      <span className="text-green-600">↑</span>
                    ) : score.score < scores[index - 1].score ? (
                      <span className="text-red-600">↓</span>
                    ) : (
                      <span className="text-gray-400">→</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Custom tooltip component
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) {
    return null;
  }

  const data = payload[0].payload;
  const score = payload[0].value;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
      <p className="text-sm font-medium text-gray-900 mb-1">
        {new Date(data.fullDate).toLocaleDateString()}
      </p>
      <div className="flex items-center space-x-2">
        <span className="text-sm text-gray-700">Score:</span>
        <span
          className={`text-lg font-bold ${
            score >= 80
              ? 'text-green-600'
              : score >= 60
              ? 'text-yellow-600'
              : 'text-red-600'
          }`}
        >
          {score}
        </span>
      </div>
    </div>
  );
}
