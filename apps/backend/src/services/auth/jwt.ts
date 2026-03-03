import jwt from 'jsonwebtoken';
import { config } from '../../config/env';

export interface TokenPayload {
  userId: string;
  role: 'Free' | 'Pro' | 'Admin';
  iat: number;
  exp: number;
}

/**
 * Generate a JWT token for a user
 * @param userId - User ID to include in token
 * @param role - User role to include in token
 * @returns Signed JWT token with 24h expiration
 */
export function generateToken(userId: string, role: 'Free' | 'Pro' | 'Admin'): string {
  const payload = {
    userId,
    role,
  };

  // Sign with HS256 algorithm, 24h expiration
  return jwt.sign(payload, config.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '24h',
  });
}

/**
 * Validate and decode a JWT token
 * @param token - JWT token to validate
 * @returns Decoded token payload
 * @throws Error if token is invalid or expired
 */
export function validateToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET, {
      algorithms: ['HS256'],
    }) as TokenPayload;

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    throw error;
  }
}
