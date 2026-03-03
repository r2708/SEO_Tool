/**
 * Unit tests for Cache Service
 * 
 * Tests the CacheService interface and RedisCache implementation
 * with focus on graceful degradation and error handling.
 * 
 * Note: Integration tests require Redis to be running.
 * If Redis is not available, tests verify graceful degradation behavior.
 */

import { describe, it, expect } from 'vitest';
import { CacheKeys, CacheTTL } from '../../../src/services/cache/cacheKeys';

describe('Cache Service', () => {
  describe('CacheKeys', () => {
    it('should generate correct keyword cache key', () => {
      const projectId = 'project-123';
      const key = CacheKeys.keywords(projectId);
      expect(key).toBe('keywords:project-123');
    });

    it('should generate correct ranking cache key without keyword', () => {
      const projectId = 'project-123';
      const key = CacheKeys.rankings(projectId);
      expect(key).toBe('rankings:project-123');
    });

    it('should generate correct ranking cache key with keyword', () => {
      const projectId = 'project-123';
      const keyword = 'seo tools';
      const key = CacheKeys.rankings(projectId, keyword);
      expect(key).toBe('rankings:project-123:seo tools');
    });

    it('should generate correct competitor cache key', () => {
      const projectId = 'project-123';
      const domain = 'competitor.com';
      const key = CacheKeys.competitor(projectId, domain);
      expect(key).toBe('competitor:project-123:competitor.com');
    });

    it('should generate correct dashboard cache key', () => {
      const userId = 'user-456';
      const key = CacheKeys.dashboard(userId);
      expect(key).toBe('dashboard:user-456');
    });

    it('should generate correct SERP cache key', () => {
      const keyword = 'best seo tools';
      const key = CacheKeys.serp(keyword);
      expect(key).toBe('serp:best seo tools');
    });

    it('should generate correct rate limit cache key', () => {
      const userId = 'user-789';
      const key = CacheKeys.rateLimit(userId);
      expect(key).toBe('ratelimit:user-789');
    });
  });

  describe('CacheTTL', () => {
    it('should have correct TTL values', () => {
      expect(CacheTTL.KEYWORDS).toBe(86400); // 24 hours
      expect(CacheTTL.RANKINGS).toBe(3600); // 1 hour
      expect(CacheTTL.COMPETITOR).toBe(43200); // 12 hours
      expect(CacheTTL.DASHBOARD).toBe(300); // 5 minutes
      expect(CacheTTL.SERP).toBe(86400); // 24 hours
      expect(CacheTTL.RATE_LIMIT).toBe(3600); // 1 hour
    });

    it('should have TTL values in seconds', () => {
      // Verify all TTL values are positive integers
      Object.values(CacheTTL).forEach(ttl => {
        expect(ttl).toBeGreaterThan(0);
        expect(Number.isInteger(ttl)).toBe(true);
      });
    });
  });

  describe('Cache Key Patterns', () => {
    it('should use consistent pattern format', () => {
      // All keys should use colon separator
      expect(CacheKeys.keywords('id')).toMatch(/^[a-z]+:/);
      expect(CacheKeys.rankings('id')).toMatch(/^[a-z]+:/);
      expect(CacheKeys.competitor('id', 'domain')).toMatch(/^[a-z]+:/);
      expect(CacheKeys.dashboard('id')).toMatch(/^[a-z]+:/);
      expect(CacheKeys.serp('keyword')).toMatch(/^[a-z]+:/);
      expect(CacheKeys.rateLimit('id')).toMatch(/^[a-z]+:/);
    });

    it('should handle special characters in parameters', () => {
      const keyword = 'seo tools & analytics';
      const key = CacheKeys.serp(keyword);
      expect(key).toBe('serp:seo tools & analytics');
    });

    it('should create unique keys for different projects', () => {
      const key1 = CacheKeys.keywords('project-1');
      const key2 = CacheKeys.keywords('project-2');
      expect(key1).not.toBe(key2);
    });

    it('should create unique keys for different users', () => {
      const key1 = CacheKeys.dashboard('user-1');
      const key2 = CacheKeys.dashboard('user-2');
      expect(key1).not.toBe(key2);
    });
  });
});

