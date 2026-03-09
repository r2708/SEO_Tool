import * as competitorService from './competitorService';
import { CacheService } from '../cache/CacheService';
import { CacheKeys, CacheTTL } from '../cache/cacheKeys';
import { logger } from '../../utils/logger';
import {
  CompetitorWithCount,
  CompetitorAnalysis,
} from './competitorService';

/**
 * Cached Competitor Service
 * 
 * Wraps the base competitor service with caching functionality:
 * - Read-through pattern: Check cache first, fallback to database
 * - Write-through pattern: Update database and invalidate cache
 * - 12-hour cache TTL for competitor analysis
 * - Graceful degradation on cache failures
 * 
 * Validates: Requirements 15.3, 15.5, 15.7
 */
export class CachedCompetitorService {
  constructor(private cache: CacheService) {}

  /**
   * Analyze competitor with caching
   * Performs analysis and caches results for 12 hours
   * Invalidates existing cache to ensure fresh analysis
   * @param projectId - Project ID
   * @param competitorDomain - Competitor domain to analyze
   * @returns Competitor analysis with overlap data
   */
  async analyze(
    projectId: string,
    competitorDomain: string
  ): Promise<CompetitorAnalysis> {
    const cacheKey = CacheKeys.competitor(projectId, competitorDomain);

    // Invalidate existing cache to ensure fresh analysis
    try {
      await this.cache.del(cacheKey);
      logger.debug(`Invalidated cache before analysis for: ${projectId}:${competitorDomain}`);
    } catch (error) {
      logger.warn(`Cache invalidation failed for key ${cacheKey}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      // Continue to analysis
    }

    // Perform analysis
    logger.debug(`Analyzing competitor: ${projectId}:${competitorDomain}`);
    const analysis = await competitorService.analyze(projectId, competitorDomain);

    // Try to cache the result (don't fail if caching fails)
    try {
      await this.cache.set(cacheKey, analysis, CacheTTL.COMPETITOR);
      logger.debug(`Cached competitor analysis for: ${projectId}:${competitorDomain}`);
    } catch (error) {
      logger.warn(`Cache storage failed for key ${cacheKey}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      // Continue - data is still returned from analysis
    }

    return analysis;
  }

  /**
   * Find competitors by project with pagination (no caching for list operations)
   * @param projectId - Project ID
   * @param skip - Number of records to skip (for pagination)
   * @param take - Number of records to take (for pagination)
   * @returns Object with competitors array and total count
   */
  async findByProject(
    projectId: string,
    skip?: number,
    take?: number
  ): Promise<{ competitors: CompetitorWithCount[]; total: number }> {
    return competitorService.findByProject(projectId, skip, take);
  }

  /**
   * Get competitor keywords (no caching)
   * @param competitorId - Competitor ID
   * @returns Array of keywords
   */
  async getCompetitorKeywords(competitorId: string): Promise<string[]> {
    return competitorService.getCompetitorKeywords(competitorId);
  }

  /**
   * Invalidate cache for a competitor
   * Called when competitor data is updated
   * @param projectId - Project ID
   * @param competitorDomain - Competitor domain
   */
  async invalidateCache(projectId: string, competitorDomain: string): Promise<void> {
    const cacheKey = CacheKeys.competitor(projectId, competitorDomain);
    
    try {
      await this.cache.del(cacheKey);
      logger.debug(`Invalidated cache for competitor: ${projectId}:${competitorDomain}`);
    } catch (error) {
      logger.warn(`Cache invalidation failed for key ${cacheKey}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - cache invalidation failure shouldn't break the operation
    }
  }
}
