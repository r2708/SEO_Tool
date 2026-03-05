import { Keyword } from '@prisma/client';
import * as keywordService from './keywordService';
import { CacheService } from '../cache/CacheService';
import { CacheKeys, CacheTTL } from '../cache/cacheKeys';
import { logger } from '../../utils/logger';
import { KeywordWithRank } from './keywordService';

/**
 * Cached Keyword Service
 * 
 * Wraps the base keyword service with caching functionality:
 * - Read-through pattern: Check cache first, fallback to database
 * - Write-through pattern: Update database and invalidate cache
 * - 24-hour cache TTL for keyword data
 * - Graceful degradation on cache failures
 * 
 * Validates: Requirements 15.1, 15.5, 15.7
 */
export class CachedKeywordService {
  constructor(private cache: CacheService) {}

  /**
   * Research keywords with cache invalidation
   * After storing new keyword data, invalidates the cache
   * @param projectId - Project ID
   * @param keywords - Array of keywords to research
   * @returns Array of stored keyword data
   */
  async research(projectId: string, keywords: string[]): Promise<Keyword[]> {
    // Perform research (writes to database)
    const results = await keywordService.research(projectId, keywords);

    // Invalidate cache after update
    await this.invalidateCache(projectId);

    return results;
  }

  /**
   * Upsert keyword with cache invalidation
   * @param projectId - Project ID
   * @param keywordData - Keyword data to store
   * @returns Stored keyword
   */
  async upsert(
    projectId: string,
    keywordData: keywordService.KeywordData
  ): Promise<Keyword> {
    // Upsert to database
    const result = await keywordService.upsert(projectId, keywordData);

    // Invalidate cache after update
    await this.invalidateCache(projectId);

    return result;
  }

  /**
   * Find keywords by project with read-through caching
   * Implements the read-through pattern:
   * 1. Try to get from cache
   * 2. If cache miss or error, fetch from database
   * 3. Store in cache for future requests
   * 4. Return data
   * 
   * @param projectId - Project ID
   * @returns Array of keywords with current rank
   */
  async findByProject(projectId: string): Promise<KeywordWithRank[]> {
    const cacheKey = CacheKeys.keywords(projectId);

    // Try cache first
    try {
      const cached = await this.cache.get<KeywordWithRank[]>(cacheKey);
      if (cached) {
        logger.debug(`Cache hit for keywords: ${projectId}`);
        return cached;
      }
    } catch (error) {
      logger.warn(`Cache retrieval failed for key ${cacheKey}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      // Continue to database fallback
    }

    // Cache miss - fetch from database
    logger.debug(`Cache miss for keywords: ${projectId}`);
    const keywords = await keywordService.findByProject(projectId);

    // Try to cache the result (don't fail if caching fails)
    try {
      await this.cache.set(cacheKey, keywords, CacheTTL.KEYWORDS);
      logger.debug(`Cached keywords for project: ${projectId}`);
    } catch (error) {
      logger.warn(`Cache storage failed for key ${cacheKey}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      // Continue - data is still returned from database
    }

    return keywords;
  }

  /**
   * Delete keyword with cache invalidation
   * @param projectId - Project ID
   * @param keyword - Keyword to delete
   */
  async deleteKeyword(projectId: string, keyword: string): Promise<void> {
    // Delete from database
    await keywordService.deleteKeyword(projectId, keyword);

    // Invalidate cache after deletion
    await this.invalidateCache(projectId);
  }

  /**
   * Invalidate cache for a project's keywords
   * Called after any update operation
   * @param projectId - Project ID
   */
  async invalidateCache(projectId: string): Promise<void> {
    const cacheKey = CacheKeys.keywords(projectId);
    
    try {
      await this.cache.del(cacheKey);
      logger.debug(`Invalidated cache for keywords: ${projectId}`);
    } catch (error) {
      logger.warn(`Cache invalidation failed for key ${cacheKey}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - cache invalidation failure shouldn't break the operation
    }
  }
}
