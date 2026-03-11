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
   * Also passes cache invalidation callback to background ranking checks
   * @param projectId - Project ID
   * @param keywords - Array of keywords to research
   * @returns Array of stored keyword data
   */
  async research(projectId: string, keywords: string[]): Promise<Keyword[]> {
    // Perform research (writes to database)
    // Pass cache invalidation callback for background ranking updates
    const results = await keywordService.research(
      projectId, 
      keywords,
      () => this.invalidateCache(projectId)
    );

    // Invalidate cache after initial research completes
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
   * Find keywords by project with read-through caching and pagination
   * Implements the read-through pattern:
   * 1. Try to get from cache
   * 2. If cache miss or error, fetch from database
   * 3. Store in cache for future requests
   * 4. Return data
   * 
   * Caches both paginated and non-paginated requests with composite keys
   * to avoid unnecessary database queries during auto-refresh.
   * 
   * @param projectId - Project ID
   * @param skip - Number of records to skip (for pagination)
   * @param take - Number of records to take (for pagination)
   * @returns Object with keywords array and total count
   */
  async findByProject(
    projectId: string,
    skip?: number,
    take?: number
  ): Promise<{ keywords: KeywordWithRank[]; total: number }> {
    // Create cache key with pagination parameters for composite caching
    const cacheKey = skip !== undefined && take !== undefined
      ? `${CacheKeys.keywords(projectId)}:page:${skip}:${take}`
      : CacheKeys.keywords(projectId);

    // Try cache first
    try {
      const cached = await this.cache.get<{ keywords: KeywordWithRank[]; total: number }>(cacheKey);
      if (cached) {
        logger.debug(`Cache hit for keywords: ${projectId} (skip: ${skip}, take: ${take})`);
        return cached;
      }
    } catch (error) {
      logger.warn(`Cache retrieval failed for key ${cacheKey}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      // Continue to database fallback
    }

    // Cache miss - fetch from database
    logger.debug(`Cache miss for keywords: ${projectId} (skip: ${skip}, take: ${take})`);
    const result = await keywordService.findByProject(projectId, skip, take);

    // Try to cache the result
    try {
      await this.cache.set(cacheKey, result, CacheTTL.KEYWORDS);
      logger.debug(`Cached keywords for project: ${projectId} (skip: ${skip}, take: ${take})`);
    } catch (error) {
      logger.warn(`Cache storage failed for key ${cacheKey}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      // Continue - data is still returned from database
    }

    return result;
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
   * Clears both base cache and all paginated cache entries using pattern matching
   * @param projectId - Project ID
   */
  async invalidateCache(projectId: string): Promise<void> {
    const baseKey = CacheKeys.keywords(projectId);
    
    try {
      // Delete base cache key
      await this.cache.del(baseKey);
      
      // Delete all paginated cache keys using pattern matching
      // Pattern: keywords:projectId:page:*
      const pattern = `${baseKey}:page:*`;
      await this.cache.delPattern(pattern);
      
      logger.debug(`Invalidated cache for keywords: ${projectId} (including paginated entries)`);
    } catch (error) {
      logger.warn(`Cache invalidation failed for project ${projectId}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - cache invalidation failure shouldn't break the operation
    }
  }
}
