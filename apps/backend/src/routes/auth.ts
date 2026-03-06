import { Router, Request, Response, NextFunction } from 'express';
import { register, login } from '../services/auth/authService';
import { ValidationError } from '../errors';
import { FormattedResponse } from '../middleware/responseFormatter';
import { authenticate, AuthenticatedRequest } from '../middleware/authenticate';
import { prisma } from '../utils/db';

const router = Router();

/**
 * POST /api/auth/register
 * Register a new user account
 * 
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
 */
router.post('/register', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      throw new ValidationError('Email and password are required');
    }

    // Register user
    const result = await register(email, password);

    // Return success response with 201 Created
    (res as FormattedResponse).success(result, 201);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 * 
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      throw new ValidationError('Email and password are required');
    }

    // Authenticate user
    const result = await login(email, password);

    // Return success response
    (res as FormattedResponse).success(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user profile
 * 
 * Requires authentication
 */
router.get('/me', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      throw new ValidationError('User ID not found');
    }

    // Fetch user from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new ValidationError('User not found');
    }

    // Return user profile
    (res as FormattedResponse).success({
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
