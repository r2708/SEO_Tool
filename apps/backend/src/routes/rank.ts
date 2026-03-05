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

    // Format response
    (res as FormattedResponse).success({
      id: result.id,
      projectId: result.projectId,
      keyword: result.keyword,
      position: result.position,
      date: result.date,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/rank/history/:projectId
 * Get ranking history for a project with optional filters
 * Requires authentication and project ownership
 * Validates: Requirements 6.5, 6.6, 11.5, 15.2, 15.5
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
    const history = await rankTrackerService.getHistory(
      projectId,
      keyword as string | undefined,
      parsedStartDate,
      parsedEndDate
    );

    // Format response as array of keywords with history arrays
    const rankings = history.map(item => ({
      keyword: item.keyword,
      history: item.history.map(entry => ({
        date: entry.date,
        position: entry.position,
      })),
    }));

    (res as FormattedResponse).success({ rankings });
  } catch (error) {
    next(error);
  }
});

export default router;
