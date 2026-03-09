'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import type { Project } from '@seo-saas/shared-types';

export default function EditProjectPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [formData, setFormData] = useState({
    domain: '',
    name: '',
  });
  const [errors, setErrors] = useState<{ domain?: string; name?: string }>({});
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    loadProject();
  }, [projectId]);

  const loadProject = async () => {
    try {
      const project = await apiClient.get<Project>(`/api/projects/${projectId}`);
      setFormData({
        domain: project.domain,
        name: project.name,
      });
    } catch (err: any) {
      setApiError(err.message || 'Failed to load project');
    } finally {
      setFetchLoading(false);
    }
  };

  const validateDomain = (domain: string): boolean => {
    let cleanDomain = domain.toLowerCase().trim();
    cleanDomain = cleanDomain.replace(/^https?:\/\//, '');
    cleanDomain = cleanDomain.replace(/^www\./, '');
    cleanDomain = cleanDomain.replace(/\/$/, '');
    
    const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    
    if (!cleanDomain.includes('.')) {
      return false;
    }
    
    const parts = cleanDomain.split('.');
    const tld = parts[parts.length - 1];
    if (tld.length < 2) {
      return false;
    }
    
    return domainRegex.test(cleanDomain);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
    setApiError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: { domain?: string; name?: string } = {};

    if (!formData.domain.trim()) {
      newErrors.domain = 'Domain is required';
    } else if (!validateDomain(formData.domain.trim())) {
      newErrors.domain = 'Invalid domain format. Must include TLD (e.g., example.com, not just example)';
    }

    if (!formData.name.trim()) {
      newErrors.name = 'Project name is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setLoading(true);
      setApiError(null);

      await apiClient.put(`/api/projects/${projectId}`, {
        domain: formData.domain.trim(),
        name: formData.name.trim(),
      });

      router.push(`/dashboard/projects/${projectId}`);
    } catch (err: any) {
      setApiError(err.message || 'Failed to update project');
      setLoading(false);
    }
  };

  const handleCancel = () => {
    router.push(`/dashboard/projects/${projectId}`);
  };

  if (fetchLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Edit Project</h1>
        <p className="text-gray-600 mt-1">
          Update your project details
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {apiError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">{apiError}</p>
            </div>
          )}

          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Project Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="My Website"
              disabled={loading}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="domain"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Domain
            </label>
            <input
              type="text"
              id="domain"
              name="domain"
              value={formData.domain}
              onChange={handleChange}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.domain ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="example.com"
              disabled={loading}
            />
            {errors.domain && (
              <p className="mt-1 text-sm text-red-600">{errors.domain}</p>
            )}
            <p className="mt-1 text-sm text-gray-500">
              Enter domain without protocol (e.g., example.com, not https://example.com)
            </p>
          </div>

          <div className="flex items-center justify-end space-x-4 pt-4">
            <button
              type="button"
              onClick={handleCancel}
              disabled={loading}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 flex items-center"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Updating...
                </>
              ) : (
                'Update Project'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
