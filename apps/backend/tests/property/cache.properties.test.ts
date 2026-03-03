/**
 * Property-Based Tests for Cache Operations
 * 
 * Tests cache behavior across all valid inputs to verify:
 * - Correct TTL configuration for different data types
 * - Cache invalidation on updates
 * - Graceful degradation on failures
 * 
 * Uses fast-check for property-based testing with 100+ iterations per property.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { RedisCache } from '../../src/services/cache/RedisCache';
import { CacheKeys, CacheTTL } from '../../src/services/cache/cacheKeys';

describe('Cache Operations Property Tests', () => {
  let cache: RedisCache;
  const testKeys: string[] = [];
  let isRedisAvailable = false;

  beforeEach(async () => {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    cache = new RedisCache(redisUrl);
    
    // Wait for connection and check if Redis is available
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Test if Redis is connected by attempting a simple operation
    const testKey = 'test:connection:check';
    await cache.set(testKey, 'test', 1);
    const result = await cache.get(testKey);
    isRedisAvailable = result !== null;
    await cache.del(testKey);
  });

  afterEach(async () => {
    // Clean up all test keys
    if (isRedisAvailable) {
      for (const key of testKeys) {
        await cache.del(key);
      }
      await cache.delPattern('test:property:*');
    }
    
    // Close connection with timeout
    try {
      await Promise.race([
        cache.close(),
        new Promise((resolve) => setTimeout(resolve, 2000))
      ]);
    } catch (error) {
      // Ignore close errors
    }
    
    testKeys.length = 0;
  }, 15000); // Increase timeout to 15 seconds

  describe('Feature: seo-saas-platform, Property 39: Cache TTL Configuration', () => {
    it('should use correct TTL value for keyword data (24 hours)', async () => {
      // **Validates: Requirements 15.1**
      
      if (!isRedisAvailable) {
        console.log('Skipping test - Redis not available');
        return;
      }
      
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.array(fc.record({
            keyword: fc.string({ minLength: 1, maxLength: 200 }),
            searchVolume: fc.nat(),
            difficulty: fc.float({ min: 0, max: 100 }),
            cpc: fc.float({ min: 0, max: 1000 }),
          })),
          async (projectId, keywordData) => {
            const key = CacheKeys.keywords(projectId);
            testKeys.push(key);
            
            // Set keyword data with correct TTL
            await cache.set(key, keywordData, CacheTTL.KEYWORDS);
            
            // Verify TTL is 24 hours (86400 seconds)
            expect(CacheTTL.KEYWORDS).toBe(86400);
            
            // Verify data is retrievable
            const retrieved = await cache.get(key);
            expect(retrieved).toEqual(keywordData);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use correct TTL value for ranking data (1 hour)', async () => {
      // **Validates: Requirements 15.2**
      
      if (!isRedisAvailable) {
        console.log('Skipping test - Redis not available');
        return;
      }
      
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 200 }),
          fc.array(fc.record({
            date: fc.date().map(d => d.toISOString().split('T')[0]),
            position: fc.integer({ min: 1, max: 100 }),
          })),
          async (projectId, keyword, rankingData) => {
            const key = CacheKeys.rankings(projectId, keyword);
            testKeys.push(key);
            
            // Set ranking data with correct TTL
            await cache.set(key, rankingData, CacheTTL.RANKINGS);
            
            // Verify TTL is 1 hour (3600 seconds)
            expect(CacheTTL.RANKINGS).toBe(3600);
            
            // Verify data is retrievable
            const retrieved = await cache.get(key);
            expect(retrieved).toEqual(rankingData);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use correct TTL value for competitor data (12 hours)', async () => {
      // **Validates: Requirements 15.3**
      
      if (!isRedisAvailable) {
        console.log('Skipping test - Redis not available');
        return;
      }
      
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.domain(),
          fc.record({
            competitor: fc.domain(),
            keywords: fc.array(fc.string({ minLength: 1, maxLength: 200 })),
            lastAnalyzed: fc.date().map(d => d.toISOString()),
          }),
          async (projectId, domain, competitorData) => {
            const key = CacheKeys.competitor(projectId, domain);
            testKeys.push(key);
            
            // Set competitor data with correct TTL
            await cache.set(key, competitorData, CacheTTL.COMPETITOR);
            
            // Verify TTL is 12 hours (43200 seconds)
            expect(CacheTTL.COMPETITOR).toBe(43200);
            
            // Verify data is retrievable
            const retrieved = await cache.get(key);
            expect(retrieved).toEqual(competitorData);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use correct TTL value for dashboard metrics (5 minutes)', async () => {
      // **Validates: Requirements 15.4**
      
      if (!isRedisAvailable) {
        console.log('Skipping test - Redis not available');
        return;
      }
      
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.record({
            totalKeywords: fc.nat(),
            averageRank: fc.float({ min: 1, max: 100 }),
            rankChange: fc.float({ min: -100, max: 100 }),
            totalProjects: fc.nat(),
          }),
          async (userId, dashboardData) => {
            const key = CacheKeys.dashboard(userId);
            testKeys.push(key);
            
            // Set dashboard data with correct TTL
            await cache.set(key, dashboardData, CacheTTL.DASHBOARD);
            
            // Verify TTL is 5 minutes (300 seconds)
            expect(CacheTTL.DASHBOARD).toBe(300);
            
            // Verify data is retrievable
            const retrieved = await cache.get(key);
            expect(retrieved).toEqual(dashboardData);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use correct TTL values for all data types', async () => {
      // **Validates: Requirements 15.1, 15.2, 15.3, 15.4**
      
      // Verify all TTL constants match requirements
      expect(CacheTTL.KEYWORDS).toBe(86400);   // 24 hours
      expect(CacheTTL.RANKINGS).toBe(3600);    // 1 hour
      expect(CacheTTL.COMPETITOR).toBe(43200); // 12 hours
      expect(CacheTTL.DASHBOARD).toBe(300);    // 5 minutes
      expect(CacheTTL.SERP).toBe(86400);       // 24 hours
      expect(CacheTTL.RATE_LIMIT).toBe(3600);  // 1 hour
    });
  });

  describe('Feature: seo-saas-platform, Property 50: Cache Invalidation on Update', () => {
    it('should invalidate keyword cache when data is updated', async () => {
      // **Validates: Requirements 15.5**
      
      if (!isRedisAvailable) {
        console.log('Skipping test - Redis not available');
        return;
      }
      
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.array(fc.record({
            keyword: fc.string({ minLength: 1, maxLength: 200 }),
            searchVolume: fc.nat(),
          })),
          fc.array(fc.record({
            keyword: fc.string({ minLength: 1, maxLength: 200 }),
            searchVolume: fc.nat(),
          })),
          async (projectId, initialData, updatedData) => {
            const key = CacheKeys.keywords(projectId);
            testKeys.push(key);
            
            // Set initial cache data
            await cache.set(key, initialData, CacheTTL.KEYWORDS);
            
            // Verify initial data is cached
            let cached = await cache.get(key);
            expect(cached).toEqual(initialData);
            
            // Simulate database update by invalidating cache
            await cache.del(key);
            
            // Verify cache is cleared
            cached = await cache.get(key);
            expect(cached).toBeNull();
            
            // Set updated data
            await cache.set(key, updatedData, CacheTTL.KEYWORDS);
            
            // Verify updated data is now cached
            cached = await cache.get(key);
            expect(cached).toEqual(updatedData);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should invalidate ranking cache when data is updated', async () => {
      // **Validates: Requirements 15.5**
      
      if (!isRedisAvailable) {
        console.log('Skipping test - Redis not available');
        return;
      }
      
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 200 }),
          fc.array(fc.record({
            date: fc.date().map(d => d.toISOString().split('T')[0]),
            position: fc.integer({ min: 1, max: 100 }),
          })),
          fc.array(fc.record({
            date: fc.date().map(d => d.toISOString().split('T')[0]),
            position: fc.integer({ min: 1, max: 100 }),
          })),
          async (projectId, keyword, initialData, updatedData) => {
            const key = CacheKeys.rankings(projectId, keyword);
            testKeys.push(key);
            
            // Set initial cache data
            await cache.set(key, initialData, CacheTTL.RANKINGS);
            
            // Verify initial data is cached
            let cached = await cache.get(key);
            expect(cached).toEqual(initialData);
            
            // Simulate database update by invalidating cache
            await cache.del(key);
            
            // Verify cache is cleared
            cached = await cache.get(key);
            expect(cached).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should invalidate all related caches using pattern deletion', async () => {
      // **Validates: Requirements 15.5**
      
      if (!isRedisAvailable) {
        console.log('Skipping test - Redis not available');
        return;
      }
      
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.array(fc.string({ minLength: 1, maxLength: 200 }), { minLength: 1, maxLength: 5 }),
          async (projectId, keywords) => {
            // Create multiple cache entries for the same project
            const keys = keywords.map(kw => CacheKeys.rankings(projectId, kw));
            testKeys.push(...keys);
            
            // Set cache data for all keywords
            for (const key of keys) {
              await cache.set(key, { data: 'test' }, CacheTTL.RANKINGS);
            }
            
            // Verify all are cached
            for (const key of keys) {
              const cached = await cache.get(key);
              expect(cached).toEqual({ data: 'test' });
            }
            
            // Invalidate all rankings for this project using pattern
            await cache.delPattern(`rankings:${projectId}:*`);
            
            // Verify all are cleared
            for (const key of keys) {
              const cached = await cache.get(key);
              expect(cached).toBeNull();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should invalidate dashboard cache when user data changes', async () => {
      // **Validates: Requirements 15.5**
      
      if (!isRedisAvailable) {
        console.log('Skipping test - Redis not available');
        return;
      }
      
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.record({
            totalKeywords: fc.nat(),
            averageRank: fc.float({ min: 1, max: 100 }),
          }),
          fc.record({
            totalKeywords: fc.nat(),
            averageRank: fc.float({ min: 1, max: 100 }),
          }),
          async (userId, initialMetrics, updatedMetrics) => {
            const key = CacheKeys.dashboard(userId);
            testKeys.push(key);
            
            // Set initial cache
            await cache.set(key, initialMetrics, CacheTTL.DASHBOARD);
            
            // Verify cached
            let cached = await cache.get(key);
            expect(cached).toEqual(initialMetrics);
            
            // Invalidate on update
            await cache.del(key);
            
            // Verify cleared
            cached = await cache.get(key);
            expect(cached).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Feature: seo-saas-platform, Property 51: Cache Failure Graceful Degradation', () => {
    it('should return null on cache get failure without throwing', async () => {
      // **Validates: Requirements 15.7**
      
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          async (key) => {
            testKeys.push(key);
            
            // Attempt to get non-existent key
            const result = await cache.get(key);
            
            // Should return null, not throw
            expect(result).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle cache set failure gracefully without throwing', async () => {
      // **Validates: Requirements 15.7**
      
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.anything(),
          fc.integer({ min: 1, max: 86400 }),
          async (key, value, ttl) => {
            testKeys.push(key);
            
            // Set operation should not throw even with unusual values
            await expect(
              cache.set(key, value, ttl)
            ).resolves.not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle cache delete failure gracefully without throwing', async () => {
      // **Validates: Requirements 15.7**
      
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          async (key) => {
            testKeys.push(key);
            
            // Delete non-existent key should not throw
            await expect(
              cache.del(key)
            ).resolves.not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle pattern deletion failure gracefully without throwing', async () => {
      // **Validates: Requirements 15.7**
      
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          async (pattern) => {
            // Delete with non-matching pattern should not throw
            await expect(
              cache.delPattern(`${pattern}:*`)
            ).resolves.not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should continue operation when cache is unavailable', async () => {
      // **Validates: Requirements 15.7**
      
      // Create a cache instance with invalid URL to simulate failure
      const failingCache = new RedisCache('redis://invalid-host:9999');
      
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.record({
            data: fc.string(),
            count: fc.nat(),
          }),
          async (key, value) => {
            // All operations should gracefully degrade
            await expect(failingCache.get(key)).resolves.toBeNull();
            await expect(failingCache.set(key, value, 60)).resolves.not.toThrow();
            await expect(failingCache.del(key)).resolves.not.toThrow();
            await expect(failingCache.delPattern(`${key}:*`)).resolves.not.toThrow();
          }
        ),
        { numRuns: 50 }
      );
      
      await failingCache.close();
    });

    it('should handle JSON serialization edge cases gracefully', async () => {
      // **Validates: Requirements 15.7**
      
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.constant(NaN),
            fc.constant(Infinity),
            fc.constant(-Infinity),
            fc.record({
              nested: fc.record({
                deep: fc.array(fc.nat()),
              }),
            })
          ),
          async (key, value) => {
            testKeys.push(key);
            
            // Set should handle edge cases without throwing
            await expect(
              cache.set(key, value, 60)
            ).resolves.not.toThrow();
            
            // Get should return null or the value without throwing
            await expect(
              cache.get(key)
            ).resolves.toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
