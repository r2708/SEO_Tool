import { Router } from 'express';
import { authenticate, requirePro, AuthenticatedRequest } from '../middleware';
import { FormattedResponse } from '../middleware/responseFormatter';
import { ValidationError } from '../errors/ValidationError';
import { scoreContent } from '../services/content/contentOptimizerService';

const router = Router();

/**
 * POST /api/content/score
 * Score content for SEO optimization using AI analysis
 * Requires authentication and Pro role
 * Validates: Requirements 9.1, 9.5, 9.6, 9.7, 9.8
 */
router.post('/score', authenticate, requirePro, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { content, targetKeyword } = req.body;

    // Validate request body
    if (!content || typeof content !== 'string') {
      throw new ValidationError('content is required and must be a string');
    }

    if (!targetKeyword || typeof targetKeyword !== 'string') {
      throw new ValidationError('targetKeyword is required and must be a string');
    }

    if (content.trim().length === 0) {
      throw new ValidationError('content cannot be empty');
    }

    if (targetKeyword.trim().length === 0) {
      throw new ValidationError('targetKeyword cannot be empty');
    }

    // Score the content
    const result = await scoreContent(content, targetKeyword);

    // Format response
    (res as FormattedResponse).success({
      score: result.score,
      missingKeywords: result.missingKeywords,
      suggestedHeadings: result.suggestedHeadings,
      analysis: {
        keywordDensity: result.analysis.keywordDensity,
        readabilityScore: result.analysis.readabilityScore,
        contentLength: result.analysis.contentLength,
        recommendedLength: result.analysis.recommendedLength,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
