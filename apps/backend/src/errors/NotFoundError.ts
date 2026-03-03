import { AppError } from './AppError';

/**
 * NotFoundError - HTTP 404
 * Thrown when a requested resource cannot be found
 */
export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, `${resource} not found`);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}
