'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import type { KeywordData } from '@seo-saas/shared-types';

interface KeywordManagementProps {
  projectId: string;
}

type SortField = 'keyword' | 'searchVolume' | 'difficulty' | 'cpc' | 'currentRank';
type SortDirection = 'asc' | 'desc';

export default function KeywordManagement({ projectId }: KeywordManagementProps) {
  const [keywords, setKeywords] = useState<KeywordData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [researching, setResearching] = useState(false);
  const [researchError, setResearchError] = useState<string | null>(null);
  const [keywordInput, setKeywordInput] = useState('');
  const [sortField, setSortField] = useState<SortField>('keyword');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [filterText, setFilterText] = useState('');

  useEffect(() => {
    loadKeywords();
  }, [projectId]);

  const loadKeywords = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get<{ keywords: KeywordData[] }>(
        `/api/keywords/${projectId}`
      );
      setKeywords(response.keywords);
    } catch (err: any) {
      setError(err.message || 'Failed to load keywords');
    } finally {
      setLoading(false);
    }
  };

  const handleResearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!keywordInput.trim()) {
      setResearchError('Please enter at least one keyword');
      return;
    }

    try {
      setResearching(true);
      setResearchError(null);

      // Split by comma and trim whitespace
      const keywordList = keywordInput
        .split(',')
        .map((k) => k.trim())
        .filter((k) => k.length > 0);

      if (keywordList.length === 0) {
        setResearchError('Please enter valid keywords');
        return;
      }

      await apiClient.post('/api/keywords/research', {
        projectId,
        keywords: keywordList,
      });

      // Clear input and reload keywords
      setKeywordInput('');
      await loadKeywords();
    } catch (err: any) {
      setResearchError(err.message || 'Failed to research keywords');
    } finally {
      setResearching(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortedAndFilteredKeywords = () => {
    let filtered = keywords;

    // Apply filter
    if (filterText) {
      filtered = keywords.filter((k) =>
        k.keyword.toLowerCase().includes(filterText.toLowerCase())
      );
    }

    // Apply sort
    return [...filtered].sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      // Handle undefined values
      if (aVal === undefined) aVal = sortDirection === 'asc' ? Infinity : -Infinity;
      if (bVal === undefined) bVal = sortDirection === 'asc' ? Infinity : -Infinity;

      if (typeof aVal === 'string') {
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <span className="text-gray-400">↕</span>;
    }
    return <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>;
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
          onClick={loadKeywords}
          className="mt-2 text-red-600 hover:text-red-700 font-medium"
        >
          Try again
        </button>
      </div>
    );
  }

  const sortedKeywords = getSortedAndFilteredKeywords();

  return (
    <div className="space-y-6">
      {/* Research Form */}
      <form onSubmit={handleResearch} className="space-y-4">
        <div>
          <label
            htmlFor="keywords"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Research Keywords
          </label>
          <input
            type="text"
            id="keywords"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter keywords separated by commas (e.g., seo tools, keyword research, rank tracking)"
            disabled={researching}
          />
          <p className="mt-1 text-sm text-gray-500">
            Enter multiple keywords separated by commas
          </p>
        </div>

        {researchError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-800">{researchError}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={researching}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 flex items-center"
        >
          {researching ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Researching...
            </>
          ) : (
            'Research Keywords'
          )}
        </button>
      </form>

      {/* Filter */}
      {keywords.length > 0 && (
        <div>
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Filter keywords..."
          />
        </div>
      )}

      {/* Keywords Table */}
      {keywords.length === 0 ? (
        <div className="text-center py-12 text-gray-600">
          <div className="text-4xl mb-4">🔍</div>
          <p>No keywords yet. Research some keywords to get started!</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th
                  onClick={() => handleSort('keyword')}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center space-x-1">
                    <span>Keyword</span>
                    <SortIcon field="keyword" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('searchVolume')}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center space-x-1">
                    <span>Search Volume</span>
                    <SortIcon field="searchVolume" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('difficulty')}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center space-x-1">
                    <span>Difficulty</span>
                    <SortIcon field="difficulty" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('cpc')}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center space-x-1">
                    <span>CPC</span>
                    <SortIcon field="cpc" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('currentRank')}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center space-x-1">
                    <span>Current Rank</span>
                    <SortIcon field="currentRank" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedKeywords.map((keyword) => (
                <tr key={keyword.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {keyword.keyword}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {keyword.searchVolume.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        keyword.difficulty >= 70
                          ? 'bg-red-100 text-red-800'
                          : keyword.difficulty >= 40
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {keyword.difficulty.toFixed(0)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    ${keyword.cpc.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {keyword.currentRank !== undefined ? keyword.currentRank : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {sortedKeywords.length === 0 && filterText && (
            <div className="text-center py-8 text-gray-600">
              No keywords match your filter
            </div>
          )}
        </div>
      )}
    </div>
  );
}
