'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import type { RankHistory } from '@seo-saas/shared-types';
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

interface RankingChartProps {
  projectId: string;
  keyword?: string;
  startDate?: string;
  endDate?: string;
}

export default function RankingChart({
  projectId,
  keyword,
  startDate,
  endDate,
}: RankingChartProps) {
  const [data, setData] = useState<RankHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedKeyword, setSelectedKeyword] = useState<string>(keyword || '');
  const [dateRange, setDateRange] = useState({
    start: startDate || '',
    end: endDate || '',
  });

  useEffect(() => {
    loadRankingData();
  }, [projectId, selectedKeyword, dateRange.start, dateRange.end]);

  const loadRankingData = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (selectedKeyword) params.append('keyword', selectedKeyword);
      if (dateRange.start) params.append('startDate', dateRange.start);
      if (dateRange.end) params.append('endDate', dateRange.end);

      const queryString = params.toString();
      const url = `/api/rank/history/${projectId}${queryString ? `?${queryString}` : ''}`;

      const response = await apiClient.get<{ rankings: RankHistory[] }>(url);
      setData(response.rankings);
    } catch (err: any) {
      setError(err.message || 'Failed to load ranking data');
    } finally {
      setLoading(false);
    }
  };

  const handleKeywordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedKeyword(e.target.value);
  };

  const handleDateChange = (field: 'start' | 'end', value: string) => {
    setDateRange((prev) => ({ ...prev, [field]: value }));
  };

  const handleClearFilters = () => {
    setSelectedKeyword('');
    setDateRange({ start: '', end: '' });
  };

  // Transform data for recharts
  const chartData = data.length > 0 ? transformDataForChart(data) : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading ranking data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center">
          <span className="text-2xl mr-3">⚠️</span>
          <div>
            <h3 className="text-lg font-semibold text-red-900">Error Loading Rankings</h3>
            <p className="text-red-700 mt-1">{error}</p>
            <button
              onClick={loadRankingData}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Keyword
            </label>
            <input
              type="text"
              value={selectedKeyword}
              onChange={handleKeywordChange}
              placeholder="Filter by keyword"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
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
        {(selectedKeyword || dateRange.start || dateRange.end) && (
          <button
            onClick={handleClearFilters}
            className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Chart */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {data.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No ranking data available for the selected filters
          </div>
        ) : (
          <>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Ranking History
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
                  label={{ value: 'Position', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ stroke: '#3b82f6', strokeWidth: 1 }}
                />
                <Legend />
                {data.map((rankHistory, index) => (
                  <Line
                    key={rankHistory.keyword}
                    type="monotone"
                    dataKey={rankHistory.keyword}
                    stroke={getColorForIndex(index)}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </>
        )}
      </div>
    </div>
  );
}

// Transform data from API format to recharts format
function transformDataForChart(data: RankHistory[]) {
  const dateMap = new Map<string, any>();

  data.forEach((rankHistory) => {
    rankHistory.history.forEach((point) => {
      if (!dateMap.has(point.date)) {
        dateMap.set(point.date, { date: point.date });
      }
      dateMap.get(point.date)![rankHistory.keyword] = point.position;
    });
  });

  return Array.from(dateMap.values()).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}

// Custom tooltip component
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) {
    return null;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
      <p className="text-sm font-medium text-gray-900 mb-2">
        {new Date(label).toLocaleDateString()}
      </p>
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center space-x-2 text-sm">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-700">{entry.name}:</span>
          <span className="font-semibold text-gray-900">#{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

// Generate colors for different keywords
function getColorForIndex(index: number): string {
  const colors = [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#14b8a6', // teal
    '#f97316', // orange
  ];
  return colors[index % colors.length];
}
