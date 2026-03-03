import { AppError } from './AppError';

/**
 * AuthorizationError - HTTP 403
 * Thrown when user lacks sufficient permissions for an operation
 */
export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(403, message);
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}
