import { CacheService } from '../cache/CacheService';
import { CacheKeys, CacheTTL } from '../cache/cacheKeys';
import * as rankTrackerService from './rankTrackerService';
import { RankRecord, RankHistory } from './rankTrackerService';
import { logger } from '../../utils/logger';

/**
 * Cached Rank Tracker Service
 * Wraps the base rank tracker service with caching layer
 * Cache TTL: 1 hour for ranking history
 * Invalidates cache on new ranking data
 */
export class CachedRankTrackerService {
  constructor(private cache: CacheService) {}

  /**
   * Track a keyword ranking (invalidates cache)
   * @param projectId - Project ID
   * @param keyword - Keyword being tracked
   * @param position - Position in search results (1-100)
   * @param date - Optional date (defaults to today)
   * @returns Stored ranking record
   */
  async track(
    projectId: string,
    keyword: string,
    position: number,
    date?: Date
  ): Promise<RankRecord> {
    const result = await rankTrackerService.track(projectId, keyword, position, date);

    // Invalidate cache for this project
    await this.invalidateCache(projectId);

    return result;
  }

  /**
   * Get ranking history with caching
   * @param projectId - Project ID
   * @param keyword - Optional keyword filter
   * @param startDate - Optional start date filter
   * @param endDate - Optional end date filter
   * @returns Array of ranking history grouped by keyword
   */
  async getHistory(
    projectId: string,
    keyword?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<RankHistory[]> {
    // Generate cache key based on filters
    const cacheKey = this.generateCacheKey(projectId, keyword, startDate, endDate);

    // Try to get from cache
    try {
      const cached = await this.cache.get<RankHistory[]>(cacheKey);
      if (cached) {
        logger.debug(`Cache hit for ranking history: ${cacheKey}`);
        return cached;
      }
    } catch (error) {
      logger.warn(`Cache retrieval failed for ${cacheKey}:`, { error: error instanceof Error ? error.message : String(error) });
      // Continue to fetch from database
    }

    // Fetch from database
    const history = await rankTrackerService.getHistory(
      projectId,
      keyword,
      startDate,
      endDate
    );

    // Store in cache
    try {
      await this.cache.set(cacheKey, history, CacheTTL.RANKINGS);
      logger.debug(`Cached ranking history: ${cacheKey}`);
    } catch (error) {
      logger.warn(`Cache storage failed for ${cacheKey}:`, { error: error instanceof Error ? error.message : String(error) });
      // Continue without caching
    }

    return history;
  }

  /**
   * Invalidate cache for a project
   * @param projectId - Project ID
   */
  async invalidateCache(projectId: string): Promise<void> {
    try {
      // Invalidate all ranking cache entries for this project
      const pattern = `${CacheKeys.rankings(projectId)}*`;
      await this.cache.delPattern(pattern);
      logger.debug(`Invalidated ranking cache for project ${projectId}`);
    } catch (error) {
      logger.warn(`Cache invalidation failed for project ${projectId}:`, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  /**
   * Generate cache key based on query parameters
   * @param projectId - Project ID
   * @param keyword - Optional keyword filter
   * @param startDate - Optional start date filter
   * @param endDate - Optional end date filter
   * @returns Cache key string
   */
  private generateCacheKey(
    projectId: string,
    keyword?: string,
    startDate?: Date,
    endDate?: Date
  ): string {
    const base = CacheKeys.rankings(projectId, keyword);
    
    if (!startDate && !endDate) {
      return base;
    }

    const parts = [base];
    if (startDate) {
      parts.push(`start:${startDate.toISOString().split('T')[0]}`);
    }
    if (endDate) {
      parts.push(`end:${endDate.toISOString().split('T')[0]}`);
    }

    return parts.join(':');
  }
}
