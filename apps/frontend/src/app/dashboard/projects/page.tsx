'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import type { ProjectWithStats } from '@seo-saas/shared-types';

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
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
    } catch (err: any) {
      setError(err.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = () => {
    router.push('/dashboard/projects/new');
  };

  const handleProjectClick = (projectId: string) => {
    router.push(`/dashboard/projects/${projectId}`);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-600 mt-1">Manage your SEO projects</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-600 mt-1">Manage your SEO projects</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
          <button
            onClick={loadProjects}
            className="mt-2 text-red-600 hover:text-red-700 font-medium"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-600 mt-1">Manage your SEO projects</p>
        </div>
        <button
          onClick={handleCreateProject}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          + Create Project
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <div className="text-6xl mb-4">📁</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            No projects yet
          </h2>
          <p className="text-gray-600 mb-6">
            Create your first project to start tracking SEO performance
          </p>
          <button
            onClick={handleCreateProject}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Create Your First Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div
              key={project.id}
              onClick={() => handleProjectClick(project.id)}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {project.name}
                  </h3>
                  <p className="text-sm text-gray-600">{project.domain}</p>
                </div>
                {project.lastAuditScore !== undefined && (
                  <div className="ml-4">
                    <div
                      className={`text-2xl font-bold ${
                        project.lastAuditScore >= 80
                          ? 'text-green-600'
                          : project.lastAuditScore >= 60
                          ? 'text-yellow-600'
                          : 'text-red-600'
                      }`}
                    >
                      {project.lastAuditScore}
                    </div>
                    <div className="text-xs text-gray-500">SEO Score</div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                <div>
                  <div className="text-2xl font-semibold text-gray-900">
                    {project.keywordCount}
                  </div>
                  <div className="text-xs text-gray-600">Keywords</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold text-gray-900">
                    {project.competitorCount}
                  </div>
                  <div className="text-xs text-gray-600">Competitors</div>
                </div>
              </div>

              <div className="mt-4 text-xs text-gray-500">
                Created {new Date(project.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
