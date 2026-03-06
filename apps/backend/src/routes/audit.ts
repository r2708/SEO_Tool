import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/authenticate';
import { FormattedResponse } from '../middleware/responseFormatter';
import { analyze, getScoreHistory } from '../services/seo/seoAnalyzerService';
import { ValidationError } from '../errors/ValidationError';
import { AuthorizationError } from '../errors/AuthorizationError';
import * as projectService from '../services/project/projectService';

const router = Router();

/**
 * POST /api/audit
 * Analyze a URL for SEO elements and calculate score
 * Optionally store score in project history if projectId is provided
 * Requires authentication
 * Validates: Requirements 7.1, 7.8, 7.9
 */
router.post('/', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { url, projectId } = req.body;
    const userId = req.user!.id;

    // Validate that url is provided
    if (!url) {
      throw new ValidationError('url is required');
    }

    // If projectId is provided, verify the user owns the project
    if (projectId) {
      const isOwner = await projectService.verifyOwnership(projectId, userId);
      if (!isOwner) {
        throw new AuthorizationError('You do not have permission to access this project');
      }
    }

    // Analyze the URL (will store score if projectId is provided)
    const analysis = await analyze(url, projectId);

    // Return the full analysis
    (res as FormattedResponse).success({
      url: analysis.url,
      score: analysis.score,
      analysis: {
        title: analysis.title,
        metaDescription: analysis.metaDescription,
        headings: analysis.headings,
        images: analysis.images,
        links: analysis.links,
      },
      recommendations: analysis.recommendations,
      analyzedAt: analysis.analyzedAt.toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/audit/history/:projectId
 * Get SEO score history for a project
 * Supports date range filtering with startDate and endDate query parameters
 * Requires authentication and project ownership
 * Validates: Requirements 12.1, 12.2, 12.3, 12.4
 */
router.get('/history/:projectId', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { projectId } = req.params;
    const { startDate, endDate } = req.query;
    const userId = req.user!.id;

    // Verify the user owns the project
    const isOwner = await projectService.verifyOwnership(projectId, userId);
    if (!isOwner) {
      throw new AuthorizationError('You do not have permission to access this project');
    }

    // Parse date parameters if provided
    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;

    // Get score history
    const scores = await getScoreHistory(projectId, start, end);

    // Return the score history
    (res as FormattedResponse).success({
      scores: scores.map(score => ({
        score: score.score,
        url: score.url,
        createdAt: score.date.toISOString(),
        scoreChange: score.scoreChange,
      })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
