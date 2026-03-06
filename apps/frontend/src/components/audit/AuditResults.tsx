'use client';

import type { SEOAnalysis } from '@seo-saas/shared-types';

interface AuditResultsProps {
  analysis: SEOAnalysis;
}

export default function AuditResults({ analysis }: AuditResultsProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-100';
    if (score >= 60) return 'bg-yellow-100';
    if (score >= 40) return 'bg-orange-100';
    return 'bg-red-100';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Improvement';
  };

  const getOptimalBadge = (optimal: boolean) => {
    return optimal ? (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
        ✓ Optimal
      </span>
    ) : (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
        ⚠ Needs Attention
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Overall Score */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">SEO Analysis Results</h2>
            <p className="text-gray-600">{analysis.url}</p>
            <p className="text-sm text-gray-500 mt-1">
              Analyzed on {new Date(analysis.analyzedAt).toLocaleString()}
            </p>
          </div>
          <div className="text-center">
            <div className={`text-6xl font-bold ${getScoreColor(analysis.score)}`}>
              {analysis.score}
            </div>
            <div className={`text-sm font-medium mt-2 px-4 py-1 rounded-full ${getScoreBgColor(analysis.score)} ${getScoreColor(analysis.score)}`}>
              {getScoreLabel(analysis.score)}
            </div>
          </div>
        </div>
      </div>

      {/* Title Analysis */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center">
            <span className="text-2xl mr-3">📝</span>
            <h3 className="text-lg font-semibold text-gray-900">Title Tag</h3>
          </div>
          {getOptimalBadge(analysis.analysis.title.optimal)}
        </div>
        <div className="space-y-2">
          <div className="bg-gray-50 rounded-md p-4">
            <p className="text-gray-900 font-medium">{analysis.analysis.title.content || '(No title found)'}</p>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Length: {analysis.analysis.title.length} characters</span>
            <span className="text-gray-500">Optimal: 50-60 characters</span>
          </div>
          {!analysis.analysis.title.optimal && (
            <p className="text-sm text-yellow-700 bg-yellow-50 rounded-md p-3">
              {analysis.analysis.title.length < 50 
                ? 'Title is too short. Consider adding more descriptive keywords.'
                : 'Title is too long. It may be truncated in search results.'}
            </p>
          )}
        </div>
      </div>

      {/* Meta Description Analysis */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center">
            <span className="text-2xl mr-3">📄</span>
            <h3 className="text-lg font-semibold text-gray-900">Meta Description</h3>
          </div>
          {getOptimalBadge(analysis.analysis.metaDescription.optimal)}
        </div>
        <div className="space-y-2">
          <div className="bg-gray-50 rounded-md p-4">
            <p className="text-gray-900">{analysis.analysis.metaDescription.content || '(No meta description found)'}</p>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Length: {analysis.analysis.metaDescription.length} characters</span>
            <span className="text-gray-500">Optimal: 150-160 characters</span>
          </div>
          {!analysis.analysis.metaDescription.optimal && (
            <p className="text-sm text-yellow-700 bg-yellow-50 rounded-md p-3">
              {analysis.analysis.metaDescription.length < 150
                ? 'Meta description is too short. Add more details to improve click-through rates.'
                : 'Meta description is too long. It may be truncated in search results.'}
            </p>
          )}
        </div>
      </div>

      {/* Heading Structure */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <span className="text-2xl mr-3">📑</span>
          <h3 className="text-lg font-semibold text-gray-900">Heading Structure</h3>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-gray-50 rounded-md p-4">
            <div className="text-3xl font-bold text-gray-900">{analysis.analysis.headings.h1Count}</div>
            <div className="text-sm text-gray-600 mt-1">H1 Tags</div>
            {analysis.analysis.headings.h1Count === 1 ? (
              <span className="text-xs text-green-600 mt-1 inline-block">✓ Perfect</span>
            ) : (
              <span className="text-xs text-yellow-600 mt-1 inline-block">
                {analysis.analysis.headings.h1Count === 0 ? '⚠ Missing H1' : '⚠ Multiple H1s'}
              </span>
            )}
          </div>
          <div className="bg-gray-50 rounded-md p-4">
            <div className="text-3xl font-bold text-gray-900">{analysis.analysis.headings.h2Count}</div>
            <div className="text-sm text-gray-600 mt-1">H2 Tags</div>
            {analysis.analysis.headings.h2Count > 0 ? (
              <span className="text-xs text-green-600 mt-1 inline-block">✓ Good</span>
            ) : (
              <span className="text-xs text-yellow-600 mt-1 inline-block">⚠ No H2s found</span>
            )}
          </div>
        </div>
        {analysis.analysis.headings.structure.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Heading Hierarchy:</h4>
            <div className="bg-gray-50 rounded-md p-4 max-h-48 overflow-y-auto">
              <ul className="space-y-1">
                {analysis.analysis.headings.structure.map((heading, index) => (
                  <li key={index} className="text-sm text-gray-700 font-mono">
                    {heading}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Image Analysis */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <span className="text-2xl mr-3">🖼️</span>
          <h3 className="text-lg font-semibold text-gray-900">Images</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-md p-4">
            <div className="text-3xl font-bold text-gray-900">{analysis.analysis.images.total}</div>
            <div className="text-sm text-gray-600 mt-1">Total Images</div>
          </div>
          <div className="bg-gray-50 rounded-md p-4">
            <div className={`text-3xl font-bold ${analysis.analysis.images.missingAlt > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {analysis.analysis.images.missingAlt}
            </div>
            <div className="text-sm text-gray-600 mt-1">Missing Alt Text</div>
            {analysis.analysis.images.missingAlt === 0 && analysis.analysis.images.total > 0 ? (
              <span className="text-xs text-green-600 mt-1 inline-block">✓ All images have alt text</span>
            ) : analysis.analysis.images.missingAlt > 0 ? (
              <span className="text-xs text-red-600 mt-1 inline-block">⚠ Add alt text for accessibility</span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Link Analysis */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <span className="text-2xl mr-3">🔗</span>
          <h3 className="text-lg font-semibold text-gray-900">Links</h3>
        </div>
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-md p-4">
            <div className="text-3xl font-bold text-gray-900">{analysis.analysis.links.internal}</div>
            <div className="text-sm text-gray-600 mt-1">Internal Links</div>
            {analysis.analysis.links.internal > 3 ? (
              <span className="text-xs text-green-600 mt-1 inline-block">✓ Good internal linking</span>
            ) : (
              <span className="text-xs text-yellow-600 mt-1 inline-block">⚠ Consider adding more internal links</span>
            )}
          </div>
          
          {analysis.analysis.links.broken.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-red-700 mb-2">
                ⚠ Broken Links Found ({analysis.analysis.links.broken.length})
              </h4>
              <div className="bg-red-50 rounded-md p-4 max-h-48 overflow-y-auto">
                <ul className="space-y-1">
                  {analysis.analysis.links.broken.map((link, index) => (
                    <li key={index} className="text-sm text-red-700 break-all">
                      {link}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          
          {analysis.analysis.links.broken.length === 0 && (
            <div className="bg-green-50 rounded-md p-4">
              <p className="text-sm text-green-700">✓ No broken links detected</p>
            </div>
          )}
        </div>
      </div>

      {/* Recommendations */}
      {analysis.recommendations.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center mb-4">
            <span className="text-2xl mr-3">💡</span>
            <h3 className="text-lg font-semibold text-gray-900">Recommendations</h3>
          </div>
          <ul className="space-y-3">
            {analysis.recommendations.map((recommendation, index) => (
              <li key={index} className="flex items-start">
                <span className="text-blue-600 mr-2 mt-1">•</span>
                <span className="text-gray-700">{recommendation}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
