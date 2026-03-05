import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './authenticate';
import { AuthorizationError } from '../errors';

/**
 * User role hierarchy
 * Free < Pro < Admin
 */
type UserRole = 'Free' | 'Pro' | 'Admin';

const ROLE_HIERARCHY: Record<UserRole, number> = {
  Free: 1,
  Pro: 2,
  Admin: 3,
};

/**
 * Role-Based Authorization Middleware Factory
 * 
 * Creates middleware that checks if user has sufficient role permissions.
 * Returns 403 for insufficient permissions.
 * Supports Free, Pro, Admin role hierarchy.
 * 
 * @param requiredRole - Minimum role required to access the endpoint
 * @returns Express middleware function
 * 
 * Validates: Requirements 3.3, 3.4, 3.5, 3.6
 */
export function requireRole(requiredRole: UserRole) {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    try {
      // Ensure user is authenticated
      if (!req.user) {
        throw new AuthorizationError('User not authenticated');
      }

      const userRole = req.user.role;
      const userRoleLevel = ROLE_HIERARCHY[userRole];
      const requiredRoleLevel = ROLE_HIERARCHY[requiredRole];

      // Check if user's role meets or exceeds required role
      if (userRoleLevel < requiredRoleLevel) {
        throw new AuthorizationError(
          `Insufficient permissions. Required role: ${requiredRole}, current role: ${userRole}`
        );
      }

      next();
    } catch (error) {
      if (error instanceof AuthorizationError) {
        next(error);
      } else {
        next(new AuthorizationError('Authorization failed'));
      }
    }
  };
}

/**
 * Convenience middleware for Pro role requirement
 */
export const requirePro = requireRole('Pro');

/**
 * Convenience middleware for Admin role requirement
 */
export const requireAdmin = requireRole('Admin');
