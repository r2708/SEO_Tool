'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import type { Competitor, CompetitorAnalysis } from '@seo-saas/shared-types';
import { CompetitorsList, CompetitorAnalysisResults } from '@/components/competitors';
import Pagination from '@/components/shared/Pagination';

export default function CompetitorsPage() {
  const params = useParams();
  const projectId = params.id as string;
  
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [competitorDomain, setCompetitorDomain] = useState('');
  const [analysisResult, setAnalysisResult] = useState<CompetitorAnalysis | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize] = useState(50);

  useEffect(() => {
    apiClient.loadToken();
    loadCompetitors();
  }, [projectId, currentPage]);

  const loadCompetitors = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.get<{ 
        competitors: Competitor[];
        pagination?: {
          page: number;
          pageSize: number;
          totalCount: number;
          totalPages: number;
        };
      }>(
        `/api/competitors/${projectId}`,
        {
          params: {
            page: currentPage,
            pageSize,
          },
        }
      );
      setCompetitors(data.competitors);
      
      // Update pagination metadata if available
      if (data.pagination) {
        setTotalPages(data.pagination.totalPages);
        setTotalCount(data.pagination.totalCount);
      } else {
        // Fallback if backend doesn't return pagination metadata yet
        setTotalPages(1);
        setTotalCount(data.competitors.length);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load competitors');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!competitorDomain.trim()) {
      setError('Please enter a competitor domain');
      return;
    }

    try {
      setAnalyzing(true);
      setError(null);
      setAnalysisResult(null);
      
      const result = await apiClient.post<CompetitorAnalysis>(
        '/api/competitors/analyze',
        {
          projectId,
          competitorDomain: competitorDomain.trim(),
        }
      );
      
      setAnalysisResult(result);
      setCompetitorDomain('');
      
      // Reload competitors list to show the new one
      setCurrentPage(1); // Reset to first page
      await loadCompetitors();
    } catch (err: any) {
      setError(err.message || 'Failed to analyze competitor');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleReanalyze = async (domain: string) => {
    try {
      setAnalyzing(true);
      setError(null);
      
      const result = await apiClient.post<CompetitorAnalysis>(
        '/api/competitors/analyze',
        {
          projectId,
          competitorDomain: domain,
        }
      );
      
      setAnalysisResult(result);
      await loadCompetitors();
    } catch (err: any) {
      setError(err.message || 'Failed to analyze competitor');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Competitor Analysis</h1>
        <p className="mt-2 text-gray-600">
          Analyze competitor domains to identify keyword opportunities
        </p>
      </div>

      {/* Competitor Analysis Form */}
      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Analyze New Competitor
        </h2>
        <form onSubmit={handleAnalyze} className="flex gap-4">
          <div className="flex-1">
            <input
              type="text"
              value={competitorDomain}
              onChange={(e) => setCompetitorDomain(e.target.value)}
              placeholder="Enter competitor domain (e.g., example.com)"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={analyzing}
            />
          </div>
          <button
            type="submit"
            disabled={analyzing}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {analyzing ? 'Analyzing...' : 'Analyze'}
          </button>
        </form>
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800">{error}</p>
          </div>
        )}
      </div>

      {/* Loading State */}
      {analyzing && (
        <div className="bg-white shadow rounded-lg p-8 mb-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <span className="ml-4 text-gray-600">Analyzing competitor...</span>
          </div>
        </div>
      )}

      {/* Analysis Results */}
      {analysisResult && !analyzing && (
        <CompetitorAnalysisResults analysis={analysisResult} />
      )}

      {/* Competitors List */}
      <CompetitorsList
        competitors={competitors}
        loading={loading}
        onReanalyze={handleReanalyze}
      />

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalCount}
        pageSize={pageSize}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
