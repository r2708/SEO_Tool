'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import type { KeywordData } from '@seo-saas/shared-types';
import Pagination from '@/components/shared/Pagination';

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
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize] = useState(50);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [deletingKeyword, setDeletingKeyword] = useState<string | null>(null);

  useEffect(() => {
    loadKeywords();
  }, [projectId, currentPage]);

  // Auto-refresh when rankings are being checked
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadKeywords();
    }, 3000); // Refresh every 3 seconds

    // Stop after 30 seconds
    const timeout = setTimeout(() => {
      setAutoRefresh(false);
    }, 30000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [autoRefresh, projectId, currentPage]);

  const loadKeywords = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get<{ 
        keywords: KeywordData[];
        pagination?: {
          page: number;
          pageSize: number;
          totalCount: number;
          totalPages: number;
        };
      }>(
        `/api/keywords/${projectId}`,
        {
          params: {
            page: currentPage,
            pageSize,
          },
        }
      );
      setKeywords(response.keywords);
      
      // Update pagination metadata if available
      if (response.pagination) {
        setTotalPages(response.pagination.totalPages);
        setTotalCount(response.pagination.totalCount);
      } else {
        // Fallback if backend doesn't return pagination metadata yet
        setTotalPages(1);
        setTotalCount(response.keywords.length);
      }
      
      // Check if any keywords are missing rankings (recently added)
      // currentRank === undefined or null means not checked yet
      // currentRank === 0 means checked but not ranked (which is a valid result)
      const hasUnrankedKeywords = response.keywords.some(
        k => k.currentRank === undefined || k.currentRank === null
      );
      
      // If there are unranked keywords and auto-refresh is not already active, start it
      if (hasUnrankedKeywords && !autoRefresh) {
        setAutoRefresh(true);
      }
      
      // If all keywords have rankings (including 0 for "not ranked"), stop auto-refresh
      if (!hasUnrankedKeywords && autoRefresh) {
        setAutoRefresh(false);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load keywords');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
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

      {/* Clear input and reload keywords */}
      setKeywordInput('');
      setCurrentPage(1); // Reset to first page
      await loadKeywords();
      
      // Start auto-refresh to show rankings as they come in
      setAutoRefresh(true);
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

  const handleDeleteKeyword = async (keyword: string) => {
    if (!confirm(`Are you sure you want to delete "${keyword}"?`)) {
      return;
    }

    try {
      setDeletingKeyword(keyword);
      await apiClient.delete(`/api/keywords/${projectId}/${encodeURIComponent(keyword)}`);
      
      // Reload keywords after deletion
      await loadKeywords();
    } catch (err: any) {
      alert(err.message || 'Failed to delete keyword');
    } finally {
      setDeletingKeyword(null);
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

        {autoRefresh && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            <p className="text-sm text-blue-800">
              Rankings are being checked... Refreshing display automatically.
            </p>
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
        <>
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Current Rank
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Actions
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
                    <td className="px-4 py-3 text-sm">
                      {keyword.currentRank !== undefined && keyword.currentRank !== null ? (
                        keyword.currentRank > 0 ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            #{keyword.currentRank}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            Not ranked
                          </span>
                        )
                      ) : (
                        <span className="text-gray-400 text-xs">Checking...</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => handleDeleteKeyword(keyword.keyword)}
                        disabled={deletingKeyword === keyword.keyword}
                        className="text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Delete keyword"
                      >
                        {deletingKeyword === keyword.keyword ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
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
