import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../../src/middleware/errorHandler';
import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  ExternalServiceError,
} from '../../src/errors';
import { logger } from '../../src/utils/logger';

describe('Error Handling Property Tests', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let loggerSpy: any;

  beforeEach(() => {
    // Setup mock request
    mockRequest = {
      path: '/api/test',
      method: 'GET',
      user: undefined,
    };

    // Setup mock response
    const jsonMock = vi.fn();
    const statusMock = vi.fn(() => mockResponse);
    const headerMock = vi.fn(() => mockResponse);

    mockResponse = {
      status: statusMock as any,
      json: jsonMock,
      header: headerMock as any,
    };

    mockNext = vi.fn();

    // Spy on logger methods
    loggerSpy = {
      error: vi.spyOn(logger, 'error').mockImplementation(() => {}),
      warn: vi.spyOn(logger, 'warn').mockImplementation(() => {}),
      info: vi.spyOn(logger, 'info').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Feature: seo-saas-platform, Property 46: Error Logging Completeness', () => {
    it('should log all required fields for any error with user context', async () => {
      // **Validates: Requirements 14.1, 14.7**

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }), // error message
          fc.uuid(), // userId
          fc.constantFrom('GET', 'POST', 'PUT', 'DELETE', 'PATCH'), // HTTP method
          fc.string({ minLength: 1, maxLength: 100 }).map(s => `/api/${s}`), // endpoint
          async (errorMessage, userId, method, endpoint) => {
            // Reset mocks
            loggerSpy.error.mockClear();
            loggerSpy.warn.mockClear();

            // Setup request with user
            mockRequest.user = { id: userId };
            mockRequest.method = method;
            mockRequest.path = endpoint;

            const error = new Error(errorMessage);

            // Call error handler
            errorHandler(
              error,
              mockRequest as Request,
              mockResponse as Response,
              mockNext
            );

            // Verify logging was called
            const logCalls = [...loggerSpy.error.mock.calls, ...loggerSpy.warn.mock.calls];
            expect(logCalls.length).toBeGreaterThan(0);

            // Get the log metadata
            const logCall = logCalls[0];
            const logMeta = logCall[1];

            // Verify all required fields are present
            expect(logMeta).toBeDefined();
            expect(logMeta.userId).toBe(userId);
            expect(logMeta.endpoint).toBe(endpoint);
            expect(logMeta.method).toBe(method);
            expect(logMeta.error).toBe(errorMessage);
            expect(logMeta.stack).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should log errors without userId when user is not authenticated', async () => {
      // **Validates: Requirements 14.1, 14.7**

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }), // error message
          fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'), // HTTP method
          fc.string({ minLength: 1, maxLength: 100 }).map(s => `/api/${s}`), // endpoint
          async (errorMessage, method, endpoint) => {
            // Reset mocks
            loggerSpy.error.mockClear();
            loggerSpy.warn.mockClear();

            // Setup request without user
            mockRequest.user = undefined;
            mockRequest.method = method;
            mockRequest.path = endpoint;

            const error = new ValidationError(errorMessage);

            // Call error handler
            errorHandler(
              error,
              mockRequest as Request,
              mockResponse as Response,
              mockNext
            );

            // Verify logging was called
            const logCalls = [...loggerSpy.error.mock.calls, ...loggerSpy.warn.mock.calls];
            expect(logCalls.length).toBeGreaterThan(0);

            // Get the log metadata
            const logCall = logCalls[0];
            const logMeta = logCall[1];

            // Verify required fields (userId should be undefined)
            expect(logMeta).toBeDefined();
            expect(logMeta.endpoint).toBe(endpoint);
            expect(logMeta.method).toBe(method);
            expect(logMeta.error).toBe(errorMessage);
            // userId can be undefined for unauthenticated requests
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use appropriate severity levels for different error types', async () => {
      // **Validates: Requirements 14.7**

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }), // error message
          async (errorMessage) => {
            // Reset mocks
            loggerSpy.error.mockClear();
            loggerSpy.warn.mockClear();

            // Test operational error (should use warn)
            const operationalError = new ValidationError(errorMessage);
            errorHandler(
              operationalError,
              mockRequest as Request,
              mockResponse as Response,
              mockNext
            );

            expect(loggerSpy.warn).toHaveBeenCalled();
            loggerSpy.warn.mockClear();

            // Test non-operational error (should use error)
            const nonOperationalError = new Error(errorMessage);
            errorHandler(
              nonOperationalError,
              mockRequest as Request,
              mockResponse as Response,
              mockNext
            );

            expect(loggerSpy.error).toHaveBeenCalled();
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Feature: seo-saas-platform, Property 47: HTTP Status Code Mapping', () => {
    it('should map ValidationError to HTTP 400', async () => {
      // **Validates: Requirements 14.2**

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          async (errorMessage) => {
            const error = new ValidationError(errorMessage);

            errorHandler(
              error,
              mockRequest as Request,
              mockResponse as Response,
              mockNext
            );

            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith({
              success: false,
              error: errorMessage,
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should map AuthenticationError to HTTP 401', async () => {
      // **Validates: Requirements 14.3**

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          async (errorMessage) => {
            const error = new AuthenticationError(errorMessage);

            errorHandler(
              error,
              mockRequest as Request,
              mockResponse as Response,
              mockNext
            );

            expect(mockResponse.status).toHaveBeenCalledWith(401);
            expect(mockResponse.json).toHaveBeenCalledWith({
              success: false,
              error: errorMessage,
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should map AuthorizationError to HTTP 403', async () => {
      // **Validates: Requirements 14.4**

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          async (errorMessage) => {
            const error = new AuthorizationError(errorMessage);

            errorHandler(
              error,
              mockRequest as Request,
              mockResponse as Response,
              mockNext
            );

            expect(mockResponse.status).toHaveBeenCalledWith(403);
            expect(mockResponse.json).toHaveBeenCalledWith({
              success: false,
              error: errorMessage,
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should map NotFoundError to HTTP 404', async () => {
      // **Validates: Requirements 14.5**

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          async (resource) => {
            const error = new NotFoundError(resource);

            errorHandler(
              error,
              mockRequest as Request,
              mockResponse as Response,
              mockNext
            );

            expect(mockResponse.status).toHaveBeenCalledWith(404);
            expect(mockResponse.json).toHaveBeenCalledWith({
              success: false,
              error: `${resource} not found`,
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should map RateLimitError to HTTP 429 with Retry-After header', async () => {
      // **Validates: Requirements 13.5, 13.6**

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 3600 }),
          async (retryAfter) => {
            const error = new RateLimitError(retryAfter);

            errorHandler(
              error,
              mockRequest as Request,
              mockResponse as Response,
              mockNext
            );

            expect(mockResponse.status).toHaveBeenCalledWith(429);
            expect(mockResponse.header).toHaveBeenCalledWith(
              'Retry-After',
              retryAfter.toString()
            );
            expect(mockResponse.json).toHaveBeenCalledWith({
              success: false,
              error: 'Rate limit exceeded',
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should map ExternalServiceError to HTTP 502', async () => {
      // **Validates: Requirements 14.8**

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('OpenAI', 'Scraper', 'Redis', 'Database'),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (service, errorMessage) => {
            const error = new ExternalServiceError(service, errorMessage);

            errorHandler(
              error,
              mockRequest as Request,
              mockResponse as Response,
              mockNext
            );

            expect(mockResponse.status).toHaveBeenCalledWith(502);
            expect(mockResponse.json).toHaveBeenCalledWith({
              success: false,
              error: `${service} service error: ${errorMessage}`,
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Feature: seo-saas-platform, Property 48: Internal Error Security', () => {
    it('should not expose internal error details for non-operational errors', async () => {
      // **Validates: Requirements 14.6**

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          async (internalErrorMessage) => {
            // Create a non-operational error (regular Error, not AppError)
            const error = new Error(internalErrorMessage);

            errorHandler(
              error,
              mockRequest as Request,
              mockResponse as Response,
              mockNext
            );

            // Should return 500
            expect(mockResponse.status).toHaveBeenCalledWith(500);

            // Should return generic message, NOT the internal error message
            expect(mockResponse.json).toHaveBeenCalledWith({
              success: false,
              error: 'An unexpected error occurred',
            });

            // Verify the internal message is NOT in the response
            const jsonCall = (mockResponse.json as any).mock.calls[0][0];
            expect(jsonCall.error).not.toBe(internalErrorMessage);
            expect(jsonCall.error).toBe('An unexpected error occurred');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not expose stack traces in error responses', async () => {
      // **Validates: Requirements 14.6**

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          async (errorMessage) => {
            const error = new Error(errorMessage);
            error.stack = 'Error: ' + errorMessage + '\n    at someFunction (file.ts:123:45)';

            errorHandler(
              error,
              mockRequest as Request,
              mockResponse as Response,
              mockNext
            );

            // Get the response
            const jsonCall = (mockResponse.json as any).mock.calls[0][0];

            // Verify no stack trace in response
            expect(jsonCall.stack).toBeUndefined();
            expect(JSON.stringify(jsonCall)).not.toContain('at someFunction');
            expect(JSON.stringify(jsonCall)).not.toContain('file.ts');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not expose sensitive information in 500 errors', async () => {
      // **Validates: Requirements 14.6**

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            password: fc.string({ minLength: 8, maxLength: 50 }),
            apiKey: fc.string({ minLength: 20, maxLength: 50 }),
            token: fc.string({ minLength: 20, maxLength: 100 }),
          }),
          async (sensitiveData) => {
            // Create error with sensitive data in message
            const errorMessage = `Database error: password=${sensitiveData.password}, apiKey=${sensitiveData.apiKey}`;
            const error = new Error(errorMessage);

            errorHandler(
              error,
              mockRequest as Request,
              mockResponse as Response,
              mockNext
            );

            // Get the response
            const jsonCall = (mockResponse.json as any).mock.calls[0][0];
            const responseString = JSON.stringify(jsonCall);

            // Verify sensitive data is NOT in response
            expect(responseString).not.toContain(sensitiveData.password);
            expect(responseString).not.toContain(sensitiveData.apiKey);
            expect(responseString).not.toContain(sensitiveData.token);
            expect(jsonCall.error).toBe('An unexpected error occurred');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Feature: seo-saas-platform, Property 49: External API Error Handling', () => {
    it('should log external service failures with details', async () => {
      // **Validates: Requirements 14.8**

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('OpenAI', 'Scraper', 'Redis', 'Database'),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (service, errorMessage) => {
            // Reset mocks
            loggerSpy.warn.mockClear();

            const error = new ExternalServiceError(service, errorMessage);

            errorHandler(
              error,
              mockRequest as Request,
              mockResponse as Response,
              mockNext
            );

            // Verify logging was called
            expect(loggerSpy.warn).toHaveBeenCalled();

            // Get the log metadata
            const logCall = loggerSpy.warn.mock.calls[0];
            const logMeta = logCall[1];

            // Verify error details are logged
            expect(logMeta.error).toContain(service);
            expect(logMeta.error).toContain(errorMessage);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return user-friendly messages for external service errors', async () => {
      // **Validates: Requirements 14.8**

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('OpenAI', 'Scraper', 'Redis', 'Database'),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (service, errorMessage) => {
            // Create fresh mocks for each iteration
            const jsonMock = vi.fn();
            const statusMock = vi.fn(() => ({ json: jsonMock, header: vi.fn() }));
            const freshResponse = {
              status: statusMock,
              json: jsonMock,
              header: vi.fn(() => ({ json: jsonMock })),
            };

            const error = new ExternalServiceError(service, errorMessage);

            errorHandler(
              error,
              mockRequest as Request,
              freshResponse as any,
              mockNext
            );

            // Get the response
            const jsonCall = jsonMock.mock.calls[0][0];

            // Verify response is user-friendly and includes service name
            expect(jsonCall.success).toBe(false);
            expect(jsonCall.error).toContain(service);
            expect(jsonCall.error).toContain('service error');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle various external service error scenarios', async () => {
      // **Validates: Requirements 14.8**

      const serviceErrorScenarios = fc.record({
        service: fc.constantFrom('OpenAI', 'Scraper', 'Puppeteer', 'Redis'),
        errorType: fc.constantFrom(
          'timeout',
          'connection refused',
          'rate limit',
          'invalid response',
          'network error'
        ),
      });

      await fc.assert(
        fc.asyncProperty(
          serviceErrorScenarios,
          async ({ service, errorType }) => {
            // Create fresh mocks for each iteration
            const jsonMock = vi.fn();
            const statusMock = vi.fn(() => ({ json: jsonMock, header: vi.fn() }));
            const freshResponse = {
              status: statusMock,
              json: jsonMock,
              header: vi.fn(() => ({ json: jsonMock })),
            };

            const errorMessage = `${errorType} occurred`;
            const error = new ExternalServiceError(service, errorMessage);

            errorHandler(
              error,
              mockRequest as Request,
              freshResponse as any,
              mockNext
            );

            // Verify proper handling
            expect(statusMock).toHaveBeenCalledWith(502);

            const jsonCall = jsonMock.mock.calls[0][0];
            expect(jsonCall.success).toBe(false);
            expect(jsonCall.error).toContain(service);
            expect(jsonCall.error).toContain(errorMessage);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
