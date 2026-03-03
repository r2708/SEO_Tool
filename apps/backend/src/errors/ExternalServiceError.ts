import { AppError } from './AppError';

/**
 * ExternalServiceError - HTTP 502
 * Thrown when external service calls fail (OpenAI, web scraping, etc.)
 */
export class ExternalServiceError extends AppError {
  constructor(service: string, message: string) {
    super(502, `${service} service error: ${message}`);
    Object.setPrototypeOf(this, ExternalServiceError.prototype);
  }
}
