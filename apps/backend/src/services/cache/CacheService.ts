/**
 * CacheService Interface
 * 
 * Defines the contract for cache operations across the platform.
 * Implementations should handle graceful degradation when cache fails.
 */
export interface CacheService {
  /**
   * Retrieve a value from cache
   * @param key - Cache key
   * @returns Parsed value or null if not found or error occurs
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Store a value in cache with TTL
   * @param key - Cache key
   * @param value - Value to store (will be JSON serialized)
   * @param ttl - Time to live in seconds
   */
  set(key: string, value: any, ttl: number): Promise<void>;

  /**
   * Delete a single cache entry
   * @param key - Cache key to delete
   */
  del(key: string): Promise<void>;

  /**
   * Delete all cache entries matching a pattern
   * @param pattern - Pattern to match (e.g., "keywords:*")
   */
  delPattern(pattern: string): Promise<void>;

  /**
   * Close the cache connection
   */
  close(): Promise<void>;
}
