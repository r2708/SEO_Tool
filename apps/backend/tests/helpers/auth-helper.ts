import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';

/**
 * Generate a test JWT token
 */
export function generateTestToken(userId: string, role: UserRole): string {
  const secret = process.env.JWT_SECRET || 'test-secret';
  
  return jwt.sign(
    {
      userId,
      role,
    },
    secret,
    {
      expiresIn: '24h',
    }
  );
}

/**
 * Create authorization header for testing
 */
export function createAuthHeader(userId: string, role: UserRole): { Authorization: string } {
  const token = generateTestToken(userId, role);
  return {
    Authorization: `Bearer ${token}`,
  };
}
