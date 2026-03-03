import { createClient, RedisClientType } from 'redis';
import { CacheService } from './CacheService';
import { logger } from '../../utils/logger';

/**
 * RedisCache Implementation
 * 
 * Implements CacheService using Redis with:
 * - Connection pooling
 * - Graceful degradation on failures
 * - JSON serialization/deserialization
 * - Error logging without throwing
 * 
 * Validates: Requirements 15.6, 15.7
 */
export class RedisCache implements CacheService {
  private client: RedisClientType;
  private isConnected: boolean = false;

  constructor(url: string) {
    this.client = createClient({
      url,
      socket: {
        reconnectStrategy: (retries) => {
          // Exponential backoff with max 3 seconds
          const delay = Math.min(retries * 100, 3000);
          logger.warn(`Redis reconnecting in ${delay}ms (attempt ${retries})`);
          return delay;
        },
      },
    });

    // Connection event handlers
    this.client.on('connect', () => {
      logger.info('Redis client connecting...');
    });

    this.client.on('ready', () => {
      this.isConnected = true;
      logger.info('Redis client connected and ready');
    });

    this.client.on('error', (err) => {
      this.isConnected = false;
      logger.error('Redis client error', { error: err.message });
    });

    this.client.on('end', () => {
      this.isConnected = false;
      logger.info('Redis client connection closed');
    });

    // Connect to Redis
    this.connect();
  }

  /**
   * Establish connection to Redis
   * Logs errors but doesn't throw to allow graceful degradation
   */
  private async connect(): Promise<void> {
    try {
      await this.client.connect();
    } catch (error) {
      this.isConnected = false;
      logger.error('Failed to connect to Redis', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      // Don't throw - allow application to continue without cache
    }
  }

  /**
   * Get value from cache
   * Returns null on error to allow graceful degradation
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected) {
      logger.warn(`Cache get failed: Redis not connected (key: ${key})`);
      return null;
    }

    try {
      const value = await this.client.get(key);
      if (!value) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error(`Cache get failed for key ${key}`, { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return null; // Graceful degradation
    }
  }

  /**
   * Set value in cache with TTL
   * Logs errors but doesn't throw to allow graceful degradation
   */
  async set(key: string, value: any, ttl: number): Promise<void> {
    if (!this.isConnected) {
      logger.warn(`Cache set failed: Redis not connected (key: ${key})`);
      return; // Graceful degradation
    }

    try {
      const serialized = JSON.stringify(value);
      await this.client.setEx(key, ttl, serialized);
    } catch (error) {
      logger.error(`Cache set failed for key ${key}`, { 
        error: error instanceof Error ? error.message : String(error) 
      });
      // Don't throw - allow application to continue
    }
  }

  /**
   * Delete a single cache entry
   * Logs errors but doesn't throw
   */
  async del(key: string): Promise<void> {
    if (!this.isConnected) {
      logger.warn(`Cache del failed: Redis not connected (key: ${key})`);
      return;
    }

    try {
      await this.client.del(key);
    } catch (error) {
      logger.error(`Cache del failed for key ${key}`, { 
        error: error instanceof Error ? error.message : String(error) 
      });
      // Don't throw - allow application to continue
    }
  }

  /**
   * Delete all cache entries matching a pattern
   * Logs errors but doesn't throw
   */
  async delPattern(pattern: string): Promise<void> {
    if (!this.isConnected) {
      logger.warn(`Cache delPattern failed: Redis not connected (pattern: ${pattern})`);
      return;
    }

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
        logger.info(`Deleted ${keys.length} cache entries matching pattern: ${pattern}`);
      }
    } catch (error) {
      logger.error(`Cache delPattern failed for pattern ${pattern}`, { 
        error: error instanceof Error ? error.message : String(error) 
      });
      // Don't throw - allow application to continue
    }
  }

  /**
   * Close the Redis connection
   */
  async close(): Promise<void> {
    try {
      await this.client.quit();
      this.isConnected = false;
      logger.info('Redis connection closed gracefully');
    } catch (error) {
      logger.error('Error closing Redis connection', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }
}
