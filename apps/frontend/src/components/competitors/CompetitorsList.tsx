import type { Competitor } from '@seo-saas/shared-types';
import { LoadingSpinner } from '@/components/shared';

interface CompetitorsListProps {
  competitors: Competitor[];
  loading: boolean;
  onReanalyze: (domain: string) => void;
}

export default function CompetitorsList({ competitors, loading, onReanalyze }: CompetitorsListProps) {
  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-8">
        <LoadingSpinner text="Loading competitors..." />
      </div>
    );
  }

  if (competitors.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg p-8">
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No competitors yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by analyzing your first competitor domain above.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">
          Tracked Competitors ({competitors.length})
        </h2>
      </div>
      
      <div className="divide-y divide-gray-200">
        {competitors.map((competitor) => (
          <div
            key={competitor.id}
            className="px-6 py-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center">
                  <h3 className="text-lg font-medium text-gray-900">
                    {competitor.domain}
                  </h3>
                  <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {competitor.keywordCount} keywords
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  Last analyzed: {new Date(competitor.lastAnalyzed).toLocaleString()}
                </p>
              </div>
              
              <button
                onClick={() => onReanalyze(competitor.domain)}
                className="ml-4 px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                Reanalyze
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
