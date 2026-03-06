import { CacheService } from '../cache/CacheService';
import { CacheKeys, CacheTTL } from '../cache/cacheKeys';
import * as dashboardService from './dashboardService';
import { DashboardMetrics } from './dashboardService';
import { logger } from '../../utils/logger';

/**
 * Cached Dashboard Service
 * 
 * Wraps the base dashboard service with caching functionality:
 * - Read-through pattern: Check cache first, fallback to database
 * - 5-minute cache TTL for dashboard metrics
 * - Graceful degradation on cache failures
 * 
 * Validates: Requirements 10.7, 15.4, 15.7
 */
export class CachedDashboardService {
  constructor(private cache: CacheService) {}

  /**
   * Get dashboard metrics with read-through caching
   * Implements the read-through pattern:
   * 1. Try to get from cache
   * 2. If cache miss or error, fetch from database
   * 3. Store in cache for future requests (5 minute TTL)
   * 4. Return data
   * 
   * @param userId - User ID
   * @returns Dashboard metrics
   */
  async getMetrics(userId: string): Promise<DashboardMetrics> {
    const cacheKey = CacheKeys.dashboard(userId);

    // Try cache first
    try {
      const cached = await this.cache.get<DashboardMetrics>(cacheKey);
      if (cached) {
        logger.debug(`Cache hit for dashboard: ${userId}`);
        return cached;
      }
    } catch (error) {
      logger.warn(`Cache retrieval failed for key ${cacheKey}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      // Continue to database fallback
    }

    // Cache miss - fetch from database
    logger.debug(`Cache miss for dashboard: ${userId}`);
    const metrics = await dashboardService.getMetrics(userId);

    // Try to cache the result (don't fail if caching fails)
    try {
      await this.cache.set(cacheKey, metrics, CacheTTL.DASHBOARD);
      logger.debug(`Cached dashboard metrics for user: ${userId}`);
    } catch (error) {
      logger.warn(`Cache storage failed for key ${cacheKey}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      // Continue - data is still returned from database
    }

    return metrics;
  }

  /**
   * Invalidate cache for a user's dashboard
   * Should be called when any data affecting dashboard metrics changes
   * @param userId - User ID
   */
  async invalidateCache(userId: string): Promise<void> {
    const cacheKey = CacheKeys.dashboard(userId);
    
    try {
      await this.cache.del(cacheKey);
      logger.debug(`Invalidated cache for dashboard: ${userId}`);
    } catch (error) {
      logger.warn(`Cache invalidation failed for key ${cacheKey}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - cache invalidation failure shouldn't break the operation
    }
  }
}
