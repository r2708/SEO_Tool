/**
 * Cache Key Patterns
 * 
 * Defines standardized cache key patterns for different data types.
 * These patterns ensure consistent cache key naming across the platform.
 */
export const CacheKeys = {
  /**
   * Keyword data cache key
   * Pattern: keywords:${projectId}
   * @param projectId - Project identifier
   */
  keywords: (projectId: string): string => `keywords:${projectId}`,

  /**
   * Ranking history cache key
   * Pattern: rankings:${projectId}:${keyword?}
   * @param projectId - Project identifier
   * @param keyword - Optional keyword filter
   */
  rankings: (projectId: string, keyword?: string): string =>
    keyword ? `rankings:${projectId}:${keyword}` : `rankings:${projectId}`,

  /**
   * Competitor analysis cache key
   * Pattern: competitor:${projectId}:${domain}
   * @param projectId - Project identifier
   * @param domain - Competitor domain
   */
  competitor: (projectId: string, domain: string): string =>
    `competitor:${projectId}:${domain}`,

  /**
   * Dashboard metrics cache key
   * Pattern: dashboard:${userId}
   * @param userId - User identifier
   */
  dashboard: (userId: string): string => `dashboard:${userId}`,

  /**
   * SERP results cache key
   * Pattern: serp:${keyword}
   * @param keyword - Search keyword
   */
  serp: (keyword: string): string => `serp:${keyword}`,

  /**
   * Rate limit counter cache key
   * Pattern: ratelimit:${userId}
   * @param userId - User identifier
   */
  rateLimit: (userId: string): string => `ratelimit:${userId}`,
};

/**
 * Cache TTL Constants (in seconds)
 * 
 * Defines time-to-live values for different cache types.
 * These values balance data freshness with performance.
 */
export const CacheTTL = {
  /** Keyword data: 24 hours */
  KEYWORDS: 86400,

  /** Ranking history: 1 hour */
  RANKINGS: 3600,

  /** Competitor analysis: 12 hours */
  COMPETITOR: 43200,

  /** Dashboard metrics: 5 minutes */
  DASHBOARD: 300,

  /** SERP results: 24 hours */
  SERP: 86400,

  /** Rate limit counter: 1 hour */
  RATE_LIMIT: 3600,
};
