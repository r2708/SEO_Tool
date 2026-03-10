import { Request, Response, NextFunction } from 'express';
import { validateToken, TokenPayload } from '../services/auth/jwt';
import { AuthenticationError } from '../errors';

/**
 * Extended Request interface with user data
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: 'Free' | 'Pro' | 'Admin';
  };
}

/**
 * JWT Authentication Middleware
 * 
 * Extracts and validates JWT token from Authorization header.
 * Attaches user data (id, email, role) to request object.
 * Returns 401 for invalid/expired tokens.
 * 
 * Validates: Requirements 3.1, 3.2
 */
export function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      throw new AuthenticationError('No authorization token provided');
    }

    // Expected format: "Bearer <token>"
    const parts = authHeader.split(' ');
    
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new AuthenticationError('Invalid authorization header format');
    }

    const token = parts[1];

    // Validate token signature and expiration
    const payload: TokenPayload = validateToken(token);

    // Attach user data to request
    req.user = {
      id: payload.userId,
      email: payload.email,
      role: payload.role,
    };

    next();
  } catch (error) {
    // Handle token validation errors
    if (error instanceof Error) {
      if (error.message === 'Token expired') {
        next(new AuthenticationError('Token expired'));
        return;
      }
      if (error.message === 'Invalid token') {
        next(new AuthenticationError('Invalid token'));
        return;
      }
    }
    
    // Pass through AuthenticationError or wrap unknown errors
    if (error instanceof AuthenticationError) {
      next(error);
    } else {
      next(new AuthenticationError('Authentication failed'));
    }
  }
}
