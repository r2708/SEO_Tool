'use client';

import { useAuth } from '@/lib/auth-context';

export default function ContentPage() {
  const { user } = useAuth();

  const isPro = user?.role === 'Pro' || user?.role === 'Admin';

  if (!isPro) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Content Optimizer</h1>
          <p className="text-gray-600 mt-1">AI-powered content optimization</p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-12 text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Pro Feature
          </h2>
          <p className="text-gray-600 mb-6">
            Upgrade to Pro to access AI-powered content optimization
          </p>
          <button className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
            Upgrade to Pro
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Content Optimizer</h1>
        <p className="text-gray-600 mt-1">AI-powered content optimization</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <div className="text-6xl mb-4">✍️</div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Content Optimizer
        </h2>
        <p className="text-gray-600">
          This feature will be implemented in a future task
        </p>
      </div>
    </div>
  );
}
