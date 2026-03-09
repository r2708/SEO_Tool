import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { responseFormatter } from '../../src/middleware/responseFormatter';
import { errorHandler } from '../../src/middleware/errorHandler';
import competitorRoutes from '../../src/routes/competitors';
import { generateToken } from '../../src/services/auth/jwt';

const prisma = new PrismaClient();

describe('Competitor Analysis Flow Integration Tests', () => {
  let app: Express;
  let testUserId: string;
  let testToken: string;
  let testProjectId: string;

  beforeAll(async () => {
    // Set up Express app with middleware
    app = express();
    app.use(express.json());
    app.use(responseFormatter as any);
    app.use('/api/competitors', competitorRoutes);
    app.use(errorHandler as any);

    // Create a test user
    const testUser = await prisma.user.create({
      data: {
        email: `test-competitor-flow-${Date.now()}@example.com`,
        password: 'hashedpassword',
        role: 'Free',
      },
    });
    testUserId = testUser.id;
    testToken = generateToken(testUserId, testUser.role);

    // Create a test project with some keywords
    const testProject = await prisma.project.create({
      data: {
        domain: 'mysite.com',
        name: 'Competitor Test Project',
        userId: testUserId,
        keywords: {
          create: [
            {
              keyword: 'seo tools',
              searchVolume: 10000,
              difficulty: 45.5,
              cpc: 12.5,
            },
            {
              keyword: 'keyword research',
              searchVolume: 5000,
              difficulty: 38.2,
              cpc: 8.75,
            },
            {
              keyword: 'rank tracking',
              searchVolume: 3000,
              difficulty: 42.0,
              cpc: 10.0,
            },
          ],
        },
      },
    });
    testProjectId = testProject.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.competitorKeyword.deleteMany({
      where: {
        competitor: {
          projectId: testProjectId,
        },
      },
    });
    await prisma.competitor.deleteMany({ where: { projectId: testProjectId } });
    await prisma.keyword.deleteMany({ where: { projectId: testProjectId } });
    await prisma.project.delete({ where: { id: testProjectId } });
    await prisma.user.delete({ where: { id: testUserId } });
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
    await prisma.competitor.deleteMany({ where: { projectId: testProjectId } });
  });

  describe('Complete Competitor Analysis Flow', () => {
    it('should analyze competitor and calculate keyword overlap', async () => {
      // Step 1: Analyze competitor
      const analyzeResponse = await request(app)
        .post('/api/competitors/analyze')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          projectId: testProjectId,
          competitorDomain: 'competitor.com',
        });

      expect(analyzeResponse.status).toBe(200);
      expect(analyzeResponse.body.success).toBe(true);

      const analysisData = analyzeResponse.body.data;

      // Verify analysis response structure
      expect(analysisData).toMatchObject({
        competitor: 'competitor.com',
        keywords: expect.any(Array),
        overlap: {
          shared: expect.any(Array),
          competitorOnly: expect.any(Array),
          userOnly: expect.any(Array),
        },
        lastAnalyzed: expect.any(String),
      });

      // Verify keywords were extracted
      expect(analysisData.keywords.length).toBeGreaterThan(0);

      // Verify overlap calculation
      const { shared, competitorOnly, userOnly } = analysisData.overlap;
      
      // All arrays should be defined
      expect(Array.isArray(shared)).toBe(true);
      expect(Array.isArray(competitorOnly)).toBe(true);
      expect(Array.isArray(userOnly)).toBe(true);

      // User should have their original keywords in userOnly or shared
      const allUserKeywords = [...shared, ...userOnly];
      expect(allUserKeywords.length).toBeGreaterThan(0);

      // Step 2: Verify competitor was stored in database
      const storedCompetitor = await prisma.competitor.findFirst({
        where: {
          projectId: testProjectId,
          domain: 'competitor.com',
        },
        include: {
          competitorKeywords: true,
        },
      });

      expect(storedCompetitor).toBeDefined();
      expect(storedCompetitor!.domain).toBe('competitor.com');
      expect(storedCompetitor!.competitorKeywords.length).toBeGreaterThan(0);
    });

    it('should list all competitors for a project', async () => {
      // Analyze multiple competitors
      await request(app)
        .post('/api/competitors/analyze')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          projectId: testProjectId,
          competitorDomain: 'competitor1.com',
        });

      await request(app)
        .post('/api/competitors/analyze')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          projectId: testProjectId,
          competitorDomain: 'competitor2.com',
        });

      // Get list of competitors
      const listResponse = await request(app)
        .get(`/api/competitors/${testProjectId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.success).toBe(true);
      expect(listResponse.body.data.competitors).toHaveLength(2);

      // Verify competitor data structure
      listResponse.body.data.competitors.forEach((competitor: any) => {
        expect(competitor).toMatchObject({
          id: expect.any(String),
          domain: expect.any(String),
          keywordCount: expect.any(Number),
          lastAnalyzed: expect.any(String),
        });
      });

      // Verify domains
      const domains = listResponse.body.data.competitors.map((c: any) => c.domain);
      expect(domains).toContain('competitor1.com');
      expect(domains).toContain('competitor2.com');
    });

    it('should update competitor data when analyzing again', async () => {
      // First analysis
      const firstAnalysis = await request(app)
        .post('/api/competitors/analyze')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          projectId: testProjectId,
          competitorDomain: 'competitor.com',
        });

      expect(firstAnalysis.status).toBe(200);
      const firstTimestamp = firstAnalysis.body.data.lastAnalyzed;

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      // Second analysis (should update existing competitor)
      const secondAnalysis = await request(app)
        .post('/api/competitors/analyze')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          projectId: testProjectId,
          competitorDomain: 'competitor.com',
        });

      expect(secondAnalysis.status).toBe(200);
      const secondTimestamp = secondAnalysis.body.data.lastAnalyzed;

      // Verify timestamp was updated
      expect(new Date(secondTimestamp).getTime()).toBeGreaterThan(
        new Date(firstTimestamp).getTime()
      );

      // Verify only one competitor exists
      const competitors = await prisma.competitor.findMany({
        where: {
          projectId: testProjectId,
          domain: 'competitor.com',
        },
      });

      expect(competitors).toHaveLength(1);
    });

    it('should identify shared keywords correctly', async () => {
      // Create a competitor with some overlapping keywords
      // Note: In a real scenario, this would be extracted from the competitor's website
      // For testing, we'll verify the overlap calculation logic

      const response = await request(app)
        .post('/api/competitors/analyze')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          projectId: testProjectId,
          competitorDomain: 'competitor.com',
        });

      expect(response.status).toBe(200);

      const { shared, competitorOnly, userOnly } = response.body.data.overlap;

      // Verify no keyword appears in multiple categories
      const sharedSet = new Set(shared);
      const competitorOnlySet = new Set(competitorOnly);
      const userOnlySet = new Set(userOnly);

      // Check for no overlap between categories
      shared.forEach((keyword: string) => {
        expect(competitorOnlySet.has(keyword)).toBe(false);
        expect(userOnlySet.has(keyword)).toBe(false);
      });

      competitorOnly.forEach((keyword: string) => {
        expect(sharedSet.has(keyword)).toBe(false);
        expect(userOnlySet.has(keyword)).toBe(false);
      });

      userOnly.forEach((keyword: string) => {
        expect(sharedSet.has(keyword)).toBe(false);
        expect(competitorOnlySet.has(keyword)).toBe(false);
      });
    });

    it('should identify keyword opportunities (competitor-only keywords)', async () => {
      const response = await request(app)
        .post('/api/competitors/analyze')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          projectId: testProjectId,
          competitorDomain: 'competitor.com',
        });

      expect(response.status).toBe(200);

      const { competitorOnly } = response.body.data.overlap;

      // Competitor-only keywords represent opportunities
      expect(Array.isArray(competitorOnly)).toBe(true);
      
      // These are keywords the competitor ranks for but the user doesn't
      // This is valuable for SEO strategy
      if (competitorOnly.length > 0) {
        competitorOnly.forEach((keyword: string) => {
          expect(typeof keyword).toBe('string');
          expect(keyword.length).toBeGreaterThan(0);
        });
      }
    });

    it('should reject competitor analysis for non-owned project', async () => {
      // Create another user and their project
      const otherUser = await prisma.user.create({
        data: {
          email: `other-comp-${Date.now()}@example.com`,
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

      // Try to analyze competitor for other user's project
      const response = await request(app)
        .post('/api/competitors/analyze')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          projectId: otherProject.id,
          competitorDomain: 'competitor.com',
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);

      // Clean up
      await prisma.project.delete({ where: { id: otherProject.id } });
      await prisma.user.delete({ where: { id: otherUser.id } });
    });

    it('should return empty list for project with no competitors', async () => {
      const response = await request(app)
        .get(`/api/competitors/${testProjectId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.competitors).toHaveLength(0);
    });

    it('should validate competitor domain format', async () => {
      const response = await request(app)
        .post('/api/competitors/analyze')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          projectId: testProjectId,
          competitorDomain: 'https://invalid-format.com',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid domain format');
    });

    it('should handle unreachable competitor domains gracefully', async () => {
      const response = await request(app)
        .post('/api/competitors/analyze')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          projectId: testProjectId,
          competitorDomain: 'this-domain-does-not-exist-12345.com',
        });

      // Should return error but not crash
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body.success).toBe(false);
    });
  });
});
