/**
 * Error classes for the SEO SaaS Platform
 * Provides a hierarchy of error types with appropriate HTTP status codes
 */

export { AppError } from './AppError';
export { ValidationError } from './ValidationError';
export { AuthenticationError } from './AuthenticationError';
export { AuthorizationError } from './AuthorizationError';
export { NotFoundError } from './NotFoundError';
export { RateLimitError } from './RateLimitError';
export { ExternalServiceError } from './ExternalServiceError';
