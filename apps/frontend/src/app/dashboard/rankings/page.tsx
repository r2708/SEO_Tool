'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import type { ProjectWithStats } from '@seo-saas/shared-types';
import RankingChart from '@/components/dashboard/RankingChart';

export default function RankingsPage() {
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get<{ projects: ProjectWithStats[] }>('/api/projects');
      setProjects(response.projects);
      
      // Auto-select first project or project from query params
      const projectIdFromQuery = searchParams.get('projectId');
      if (projectIdFromQuery && response.projects.some(p => p.id === projectIdFromQuery)) {
        setSelectedProjectId(projectIdFromQuery);
      } else if (response.projects.length > 0) {
        setSelectedProjectId(response.projects[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading projects...</p>
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
            <h3 className="text-lg font-semibold text-red-900">Error Loading Projects</h3>
            <p className="text-red-700 mt-1">{error}</p>
            <button
              onClick={loadProjects}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📊</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">No Projects Yet</h2>
        <p className="text-gray-600 mb-6">
          Create a project to start tracking keyword rankings
        </p>
        <a
          href="/dashboard/projects/new"
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Create Project
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Ranking History</h1>
        <p className="text-gray-600 mt-1">Track your keyword rankings over time</p>
      </div>

      {/* Project Selector */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Project
        </label>
        <select
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          className="w-full md:w-96 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name} ({project.domain})
            </option>
          ))}
        </select>
      </div>

      {/* Ranking Chart */}
      {selectedProjectId && <RankingChart projectId={selectedProjectId} />}
    </div>
  );
}
