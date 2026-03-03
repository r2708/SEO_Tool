import { AppError } from './AppError';

/**
 * AuthenticationError - HTTP 401
 * Thrown when authentication fails (invalid credentials, missing token, etc.)
 */
export class AuthenticationError extends AppError {
  constructor(message: string = 'Invalid credentials') {
    super(401, message);
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}
