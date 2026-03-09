import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/authenticate';
import { FormattedResponse } from '../middleware/responseFormatter';
import { CachedCompetitorService } from '../services/competitor/cachedCompetitorService';
import { RedisCache } from '../services/cache/RedisCache';
import { config } from '../config/env';
import { ValidationError } from '../errors/ValidationError';
import { AuthorizationError } from '../errors/AuthorizationError';
import * as projectService from '../services/project/projectService';

const router = Router();

// Initialize cache and cached competitor service
const cache = new RedisCache(config.REDIS_URL);
const competitorService = new CachedCompetitorService(cache);

/**
 * POST /api/competitors/analyze
 * Analyze a competitor domain and calculate keyword overlap
 * Requires authentication and project ownership
 * Caches results for 12 hours
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 15.3
 */
router.post('/analyze', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { projectId, competitorDomain } = req.body;
    const userId = req.user!.id;

    // Validate request body
    if (!projectId) {
      throw new ValidationError('projectId is required');
    }

    if (!competitorDomain || typeof competitorDomain !== 'string') {
      throw new ValidationError('competitorDomain is required and must be a string');
    }

    if (competitorDomain.trim().length === 0) {
      throw new ValidationError('competitorDomain cannot be empty');
    }

    // Verify project ownership
    const isOwner = await projectService.verifyOwnership(projectId, userId);
    if (!isOwner) {
      throw new AuthorizationError('You do not have permission to access this project');
    }

    // Analyze competitor (uses caching - 12 hour TTL)
    const analysis = await competitorService.analyze(projectId, competitorDomain);

    // Format response
    const response = {
      competitor: analysis.competitor,
      keywords: analysis.keywords,
      overlap: {
        shared: analysis.overlap.shared,
        competitorOnly: analysis.overlap.competitorOnly,
        userOnly: analysis.overlap.userOnly,
      },
      lastAnalyzed: analysis.lastAnalyzed.toISOString(),
    };

    (res as FormattedResponse).success(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/competitors/:projectId
 * List all competitors for a project with keyword counts, last analyzed timestamp, and pagination
 * Requires authentication and project ownership
 * Validates: Requirements 8.7, 20.4, 20.5
 */
router.get('/:projectId', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { projectId } = req.params;
    const userId = req.user!.id;

    // Verify project ownership
    const isOwner = await projectService.verifyOwnership(projectId, userId);
    if (!isOwner) {
      throw new AuthorizationError('You do not have permission to access this project');
    }

    // Parse pagination parameters
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const parsedPageSize = parseInt(req.query.pageSize as string);
    const pageSize = Math.min(100, Math.max(1, isNaN(parsedPageSize) ? 50 : parsedPageSize));

    // Calculate skip and take for Prisma
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    // Get competitors for project
    const { competitors, total } = await competitorService.findByProject(projectId, skip, take);

    // Format response
    const formattedCompetitors = competitors.map(competitor => ({
      id: competitor.id,
      domain: competitor.domain,
      keywordCount: competitor.keywordCount,
      lastAnalyzed: competitor.lastAnalyzed.toISOString(),
    }));

    // Calculate total pages
    const totalPages = Math.ceil(total / pageSize);

    (res as FormattedResponse).success({
      competitors: formattedCompetitors,
      pagination: {
        total,
        page,
        pageSize,
        totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
