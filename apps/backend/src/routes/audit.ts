import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/authenticate';
import { FormattedResponse } from '../middleware/responseFormatter';
import { analyze } from '../services/seo/seoAnalyzerService';
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

export default router;
