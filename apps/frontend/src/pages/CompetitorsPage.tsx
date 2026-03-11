import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { CompetitorAnalysis } from '../components/competitors/CompetitorAnalysis';
import { CompetitorList } from '../components/competitors/CompetitorList';
import { apiClient } from '../lib/api-client';

interface Project {
  id: string;
  name: string;
  domain: string;
}

const CompetitorsPage: React.FC = () => {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await apiClient.get<{ projects: Project[] }>('/api/projects');
      setProjects(response.projects);
      
      // Auto-select first project if available
      if (response.projects.length > 0 && !selectedProjectId) {
        setSelectedProjectId(response.projects[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalysisComplete = () => {
    // Trigger refresh of competitor list
    setRefreshTrigger(prev => prev + 1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => router.back()}
                className="mr-4 p-2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Competitor Analysis</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {projects.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 mb-4">No projects found</div>
            <button
              onClick={() => router.push('/projects')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Your First Project
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Project Selector */}
            <div className="bg-white rounded-lg shadow-md p-6">
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
                <CompetitorAnalysis
                  projectId={selectedProjectId}
                  onAnalysisComplete={handleAnalysisComplete}
                />

                {/* Competitor List */}
                <CompetitorList
                  projectId={selectedProjectId}
                  refreshTrigger={refreshTrigger}
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CompetitorsPage;