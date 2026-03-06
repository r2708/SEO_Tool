import type { CompetitorAnalysis } from '@seo-saas/shared-types';

interface CompetitorAnalysisResultsProps {
  analysis: CompetitorAnalysis;
}

export default function CompetitorAnalysisResults({ analysis }: CompetitorAnalysisResultsProps) {
  const { competitor, overlap, lastAnalyzed } = analysis;
  const { shared, competitorOnly, userOnly } = overlap;

  return (
    <div className="bg-white shadow rounded-lg p-6 mb-8">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-900">
          Analysis Results: {competitor}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Last analyzed: {new Date(lastAnalyzed).toLocaleString()}
        </p>
      </div>

      {/* Keyword Counts Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm font-medium text-blue-600">Shared Keywords</div>
          <div className="text-3xl font-bold text-blue-900 mt-2">{shared.length}</div>
          <div className="text-xs text-blue-600 mt-1">Keywords you both rank for</div>
        </div>
        
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-sm font-medium text-green-600">Opportunities</div>
          <div className="text-3xl font-bold text-green-900 mt-2">{competitorOnly.length}</div>
          <div className="text-xs text-green-600 mt-1">Keywords they rank for (you don't)</div>
        </div>
        
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="text-sm font-medium text-purple-600">Your Unique Keywords</div>
          <div className="text-3xl font-bold text-purple-900 mt-2">{userOnly.length}</div>
          <div className="text-xs text-purple-600 mt-1">Keywords only you rank for</div>
        </div>
      </div>

      {/* Keyword Lists */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Shared Keywords */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
            <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
            Shared Keywords
          </h3>
          <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
            {shared.length > 0 ? (
              <ul className="space-y-2">
                {shared.map((keyword, index) => (
                  <li
                    key={index}
                    className="text-sm text-gray-700 bg-white px-3 py-2 rounded border border-gray-200"
                  >
                    {keyword}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 italic">No shared keywords found</p>
            )}
          </div>
        </div>

        {/* Competitor-Only Keywords (Opportunities) */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
            <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
            Opportunities
          </h3>
          <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
            {competitorOnly.length > 0 ? (
              <ul className="space-y-2">
                {competitorOnly.map((keyword, index) => (
                  <li
                    key={index}
                    className="text-sm text-gray-700 bg-white px-3 py-2 rounded border border-green-200"
                  >
                    {keyword}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 italic">No opportunities found</p>
            )}
          </div>
        </div>

        {/* User-Only Keywords */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
            <span className="w-3 h-3 bg-purple-500 rounded-full mr-2"></span>
            Your Unique Keywords
          </h3>
          <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
            {userOnly.length > 0 ? (
              <ul className="space-y-2">
                {userOnly.map((keyword, index) => (
                  <li
                    key={index}
                    className="text-sm text-gray-700 bg-white px-3 py-2 rounded border border-purple-200"
                  >
                    {keyword}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 italic">No unique keywords found</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
