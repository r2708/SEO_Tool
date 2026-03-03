import { AppError } from './AppError';

/**
 * ValidationError - HTTP 400
 * Thrown when request data fails validation
 */
export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}
