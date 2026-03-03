/**
 * Integration tests for Redis Cache Service
 * 
 * These tests require Redis to be running on localhost:6379
 * Run with: npm test -- tests/integration/cache.integration.test.ts
 * 
 * To skip these tests when Redis is not available, use:
 * npm test -- --exclude tests/integration/**
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RedisCache } from '../../src/services/cache/RedisCache';
import { CacheKeys, CacheTTL } from '../../src/services/cache/cacheKeys';

describe('RedisCache - Integration Tests (requires Redis)', () => {
  let cache: RedisCache;
  const testKey = 'test:integration:key';
  const testValue = { data: 'test value', count: 42 };

  beforeEach(async () => {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    cache = new RedisCache(redisUrl);
    
    // Wait for connection
    await new Promise(resolve => setTimeout(resolve, 200));
  });

  afterEach(async () => {
    // Clean up all test keys
    await cache.delPattern('test:integration:*');
    await cache.close();
  });

  it('should store and retrieve data correctly', async () => {
    await cache.set(testKey, testValue, 60);
    const retrieved = await cache.get<typeof testValue>(testKey);
    
    expect(retrieved).toEqual(testValue);
  });

  it('should return null for non-existent keys', async () => {
    const result = await cache.get('test:integration:nonexistent');
    expect(result).toBeNull();
  });

  it('should handle JSON serialization of complex data', async () => {
    const complexData = {
      string: 'test',
      number: 123,
      boolean: true,
      array: [1, 2, 3],
      nested: { key: 'value' },
      nullValue: null,
    };

    await cache.set(testKey, complexData, 60);
    const retrieved = await cache.get<typeof complexData>(testKey);
    
    expect(retrieved).toEqual(complexData);
  });

  it('should delete single cache entry', async () => {
    await cache.set(testKey, testValue, 60);
    
    // Verify it exists
    let result = await cache.get(testKey);
    expect(result).toEqual(testValue);
    
    // Delete it
    await cache.del(testKey);
    
    // Verify it's gone
    result = await cache.get(testKey);
    expect(result).toBeNull();
  });

  it('should delete entries matching pattern', async () => {
    // Create multiple test keys
    await cache.set('test:integration:key1', { data: 1 }, 60);
    await cache.set('test:integration:key2', { data: 2 }, 60);
    await cache.set('test:integration:key3', { data: 3 }, 60);
    await cache.set('test:integration:other', { data: 4 }, 60);

    // Delete pattern
    await cache.delPattern('test:integration:key*');

    // Verify pattern keys are deleted
    expect(await cache.get('test:integration:key1')).toBeNull();
    expect(await cache.get('test:integration:key2')).toBeNull();
    expect(await cache.get('test:integration:key3')).toBeNull();

    // Verify other key still exists
    expect(await cache.get('test:integration:other')).toEqual({ data: 4 });
  });

  it('should respect TTL expiration', async () => {
    // Set with 1 second TTL
    await cache.set(testKey, testValue, 1);
    
    // Should exist immediately
    let result = await cache.get(testKey);
    expect(result).toEqual(testValue);

    // Wait for expiration (1.2 seconds to be safe)
    await new Promise(resolve => setTimeout(resolve, 1200));

    // Should be expired
    result = await cache.get(testKey);
    expect(result).toBeNull();
  });

  it('should handle concurrent operations', async () => {
    const count = 20;
    
    // Concurrent writes
    const writes = Array.from({ length: count }, (_, i) => 
      cache.set(`test:integration:concurrent:${i}`, { value: i }, 60)
    );
    await Promise.all(writes);

    // Concurrent reads
    const reads = Array.from({ length: count }, (_, i) =>
      cache.get<{ value: number }>(`test:integration:concurrent:${i}`)
    );
    const results = await Promise.all(reads);
    
    // Verify all values
    results.forEach((result, i) => {
      expect(result).toEqual({ value: i });
    });

    // Cleanup
    await cache.delPattern('test:integration:concurrent:*');
  });

  it('should handle empty pattern deletion gracefully', async () => {
    await expect(
      cache.delPattern('test:integration:nonexistent:*')
    ).resolves.not.toThrow();
  });

  it('should handle large data objects', async () => {
    const largeData = {
      items: Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        description: `Description for item ${i}`,
        tags: ['tag1', 'tag2', 'tag3'],
      })),
    };

    await cache.set(testKey, largeData, 60);
    const retrieved = await cache.get<typeof largeData>(testKey);
    
    expect(retrieved).toEqual(largeData);
    expect(retrieved?.items.length).toBe(1000);
  });

  it('should handle cache key patterns from CacheKeys utility', async () => {
    const projectId = 'test-project-123';
    const userId = 'test-user-456';
    
    // Test different key patterns
    await cache.set(CacheKeys.keywords(projectId), ['keyword1', 'keyword2'], CacheTTL.KEYWORDS);
    await cache.set(CacheKeys.dashboard(userId), { metrics: 'data' }, CacheTTL.DASHBOARD);
    
    // Retrieve
    const keywords = await cache.get<string[]>(CacheKeys.keywords(projectId));
    const dashboard = await cache.get<{ metrics: string }>(CacheKeys.dashboard(userId));
    
    expect(keywords).toEqual(['keyword1', 'keyword2']);
    expect(dashboard).toEqual({ metrics: 'data' });
    
    // Cleanup
    await cache.del(CacheKeys.keywords(projectId));
    await cache.del(CacheKeys.dashboard(userId));
  });
});
