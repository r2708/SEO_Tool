'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { LoadingSpinner } from '@/components/shared';

interface Project {
  id: string;
  name: string;
  domain: string;
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

interface CompetitorKeywordWithRanking {
  keyword: string;
  position: number | null;
  searchVolume: number | null;
  difficulty: number | null;
  cpc: number | null;
  lastUpdated: string;
}

interface AnalysisResult {
  competitor: string;
  keywords: CompetitorKeywordWithRanking[];
  overlap: {
    shared: string[];
    competitorOnly: string[];
    userOnly: string[];
  };
  lastAnalyzed: string;
}

export default function CompetitorsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [domain, setDomain] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAllCompetitorKeywords, setShowAllCompetitorKeywords] = useState(false);
  const [showAllSharedKeywords, setShowAllSharedKeywords] = useState(false);
  const [showAllUserKeywords, setShowAllUserKeywords] = useState(false);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    pageSize: 10,
    totalPages: 0,
  });

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      fetchCompetitors();
    }
  }, [selectedProjectId]);

  const fetchProjects = async () => {
    try {
      const response = await apiClient.get<{ projects: Project[] }>('/api/projects');
      setProjects(response.projects);
      
      if (response.projects.length > 0 && !selectedProjectId) {
        setSelectedProjectId(response.projects[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompetitors = async (page = 1) => {
    if (!selectedProjectId) return;
    
    try {
      const response: CompetitorListResponse = await apiClient.get(
        `/api/competitors/${selectedProjectId}?page=${page}&pageSize=${pagination.pageSize}`
      );
      
      setCompetitors(response.competitors);
      setPagination(response.pagination);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch competitors');
    }
  };

  const handleAnalyze = async () => {
    if (!domain.trim() || !selectedProjectId) {
      setError('Please enter a competitor domain and select a project');
      return;
    }

    setAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const analysisResult: AnalysisResult = await apiClient.post('/api/competitors/analyze', {
        projectId: selectedProjectId,
        competitorDomain: domain.trim(),
      });
      
      setResult(analysisResult);
      setDomain('');
      // Reset expand states for new analysis
      setShowAllCompetitorKeywords(false);
      setShowAllSharedKeywords(false);
      setShowAllUserKeywords(false);
      fetchCompetitors(); // Refresh the list
      
      // Poll for updated ranking data after 5 seconds
      setTimeout(() => {
        pollForUpdatedData(selectedProjectId, domain.trim());
      }, 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze competitor');
    } finally {
      setAnalyzing(false);
    }
  };

  const pollForUpdatedData = async (projectId: string, competitorDomain: string) => {
    try {
      // Re-fetch the analysis to get updated ranking data
      const updatedResult: AnalysisResult = await apiClient.post('/api/competitors/analyze', {
        projectId,
        competitorDomain,
      });
      
      // Only update if we have new ranking data
      if (updatedResult.keywords.some(k => k.searchVolume !== null)) {
        setResult(updatedResult);
      } else {
        // Poll again after 10 seconds if data is still processing
        setTimeout(() => {
          pollForUpdatedData(projectId, competitorDomain);
        }, 10000);
      }
    } catch (err) {
      console.error('Failed to poll for updated data:', err);
    }
  };

  const viewCompetitorDetails = async (competitorId: string, competitorDomain: string) => {
    if (!selectedProjectId) return;
    
    setAnalyzing(true);
    setError(null);
    
    try {
      // Fetch keywords with ranking data from database
      const response = await apiClient.get(`/api/competitors/${competitorId}/keywords`);
      
      // Get user keywords for overlap calculation
      const userKeywords = await apiClient.get(`/api/keywords?projectId=${selectedProjectId}`);
      const userKeywordList = userKeywords.keywords?.map((k: any) => k.keyword.toLowerCase()) || [];
      
      // Calculate overlap
      const competitorKeywordList = response.keywords.map((k: any) => k.keyword.toLowerCase());
      const shared = userKeywordList.filter((k: string) => competitorKeywordList.includes(k));
      const competitorOnly = competitorKeywordList.filter((k: string) => !userKeywordList.includes(k));
      const userOnly = userKeywordList.filter((k: string) => !competitorKeywordList.includes(k));
      
      // Format result
      const analysisResult: AnalysisResult = {
        competitor: competitorDomain,
        keywords: response.keywords,
        overlap: {
          shared,
          competitorOnly,
          userOnly,
        },
        lastAnalyzed: new Date().toISOString(),
      };
      
      setResult(analysisResult);
      setShowAllCompetitorKeywords(false);
      setShowAllSharedKeywords(false);
      setShowAllUserKeywords(false);
      
      // Scroll to results
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setError(err.message || 'Failed to load competitor details');
    } finally {
      setAnalyzing(false);
    }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="large" text="Loading..." />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Competitor Analysis</h1>
        <p className="mt-2 text-gray-600">
          Analyze your competitors' keywords and discover new opportunities
        </p>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-500 mb-4">No projects found</div>
          <a
            href="/dashboard/projects/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Your First Project
          </a>
        </div>
      ) : (
        <>
          {/* Project Selector */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-medium text-gray-800 mb-4">Select Project</h2>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Choose a project...</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name} ({project.domain})
                </option>
              ))}
            </select>
          </div>

          {selectedProjectId && (
            <>
              {/* Competitor Analysis Form */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                  Analyze Competitor
                </h2>

                <div className="mb-6">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && !analyzing && handleAnalyze()}
                      placeholder="Enter competitor domain (e.g., example.com)"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={analyzing}
                    />
                    <button
                      onClick={handleAnalyze}
                      disabled={analyzing || !domain.trim()}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                      {analyzing ? 'Analyzing...' : 'Analyze Competitor'}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                    {error}
                  </div>
                )}

                {analyzing && (
                  <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                      <span className="text-blue-700">
                        Analyzing competitor website and extracting keywords...
                      </span>
                    </div>
                  </div>
                )}

                {result && (
                  <div className="space-y-6">
                    {/* Summary */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="text-lg font-medium text-gray-800 mb-3">
                        Analysis Summary
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">
                            {result.keywords.length}
                          </div>
                          <div className="text-sm text-gray-600">Total Keywords Found</div>
                          <div className="text-xs text-gray-500 mt-1">
                            Ranking data processing...
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {result.keywords.filter(k => k.position && k.position <= 10).length}
                          </div>
                          <div className="text-sm text-gray-600">Top 10 Rankings</div>
                          <div className="text-xs text-gray-500 mt-1">
                            ({result.keywords.filter(k => k.searchVolume !== null).length} analyzed)
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-orange-600">
                            {result.overlap.competitorOnly.length}
                          </div>
                          <div className="text-sm text-gray-600">Competitor-Only Keywords</div>
                        </div>
                      </div>
                    </div>

                    {/* Keyword Rankings Table */}
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                        <h4 className="font-medium text-gray-800">
                          Competitor Keywords with Rankings ({result.keywords.length})
                        </h4>
                        {result.keywords.every(k => k.position === null && k.searchVolume === null) && (
                          <p className="text-sm text-amber-600 mt-1">
                            ⚠️ This analysis contains only keyword extraction. Re-analyze to get rankings and metrics.
                          </p>
                        )}
                        {result.keywords.some(k => k.searchVolume !== null) && (
                          <p className="text-sm text-green-600 mt-1">
                            ✓ Analysis includes ranking data for top {result.keywords.filter(k => k.searchVolume !== null).length} keywords
                          </p>
                        )}
                      </div>
                      <div className="max-h-96 overflow-y-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="text-left py-2 px-4 text-sm font-medium text-gray-700">Keyword</th>
                              <th className="text-left py-2 px-4 text-sm font-medium text-gray-700">Position</th>
                              <th className="text-left py-2 px-4 text-sm font-medium text-gray-700">Search Volume</th>
                              <th className="text-left py-2 px-4 text-sm font-medium text-gray-700">Difficulty</th>
                              <th className="text-left py-2 px-4 text-sm font-medium text-gray-700">CPC</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.keywords
                              .sort((a, b) => {
                                // Sort by position (ranked first), then by search volume
                                if (a.position && b.position) return a.position - b.position;
                                if (a.position && !b.position) return -1;
                                if (!a.position && b.position) return 1;
                                return (b.searchVolume || 0) - (a.searchVolume || 0);
                              })
                              .slice(0, 20) // Show first 20 keywords to avoid overwhelming UI
                              .map((keyword, index) => (
                              <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                                <td className="py-2 px-4 text-sm text-gray-900">{keyword.keyword}</td>
                                <td className="py-2 px-4 text-sm">
                                  {keyword.position ? (
                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                      keyword.position <= 3 ? 'bg-green-100 text-green-800' :
                                      keyword.position <= 10 ? 'bg-yellow-100 text-yellow-800' :
                                      keyword.position <= 20 ? 'bg-orange-100 text-orange-800' :
                                      'bg-red-100 text-red-800'
                                    }`}>
                                      #{keyword.position}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400 text-xs">Pending...</span>
                                  )}
                                </td>
                                <td className="py-2 px-4 text-sm text-gray-600">
                                  {keyword.searchVolume ? keyword.searchVolume.toLocaleString() : 
                                   <span className="text-gray-400 text-xs">Pending...</span>}
                                </td>
                                <td className="py-2 px-4 text-sm text-gray-600">
                                  {keyword.difficulty ? `${keyword.difficulty}%` : 
                                   <span className="text-gray-400 text-xs">Pending...</span>}
                                </td>
                                <td className="py-2 px-4 text-sm text-gray-600">
                                  {keyword.cpc ? `$${keyword.cpc.toFixed(2)}` : 
                                   <span className="text-gray-400 text-xs">Pending...</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {result.keywords.length > 20 && (
                          <div className="px-4 py-3 bg-gray-50 text-sm text-gray-600 text-center">
                            Showing first 20 of {result.keywords.length} keywords
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Keyword Overlap Details */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Shared Keywords */}
                      <div className="bg-green-50 rounded-lg p-4">
                        <h4 className="font-medium text-green-800 mb-3">
                          Shared Keywords ({result.overlap.shared.length})
                        </h4>
                        <div className="max-h-40 overflow-y-auto">
                          {result.overlap.shared.length > 0 ? (
                            <div className="space-y-1">
                              {result.overlap.shared.slice(0, showAllSharedKeywords ? result.overlap.shared.length : 10).map((keyword, index) => (
                                <div
                                  key={index}
                                  className="text-sm text-green-700 bg-green-100 px-2 py-1 rounded"
                                >
                                  {keyword}
                                </div>
                              ))}
                              {result.overlap.shared.length > 10 && (
                                <button
                                  onClick={() => setShowAllSharedKeywords(!showAllSharedKeywords)}
                                  className="text-xs text-green-600 hover:text-green-800 mt-2 underline cursor-pointer"
                                >
                                  {showAllSharedKeywords 
                                    ? 'Show less...' 
                                    : `+${result.overlap.shared.length - 10} more...`
                                  }
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="text-sm text-green-600">No shared keywords found</div>
                          )}
                        </div>
                      </div>

                      {/* Competitor-Only Keywords */}
                      <div className="bg-orange-50 rounded-lg p-4">
                        <h4 className="font-medium text-orange-800 mb-3">
                          Competitor-Only Keywords ({result.overlap.competitorOnly.length})
                        </h4>
                        <div className="max-h-40 overflow-y-auto">
                          {result.overlap.competitorOnly.length > 0 ? (
                            <div className="space-y-1">
                              {result.overlap.competitorOnly.slice(0, showAllCompetitorKeywords ? result.overlap.competitorOnly.length : 10).map((keyword, index) => (
                                <div
                                  key={index}
                                  className="text-sm text-orange-700 bg-orange-100 px-2 py-1 rounded"
                                >
                                  {keyword}
                                </div>
                              ))}
                              {result.overlap.competitorOnly.length > 10 && (
                                <button
                                  onClick={() => setShowAllCompetitorKeywords(!showAllCompetitorKeywords)}
                                  className="text-xs text-orange-600 hover:text-orange-800 mt-2 underline cursor-pointer"
                                >
                                  {showAllCompetitorKeywords 
                                    ? 'Show less...' 
                                    : `+${result.overlap.competitorOnly.length - 10} more...`
                                  }
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="text-sm text-orange-600">No competitor-only keywords found</div>
                          )}
                        </div>
                      </div>

                      {/* Your-Only Keywords */}
                      <div className="bg-blue-50 rounded-lg p-4">
                        <h4 className="font-medium text-blue-800 mb-3">
                          Your-Only Keywords ({result.overlap.userOnly.length})
                        </h4>
                        <div className="max-h-40 overflow-y-auto">
                          {result.overlap.userOnly.length > 0 ? (
                            <div className="space-y-1">
                              {result.overlap.userOnly.slice(0, showAllUserKeywords ? result.overlap.userOnly.length : 10).map((keyword, index) => (
                                <div
                                  key={index}
                                  className="text-sm text-blue-700 bg-blue-100 px-2 py-1 rounded"
                                >
                                  {keyword}
                                </div>
                              ))}
                              {result.overlap.userOnly.length > 10 && (
                                <button
                                  onClick={() => setShowAllUserKeywords(!showAllUserKeywords)}
                                  className="text-xs text-blue-600 hover:text-blue-800 mt-2 underline cursor-pointer"
                                >
                                  {showAllUserKeywords 
                                    ? 'Show less...' 
                                    : `+${result.overlap.userOnly.length - 10} more...`
                                  }
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="text-sm text-blue-600">No unique keywords found</div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-sm text-gray-500 text-center">
                      Analysis completed on {new Date(result.lastAnalyzed).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>

              {/* Competitor List */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                  Analyzed Competitors ({pagination.total})
                </h2>

                {competitors.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-gray-500 mb-2">No competitors analyzed yet</div>
                    <div className="text-sm text-gray-400">
                      Use the form above to analyze your first competitor
                    </div>
                  </div>
                ) : (
                  <>
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
                                <button
                                  onClick={() => viewCompetitorDetails(competitor.id, competitor.domain)}
                                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                >
                                  View Details
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {pagination.totalPages > 1 && (
                      <div className="mt-6 flex items-center justify-between">
                        <div className="text-sm text-gray-700">
                          Showing {((pagination.page - 1) * pagination.pageSize) + 1} to{' '}
                          {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{' '}
                          {pagination.total} competitors
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => fetchCompetitors(pagination.page - 1)}
                            disabled={pagination.page === 1}
                            className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Previous
                          </button>
                          <span className="px-3 py-1 text-sm text-gray-700">
                            Page {pagination.page} of {pagination.totalPages}
                          </span>
                          <button
                            onClick={() => fetchCompetitors(pagination.page + 1)}
                            disabled={pagination.page === pagination.totalPages}
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
            </>
          )}
        </>
      )}
    </div>
  );
}