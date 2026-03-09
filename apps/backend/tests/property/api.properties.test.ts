import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import { Request, Response, NextFunction } from 'express';
import { requireRole } from '../../src/middleware/authorize';
import { AuthenticatedRequest } from '../../src/middleware/authenticate';
import { AuthorizationError, RateLimitError } from '../../src/errors';
import { responseFormatter } from '../../src/middleware/responseFormatter';

/**
 * **Validates: Requirements 3.4, 3.5, 3.6**
 * 
 * Property 12: Role-Based Access Control
 * For any endpoint with role requirements, the API_Gateway should deny access to users 
 * whose role is insufficient (Free cannot access Pro features, Free and Pro cannot access 
 * Admin features) and return HTTP 403.
 */
describe('Feature: seo-saas-platform, API Middleware Properties', () => {
  describe('Property 12: Role-Based Access Control', () => {
    it('should enforce role hierarchy: Free < Pro < Admin', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('Free' as const, 'Pro' as const, 'Admin' as const),
          fc.constantFrom('Free' as const, 'Pro' as const, 'Admin' as const),
          fc.uuid(),
          (userRole: 'Free' | 'Pro' | 'Admin', requiredRole: 'Free' | 'Pro' | 'Admin', userId: string) => {
            // Create mock request with user
            const req = {
              user: {
                id: userId,
                role: userRole,
              },
            } as AuthenticatedRequest;

            const res = {} as Response;
            let nextCalled = false;
            let errorPassed: any = null;

            const next: NextFunction = (error?: any) => {
              nextCalled = true;
              if (error) {
                errorPassed = error;
              }
            };

            // Create middleware with required role
            const middleware = requireRole(requiredRole);
            middleware(req, res, next);

            // Define role hierarchy
            const roleLevel: Record<string, number> = {
              Free: 1,
              Pro: 2,
              Admin: 3,
            };

            const userLevel = roleLevel[userRole];
            const requiredLevel = roleLevel[requiredRole];

            // Verify authorization logic
            if (userLevel >= requiredLevel) {
              // User should be authorized - next() called without error
              expect(nextCalled).toBe(true);
              expect(errorPassed).toBeNull();
            } else {
              // User should be denied - next() called with AuthorizationError
              expect(nextCalled).toBe(true);
              expect(errorPassed).toBeInstanceOf(AuthorizationError);
              expect(errorPassed.statusCode).toBe(403);
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should deny Free users access to Pro features', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          (userId: string) => {
            const req = {
              user: {
                id: userId,
                role: 'Free' as const,
              },
            } as AuthenticatedRequest;

            const res = {} as Response;
            let errorPassed: any = null;

            const next: NextFunction = (error?: any) => {
              if (error) {
                errorPassed = error;
              }
            };

            const middleware = requireRole('Pro');
            middleware(req, res, next);

            // Free user should be denied Pro access
            expect(errorPassed).toBeInstanceOf(AuthorizationError);
            expect(errorPassed.statusCode).toBe(403);
            expect(errorPassed.message).toContain('Insufficient permissions');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should deny Free and Pro users access to Admin features', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('Free' as const, 'Pro' as const),
          fc.uuid(),
          (userRole: 'Free' | 'Pro', userId: string) => {
            const req = {
              user: {
                id: userId,
                role: userRole,
              },
            } as AuthenticatedRequest;

            const res = {} as Response;
            let errorPassed: any = null;

            const next: NextFunction = (error?: any) => {
              if (error) {
                errorPassed = error;
              }
            };

            const middleware = requireRole('Admin');
            middleware(req, res, next);

            // Non-admin users should be denied Admin access
            expect(errorPassed).toBeInstanceOf(AuthorizationError);
            expect(errorPassed.statusCode).toBe(403);
            expect(errorPassed.message).toContain('Insufficient permissions');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should allow users to access features at or below their role level', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          (userId: string) => {
            // Test Pro user accessing Free features
            const proReq = {
              user: {
                id: userId,
                role: 'Pro' as const,
              },
            } as AuthenticatedRequest;

            const res = {} as Response;
            let proError: any = null;

            const proNext: NextFunction = (error?: any) => {
              if (error) {
                proError = error;
              }
            };

            const freeMiddleware = requireRole('Free');
            freeMiddleware(proReq, res, proNext);

            // Pro user should access Free features
            expect(proError).toBeNull();

            // Test Admin user accessing Pro features
            const adminReq = {
              user: {
                id: userId,
                role: 'Admin' as const,
              },
            } as AuthenticatedRequest;

            let adminError: any = null;

            const adminNext: NextFunction = (error?: any) => {
              if (error) {
                adminError = error;
              }
            };

            const proMiddleware = requireRole('Pro');
            proMiddleware(adminReq, res, adminNext);

            // Admin user should access Pro features
            expect(adminError).toBeNull();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should return 403 status code for authorization failures', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('Free' as const, 'Pro' as const),
          fc.constantFrom('Pro' as const, 'Admin' as const),
          fc.uuid(),
          (userRole: 'Free' | 'Pro', requiredRole: 'Pro' | 'Admin', userId: string) => {
            // Ensure user role is insufficient
            const roleLevel: Record<string, number> = {
              Free: 1,
              Pro: 2,
              Admin: 3,
            };

            fc.pre(roleLevel[userRole] < roleLevel[requiredRole]);

            const req = {
              user: {
                id: userId,
                role: userRole,
              },
            } as AuthenticatedRequest;

            const res = {} as Response;
            let errorPassed: any = null;

            const next: NextFunction = (error?: any) => {
              if (error) {
                errorPassed = error;
              }
            };

            const middleware = requireRole(requiredRole);
            middleware(req, res, next);

            // Verify 403 status code
            expect(errorPassed).toBeInstanceOf(AuthorizationError);
            expect(errorPassed.statusCode).toBe(403);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});

/**
 * **Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7**
 * 
 * Property 43: Rate Limit Tracking
 * For any user making API requests, the API_Gateway should increment the request counter 
 * in cache and enforce limits: Free (100/hour), Pro (1000/hour), Admin (unlimited).
 */
describe('Property 43: Rate Limit Tracking', () => {
  it('should track request count per user and enforce role-based limits', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('Free' as const, 'Pro' as const, 'Admin' as const),
        fc.uuid(),
        fc.integer({ min: 1, max: 150 }),
        async (userRole: 'Free' | 'Pro' | 'Admin', userId: string, requestCount: number) => {
          // Create mock cache
          let cacheData: Record<string, any> = {};
          const mockCache = {
            get: vi.fn(async (key: string) => cacheData[key] ?? null),
            set: vi.fn(async (key: string, value: any) => {
              cacheData[key] = value;
            }),
            del: vi.fn(),
            delPattern: vi.fn(),
            close: vi.fn(),
          };

          const { createRateLimiter } = await import('../../src/middleware/rateLimit');
          const rateLimiter = createRateLimiter(mockCache);

          // Define limits
          const limits: Record<string, number> = {
            Free: 100,
            Pro: 1000,
            Admin: Infinity,
          };

          const limit = limits[userRole];
          let errorThrown: any = null;

          // Simulate multiple requests
          for (let i = 0; i < requestCount; i++) {
            const req = {
              user: {
                id: userId,
                role: userRole,
              },
            } as AuthenticatedRequest;

            const res = {
              setHeader: vi.fn(),
            } as any;

            let nextCalled = false;
            const next: NextFunction = (error?: any) => {
              nextCalled = true;
              if (error) {
                errorThrown = error;
              }
            };

            await rateLimiter(req, res, next);

            // If error was thrown, stop making requests
            if (errorThrown) {
              break;
            }

            expect(nextCalled).toBe(true);
          }

          // Verify rate limit enforcement
          if (userRole === 'Admin') {
            // Admin should never be rate limited
            expect(errorThrown).toBeNull();
          } else if (requestCount > limit) {
            // Should be rate limited
            expect(errorThrown).toBeInstanceOf(RateLimitError);
            expect(errorThrown.statusCode).toBe(429);
          } else {
            // Should not be rate limited
            expect(errorThrown).toBeNull();
          }

          // Clean up
          cacheData = {};
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should enforce Free user limit of 100 requests per hour', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        async (userId: string) => {
          let cacheData: Record<string, any> = {};
          const mockCache = {
            get: vi.fn(async (key: string) => cacheData[key] ?? null),
            set: vi.fn(async (key: string, value: any) => {
              cacheData[key] = value;
            }),
            del: vi.fn(),
            delPattern: vi.fn(),
            close: vi.fn(),
          };

          const { createRateLimiter } = await import('../../src/middleware/rateLimit');
          const rateLimiter = createRateLimiter(mockCache);

          let errorThrown: any = null;

          // Make 101 requests
          for (let i = 0; i < 101; i++) {
            const req = {
              user: {
                id: userId,
                role: 'Free' as const,
              },
            } as AuthenticatedRequest;

            const res = {
              setHeader: vi.fn(),
            } as any;

            const next: NextFunction = (error?: any) => {
              if (error) {
                errorThrown = error;
              }
            };

            await rateLimiter(req, res, next);

            if (errorThrown) {
              break;
            }
          }

          // 101st request should be rate limited
          expect(errorThrown).toBeInstanceOf(RateLimitError);
          expect(errorThrown.statusCode).toBe(429);
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should not rate limit Admin users', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.integer({ min: 100, max: 2000 }),
        async (userId: string, requestCount: number) => {
          let cacheData: Record<string, any> = {};
          const mockCache = {
            get: vi.fn(async (key: string) => cacheData[key] ?? null),
            set: vi.fn(async (key: string, value: any) => {
              cacheData[key] = value;
            }),
            del: vi.fn(),
            delPattern: vi.fn(),
            close: vi.fn(),
          };

          const { createRateLimiter } = await import('../../src/middleware/rateLimit');
          const rateLimiter = createRateLimiter(mockCache);

          let errorThrown: any = null;

          // Make many requests as Admin
          for (let i = 0; i < requestCount; i++) {
            const req = {
              user: {
                id: userId,
                role: 'Admin' as const,
              },
            } as AuthenticatedRequest;

            const res = {
              setHeader: vi.fn(),
            } as any;

            const next: NextFunction = (error?: any) => {
              if (error) {
                errorThrown = error;
              }
            };

            await rateLimiter(req, res, next);

            if (errorThrown) {
              break;
            }
          }

          // Admin should never be rate limited
          expect(errorThrown).toBeNull();
        }
      ),
      { numRuns: 10 }
    );
  });
});

/**
 * **Validates: Requirements 13.5, 13.6**
 * 
 * Property 44: Rate Limit Response
 * For any request that exceeds the rate limit, the API_Gateway should return HTTP 429 
 * with a Retry-After header indicating seconds until the limit resets.
 */
describe('Property 44: Rate Limit Response', () => {
  it('should return 429 with Retry-After header when limit exceeded', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('Free' as const, 'Pro' as const),
        fc.uuid(),
        async (userRole: 'Free' | 'Pro', userId: string) => {
          let cacheData: Record<string, any> = {};
          const mockCache = {
            get: vi.fn(async (key: string) => cacheData[key] ?? null),
            set: vi.fn(async (key: string, value: any) => {
              cacheData[key] = value;
            }),
            del: vi.fn(),
            delPattern: vi.fn(),
            close: vi.fn(),
          };

          const { createRateLimiter } = await import('../../src/middleware/rateLimit');
          const rateLimiter = createRateLimiter(mockCache);

          const limits: Record<string, number> = {
            Free: 100,
            Pro: 1000,
          };

          const limit = limits[userRole];
          let errorThrown: any = null;

          // Exceed the limit
          for (let i = 0; i <= limit; i++) {
            const req = {
              user: {
                id: userId,
                role: userRole,
              },
            } as AuthenticatedRequest;

            const res = {
              setHeader: vi.fn(),
            } as any;

            const next: NextFunction = (error?: any) => {
              if (error) {
                errorThrown = error;
              }
            };

            await rateLimiter(req, res, next);

            if (errorThrown) {
              break;
            }
          }

          // Verify error response
          expect(errorThrown).toBeInstanceOf(RateLimitError);
          expect(errorThrown.statusCode).toBe(429);
          expect(errorThrown.retryAfter).toBe(3600); // 1 hour in seconds
        }
      ),
      { numRuns: 10 }
    );
  });
});

/**
 * **Validates: Requirements 13.7**
 * 
 * Property 45: Rate Limit Cache Storage
 * For any rate limit counter, it should be stored in the Cache_Layer with TTL 
 * matching the time window (1 hour).
 */
describe('Property 45: Rate Limit Cache Storage', () => {
  it('should store rate limit counters with 1-hour TTL', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('Free' as const, 'Pro' as const),
        fc.uuid(),
        async (userRole: 'Free' | 'Pro', userId: string) => {
          let cacheData: Record<string, any> = {};
          let cacheTTL: Record<string, number> = {};
          
          const mockCache = {
            get: vi.fn(async (key: string) => cacheData[key] ?? null),
            set: vi.fn(async (key: string, value: any, ttl: number) => {
              cacheData[key] = value;
              cacheTTL[key] = ttl;
            }),
            del: vi.fn(),
            delPattern: vi.fn(),
            close: vi.fn(),
          };

          const { createRateLimiter } = await import('../../src/middleware/rateLimit');
          const rateLimiter = createRateLimiter(mockCache);

          const req = {
            user: {
              id: userId,
              role: userRole,
            },
          } as AuthenticatedRequest;

          const res = {
            setHeader: vi.fn(),
          } as any;

          const next: NextFunction = () => {};

          await rateLimiter(req, res, next);

          // Verify cache was called with correct TTL
          expect(mockCache.set).toHaveBeenCalled();
          
          const cacheKey = `ratelimit:${userId}`;
          expect(cacheTTL[cacheKey]).toBe(3600); // 1 hour in seconds
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should use correct cache key pattern for rate limiting', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        async (userId: string) => {
          let cacheKeys: string[] = [];
          
          const mockCache = {
            get: vi.fn(async (key: string) => {
              cacheKeys.push(key);
              return null;
            }),
            set: vi.fn(async (key: string) => {
              cacheKeys.push(key);
            }),
            del: vi.fn(),
            delPattern: vi.fn(),
            close: vi.fn(),
          };

          const { createRateLimiter } = await import('../../src/middleware/rateLimit');
          const rateLimiter = createRateLimiter(mockCache);

          const req = {
            user: {
              id: userId,
              role: 'Free' as const,
            },
          } as AuthenticatedRequest;

          const res = {
            setHeader: vi.fn(),
          } as any;

          const next: NextFunction = () => {};

          await rateLimiter(req, res, next);

          // Verify cache key pattern
          const expectedKey = `ratelimit:${userId}`;
          expect(cacheKeys).toContain(expectedKey);
        }
      ),
      { numRuns: 20 }
    );
  });
});

/**
 * **Validates: Requirements 19.1, 19.2, 19.3, 19.4, 19.5**
 * 
 * Property 61: API Response Format Consistency
 * For any API response, it should follow the standard format: success responses include 
 * {success: true, data: {...}}, error responses include {success: false, error: "message"}, 
 * and Content-Type should be application/json.
 */
describe('Property 61: API Response Format Consistency', () => {
  it('should format successful responses with {success: true, data: {...}}', () => {
    fc.assert(
      fc.property(
        fc.anything(),
        fc.integer({ min: 200, max: 299 }),
        (data: any, statusCode: number) => {
          const req = {} as Request;
          let responseData: any = null;
          let responseStatus: number = 200;
          let headers: Record<string, string> = {};

          const res = {
            setHeader: vi.fn((key: string, value: string) => {
              headers[key] = value;
            }),
            status: vi.fn(function (this: any, code: number) {
              responseStatus = code;
              return this;
            }),
            json: vi.fn((body: any) => {
              responseData = body;
            }),
          } as any;

          let nextCalled = false;
          const next: NextFunction = () => {
            nextCalled = true;
          };

          // Apply middleware
          responseFormatter(req, res, next);

          // Verify next was called
          expect(nextCalled).toBe(true);

          // Use the success method
          res.success(data, statusCode);

          // Verify response format
          expect(responseData).toEqual({
            success: true,
            data,
          });

          // Verify status code
          expect(responseStatus).toBe(statusCode);

          // Verify Content-Type header
          expect(headers['Content-Type']).toBe('application/json');
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should set Content-Type to application/json for all responses', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          name: fc.string(),
          value: fc.integer(),
        }),
        (data: any) => {
          const req = {} as Request;
          let headers: Record<string, string> = {};

          const res = {
            setHeader: vi.fn((key: string, value: string) => {
              headers[key] = value;
            }),
            status: vi.fn(function (this: any) {
              return this;
            }),
            json: vi.fn(),
          } as any;

          const next: NextFunction = () => {};

          // Apply middleware
          responseFormatter(req, res, next);

          // Use the success method
          res.success(data);

          // Verify Content-Type header is set
          expect(headers['Content-Type']).toBe('application/json');
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should default to status code 200 when not specified', () => {
    fc.assert(
      fc.property(
        fc.object(),
        (data: any) => {
          const req = {} as Request;
          let responseStatus: number = 0;

          const res = {
            setHeader: vi.fn(),
            status: vi.fn(function (this: any, code: number) {
              responseStatus = code;
              return this;
            }),
            json: vi.fn(),
          } as any;

          const next: NextFunction = () => {};

          // Apply middleware
          responseFormatter(req, res, next);

          // Use the success method without status code
          res.success(data);

          // Verify default status code is 200
          expect(responseStatus).toBe(200);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should preserve data structure in response', () => {
    fc.assert(
      fc.property(
        fc.record({
          users: fc.array(fc.record({
            id: fc.uuid(),
            email: fc.emailAddress(),
          })),
          total: fc.nat(),
          page: fc.nat(),
        }),
        (data: any) => {
          const req = {} as Request;
          let responseData: any = null;

          const res = {
            setHeader: vi.fn(),
            status: vi.fn(function (this: any) {
              return this;
            }),
            json: vi.fn((body: any) => {
              responseData = body;
            }),
          } as any;

          const next: NextFunction = () => {};

          // Apply middleware
          responseFormatter(req, res, next);

          // Use the success method
          res.success(data);

          // Verify data structure is preserved
          expect(responseData.success).toBe(true);
          expect(responseData.data).toEqual(data);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle various data types correctly', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string(),
          fc.integer(),
          fc.boolean(),
          fc.array(fc.anything()),
          fc.object(),
          fc.constant(null)
        ),
        (data: any) => {
          const req = {} as Request;
          let responseData: any = null;

          const res = {
            setHeader: vi.fn(),
            status: vi.fn(function (this: any) {
              return this;
            }),
            json: vi.fn((body: any) => {
              responseData = body;
            }),
          } as any;

          const next: NextFunction = () => {};

          // Apply middleware
          responseFormatter(req, res, next);

          // Use the success method
          res.success(data);

          // Verify response format
          expect(responseData).toHaveProperty('success', true);
          expect(responseData).toHaveProperty('data');
          expect(responseData.data).toEqual(data);
        }
      ),
      { numRuns: 50 }
    );
  });
});
