import { Request, Response, NextFunction } from 'express';
import { AppError, RateLimitError } from '../errors';
import { logger } from '../utils/logger';

/**
 * Global error handler middleware
 * Logs all errors and returns consistent JSON responses
 * Ensures 500 errors don't expose internal details
 * 
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Extract user ID from request if available (set by auth middleware)
  const userId = (req as any).user?.id;

  // Log all errors with context
  const logMeta = {
    userId,
    endpoint: req.path,
    method: req.method,
    error: err.message,
    stack: err.stack,
  };

  // Determine severity based on error type
  if (err instanceof AppError && err.isOperational) {
    // Operational errors are expected (validation, auth, etc.)
    logger.warn('Operational error occurred', logMeta);
  } else {
    // Programming errors or unexpected failures
    logger.error('Unexpected error occurred', logMeta);
  }

  // Handle known operational errors
  if (err instanceof AppError && err.isOperational) {
    // Special handling for rate limit errors (include Retry-After header)
    if (err instanceof RateLimitError) {
      res
        .status(err.statusCode)
        .header('Retry-After', err.retryAfter.toString())
        .json({
          success: false,
          error: err.message,
        });
      return;
    }

    // Standard operational error response
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
    return;
  }

  // Handle unknown/programming errors
  // Don't expose internal details to clients (Requirement 14.6)
  res.status(500).json({
    success: false,
    error: 'An unexpected error occurred',
  });
}
