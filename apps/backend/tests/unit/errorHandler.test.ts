import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

// Mock logger
vi.mock('../../src/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Error Handler Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;
  let headerMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup mock request
    mockRequest = {
      path: '/api/test',
      method: 'POST',
    };

    // Setup mock response
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnThis();
    headerMock = vi.fn().mockReturnThis();
    
    mockResponse = {
      status: statusMock,
      json: jsonMock,
      header: headerMock,
    };

    mockNext = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Operational Errors', () => {
    it('should handle ValidationError with 400 status', () => {
      const error = new ValidationError('Invalid email format');

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid email format',
      });
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should handle AuthenticationError with 401 status', () => {
      const error = new AuthenticationError('Token expired');

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Token expired',
      });
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should handle AuthorizationError with 403 status', () => {
      const error = new AuthorizationError('Pro subscription required');

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Pro subscription required',
      });
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should handle NotFoundError with 404 status', () => {
      const error = new NotFoundError('Project');

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Project not found',
      });
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should handle RateLimitError with 429 status and Retry-After header', () => {
      const error = new RateLimitError(3600);

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(429);
      expect(headerMock).toHaveBeenCalledWith('Retry-After', '3600');
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Rate limit exceeded',
      });
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should handle ExternalServiceError with 502 status', () => {
      const error = new ExternalServiceError('OpenAI', 'API timeout');

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(502);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'OpenAI service error: API timeout',
      });
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('Non-Operational Errors', () => {
    it('should handle programming errors with 500 status without exposing details', () => {
      const error = new Error('Database connection failed');

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'An unexpected error occurred',
      });
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle non-operational AppError with 500 status', () => {
      const error = new AppError(500, 'Internal error', false);

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'An unexpected error occurred',
      });
      expect(logger.error).toHaveBeenCalled();
    });

    it('should not expose internal error messages for 500 errors', () => {
      const error = new Error('Sensitive database credentials exposed');

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      const jsonCall = jsonMock.mock.calls[0][0];
      expect(jsonCall.error).not.toContain('database');
      expect(jsonCall.error).not.toContain('credentials');
      expect(jsonCall.error).toBe('An unexpected error occurred');
    });
  });

  describe('Logging', () => {
    it('should log error with request context', () => {
      const error = new ValidationError('Test error');

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(logger.warn).toHaveBeenCalledWith(
        'Operational error occurred',
        expect.objectContaining({
          endpoint: '/api/test',
          method: 'POST',
          error: 'Test error',
          stack: expect.any(String),
        })
      );
    });

    it('should log userId when available', () => {
      const error = new ValidationError('Test error');
      mockRequest = {
        ...mockRequest,
        user: { id: 'user-123' },
      } as any;

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(logger.warn).toHaveBeenCalledWith(
        'Operational error occurred',
        expect.objectContaining({
          userId: 'user-123',
        })
      );
    });

    it('should log operational errors with warn level', () => {
      const error = new ValidationError('Test error');

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(logger.warn).toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('should log unexpected errors with error level', () => {
      const error = new Error('Unexpected error');

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(logger.error).toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe('Response Format', () => {
    it('should always return JSON with success: false', () => {
      const errors = [
        new ValidationError('test'),
        new AuthenticationError('test'),
        new NotFoundError('test'),
        new Error('test'),
      ];

      errors.forEach(error => {
        vi.clearAllMocks();
        errorHandler(
          error,
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        const jsonCall = jsonMock.mock.calls[0][0];
        expect(jsonCall).toHaveProperty('success', false);
        expect(jsonCall).toHaveProperty('error');
        expect(typeof jsonCall.error).toBe('string');
      });
    });

    it('should not include stack traces in response', () => {
      const error = new Error('Test error with stack');

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      const jsonCall = jsonMock.mock.calls[0][0];
      expect(jsonCall).not.toHaveProperty('stack');
    });
  });

  describe('Edge Cases', () => {
    it('should handle errors without user context', () => {
      const error = new ValidationError('Test error');
      mockRequest = {
        path: '/api/test',
        method: 'GET',
      };

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalled();
    });

    it('should handle errors with empty message', () => {
      const error = new ValidationError('');

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: '',
      });
    });
  });
});
