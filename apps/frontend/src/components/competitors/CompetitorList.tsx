import React, { useState, useEffect } from 'react';
import { competitorAPI } from '../../lib/api-client';

interface CompetitorListProps {
  projectId: string;
  refreshTrigger?: number;
}

interface Competitor {
  id: string;
  domain: string;
  keywordCount: number;
  lastAnalyzed: string;
}

interface CompetitorListResponse {
  competitors: Competitor[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export const CompetitorList: React.FC<CompetitorListProps> = ({
  projectId,
  refreshTrigger,
}) => {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    pageSize: 10,
    totalPages: 0,
  });

  const fetchCompetitors = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      
      const response: CompetitorListResponse = await competitorAPI.getCompetitors(
        projectId,
        page,
        pagination.pageSize
      ) as CompetitorListResponse;
      
      setCompetitors(response.competitors);
      setPagination(response.pagination);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch competitors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchCompetitors(1);
    }
  }, [projectId, refreshTrigger]);

  const handlePageChange = (newPage: number) => {
    fetchCompetitors(newPage);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading && competitors.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          Analyzed Competitors
        </h2>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading competitors...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">
        Analyzed Competitors ({pagination.total})
      </h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {competitors.length === 0 && !loading ? (
        <div className="text-center py-8">
          <div className="text-gray-500 mb-2">No competitors analyzed yet</div>
          <div className="text-sm text-gray-400">
            Use the form above to analyze your first competitor
          </div>
        </div>
      ) : (
        <>
          {/* Competitors Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    Domain
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    Keywords Found
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    Last Analyzed
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {competitors.map((competitor) => (
                  <tr
                    key={competitor.id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900">
                        {competitor.domain}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {competitor.keywordCount} keywords
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {formatDate(competitor.lastAnalyzed)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            // TODO: Implement view details functionality
                            console.log('View details for:', competitor.id);
                          }}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          View Details
                        </button>
                        <button
                          onClick={() => {
                            // TODO: Implement re-analyze functionality
                            console.log('Re-analyze:', competitor.domain);
                          }}
                          className="text-green-600 hover:text-green-800 text-sm font-medium"
                        >
                          Re-analyze
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {((pagination.page - 1) * pagination.pageSize) + 1} to{' '}
                {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{' '}
                {pagination.total} competitors
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1 || loading}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="px-3 py-1 text-sm text-gray-700">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages || loading}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};