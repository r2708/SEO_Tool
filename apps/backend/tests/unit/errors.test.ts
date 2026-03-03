import { describe, it, expect } from 'vitest';
import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  ExternalServiceError,
} from '../../src/errors';

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create an error with statusCode and isOperational flag', () => {
      const error = new AppError(500, 'Test error', true);
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(true);
      expect(error.stack).toBeDefined();
    });

    it('should default isOperational to true', () => {
      const error = new AppError(500, 'Test error');
      expect(error.isOperational).toBe(true);
    });

    it('should allow isOperational to be false', () => {
      const error = new AppError(500, 'Programming error', false);
      expect(error.isOperational).toBe(false);
    });
  });

  describe('ValidationError', () => {
    it('should create a 400 error', () => {
      const error = new ValidationError('Invalid email format');
      
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe('Invalid email format');
      expect(error.statusCode).toBe(400);
      expect(error.isOperational).toBe(true);
    });
  });

  describe('AuthenticationError', () => {
    it('should create a 401 error with default message', () => {
      const error = new AuthenticationError();
      
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error.message).toBe('Invalid credentials');
      expect(error.statusCode).toBe(401);
      expect(error.isOperational).toBe(true);
    });

    it('should create a 401 error with custom message', () => {
      const error = new AuthenticationError('Token expired');
      
      expect(error.message).toBe('Token expired');
      expect(error.statusCode).toBe(401);
    });
  });

  describe('AuthorizationError', () => {
    it('should create a 403 error with default message', () => {
      const error = new AuthorizationError();
      
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(AuthorizationError);
      expect(error.message).toBe('Insufficient permissions');
      expect(error.statusCode).toBe(403);
      expect(error.isOperational).toBe(true);
    });

    it('should create a 403 error with custom message', () => {
      const error = new AuthorizationError('Pro subscription required');
      
      expect(error.message).toBe('Pro subscription required');
      expect(error.statusCode).toBe(403);
    });
  });

  describe('NotFoundError', () => {
    it('should create a 404 error with resource name', () => {
      const error = new NotFoundError('Project');
      
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(NotFoundError);
      expect(error.message).toBe('Project not found');
      expect(error.statusCode).toBe(404);
      expect(error.isOperational).toBe(true);
    });

    it('should format message correctly for different resources', () => {
      expect(new NotFoundError('User').message).toBe('User not found');
      expect(new NotFoundError('Keyword').message).toBe('Keyword not found');
      expect(new NotFoundError('Competitor').message).toBe('Competitor not found');
    });
  });

  describe('RateLimitError', () => {
    it('should create a 429 error with retryAfter', () => {
      const error = new RateLimitError(3600);
      
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(RateLimitError);
      expect(error.message).toBe('Rate limit exceeded');
      expect(error.statusCode).toBe(429);
      expect(error.retryAfter).toBe(3600);
      expect(error.isOperational).toBe(true);
    });

    it('should store different retryAfter values', () => {
      const error1 = new RateLimitError(60);
      const error2 = new RateLimitError(3600);
      
      expect(error1.retryAfter).toBe(60);
      expect(error2.retryAfter).toBe(3600);
    });
  });

  describe('ExternalServiceError', () => {
    it('should create a 502 error with service name and message', () => {
      const error = new ExternalServiceError('OpenAI', 'API timeout');
      
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(ExternalServiceError);
      expect(error.message).toBe('OpenAI service error: API timeout');
      expect(error.statusCode).toBe(502);
      expect(error.isOperational).toBe(true);
    });

    it('should format message correctly for different services', () => {
      const openAIError = new ExternalServiceError('OpenAI', 'Rate limit exceeded');
      const scraperError = new ExternalServiceError('Scraper', 'Page unreachable');
      
      expect(openAIError.message).toBe('OpenAI service error: Rate limit exceeded');
      expect(scraperError.message).toBe('Scraper service error: Page unreachable');
    });
  });

  describe('Error inheritance', () => {
    it('should maintain proper prototype chain', () => {
      const errors = [
        new ValidationError('test'),
        new AuthenticationError('test'),
        new AuthorizationError('test'),
        new NotFoundError('test'),
        new RateLimitError(60),
        new ExternalServiceError('test', 'test'),
      ];

      errors.forEach(error => {
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(AppError);
        expect(error.stack).toBeDefined();
      });
    });
  });
});
