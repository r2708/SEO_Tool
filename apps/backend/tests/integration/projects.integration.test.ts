import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { responseFormatter } from '../../src/middleware/responseFormatter';
import { errorHandler } from '../../src/middleware/errorHandler';
import projectRoutes from '../../src/routes/projects';
import { generateToken } from '../../src/services/auth/jwt';

const prisma = new PrismaClient();

describe('Project API Routes Integration Tests', () => {
  let app: Express;
  let testUserId: string;
  let testToken: string;
  let testProjectId: string;

  beforeAll(async () => {
    // Set up Express app with middleware
    app = express();
    app.use(express.json());
    app.use(responseFormatter as any);
    app.use('/api/projects', projectRoutes);
    app.use(errorHandler as any);

    // Create a test user
    const testUser = await prisma.user.create({
      data: {
        email: `test-projects-${Date.now()}@example.com`,
        password: 'hashedpassword',
        role: 'Free',
      },
    });
    testUserId = testUser.id;
    testToken = generateToken(testUserId, testUser.role);
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.project.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up projects before each test
    await prisma.project.deleteMany({ where: { userId: testUserId } });
  });

  describe('POST /api/projects', () => {
    it('should create a new project with valid data', async () => {
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          domain: 'example.com',
          name: 'Test Project',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        domain: 'example.com',
        name: 'Test Project',
        userId: testUserId,
      });
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.createdAt).toBeDefined();

      testProjectId = response.body.data.id;
    });

    it('should create a project with default name when name is not provided', async () => {
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          domain: 'example.com',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('example.com');
    });

    it('should reject invalid domain format', async () => {
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          domain: 'https://example.com',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid domain format');
    });

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .post('/api/projects')
        .send({
          domain: 'example.com',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/projects', () => {
    beforeEach(async () => {
      // Create test projects
      await prisma.project.createMany({
        data: [
          { domain: 'example1.com', name: 'Project 1', userId: testUserId },
          { domain: 'example2.com', name: 'Project 2', userId: testUserId },
        ],
      });
    });

    it('should list all user projects with enriched data', async () => {
      const response = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.projects).toHaveLength(2);
      expect(response.body.data.projects[0]).toMatchObject({
        domain: expect.any(String),
        name: expect.any(String),
        keywordCount: 0,
        competitorCount: 0,
      });
    });

    it('should return empty array when user has no projects', async () => {
      await prisma.project.deleteMany({ where: { userId: testUserId } });

      const response = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.projects).toHaveLength(0);
    });
  });

  describe('GET /api/projects/:id', () => {
    beforeEach(async () => {
      const project = await prisma.project.create({
        data: {
          domain: 'example.com',
          name: 'Test Project',
          userId: testUserId,
        },
      });
      testProjectId = project.id;
    });

    it('should get project details with enriched data', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: testProjectId,
        domain: 'example.com',
        name: 'Test Project',
        keywordCount: 0,
        competitorCount: 0,
      });
    });

    it('should return 404 for non-existent project', async () => {
      const response = await request(app)
        .get('/api/projects/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should return 403 when accessing another user\'s project', async () => {
      // Create another user and their project
      const otherUser = await prisma.user.create({
        data: {
          email: `other-${Date.now()}@example.com`,
          password: 'hashedpassword',
          role: 'Free',
        },
      });
      const otherProject = await prisma.project.create({
        data: {
          domain: 'other.com',
          name: 'Other Project',
          userId: otherUser.id,
        },
      });

      const response = await request(app)
        .get(`/api/projects/${otherProject.id}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);

      // Clean up
      await prisma.project.delete({ where: { id: otherProject.id } });
      await prisma.user.delete({ where: { id: otherUser.id } });
    });
  });

  describe('PUT /api/projects/:id', () => {
    beforeEach(async () => {
      const project = await prisma.project.create({
        data: {
          domain: 'example.com',
          name: 'Test Project',
          userId: testUserId,
        },
      });
      testProjectId = project.id;
    });

    it('should update project domain and name', async () => {
      const response = await request(app)
        .put(`/api/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          domain: 'updated.com',
          name: 'Updated Project',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: testProjectId,
        domain: 'updated.com',
        name: 'Updated Project',
      });
      expect(response.body.data.updatedAt).toBeDefined();
    });

    it('should update only name', async () => {
      const response = await request(app)
        .put(`/api/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          name: 'New Name',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe('New Name');
      expect(response.body.data.domain).toBe('example.com');
    });

    it('should reject invalid domain format', async () => {
      const response = await request(app)
        .put(`/api/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          domain: 'https://invalid.com',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/projects/:id', () => {
    beforeEach(async () => {
      const project = await prisma.project.create({
        data: {
          domain: 'example.com',
          name: 'Test Project',
          userId: testUserId,
        },
      });
      testProjectId = project.id;
    });

    it('should delete project', async () => {
      const response = await request(app)
        .delete(`/api/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({});

      // Verify project is deleted
      const project = await prisma.project.findUnique({
        where: { id: testProjectId },
      });
      expect(project).toBeNull();
    });

    it('should return 404 when deleting non-existent project', async () => {
      const response = await request(app)
        .delete('/api/projects/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });
});
