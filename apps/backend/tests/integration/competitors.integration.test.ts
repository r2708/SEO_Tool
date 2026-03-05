import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { responseFormatter } from '../../src/middleware/responseFormatter';
import { errorHandler } from '../../src/middleware/errorHandler';
import competitorRoutes from '../../src/routes/competitors';
import { generateToken } from '../../src/services/auth/jwt';

const prisma = new PrismaClient();

// Mock the scraper service to avoid actual web scraping
vi.mock('../../src/services/scraper/scraper.service', () => ({
  scrapePage: vi.fn(async (url: string) => {
    // Return mock HTML content
    return `
      <html>
        <head>
          <title>Competitor Site - SEO Marketing</title>
          <meta name="keywords" content="seo, marketing, analytics">
          <meta name="description" content="Best SEO and marketing optimization tools for content">
        </head>
        <body>
          <h1>SEO Marketing Solutions</h1>
          <h2>Analytics and Optimization</h2>
          <h3>Content Marketing</h3>
          <p>We provide the best SEO marketing analytics optimization and content solutions.</p>
        </body>
      </html>
    `;
  }),
}));

describe('Competitor API Routes Integration Tests', () => {
  let app: Express;
  let testUserId: string;
  let testToken: string;
  let testProjectId: string;
  let otherUserId: string;
  let otherProjectId: string;

  beforeAll(async () => {
    // Set up Express app with middleware
    app = express();
    app.use(express.json());
    app.use(responseFormatter as any);
    app.use('/api/competitors', competitorRoutes);
    app.use(errorHandler as any);

    // Create test users
    const testUser = await prisma.user.create({
      data: {
        email: `test-competitors-${Date.now()}@example.com`,
        password: 'hashedpassword',
        role: 'Free',
      },
    });
    testUserId = testUser.id;
    testToken = generateToken(testUserId, testUser.role);

    const otherUser = await prisma.user.create({
      data: {
        email: `other-competitors-${Date.now()}@example.com`,
        password: 'hashedpassword',
        role: 'Free',
      },
    });
    otherUserId = otherUser.id;

    // Create test projects
    const testProject = await prisma.project.create({
      data: {
        domain: 'mysite.com',
        name: 'My Site',
        userId: testUserId,
      },
    });
    testProjectId = testProject.id;

    const otherProject = await prisma.project.create({
      data: {
        domain: 'othersite.com',
        name: 'Other Site',
        userId: otherUserId,
      },
    });
    otherProjectId = otherProject.id;

    // Add some keywords to test project for overlap calculation
    await prisma.keyword.createMany({
      data: [
        {
          projectId: testProjectId,
          keyword: 'seo',
          searchVolume: 10000,
          difficulty: 50,
          cpc: 2.5,
        },
        {
          projectId: testProjectId,
          keyword: 'marketing',
          searchVolume: 8000,
          difficulty: 45,
          cpc: 3.0,
        },
        {
          projectId: testProjectId,
          keyword: 'website',
          searchVolume: 5000,
          difficulty: 40,
          cpc: 1.5,
        },
      ],
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.competitorKeyword.deleteMany({
      where: {
        competitor: {
          projectId: { in: [testProjectId, otherProjectId] },
        },
      },
    });
    await prisma.competitor.deleteMany({
      where: { projectId: { in: [testProjectId, otherProjectId] } },
    });
    await prisma.keyword.deleteMany({
      where: { projectId: { in: [testProjectId, otherProjectId] } },
    });
    await prisma.project.deleteMany({
      where: { id: { in: [testProjectId, otherProjectId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [testUserId, otherUserId] } },
    });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up competitors before each test
    await prisma.competitorKeyword.deleteMany({
      where: {
        competitor: {
          projectId: testProjectId,
        },
      },
    });
    await prisma.competitor.deleteMany({
      where: { projectId: testProjectId },
    });
  });

  describe('POST /api/competitors/analyze', () => {
    it('should analyze competitor and return overlap data', async () => {
      const response = await request(app)
        .post('/api/competitors/analyze')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          projectId: testProjectId,
          competitorDomain: 'competitor.com',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        competitor: 'competitor.com',
        keywords: expect.arrayContaining(['seo', 'marketing', 'analytics', 'optimization', 'content']),
        overlap: {
          shared: expect.arrayContaining(['seo', 'marketing']),
          competitorOnly: expect.any(Array),
          userOnly: expect.arrayContaining(['website']),
        },
        lastAnalyzed: expect.any(String),
      });

      // Verify competitor was stored in database
      const competitor = await prisma.competitor.findFirst({
        where: {
          projectId: testProjectId,
          domain: 'competitor.com',
        },
      });
      expect(competitor).toBeDefined();
    });

    it('should reject request without projectId', async () => {
      const response = await request(app)
        .post('/api/competitors/analyze')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          competitorDomain: 'competitor.com',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('projectId is required');
    });

    it('should reject request without competitorDomain', async () => {
      const response = await request(app)
        .post('/api/competitors/analyze')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          projectId: testProjectId,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('competitorDomain is required');
    });

    it('should reject empty competitorDomain', async () => {
      const response = await request(app)
        .post('/api/competitors/analyze')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          projectId: testProjectId,
          competitorDomain: '   ',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('competitorDomain cannot be empty');
    });

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .post('/api/competitors/analyze')
        .send({
          projectId: testProjectId,
          competitorDomain: 'competitor.com',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should reject request for project user does not own', async () => {
      const response = await request(app)
        .post('/api/competitors/analyze')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          projectId: otherProjectId,
          competitorDomain: 'competitor.com',
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('permission');
    });

    it('should update existing competitor on re-analysis', async () => {
      // First analysis
      const firstResponse = await request(app)
        .post('/api/competitors/analyze')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          projectId: testProjectId,
          competitorDomain: 'competitor.com',
        });

      expect(firstResponse.status).toBe(200);
      const firstAnalyzedTime = new Date(firstResponse.body.data.lastAnalyzed);

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      // Second analysis
      const secondResponse = await request(app)
        .post('/api/competitors/analyze')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          projectId: testProjectId,
          competitorDomain: 'competitor.com',
        });

      expect(secondResponse.status).toBe(200);
      const secondAnalyzedTime = new Date(secondResponse.body.data.lastAnalyzed);

      // Verify lastAnalyzed was updated
      expect(secondAnalyzedTime.getTime()).toBeGreaterThan(firstAnalyzedTime.getTime());

      // Verify only one competitor record exists
      const competitors = await prisma.competitor.findMany({
        where: {
          projectId: testProjectId,
          domain: 'competitor.com',
        },
      });
      expect(competitors).toHaveLength(1);
    });
  });

  describe('GET /api/competitors/:projectId', () => {
    beforeEach(async () => {
      // Create test competitors
      const competitor1 = await prisma.competitor.create({
        data: {
          projectId: testProjectId,
          domain: 'competitor1.com',
          lastAnalyzed: new Date(),
        },
      });

      const competitor2 = await prisma.competitor.create({
        data: {
          projectId: testProjectId,
          domain: 'competitor2.com',
          lastAnalyzed: new Date(),
        },
      });

      // Add keywords to competitors
      await prisma.competitorKeyword.createMany({
        data: [
          { competitorId: competitor1.id, keyword: 'keyword1' },
          { competitorId: competitor1.id, keyword: 'keyword2' },
          { competitorId: competitor2.id, keyword: 'keyword3' },
        ],
      });
    });

    it('should list all competitors for a project', async () => {
      const response = await request(app)
        .get(`/api/competitors/${testProjectId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.competitors).toHaveLength(2);
      
      const competitor1 = response.body.data.competitors.find(
        (c: any) => c.domain === 'competitor1.com'
      );
      const competitor2 = response.body.data.competitors.find(
        (c: any) => c.domain === 'competitor2.com'
      );

      expect(competitor1).toMatchObject({
        id: expect.any(String),
        domain: 'competitor1.com',
        keywordCount: 2,
        lastAnalyzed: expect.any(String),
      });

      expect(competitor2).toMatchObject({
        id: expect.any(String),
        domain: 'competitor2.com',
        keywordCount: 1,
        lastAnalyzed: expect.any(String),
      });
    });

    it('should return empty array when project has no competitors', async () => {
      // Clean up competitors
      await prisma.competitorKeyword.deleteMany({
        where: {
          competitor: {
            projectId: testProjectId,
          },
        },
      });
      await prisma.competitor.deleteMany({
        where: { projectId: testProjectId },
      });

      const response = await request(app)
        .get(`/api/competitors/${testProjectId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.competitors).toHaveLength(0);
    });

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .get(`/api/competitors/${testProjectId}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should reject request for project user does not own', async () => {
      const response = await request(app)
        .get(`/api/competitors/${otherProjectId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('permission');
    });

    it('should order competitors by lastAnalyzed descending', async () => {
      // Clean up existing competitors
      await prisma.competitorKeyword.deleteMany({
        where: {
          competitor: {
            projectId: testProjectId,
          },
        },
      });
      await prisma.competitor.deleteMany({
        where: { projectId: testProjectId },
      });

      // Create competitors with different timestamps
      const now = new Date();
      await prisma.competitor.create({
        data: {
          projectId: testProjectId,
          domain: 'old-competitor.com',
          lastAnalyzed: new Date(now.getTime() - 86400000), // 1 day ago
        },
      });

      await prisma.competitor.create({
        data: {
          projectId: testProjectId,
          domain: 'new-competitor.com',
          lastAnalyzed: now,
        },
      });

      const response = await request(app)
        .get(`/api/competitors/${testProjectId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.competitors).toHaveLength(2);
      
      // First competitor should be the most recently analyzed
      expect(response.body.data.competitors[0].domain).toBe('new-competitor.com');
      expect(response.body.data.competitors[1].domain).toBe('old-competitor.com');
    });
  });
});
