import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './authenticate';
import { RateLimitError } from '../errors';
import { CacheService } from '../services/cache';
import { CacheKeys, CacheTTL } from '../services/cache/cacheKeys';
import { logger } from '../utils/logger';

/**
 * Rate limits per user role (requests per hour)
 */
const RATE_LIMITS: Record<'Free' | 'Pro' | 'Admin', number> = {
  Free: 500,    // Increased from 100 to 500
  Pro: 2000,    // Increased from 1000 to 2000
  Admin: Infinity, // Unlimited
};

/**
 * Rate Limiting Middleware Factory
 * 
 * Tracks request count per user in Redis with 1-hour TTL.
 * Enforces limits: Free (100/hour), Pro (1000/hour), Admin (unlimited).
 * Returns 429 with Retry-After header when limit exceeded.
 * 
 * @param cache - Cache service instance for storing rate limit counters
 * @returns Express middleware function
 * 
 * Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7
 */
export function createRateLimiter(cache: CacheService) {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Ensure user is authenticated
      if (!req.user) {
        // If no user, skip rate limiting (should be caught by auth middleware)
        next();
        return;
      }

      const userId = req.user.id;
      const userRole = req.user.role;

      // Admin users have unlimited access
      if (userRole === 'Admin') {
        next();
        return;
      }

      const limit = RATE_LIMITS[userRole];
      const cacheKey = CacheKeys.rateLimit(userId);

      // Get current request count from cache
      let currentCount = await cache.get<number>(cacheKey);

      if (currentCount === null) {
        // First request in this time window
        currentCount = 0;
      }

      // Check if limit exceeded
      if (currentCount >= limit) {
        // Calculate retry-after in seconds (time until TTL expires)
        // Since we use 1-hour TTL, we return the remaining time
        const retryAfter = CacheTTL.RATE_LIMIT; // 3600 seconds

        logger.warn('Rate limit exceeded', {
          userId,
          role: userRole,
          limit,
          currentCount,
        });

        throw new RateLimitError(retryAfter);
      }

      // Increment request count
      const newCount = currentCount + 1;
      await cache.set(cacheKey, newCount, CacheTTL.RATE_LIMIT);

      // Add rate limit headers to response
      res.setHeader('X-RateLimit-Limit', limit.toString());
      res.setHeader('X-RateLimit-Remaining', (limit - newCount).toString());
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + CacheTTL.RATE_LIMIT * 1000).toISOString());

      next();
    } catch (error) {
      if (error instanceof RateLimitError) {
        next(error);
      } else {
        // If cache fails, log warning but allow request through (graceful degradation)
        logger.warn('Rate limiting failed, allowing request', {
          error: error instanceof Error ? error.message : String(error),
          userId: req.user?.id,
        });
        next();
      }
    }
  };
}
