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
   * Get ranking history with caching and pagination
   * @param projectId - Project ID
   * @param keyword - Optional keyword filter
   * @param startDate - Optional start date filter
   * @param endDate - Optional end date filter
   * @param skip - Number of records to skip (for pagination)
   * @param take - Number of records to take (for pagination)
   * @returns Object with ranking history array and total count
   */
  async getHistory(
    projectId: string,
    keyword?: string,
    startDate?: Date,
    endDate?: Date,
    skip?: number,
    take?: number
  ): Promise<{ history: RankHistory[]; total: number }> {
    // Generate cache key based on filters (only for non-paginated requests)
    const cacheKey = this.generateCacheKey(projectId, keyword, startDate, endDate);

    // Try to get from cache (only for non-paginated requests)
    if (skip === undefined && take === undefined) {
      try {
        const cached = await this.cache.get<{ history: RankHistory[]; total: number }>(cacheKey);
        if (cached) {
          logger.debug(`Cache hit for ranking history: ${cacheKey}`);
          return cached;
        }
      } catch (error) {
        logger.warn(`Cache retrieval failed for ${cacheKey}:`, { error: error instanceof Error ? error.message : String(error) });
        // Continue to fetch from database
      }
    }

    // Fetch from database
    const result = await rankTrackerService.getHistory(
      projectId,
      keyword,
      startDate,
      endDate,
      skip,
      take
    );

    // Store in cache (only for non-paginated requests)
    if (skip === undefined && take === undefined) {
      try {
        await this.cache.set(cacheKey, result, CacheTTL.RANKINGS);
        logger.debug(`Cached ranking history: ${cacheKey}`);
      } catch (error) {
        logger.warn(`Cache storage failed for ${cacheKey}:`, { error: error instanceof Error ? error.message : String(error) });
        // Continue without caching
      }
    }

    return result;
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
   * Get all keywords for a project (from keyword service)
   * @param projectId - Project ID
   * @returns Array of keywords with current rank if available
   */
  async getProjectKeywords(projectId: string): Promise<{ keywords: string[] }> {
    try {
      // Import keyword service to get project keywords
      const { findByProject } = await import('../keyword/keywordService');
      const { keywords } = await findByProject(projectId);
      
      // Extract just the keyword strings
      const keywordList = keywords.map((k: any) => k.keyword);
      
      return { keywords: keywordList };
    } catch (error) {
      logger.error('Error getting project keywords:', { error: error instanceof Error ? error.message : String(error) });
      return { keywords: [] };
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
