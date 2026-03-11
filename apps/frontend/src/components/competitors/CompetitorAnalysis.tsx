import React, { useState } from 'react';
import { competitorAPI } from '../../lib/api-client';

interface CompetitorAnalysisProps {
  projectId: string;
  onAnalysisComplete?: () => void;
}

interface AnalysisResult {
  competitor: string;
  keywords: string[];
  overlap: {
    shared: string[];
    competitorOnly: string[];
    userOnly: string[];
  };
  lastAnalyzed: string;
}

export const CompetitorAnalysis: React.FC<CompetitorAnalysisProps> = ({
  projectId,
  onAnalysisComplete,
}) => {
  const [domain, setDomain] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!domain.trim()) {
      setError('Please enter a competitor domain');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const analysisResult: AnalysisResult = await competitorAPI.analyzeCompetitor(projectId, domain.trim()) as AnalysisResult;
      setResult(analysisResult);
      onAnalysisComplete?.();
    } catch (err: any) {
      setError(err.message || 'Failed to analyze competitor');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isAnalyzing) {
      handleAnalyze();
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">
        Analyze Competitor
      </h2>

      {/* Input Form */}
      <div className="mb-6">
        <div className="flex gap-3">
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter competitor domain (e.g., example.com)"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isAnalyzing}
          />
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !domain.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isAnalyzing ? 'Analyzing...' : 'Analyze Competitor'}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Loading State */}
      {isAnalyzing && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <span className="text-blue-700">
              Analyzing competitor website and extracting keywords...
            </span>
          </div>
        </div>
      )}

      {/* Analysis Results */}
      {result && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-800 mb-3">
              Analysis Summary
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {result.keywords.length}
                </div>
                <div className="text-sm text-gray-600">Total Keywords Found</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {result.overlap.shared.length}
                </div>
                <div className="text-sm text-gray-600">Shared Keywords</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {result.overlap.competitorOnly.length}
                </div>
                <div className="text-sm text-gray-600">Competitor-Only Keywords</div>
              </div>
            </div>
          </div>

          {/* Keyword Overlap Details */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Shared Keywords */}
            <div className="bg-green-50 rounded-lg p-4">
              <h4 className="font-medium text-green-800 mb-3">
                Shared Keywords ({result.overlap.shared.length})
              </h4>
              <div className="max-h-40 overflow-y-auto">
                {result.overlap.shared.length > 0 ? (
                  <div className="space-y-1">
                    {result.overlap.shared.slice(0, 10).map((keyword, index) => (
                      <div
                        key={index}
                        className="text-sm text-green-700 bg-green-100 px-2 py-1 rounded"
                      >
                        {keyword}
                      </div>
                    ))}
                    {result.overlap.shared.length > 10 && (
                      <div className="text-xs text-green-600 mt-2">
                        +{result.overlap.shared.length - 10} more...
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-green-600">No shared keywords found</div>
                )}
              </div>
            </div>

            {/* Competitor-Only Keywords */}
            <div className="bg-orange-50 rounded-lg p-4">
              <h4 className="font-medium text-orange-800 mb-3">
                Competitor-Only Keywords ({result.overlap.competitorOnly.length})
              </h4>
              <div className="max-h-40 overflow-y-auto">
                {result.overlap.competitorOnly.length > 0 ? (
                  <div className="space-y-1">
                    {result.overlap.competitorOnly.slice(0, 10).map((keyword, index) => (
                      <div
                        key={index}
                        className="text-sm text-orange-700 bg-orange-100 px-2 py-1 rounded"
                      >
                        {keyword}
                      </div>
                    ))}
                    {result.overlap.competitorOnly.length > 10 && (
                      <div className="text-xs text-orange-600 mt-2">
                        +{result.overlap.competitorOnly.length - 10} more...
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-orange-600">No competitor-only keywords found</div>
                )}
              </div>
            </div>

            {/* Your-Only Keywords */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="font-medium text-blue-800 mb-3">
                Your-Only Keywords ({result.overlap.userOnly.length})
              </h4>
              <div className="max-h-40 overflow-y-auto">
                {result.overlap.userOnly.length > 0 ? (
                  <div className="space-y-1">
                    {result.overlap.userOnly.slice(0, 10).map((keyword, index) => (
                      <div
                        key={index}
                        className="text-sm text-blue-700 bg-blue-100 px-2 py-1 rounded"
                      >
                        {keyword}
                      </div>
                    ))}
                    {result.overlap.userOnly.length > 10 && (
                      <div className="text-xs text-blue-600 mt-2">
                        +{result.overlap.userOnly.length - 10} more...
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-blue-600">No unique keywords found</div>
                )}
              </div>
            </div>
          </div>

          {/* Analysis Info */}
          <div className="text-sm text-gray-500 text-center">
            Analysis completed on {new Date(result.lastAnalyzed).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
};