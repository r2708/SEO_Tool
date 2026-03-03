import { AppError } from './AppError';

/**
 * RateLimitError - HTTP 429
 * Thrown when user exceeds rate limit
 * Includes retryAfter property for Retry-After header
 */
export class RateLimitError extends AppError {
  public readonly retryAfter: number;

  constructor(retryAfter: number) {
    super(429, 'Rate limit exceeded');
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}
