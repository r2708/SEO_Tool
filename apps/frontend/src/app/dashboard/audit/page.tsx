'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import type { SEOAnalysis, ProjectWithStats } from '@seo-saas/shared-types';
import { AuditResults, ScoreHistoryChart } from '@/components/audit';

export default function AuditPage() {
  const [url, setUrl] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [auditResult, setAuditResult] = useState<SEOAnalysis | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoadingProjects(true);
      const response = await apiClient.get<{ projects: ProjectWithStats[] }>('/api/projects');
      setProjects(response.projects);
    } catch (err: any) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setAuditResult(null);

      const requestData: { url: string; projectId?: string } = { url: url.trim() };
      if (selectedProjectId) {
        requestData.projectId = selectedProjectId;
      }

      const result = await apiClient.post<SEOAnalysis>('/api/audit', requestData);
      setAuditResult(result);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze URL');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setUrl('');
    setSelectedProjectId('');
    setAuditResult(null);
    setError(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">SEO Audit</h1>
        <p className="text-gray-600 mt-1">Analyze on-page SEO elements</p>
      </div>

      {/* Audit Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-1">
              URL to Analyze
            </label>
            <input
              type="url"
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
              required
            />
          </div>

          <div>
            <label htmlFor="project" className="block text-sm font-medium text-gray-700 mb-1">
              Project (Optional)
            </label>
            <select
              id="project"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading || loadingProjects}
            >
              <option value="">Select a project to store score in history</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name} ({project.domain})
                </option>
              ))}
            </select>
            {loadingProjects && (
              <p className="text-sm text-gray-500 mt-1">Loading projects...</p>
            )}
          </div>

          <div className="flex space-x-3">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Analyzing...' : 'Analyze URL'}
            </button>
            {auditResult && (
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
          <div className="flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mb-4"></div>
            <p className="text-gray-600 text-lg">Analyzing page...</p>
            <p className="text-gray-500 text-sm mt-2">This may take a few moments</p>
          </div>
        </div>
      )}

      {/* Audit Results */}
      {auditResult && !loading && (
        <AuditResults analysis={auditResult} />
      )}

      {/* Score History Chart */}
      {selectedProjectId && !loading && (
        <ScoreHistoryChart projectId={selectedProjectId} />
      )}
    </div>
  );
}
