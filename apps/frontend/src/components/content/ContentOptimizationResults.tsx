'use client';

import type { ContentScore } from '@seo-saas/shared-types';

interface ContentOptimizationResultsProps {
  result: ContentScore;
  targetKeyword: string;
}

export default function ContentOptimizationResults({ result, targetKeyword }: ContentOptimizationResultsProps) {
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

  const getImportanceColor = (index: number) => {
    if (index < 3) return 'bg-red-100 text-red-800';
    if (index < 6) return 'bg-orange-100 text-orange-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  const getImportanceLabel = (index: number) => {
    if (index < 3) return 'High';
    if (index < 6) return 'Medium';
    return 'Low';
  };

  return (
    <div className="space-y-6">
      {/* Overall Score */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Content Optimization Results</h2>
            <p className="text-gray-600">Target Keyword: <span className="font-semibold">{targetKeyword}</span></p>
          </div>
          <div className="text-center">
            <div className={`text-6xl font-bold ${getScoreColor(result.score)}`}>
              {result.score}
            </div>
            <div className={`text-sm font-medium mt-2 px-4 py-1 rounded-full ${getScoreBgColor(result.score)} ${getScoreColor(result.score)}`}>
              {getScoreLabel(result.score)}
            </div>
          </div>
        </div>
      </div>

      {/* Analysis Metrics */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <span className="text-2xl mr-3">📊</span>
          <h3 className="text-lg font-semibold text-gray-900">Content Metrics</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-md p-4">
            <div className="text-2xl font-bold text-gray-900">
              {result.analysis.keywordDensity.toFixed(2)}%
            </div>
            <div className="text-sm text-gray-600 mt-1">Keyword Density</div>
            {result.analysis.keywordDensity >= 1 && result.analysis.keywordDensity <= 3 ? (
              <span className="text-xs text-green-600 mt-1 inline-block">✓ Optimal</span>
            ) : (
              <span className="text-xs text-yellow-600 mt-1 inline-block">
                {result.analysis.keywordDensity < 1 ? '⚠ Too low' : '⚠ Too high'}
              </span>
            )}
          </div>
          
          <div className="bg-gray-50 rounded-md p-4">
            <div className="text-2xl font-bold text-gray-900">
              {result.analysis.readabilityScore}
            </div>
            <div className="text-sm text-gray-600 mt-1">Readability Score</div>
            {result.analysis.readabilityScore >= 60 ? (
              <span className="text-xs text-green-600 mt-1 inline-block">✓ Good</span>
            ) : (
              <span className="text-xs text-yellow-600 mt-1 inline-block">⚠ Needs work</span>
            )}
          </div>
          
          <div className="bg-gray-50 rounded-md p-4">
            <div className="text-2xl font-bold text-gray-900">
              {result.analysis.contentLength}
            </div>
            <div className="text-sm text-gray-600 mt-1">Current Length</div>
            <span className="text-xs text-gray-500 mt-1 inline-block">words</span>
          </div>
          
          <div className="bg-gray-50 rounded-md p-4">
            <div className="text-2xl font-bold text-blue-600">
              {result.analysis.recommendedLength}
            </div>
            <div className="text-sm text-gray-600 mt-1">Recommended Length</div>
            <span className="text-xs text-gray-500 mt-1 inline-block">words</span>
          </div>
        </div>
        
        {result.analysis.contentLength < result.analysis.recommendedLength && (
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-md p-3">
            <p className="text-sm text-blue-800">
              💡 Consider adding {result.analysis.recommendedLength - result.analysis.contentLength} more words to match top-ranking content length.
            </p>
          </div>
        )}
      </div>

      {/* Missing Keywords */}
      {result.missingKeywords.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center mb-4">
            <span className="text-2xl mr-3">🔑</span>
            <h3 className="text-lg font-semibold text-gray-900">Missing Keywords</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            These keywords appear frequently in top-ranking content but are missing from your article:
          </p>
          <div className="flex flex-wrap gap-2">
            {result.missingKeywords.map((keyword, index) => (
              <div
                key={index}
                className="flex items-center space-x-2 px-3 py-2 rounded-md border border-gray-200 bg-gray-50"
              >
                <span className="text-gray-900 font-medium">{keyword}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${getImportanceColor(index)}`}>
                  {getImportanceLabel(index)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <p className="text-sm text-yellow-800">
              💡 Try incorporating these keywords naturally throughout your content to improve relevance.
            </p>
          </div>
        </div>
      )}

      {/* Suggested Headings */}
      {result.suggestedHeadings.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center mb-4">
            <span className="text-2xl mr-3">📑</span>
            <h3 className="text-lg font-semibold text-gray-900">Suggested Heading Structure</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Based on analysis of top-ranking content, consider using these headings:
          </p>
          <div className="bg-gray-50 rounded-md p-4 space-y-2">
            {result.suggestedHeadings.map((heading, index) => (
              <div
                key={index}
                className="flex items-start space-x-3 p-3 bg-white rounded border border-gray-200"
              >
                <span className="text-blue-600 font-semibold text-sm mt-0.5">
                  {index + 1}.
                </span>
                <span className="text-gray-900 flex-1">{heading}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-md p-3">
            <p className="text-sm text-blue-800">
              💡 These heading suggestions are based on common patterns in top-ranking articles for your target keyword.
            </p>
          </div>
        </div>
      )}

      {/* Actionable Recommendations */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <span className="text-2xl mr-3">💡</span>
          <h3 className="text-lg font-semibold text-gray-900">Actionable Recommendations</h3>
        </div>
        <div className="space-y-3">
          {result.analysis.keywordDensity < 1 && (
            <div className="flex items-start p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <span className="text-yellow-600 mr-2 mt-0.5">⚠</span>
              <div>
                <p className="text-sm font-medium text-yellow-900">Increase keyword usage</p>
                <p className="text-sm text-yellow-800 mt-1">
                  Your target keyword appears too infrequently. Aim for 1-3% keyword density by naturally incorporating "{targetKeyword}" more often.
                </p>
              </div>
            </div>
          )}
          
          {result.analysis.keywordDensity > 3 && (
            <div className="flex items-start p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <span className="text-yellow-600 mr-2 mt-0.5">⚠</span>
              <div>
                <p className="text-sm font-medium text-yellow-900">Reduce keyword stuffing</p>
                <p className="text-sm text-yellow-800 mt-1">
                  Your keyword density is too high, which may be seen as keyword stuffing. Use synonyms and related terms instead.
                </p>
              </div>
            </div>
          )}
          
          {result.analysis.contentLength < result.analysis.recommendedLength && (
            <div className="flex items-start p-3 bg-blue-50 border border-blue-200 rounded-md">
              <span className="text-blue-600 mr-2 mt-0.5">ℹ</span>
              <div>
                <p className="text-sm font-medium text-blue-900">Expand your content</p>
                <p className="text-sm text-blue-800 mt-1">
                  Top-ranking articles average {result.analysis.recommendedLength} words. Consider adding more depth and detail to your content.
                </p>
              </div>
            </div>
          )}
          
          {result.missingKeywords.length > 0 && (
            <div className="flex items-start p-3 bg-purple-50 border border-purple-200 rounded-md">
              <span className="text-purple-600 mr-2 mt-0.5">✨</span>
              <div>
                <p className="text-sm font-medium text-purple-900">Add related keywords</p>
                <p className="text-sm text-purple-800 mt-1">
                  Incorporate the {result.missingKeywords.length} missing keywords listed above to improve topical relevance and coverage.
                </p>
              </div>
            </div>
          )}
          
          {result.suggestedHeadings.length > 0 && (
            <div className="flex items-start p-3 bg-green-50 border border-green-200 rounded-md">
              <span className="text-green-600 mr-2 mt-0.5">✓</span>
              <div>
                <p className="text-sm font-medium text-green-900">Improve content structure</p>
                <p className="text-sm text-green-800 mt-1">
                  Use the suggested headings to organize your content in a way that matches user search intent and top-ranking articles.
                </p>
              </div>
            </div>
          )}
          
          {result.analysis.readabilityScore < 60 && (
            <div className="flex items-start p-3 bg-orange-50 border border-orange-200 rounded-md">
              <span className="text-orange-600 mr-2 mt-0.5">⚠</span>
              <div>
                <p className="text-sm font-medium text-orange-900">Improve readability</p>
                <p className="text-sm text-orange-800 mt-1">
                  Your content may be difficult to read. Use shorter sentences, simpler words, and break up long paragraphs.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
