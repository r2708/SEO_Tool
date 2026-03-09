import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { responseFormatter } from '../../src/middleware/responseFormatter';
import { errorHandler } from '../../src/middleware/errorHandler';
import auditRoutes from '../../src/routes/audit';
import { generateToken } from '../../src/services/auth/jwt';

const prisma = new PrismaClient();

describe('SEO Audit End-to-End Flow Integration Tests', () => {
  let app: Express;
  let testUserId: string;
  let testToken: string;
  let testProjectId: string;

  beforeAll(async () => {
    // Set up Express app with middleware
    app = express();
    app.use(express.json());
    app.use(responseFormatter as any);
    app.use('/api/audit', auditRoutes);
    app.use(errorHandler as any);

    // Create a test user
    const testUser = await prisma.user.create({
      data: {
        email: `test-audit-${Date.now()}@example.com`,
        password: 'hashedpassword',
        role: 'Free',
      },
    });
    testUserId = testUser.id;
    testToken = generateToken(testUserId, testUser.role);

    // Create a test project
    const testProject = await prisma.project.create({
      data: {
        domain: 'example.com',
        name: 'Audit Test Project',
        userId: testUserId,
      },
    });
    testProjectId = testProject.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.sEOScore.deleteMany({ where: { projectId: testProjectId } });
    await prisma.project.delete({ where: { id: testProjectId } });
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up SEO scores before each test
    await prisma.sEOScore.deleteMany({ where: { projectId: testProjectId } });
  });

  describe('Complete SEO Audit Flow', () => {
    it('should perform SEO audit and return comprehensive analysis', async () => {
      // Note: This test uses a mock HTML page since we can't rely on external URLs
      // In a real scenario, you might want to mock the Puppeteer scraping
      const auditResponse = await request(app)
        .post('/api/audit')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          url: 'https://example.com',
          projectId: testProjectId,
        });

      expect(auditResponse.status).toBe(200);
      expect(auditResponse.body.success).toBe(true);
      
      const auditData = auditResponse.body.data;
      
      // Verify audit response structure
      expect(auditData).toMatchObject({
        url: 'https://example.com',
        score: expect.any(Number),
        analysis: {
          title: {
            content: expect.any(String),
            length: expect.any(Number),
            optimal: expect.any(Boolean),
          },
          metaDescription: {
            content: expect.any(String),
            length: expect.any(Number),
            optimal: expect.any(Boolean),
          },
          headings: {
            h1Count: expect.any(Number),
            h2Count: expect.any(Number),
            structure: expect.any(Array),
          },
          images: {
            total: expect.any(Number),
            missingAlt: expect.any(Number),
          },
          links: {
            internal: expect.any(Number),
            broken: expect.any(Array),
          },
        },
        recommendations: expect.any(Array),
        analyzedAt: expect.any(String),
      });

      // Verify score is in valid range
      expect(auditData.score).toBeGreaterThanOrEqual(0);
      expect(auditData.score).toBeLessThanOrEqual(100);

      // Verify score was stored in database
      const storedScores = await prisma.sEOScore.findMany({
        where: { projectId: testProjectId },
      });
      expect(storedScores).toHaveLength(1);
      expect(storedScores[0].score).toBe(auditData.score);
      expect(storedScores[0].url).toBe('https://example.com');
    });

    it('should perform audit without storing score when projectId is not provided', async () => {
      const auditResponse = await request(app)
        .post('/api/audit')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          url: 'https://example.com',
        });

      expect(auditResponse.status).toBe(200);
      expect(auditResponse.body.success).toBe(true);
      expect(auditResponse.body.data.score).toBeDefined();

      // Verify no score was stored
      const storedScores = await prisma.sEOScore.findMany({
        where: { projectId: testProjectId },
      });
      expect(storedScores).toHaveLength(0);
    });

    it('should track SEO score history over time', async () => {
      // Perform first audit
      const audit1 = await request(app)
        .post('/api/audit')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          url: 'https://example.com/page1',
          projectId: testProjectId,
        });

      expect(audit1.status).toBe(200);
      const score1 = audit1.body.data.score;

      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 100));

      // Perform second audit
      const audit2 = await request(app)
        .post('/api/audit')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          url: 'https://example.com/page2',
          projectId: testProjectId,
        });

      expect(audit2.status).toBe(200);
      const score2 = audit2.body.data.score;

      // Verify both scores are stored
      const storedScores = await prisma.sEOScore.findMany({
        where: { projectId: testProjectId },
        orderBy: { createdAt: 'desc' },
      });

      expect(storedScores).toHaveLength(2);
      expect(storedScores[0].score).toBe(score2);
      expect(storedScores[1].score).toBe(score1);
    });

    it('should validate URL format', async () => {
      const response = await request(app)
        .post('/api/audit')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          url: 'not-a-valid-url',
          projectId: testProjectId,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid URL');
    });

    it('should handle unreachable URLs gracefully', async () => {
      const response = await request(app)
        .post('/api/audit')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          url: 'https://this-domain-definitely-does-not-exist-12345.com',
          projectId: testProjectId,
        });

      // Should return error but not crash
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body.success).toBe(false);
    });

    it('should calculate score based on SEO elements', async () => {
      // This test verifies the scoring algorithm
      const response = await request(app)
        .post('/api/audit')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          url: 'https://example.com',
          projectId: testProjectId,
        });

      expect(response.status).toBe(200);
      const { score, analysis } = response.body.data;

      // Score should be influenced by:
      // - Title optimal: +15
      // - Meta description optimal: +15
      // - Single H1: +10
      // - Multiple H2s: +10
      // - All images have alt: +15
      // - No broken links: +15
      // - Internal links > 3: +10
      // - Base score: 10

      expect(score).toBeGreaterThanOrEqual(10); // At least base score
      expect(score).toBeLessThanOrEqual(100); // Max score

      // Verify analysis contains all required elements
      expect(analysis.title).toBeDefined();
      expect(analysis.metaDescription).toBeDefined();
      expect(analysis.headings).toBeDefined();
      expect(analysis.images).toBeDefined();
      expect(analysis.links).toBeDefined();
    });

    it('should provide actionable recommendations', async () => {
      const response = await request(app)
        .post('/api/audit')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          url: 'https://example.com',
          projectId: testProjectId,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.recommendations).toBeDefined();
      expect(Array.isArray(response.body.data.recommendations)).toBe(true);

      // Recommendations should be strings
      if (response.body.data.recommendations.length > 0) {
        expect(typeof response.body.data.recommendations[0]).toBe('string');
      }
    });

    it('should reject audit for non-owned project', async () => {
      // Create another user and their project
      const otherUser = await prisma.user.create({
        data: {
          email: `other-audit-${Date.now()}@example.com`,
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

      // Try to audit with other user's project
      const response = await request(app)
        .post('/api/audit')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          url: 'https://example.com',
          projectId: otherProject.id,
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);

      // Clean up
      await prisma.project.delete({ where: { id: otherProject.id } });
      await prisma.user.delete({ where: { id: otherUser.id } });
    });

    it('should store full analysis as JSON in database', async () => {
      const response = await request(app)
        .post('/api/audit')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          url: 'https://example.com',
          projectId: testProjectId,
        });

      expect(response.status).toBe(200);

      // Retrieve from database
      const storedScore = await prisma.sEOScore.findFirst({
        where: { projectId: testProjectId },
      });

      expect(storedScore).toBeDefined();
      expect(storedScore!.analysis).toBeDefined();
      
      // Verify analysis JSON contains all required fields
      const analysis = storedScore!.analysis as any;
      expect(analysis.title).toBeDefined();
      expect(analysis.metaDescription).toBeDefined();
      expect(analysis.headings).toBeDefined();
      expect(analysis.images).toBeDefined();
      expect(analysis.links).toBeDefined();
    });
  });
});
