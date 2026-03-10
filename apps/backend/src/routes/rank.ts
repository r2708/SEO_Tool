import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/authenticate';
import { FormattedResponse } from '../middleware/responseFormatter';
import { CachedRankTrackerService } from '../services/rank/cachedRankTrackerService';
import { RedisCache } from '../services/cache/RedisCache';
import { config } from '../config/env';
import { ValidationError } from '../errors/ValidationError';
import { AuthorizationError } from '../errors/AuthorizationError';
import * as projectService from '../services/project/projectService';

const router = Router();

// Initialize cache and cached rank tracker service
const cache = new RedisCache(config.REDIS_URL);
const rankTrackerService = new CachedRankTrackerService(cache);

/**
 * POST /api/rank/track
 * Record a keyword ranking for a project
 * Requires authentication and project ownership
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.7
 */
router.post('/track', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { projectId, keyword, position } = req.body;
    const userId = req.user!.id;

    // Validate request body
    if (!projectId) {
      throw new ValidationError('projectId is required');
    }

    if (!keyword) {
      throw new ValidationError('keyword is required');
    }

    if (position === undefined || position === null) {
      throw new ValidationError('position is required');
    }

    // Verify project ownership
    const isOwner = await projectService.verifyOwnership(projectId, userId);
    if (!isOwner) {
      throw new AuthorizationError('You do not have permission to access this project');
    }

    // Track ranking (validates position constraints)
    const result = await rankTrackerService.track(projectId, keyword, position);

    // Use 201 for creates, 200 for updates
    const statusCode = result.isUpdate ? 200 : 201;

    // Format response
    (res as FormattedResponse).success({
      id: result.id,
      projectId: result.projectId,
      keyword: result.keyword,
      position: result.position,
      date: result.date,
    }, statusCode);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/rank/keywords/:projectId
 * Get all keywords for a project that have rankings or are available for tracking
 * Requires authentication and project ownership
 */
router.get('/keywords/:projectId', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { projectId } = req.params;
    const userId = req.user!.id;

    // Verify project ownership
    const isOwner = await projectService.verifyOwnership(projectId, userId);
    if (!isOwner) {
      throw new AuthorizationError('You do not have permission to access this project');
    }

    // Get keywords from the keyword service
    const { keywords } = await rankTrackerService.getProjectKeywords(projectId);

    (res as FormattedResponse).success({
      keywords,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/rank/history/:projectId
 * Get ranking history for a project with optional filters and pagination
 * Requires authentication and project ownership
 * Validates: Requirements 6.5, 6.6, 11.5, 15.2, 15.5, 20.4, 20.5
 */
router.get('/history/:projectId', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { projectId } = req.params;
    const { keyword, startDate, endDate } = req.query;
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

    // Parse date parameters
    let parsedStartDate: Date | undefined;
    let parsedEndDate: Date | undefined;

    if (startDate) {
      parsedStartDate = new Date(startDate as string);
      if (isNaN(parsedStartDate.getTime())) {
        throw new ValidationError('Invalid startDate format. Use YYYY-MM-DD');
      }
    }

    if (endDate) {
      parsedEndDate = new Date(endDate as string);
      if (isNaN(parsedEndDate.getTime())) {
        throw new ValidationError('Invalid endDate format. Use YYYY-MM-DD');
      }
    }

    // Get ranking history (uses caching)
    const { history, total } = await rankTrackerService.getHistory(
      projectId,
      keyword as string | undefined,
      parsedStartDate,
      parsedEndDate,
      skip,
      take
    );

    // Format response as array of keywords with history arrays
    const rankings = history.map(item => ({
      keyword: item.keyword,
      history: item.history.map(entry => ({
        date: entry.date,
        position: entry.position,
      })),
    }));

    // Calculate total pages
    const totalPages = Math.ceil(total / pageSize);

    (res as FormattedResponse).success({
      rankings,
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
