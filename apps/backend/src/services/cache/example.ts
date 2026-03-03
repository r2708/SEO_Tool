/**
 * Example usage of the Cache Service
 * 
 * This file demonstrates how to use the RedisCache service
 * with read-through and write-through patterns.
 */

import { RedisCache, CacheKeys, CacheTTL } from './index';

// Initialize cache (typically done once at application startup)
const cache = new RedisCache(process.env.REDIS_URL || 'redis://localhost:6379');

// Example data types
interface KeywordData {
  keyword: string;
  searchVolume: number;
  difficulty: number;
  cpc: number;
  lastUpdated: Date;
}

interface DashboardMetrics {
  totalKeywords: number;
  averageRank: number;
  rankChange: number;
  totalProjects: number;
}

/**
 * Example 1: Read-Through Caching Pattern
 * Try cache first, fall back to database if not found
 */
async function getKeywords(projectId: string): Promise<KeywordData[]> {
  // Try cache first
  const cached = await cache.get<KeywordData[]>(CacheKeys.keywords(projectId));
  if (cached) {
    console.log('Cache hit for keywords');
    return cached;
  }

  console.log('Cache miss - fetching from database');
  
  // Simulate database fetch
  const keywords: KeywordData[] = [
    {
      keyword: 'seo tools',
      searchVolume: 10000,
      difficulty: 45.5,
      cpc: 2.50,
      lastUpdated: new Date(),
    },
  ];

  // Store in cache for future requests
  await cache.set(
    CacheKeys.keywords(projectId),
    keywords,
    CacheTTL.KEYWORDS
  );

  return keywords;
}

/**
 * Example 2: Write-Through Caching Pattern
 * Update database and invalidate cache
 */
async function updateKeyword(
  projectId: string,
  keywordData: KeywordData
): Promise<void> {
  // Update database
  console.log('Updating keyword in database');
  // await prisma.keyword.upsert({ ... });

  // Invalidate cache to ensure fresh data on next read
  await cache.del(CacheKeys.keywords(projectId));
  console.log('Cache invalidated for project keywords');
}

/**
 * Example 3: Dashboard Metrics with Short TTL
 * Cache expensive aggregations with short expiration
 */
async function getDashboardMetrics(userId: string): Promise<DashboardMetrics> {
  const cached = await cache.get<DashboardMetrics>(
    CacheKeys.dashboard(userId)
  );
  
  if (cached) {
    return cached;
  }

  // Expensive aggregation query
  console.log('Calculating dashboard metrics');
  const metrics: DashboardMetrics = {
    totalKeywords: 150,
    averageRank: 12.5,
    rankChange: 5.2,
    totalProjects: 3,
  };

  // Cache with short TTL (5 minutes)
  await cache.set(
    CacheKeys.dashboard(userId),
    metrics,
    CacheTTL.DASHBOARD
  );

  return metrics;
}

/**
 * Example 4: Cascade Invalidation
 * Delete all related cache entries when a project is deleted
 */
async function deleteProject(projectId: string, userId: string): Promise<void> {
  // Delete from database
  console.log('Deleting project from database');
  // await prisma.project.delete({ where: { id: projectId } });

  // Invalidate all related caches
  await cache.delPattern(`keywords:${projectId}*`);
  await cache.delPattern(`rankings:${projectId}*`);
  await cache.delPattern(`competitor:${projectId}*`);
  await cache.del(CacheKeys.dashboard(userId));
  
  console.log('All related caches invalidated');
}

/**
 * Example 5: Rate Limiting
 * Track request counts per user
 */
async function checkRateLimit(userId: string, limit: number): Promise<boolean> {
  const key = CacheKeys.rateLimit(userId);
  const count = await cache.get<number>(key) || 0;

  if (count >= limit) {
    console.log(`Rate limit exceeded for user ${userId}`);
    return false;
  }

  // Increment counter
  await cache.set(key, count + 1, CacheTTL.RATE_LIMIT);
  return true;
}

/**
 * Example 6: SERP Results Caching
 * Cache expensive external API calls
 */
async function getSERPResults(keyword: string): Promise<any[]> {
  const cached = await cache.get<any[]>(CacheKeys.serp(keyword));
  
  if (cached) {
    console.log('Using cached SERP results');
    return cached;
  }

  // Expensive external API call
  console.log('Fetching SERP results from external API');
  const results = [
    { url: 'https://example.com', title: 'Example Result' },
  ];

  // Cache for 24 hours
  await cache.set(CacheKeys.serp(keyword), results, CacheTTL.SERP);

  return results;
}

/**
 * Example 7: Graceful Shutdown
 * Close cache connection when application shuts down
 */
async function shutdown(): Promise<void> {
  console.log('Shutting down application...');
  await cache.close();
  console.log('Cache connection closed');
}

// Export example functions
export {
  getKeywords,
  updateKeyword,
  getDashboardMetrics,
  deleteProject,
  checkRateLimit,
  getSERPResults,
  shutdown,
};
