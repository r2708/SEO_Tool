import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/authenticate';
import { FormattedResponse } from '../middleware/responseFormatter';
import { CachedDashboardService } from '../services/dashboard/cachedDashboardService';
import { RedisCache } from '../services/cache/RedisCache';
import { config } from '../config/env';

const router = Router();

// Initialize cache and cached dashboard service
const cache = new RedisCache(config.REDIS_URL);
const cachedDashboardService = new CachedDashboardService(cache);

/**
 * GET /api/dashboard
 * Get dashboard metrics for the authenticated user
 * Returns aggregated metrics across all user projects:
 * - Total keywords count
 * - Average ranking position
 * - Rank change percentage vs previous 30-day period
 * - Total projects count
 * - Most recent SEO score for each project
 * 
 * Results are cached for 5 minutes
 * Requires authentication
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7
 */
router.get('/', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;

    // Get dashboard metrics (with caching)
    const metrics = await cachedDashboardService.getMetrics(userId);

    // Format response
    (res as FormattedResponse).success({
      totalKeywords: metrics.totalKeywords,
      averageRank: metrics.averageRank,
      rankChange: metrics.rankChange,
      totalProjects: metrics.totalProjects,
      recentScores: metrics.recentScores.map(score => ({
        projectId: score.projectId,
        projectName: score.projectName,
        score: score.score,
        date: score.date.toISOString(),
      })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
