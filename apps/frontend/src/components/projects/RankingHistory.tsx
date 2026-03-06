'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import type { RankHistory } from '@seo-saas/shared-types';
import Pagination from '@/components/shared/Pagination';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface RankingHistoryProps {
  projectId: string;
}

export default function RankingHistory({ projectId }: RankingHistoryProps) {
  const [rankings, setRankings] = useState<RankHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedKeyword, setSelectedKeyword] = useState<string>('');
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: '',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize] = useState(50);

  useEffect(() => {
    loadRankings();
  }, [projectId, currentPage]);

  const loadRankings = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query params
      const params = new URLSearchParams();
      params.append('page', currentPage.toString());
      params.append('pageSize', pageSize.toString());
      if (selectedKeyword) params.append('keyword', selectedKeyword);
      if (dateRange.startDate) params.append('startDate', dateRange.startDate);
      if (dateRange.endDate) params.append('endDate', dateRange.endDate);

      const queryString = params.toString();
      const url = `/api/rank/history/${projectId}?${queryString}`;

      const response = await apiClient.get<{ 
        rankings: RankHistory[];
        pagination?: {
          page: number;
          pageSize: number;
          totalCount: number;
          totalPages: number;
        };
      }>(url);
      setRankings(response.rankings);
      
      // Update pagination metadata if available
      if (response.pagination) {
        setTotalPages(response.pagination.totalPages);
        setTotalCount(response.pagination.totalCount);
      } else {
        // Fallback if backend doesn't return pagination metadata yet
        setTotalPages(1);
        setTotalCount(response.rankings.length);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load ranking history');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleFilterChange = () => {
    setCurrentPage(1); // Reset to first page when filters change
    loadRankings();
  };

  const handleResetFilters = () => {
    setSelectedKeyword('');
    setDateRange({ startDate: '', endDate: '' });
    setCurrentPage(1);
    setTimeout(() => loadRankings(), 0);
  };

  // Get all unique keywords for the dropdown
  const allKeywords = rankings.map((r) => r.keyword);

  // Prepare chart data
  const getChartData = () => {
    if (rankings.length === 0) return [];

    // Get all unique dates across all keywords
    const allDates = new Set<string>();
    rankings.forEach((r) => {
      r.history.forEach((h) => allDates.add(h.date));
    });

    const sortedDates = Array.from(allDates).sort();

    // Build data points for each date
    return sortedDates.map((date) => {
      const dataPoint: any = { date };

      rankings.forEach((r) => {
        const historyPoint = r.history.find((h) => h.date === date);
        dataPoint[r.keyword] = historyPoint ? historyPoint.position : null;
      });

      return dataPoint;
    });
  };

  const chartData = getChartData();

  // Colors for different keywords
  const colors = [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // purple
    '#ec4899', // pink
  ];

  // Calculate ranking changes
  const getRankingChange = (keyword: string) => {
    const ranking = rankings.find((r) => r.keyword === keyword);
    if (!ranking || ranking.history.length < 2) return null;

    const latest = ranking.history[ranking.history.length - 1].position;
    const previous = ranking.history[ranking.history.length - 2].position;
    return previous - latest; // Positive means improvement (lower rank number)
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
        <button
          onClick={loadRankings}
          className="mt-2 text-red-600 hover:text-red-700 font-medium"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Keyword
            </label>
            <select
              value={selectedKeyword}
              onChange={(e) => setSelectedKeyword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Keywords</option>
              {allKeywords.map((keyword) => (
                <option key={keyword} value={keyword}>
                  {keyword}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) =>
                setDateRange((prev) => ({ ...prev, startDate: e.target.value }))
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Date
            </label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) =>
                setDateRange((prev) => ({ ...prev, endDate: e.target.value }))
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleFilterChange}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Apply Filters
          </button>
          <button
            onClick={handleResetFilters}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            Reset
          </button>
        </div>
      </div>

      {rankings.length === 0 ? (
        <div className="text-center py-12 text-gray-600">
          <div className="text-4xl mb-4">📊</div>
          <p>No ranking data available yet.</p>
          <p className="text-sm mt-2">
            Track rankings for your keywords to see historical data here.
          </p>
        </div>
      ) : (
        <>
          {/* Ranking Changes Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rankings.map((ranking) => {
              const change = getRankingChange(ranking.keyword);
              const latestRank =
                ranking.history.length > 0
                  ? ranking.history[ranking.history.length - 1].position
                  : null;

              return (
                <div
                  key={ranking.keyword}
                  className="bg-white rounded-lg border border-gray-200 p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 mb-1">
                        {ranking.keyword}
                      </h4>
                      <div className="text-2xl font-bold text-gray-900">
                        {latestRank !== null ? `#${latestRank}` : '—'}
                      </div>
                    </div>
                    {change !== null && (
                      <div
                        className={`flex items-center space-x-1 ${
                          change > 0
                            ? 'text-green-600'
                            : change < 0
                            ? 'text-red-600'
                            : 'text-gray-600'
                        }`}
                      >
                        {change > 0 ? (
                          <>
                            <span className="text-xl">↑</span>
                            <span className="font-semibold">{change}</span>
                          </>
                        ) : change < 0 ? (
                          <>
                            <span className="text-xl">↓</span>
                            <span className="font-semibold">{Math.abs(change)}</span>
                          </>
                        ) : (
                          <span className="text-sm">No change</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Chart */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Ranking Trends
            </h3>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return `${date.getMonth() + 1}/${date.getDate()}`;
                  }}
                />
                <YAxis
                  reversed
                  domain={[1, 100]}
                  tick={{ fontSize: 12 }}
                  label={{ value: 'Rank Position', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip
                  formatter={(value: any) => [`#${value}`, 'Rank']}
                  labelFormatter={(label) => {
                    const date = new Date(label);
                    return date.toLocaleDateString();
                  }}
                />
                <Legend />
                {rankings.map((ranking, index) => (
                  <Line
                    key={ranking.keyword}
                    type="monotone"
                    dataKey={ranking.keyword}
                    stroke={colors[index % colors.length]}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Pagination */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalCount}
            pageSize={pageSize}
            onPageChange={handlePageChange}
          />
        </>
      )}
    </div>
  );
}
