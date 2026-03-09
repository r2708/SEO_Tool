import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { responseFormatter } from '../../src/middleware/responseFormatter';
import { errorHandler } from '../../src/middleware/errorHandler';
import projectRoutes from '../../src/routes/projects';
import keywordRoutes from '../../src/routes/keywords';
import { generateToken } from '../../src/services/auth/jwt';

const prisma = new PrismaClient();

describe('Project Creation and Keyword Research Flow Integration Tests', () => {
  let app: Express;
  let testUserId: string;
  let testToken: string;

  beforeAll(async () => {
    // Set up Express app with middleware
    app = express();
    app.use(express.json());
    app.use(responseFormatter as any);
    app.use('/api/projects', projectRoutes);
    app.use('/api/keywords', keywordRoutes);
    app.use(errorHandler as any);

    // Create a test user
    const testUser = await prisma.user.create({
      data: {
        email: `test-project-keyword-${Date.now()}@example.com`,
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

  describe('Complete Project and Keyword Research Flow', () => {
    it('should create project, research keywords, and retrieve them', async () => {
      // Step 1: Create a new project
      const projectResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          domain: 'example.com',
          name: 'SEO Test Project',
        });

      expect(projectResponse.status).toBe(201);
      expect(projectResponse.body.success).toBe(true);
      expect(projectResponse.body.data).toMatchObject({
        id: expect.any(String),
        domain: 'example.com',
        name: 'SEO Test Project',
        userId: testUserId,
      });

      const projectId = projectResponse.body.data.id;

      // Step 2: Research keywords for the project
      const keywordResearchResponse = await request(app)
        .post('/api/keywords/research')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          projectId,
          keywords: ['seo tools', 'keyword research', 'rank tracking'],
        });

      expect(keywordResearchResponse.status).toBe(200);
      expect(keywordResearchResponse.body.success).toBe(true);
      expect(keywordResearchResponse.body.data.keywords).toHaveLength(3);
      
      // Verify keyword data structure
      keywordResearchResponse.body.data.keywords.forEach((keyword: any) => {
        expect(keyword).toMatchObject({
          keyword: expect.any(String),
          searchVolume: expect.any(Number),
          difficulty: expect.any(Number),
          cpc: expect.any(Number),
          lastUpdated: expect.any(String),
        });
        expect(keyword.difficulty).toBeGreaterThanOrEqual(0);
        expect(keyword.difficulty).toBeLessThanOrEqual(100);
        expect(keyword.searchVolume).toBeGreaterThanOrEqual(0);
        expect(keyword.cpc).toBeGreaterThanOrEqual(0);
      });

      // Step 3: Retrieve keywords for the project
      const getKeywordsResponse = await request(app)
        .get(`/api/keywords/${projectId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(getKeywordsResponse.status).toBe(200);
      expect(getKeywordsResponse.body.success).toBe(true);
      expect(getKeywordsResponse.body.data.keywords).toHaveLength(3);

      // Verify keywords match what was researched
      const keywordTexts = getKeywordsResponse.body.data.keywords.map((k: any) => k.keyword);
      expect(keywordTexts).toContain('seo tools');
      expect(keywordTexts).toContain('keyword research');
      expect(keywordTexts).toContain('rank tracking');

      // Step 4: Verify project shows keyword count
      const projectDetailResponse = await request(app)
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(projectDetailResponse.status).toBe(200);
      expect(projectDetailResponse.body.data.keywordCount).toBe(3);
    });

    it('should update existing keywords when researching duplicates', async () => {
      // Create project
      const projectResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          domain: 'example.com',
          name: 'Test Project',
        });

      const projectId = projectResponse.body.data.id;

      // Research keywords first time
      const firstResearch = await request(app)
        .post('/api/keywords/research')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          projectId,
          keywords: ['seo tools'],
        });

      expect(firstResearch.status).toBe(200);
      const firstSearchVolume = firstResearch.body.data.keywords[0].searchVolume;

      // Research same keyword again (should update, not duplicate)
      const secondResearch = await request(app)
        .post('/api/keywords/research')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          projectId,
          keywords: ['seo tools'],
        });

      expect(secondResearch.status).toBe(200);

      // Verify only one keyword exists
      const getKeywords = await request(app)
        .get(`/api/keywords/${projectId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(getKeywords.body.data.keywords).toHaveLength(1);
      expect(getKeywords.body.data.keywords[0].keyword).toBe('seo tools');
    });

    it('should handle batch keyword research', async () => {
      // Create project
      const projectResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          domain: 'example.com',
          name: 'Batch Test',
        });

      const projectId = projectResponse.body.data.id;

      // Research multiple keywords at once
      const keywords = [
        'keyword 1',
        'keyword 2',
        'keyword 3',
        'keyword 4',
        'keyword 5',
      ];

      const researchResponse = await request(app)
        .post('/api/keywords/research')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          projectId,
          keywords,
        });

      expect(researchResponse.status).toBe(200);
      expect(researchResponse.body.data.keywords).toHaveLength(5);

      // Verify all keywords are stored
      const getKeywords = await request(app)
        .get(`/api/keywords/${projectId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(getKeywords.body.data.keywords).toHaveLength(5);
    });

    it('should reject keyword research for non-owned project', async () => {
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

      // Try to research keywords for other user's project
      const response = await request(app)
        .post('/api/keywords/research')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          projectId: otherProject.id,
          keywords: ['test keyword'],
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);

      // Clean up
      await prisma.project.delete({ where: { id: otherProject.id } });
      await prisma.user.delete({ where: { id: otherUser.id } });
    });

    it('should return empty array for project with no keywords', async () => {
      // Create project without keywords
      const projectResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          domain: 'example.com',
          name: 'Empty Project',
        });

      const projectId = projectResponse.body.data.id;

      // Get keywords
      const getKeywords = await request(app)
        .get(`/api/keywords/${projectId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(getKeywords.status).toBe(200);
      expect(getKeywords.body.data.keywords).toHaveLength(0);
    });
  });
});
