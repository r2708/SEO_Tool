import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { responseFormatter } from '../../src/middleware/responseFormatter';
import { errorHandler } from '../../src/middleware/errorHandler';
import authRoutes from '../../src/routes/auth';

const prisma = new PrismaClient();

describe('User Registration and Login Flow Integration Tests', () => {
  let app: Express;
  let testEmail: string;
  const testPassword = 'testpassword123';

  beforeAll(async () => {
    // Set up Express app with middleware
    app = express();
    app.use(express.json());
    app.use(responseFormatter as any);
    app.use('/api/auth', authRoutes);
    app.use(errorHandler as any);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Generate unique email for each test
    testEmail = `test-auth-${Date.now()}@example.com`;
  });

  describe('Complete Registration and Login Flow', () => {
    it('should register a new user and then login successfully', async () => {
      // Step 1: Register new user
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: testEmail,
          password: testPassword,
        });

      expect(registerResponse.status).toBe(201);
      expect(registerResponse.body.success).toBe(true);
      expect(registerResponse.body.data).toMatchObject({
        token: expect.any(String),
        user: {
          id: expect.any(String),
          email: testEmail,
          role: 'Free',
          createdAt: expect.any(String),
        },
      });

      const userId = registerResponse.body.data.user.id;
      const registrationToken = registerResponse.body.data.token;

      // Verify token is valid JWT
      expect(registrationToken.split('.')).toHaveLength(3);

      // Step 2: Login with the same credentials
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.success).toBe(true);
      expect(loginResponse.body.data).toMatchObject({
        token: expect.any(String),
        user: {
          id: userId,
          email: testEmail,
          role: 'Free',
        },
      });

      // Verify both tokens are valid (different tokens but same user)
      expect(loginResponse.body.data.token).toBeDefined();
      expect(loginResponse.body.data.token.split('.')).toHaveLength(3);

      // Clean up
      await prisma.user.delete({ where: { id: userId } });
    });

    it('should reject duplicate email registration', async () => {
      // Register first user
      const firstResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: testEmail,
          password: testPassword,
        });

      expect(firstResponse.status).toBe(201);
      const userId = firstResponse.body.data.user.id;

      // Try to register with same email
      const duplicateResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: testEmail,
          password: 'differentpassword',
        });

      expect(duplicateResponse.status).toBe(400);
      expect(duplicateResponse.body.success).toBe(false);
      expect(duplicateResponse.body.error).toContain('already registered');

      // Clean up
      await prisma.user.delete({ where: { id: userId } });
    });

    it('should reject login with invalid credentials', async () => {
      // Register user
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: testEmail,
          password: testPassword,
        });

      const userId = registerResponse.body.data.user.id;

      // Try to login with wrong password
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: 'wrongpassword',
        });

      expect(loginResponse.status).toBe(401);
      expect(loginResponse.body.success).toBe(false);
      expect(loginResponse.body.error).toContain('Invalid credentials');

      // Clean up
      await prisma.user.delete({ where: { id: userId } });
    });

    it('should reject login with non-existent email', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: testPassword,
        });

      expect(loginResponse.status).toBe(401);
      expect(loginResponse.body.success).toBe(false);
      expect(loginResponse.body.error).toContain('Invalid credentials');
    });

    it('should reject registration with invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: testPassword,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid email format');
    });

    it('should assign Free role by default on registration', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: testEmail,
          password: testPassword,
        });

      expect(response.status).toBe(201);
      expect(response.body.data.user.role).toBe('Free');

      // Verify in database
      const user = await prisma.user.findUnique({
        where: { email: testEmail },
      });
      expect(user?.role).toBe('Free');

      // Clean up
      await prisma.user.delete({ where: { id: user!.id } });
    });
  });
});
