import { PrismaClient, UserRole } from '@prisma/client';
import { hashPassword, comparePassword } from './password';
import { generateToken } from './jwt';
import { ValidationError } from '../../errors/ValidationError';
import { AuthenticationError } from '../../errors/AuthenticationError';

const prisma = new PrismaClient();

export interface AuthResult {
  token: string;
  user: {
    id: string;
    email: string;
    role: UserRole;
    createdAt: Date;
  };
}

/**
 * Validate email format using RFC 5322 compliant regex
 * @param email - Email address to validate
 * @returns true if email is valid, false otherwise
 */
export function validateEmail(email: string): boolean {
  // RFC 5322 compliant email regex (simplified)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Register a new user
 * @param email - User email address
 * @param password - User password (plain text, will be hashed)
 * @returns AuthResult with JWT token and user profile
 * @throws ValidationError if email is invalid or already registered
 */
export async function register(email: string, password: string): Promise<AuthResult> {
  // Validate email format
  if (!validateEmail(email)) {
    throw new ValidationError('Invalid email format');
  }

  // Check for duplicate email
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new ValidationError('Email already registered');
  }

  // Hash password
  const hashedPassword = await hashPassword(password);

  // Create user with Free role by default
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      role: 'Free', // Default role
    },
  });

  // Generate JWT token
  const token = generateToken(user.id, user.role);

  // Return token and user profile data
  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    },
  };
}

/**
 * Authenticate a user with email and password
 * @param email - User email address
 * @param password - User password (plain text)
 * @returns AuthResult with JWT token and user profile
 * @throws AuthenticationError if credentials are invalid
 */
export async function login(email: string, password: string): Promise<AuthResult> {
  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email },
  });

  // If user not found or password doesn't match, return error
  if (!user) {
    throw new AuthenticationError('Invalid credentials');
  }

  // Compare password hash
  const isPasswordValid = await comparePassword(password, user.password);

  if (!isPasswordValid) {
    throw new AuthenticationError('Invalid credentials');
  }

  // Generate JWT token
  const token = generateToken(user.id, user.role);

  // Return token and user profile data
  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    },
  };
}
