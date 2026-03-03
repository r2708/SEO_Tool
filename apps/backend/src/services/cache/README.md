# Cache Service

This module provides Redis-based caching functionality with graceful degradation.

## Overview

The cache service implements a read-through and write-through caching pattern with automatic failover to database when Redis is unavailable.

## Components

### CacheService Interface

Defines the contract for cache operations:
- `get<T>(key: string): Promise<T | null>` - Retrieve cached value
- `set(key: string, value: any, ttl: number): Promise<void>` - Store value with TTL
- `del(key: string): Promise<void>` - Delete single entry
- `delPattern(pattern: string): Promise<void>` - Delete entries matching pattern
- `close(): Promise<void>` - Close connection

### RedisCache Implementation

Production implementation using Redis with:
- **Connection Pooling**: Automatic reconnection with exponential backoff
- **Graceful Degradation**: Returns null on errors instead of throwing
- **JSON Serialization**: Automatic serialization/deserialization
- **Error Logging**: All errors logged but don't interrupt application flow

### Cache Keys

Standardized key patterns for different data types:
- `keywords:${projectId}` - Keyword data (24h TTL)
- `rankings:${projectId}:${keyword?}` - Ranking history (1h TTL)
- `competitor:${projectId}:${domain}` - Competitor analysis (12h TTL)
- `dashboard:${userId}` - Dashboard metrics (5min TTL)
- `serp:${keyword}` - SERP results (24h TTL)
- `ratelimit:${userId}` - Rate limit counters (1h TTL)

## Usage

### Basic Usage

```typescript
import { RedisCache, CacheKeys, CacheTTL } from './services/cache';

// Initialize cache
const cache = new RedisCache(process.env.REDIS_URL!);

// Store data
await cache.set(
  CacheKeys.keywords(projectId),
  keywordData,
  CacheTTL.KEYWORDS
);

// Retrieve data
const cached = await cache.get<KeywordData[]>(
  CacheKeys.keywords(projectId)
);

// Delete data
await cache.del(CacheKeys.keywords(projectId));

// Delete pattern
await cache.delPattern(`keywords:${projectId}*`);
```

### Read-Through Pattern

```typescript
async function getKeywords(projectId: string): Promise<KeywordData[]> {
  // Try cache first
  const cached = await cache.get<KeywordData[]>(
    CacheKeys.keywords(projectId)
  );
  if (cached) {
    return cached;
  }

  // Fetch from database
  const keywords = await prisma.keyword.findMany({
    where: { projectId },
  });

  // Store in cache
  await cache.set(
    CacheKeys.keywords(projectId),
    keywords,
    CacheTTL.KEYWORDS
  );

  return keywords;
}
```

### Write-Through Pattern

```typescript
async function updateKeyword(
  projectId: string,
  keywordData: KeywordData
): Promise<void> {
  // Update database
  await prisma.keyword.upsert({
    where: { projectId_keyword: { projectId, keyword: keywordData.keyword } },
    update: keywordData,
    create: { projectId, ...keywordData },
  });

  // Invalidate cache
  await cache.del(CacheKeys.keywords(projectId));
}
```

### Cascade Invalidation

```typescript
async function deleteProject(projectId: string): Promise<void> {
  // Delete from database
  await prisma.project.delete({ where: { id: projectId } });

  // Invalidate all related caches
  await cache.delPattern(`keywords:${projectId}*`);
  await cache.delPattern(`rankings:${projectId}*`);
  await cache.delPattern(`competitor:${projectId}*`);
}
```

## Graceful Degradation

The cache service is designed to fail gracefully:

1. **Connection Failures**: If Redis is unavailable, operations return null/void without throwing
2. **Operation Failures**: Individual operation failures are logged but don't interrupt flow
3. **Automatic Reconnection**: Client attempts to reconnect with exponential backoff
4. **Application Continuity**: Application continues to function using database directly

## Error Handling

All cache operations handle errors internally:
- `get()` returns `null` on error
- `set()`, `del()`, `delPattern()` log errors but don't throw
- Errors are logged with context (key, pattern, operation)

## Configuration

Required environment variable:
- `REDIS_URL` - Redis connection URL (e.g., `redis://localhost:6379`)

## Testing

See `tests/unit/cache/` for unit tests and `tests/property/cache.properties.test.ts` for property-based tests.

## Requirements

Validates:
- **Requirement 15.6**: Cache_Layer SHALL use Redis for all caching operations
- **Requirement 15.7**: WHEN cache retrieval fails, THE Platform SHALL fetch data from Database and continue operation
