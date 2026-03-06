'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import type { ProjectWithStats } from '@seo-saas/shared-types';
import KeywordManagement from '@/components/projects/KeywordManagement';
import RankingHistory from '@/components/projects/RankingHistory';

type TabType = 'keywords' | 'rankings' | 'competitors';

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<ProjectWithStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('keywords');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadProject();
  }, [projectId]);

  const loadProject = async () => {
    try {
      setLoading(true);
      setError(null);
      const projectData = await apiClient.get<ProjectWithStats>(`/api/projects/${projectId}`);
      setProject(projectData);
    } catch (err: any) {
      setError(err.message || 'Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    // Navigate to edit page (to be implemented)
    router.push(`/dashboard/projects/${projectId}/edit`);
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await apiClient.delete(`/api/projects/${projectId}`);
      router.push('/dashboard/projects');
    } catch (err: any) {
      alert(err.message || 'Failed to delete project');
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error || 'Project not found'}</p>
          <button
            onClick={() => router.push('/dashboard/projects')}
            className="mt-2 text-red-600 hover:text-red-700 font-medium"
          >
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
          <p className="text-gray-600 mt-1">{project.domain}</p>
          <p className="text-sm text-gray-500 mt-1">
            Created {new Date(project.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleEdit}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            Edit
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors font-medium"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-3xl font-bold text-gray-900">
            {project.keywordCount}
          </div>
          <div className="text-sm text-gray-600 mt-1">Tracked Keywords</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-3xl font-bold text-gray-900">
            {project.competitorCount}
          </div>
          <div className="text-sm text-gray-600 mt-1">Competitors</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div
            className={`text-3xl font-bold ${
              project.lastAuditScore !== undefined
                ? project.lastAuditScore >= 80
                  ? 'text-green-600'
                  : project.lastAuditScore >= 60
                  ? 'text-yellow-600'
                  : 'text-red-600'
                : 'text-gray-400'
            }`}
          >
            {project.lastAuditScore !== undefined ? project.lastAuditScore : '—'}
          </div>
          <div className="text-sm text-gray-600 mt-1">Latest SEO Score</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('keywords')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'keywords'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              Keywords
            </button>
            <button
              onClick={() => setActiveTab('rankings')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'rankings'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              Rankings
            </button>
            <button
              onClick={() => setActiveTab('competitors')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'competitors'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              Competitors
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'keywords' && (
            <KeywordManagement projectId={projectId} />
          )}
          {activeTab === 'rankings' && (
            <RankingHistory projectId={projectId} />
          )}
          {activeTab === 'competitors' && (
            <div className="text-center py-12 text-gray-600">
              Competitor analysis will be implemented in a future task
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Delete Project
            </h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete "{project.name}"? This action cannot be
              undone and will delete all associated keywords, rankings, and competitors.
            </p>
            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 flex items-center"
              >
                {deleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Deleting...
                  </>
                ) : (
                  'Delete Project'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
