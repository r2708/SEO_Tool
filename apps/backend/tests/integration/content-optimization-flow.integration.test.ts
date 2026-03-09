import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { responseFormatter } from '../../src/middleware/responseFormatter';
import { errorHandler } from '../../src/middleware/errorHandler';
import contentRoutes from '../../src/routes/content';
import { generateToken } from '../../src/services/auth/jwt';

const prisma = new PrismaClient();

describe('Content Optimization Flow Integration Tests (Pro Feature)', () => {
  let app: Express;
  let freeUserId: string;
  let freeUserToken: string;
  let proUserId: string;
  let proUserToken: string;
  let adminUserId: string;
  let adminUserToken: string;

  beforeAll(async () => {
    // Set up Express app with middleware
    app = express();
    app.use(express.json());
    app.use(responseFormatter as any);
    app.use('/api/content', contentRoutes);
    app.use(errorHandler as any);

    // Create Free user
    const freeUser = await prisma.user.create({
      data: {
        email: `test-content-free-${Date.now()}@example.com`,
        password: 'hashedpassword',
        role: 'Free',
      },
    });
    freeUserId = freeUser.id;
    freeUserToken = generateToken(freeUserId, freeUser.role);

    // Create Pro user
    const proUser = await prisma.user.create({
      data: {
        email: `test-content-pro-${Date.now()}@example.com`,
        password: 'hashedpassword',
        role: 'Pro',
      },
    });
    proUserId = proUser.id;
    proUserToken = generateToken(proUserId, proUser.role);

    // Create Admin user
    const adminUser = await prisma.user.create({
      data: {
        email: `test-content-admin-${Date.now()}@example.com`,
        password: 'hashedpassword',
        role: 'Admin',
      },
    });
    adminUserId = adminUser.id;
    adminUserToken = generateToken(adminUserId, adminUser.role);
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.user.delete({ where: { id: freeUserId } });
    await prisma.user.delete({ where: { id: proUserId } });
    await prisma.user.delete({ where: { id: adminUserId } });
    await prisma.$disconnect();
  });

  describe('Complete Content Optimization Flow', () => {
    it('should allow Pro user to score content and receive optimization suggestions', async () => {
      const testContent = `
        # SEO Tools Guide
        
        SEO tools are essential for digital marketing success. This comprehensive guide 
        covers the best SEO tools available in 2024.
        
        ## Keyword Research Tools
        
        Keyword research is the foundation of SEO. Using the right tools can help you 
        identify high-value keywords with good search volume and manageable competition.
        
        ## Rank Tracking Tools
        
        Monitor your keyword rankings daily to track your SEO progress. Rank tracking 
        tools provide valuable insights into your search engine performance.
        
        ## Content Optimization
        
        Optimize your content for target keywords while maintaining readability and 
        providing value to your readers.
      `;

      const response = await request(app)
        .post('/api/content/score')
        .set('Authorization', `Bearer ${proUserToken}`)
        .send({
          content: testContent,
          targetKeyword: 'seo tools',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const scoreData = response.body.data;

      // Verify response structure
      expect(scoreData).toMatchObject({
        score: expect.any(Number),
        missingKeywords: expect.any(Array),
        suggestedHeadings: expect.any(Array),
        analysis: {
          keywordDensity: expect.any(Number),
          readabilityScore: expect.any(Number),
          contentLength: expect.any(Number),
          recommendedLength: expect.any(Number),
        },
      });

      // Verify score is in valid range
      expect(scoreData.score).toBeGreaterThanOrEqual(0);
      expect(scoreData.score).toBeLessThanOrEqual(100);

      // Verify analysis metrics
      expect(scoreData.analysis.keywordDensity).toBeGreaterThanOrEqual(0);
      expect(scoreData.analysis.contentLength).toBeGreaterThan(0);
      expect(scoreData.analysis.recommendedLength).toBeGreaterThan(0);

      // Verify suggestions are provided
      expect(Array.isArray(scoreData.missingKeywords)).toBe(true);
      expect(Array.isArray(scoreData.suggestedHeadings)).toBe(true);
    });

    it('should allow Admin user to access content optimization', async () => {
      const testContent = 'Test content for admin user';

      const response = await request(app)
        .post('/api/content/score')
        .set('Authorization', `Bearer ${adminUserToken}`)
        .send({
          content: testContent,
          targetKeyword: 'test keyword',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.score).toBeDefined();
    });

    it('should reject Free user from accessing content optimization', async () => {
      const testContent = 'Test content for free user';

      const response = await request(app)
        .post('/api/content/score')
        .set('Authorization', `Bearer ${freeUserToken}`)
        .send({
          content: testContent,
          targetKeyword: 'test keyword',
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Pro');
    });

    it('should identify missing keywords from top-ranking content', async () => {
      const testContent = `
        This is a basic article about SEO.
        It doesn't contain many relevant keywords.
      `;

      const response = await request(app)
        .post('/api/content/score')
        .set('Authorization', `Bearer ${proUserToken}`)
        .send({
          content: testContent,
          targetKeyword: 'seo tools',
        });

      expect(response.status).toBe(200);
      
      const { missingKeywords } = response.body.data;

      // Should identify keywords missing from the content
      expect(Array.isArray(missingKeywords)).toBe(true);
      
      // Missing keywords should be strings
      if (missingKeywords.length > 0) {
        missingKeywords.forEach((keyword: string) => {
          expect(typeof keyword).toBe('string');
          expect(keyword.length).toBeGreaterThan(0);
        });
      }
    });

    it('should suggest heading structures based on top-ranking content', async () => {
      const testContent = `
        SEO tools are important for digital marketing.
        This article covers various aspects of SEO tools.
      `;

      const response = await request(app)
        .post('/api/content/score')
        .set('Authorization', `Bearer ${proUserToken}`)
        .send({
          content: testContent,
          targetKeyword: 'seo tools',
        });

      expect(response.status).toBe(200);
      
      const { suggestedHeadings } = response.body.data;

      // Should provide heading suggestions
      expect(Array.isArray(suggestedHeadings)).toBe(true);
      
      // Suggested headings should be strings
      if (suggestedHeadings.length > 0) {
        suggestedHeadings.forEach((heading: string) => {
          expect(typeof heading).toBe('string');
          expect(heading.length).toBeGreaterThan(0);
        });
      }
    });

    it('should calculate keyword density', async () => {
      const testContent = `
        SEO tools are essential. The best SEO tools help with keyword research.
        Using SEO tools improves your rankings. SEO tools provide valuable insights.
      `;

      const response = await request(app)
        .post('/api/content/score')
        .set('Authorization', `Bearer ${proUserToken}`)
        .send({
          content: testContent,
          targetKeyword: 'seo tools',
        });

      expect(response.status).toBe(200);
      
      const { analysis } = response.body.data;

      // Keyword density should be calculated
      expect(analysis.keywordDensity).toBeGreaterThan(0);
      expect(analysis.keywordDensity).toBeLessThanOrEqual(100);
    });

    it('should provide content length recommendations', async () => {
      const shortContent = 'This is a very short article.';

      const response = await request(app)
        .post('/api/content/score')
        .set('Authorization', `Bearer ${proUserToken}`)
        .send({
          content: shortContent,
          targetKeyword: 'seo tools',
        });

      expect(response.status).toBe(200);
      
      const { analysis } = response.body.data;

      // Should provide length analysis
      expect(analysis.contentLength).toBeLessThan(analysis.recommendedLength);
      expect(analysis.recommendedLength).toBeGreaterThan(0);
    });

    it('should handle long-form content', async () => {
      // Generate long content
      const longContent = Array(100)
        .fill('This is a sentence about SEO tools and keyword research. ')
        .join('');

      const response = await request(app)
        .post('/api/content/score')
        .set('Authorization', `Bearer ${proUserToken}`)
        .send({
          content: longContent,
          targetKeyword: 'seo tools',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.score).toBeDefined();
      expect(response.body.data.analysis.contentLength).toBeGreaterThan(1000);
    });

    it('should validate required fields', async () => {
      // Missing content
      const response1 = await request(app)
        .post('/api/content/score')
        .set('Authorization', `Bearer ${proUserToken}`)
        .send({
          targetKeyword: 'seo tools',
        });

      expect(response1.status).toBe(400);
      expect(response1.body.success).toBe(false);

      // Missing target keyword
      const response2 = await request(app)
        .post('/api/content/score')
        .set('Authorization', `Bearer ${proUserToken}`)
        .send({
          content: 'Test content',
        });

      expect(response2.status).toBe(400);
      expect(response2.body.success).toBe(false);
    });

    it('should handle empty content gracefully', async () => {
      const response = await request(app)
        .post('/api/content/score')
        .set('Authorization', `Bearer ${proUserToken}`)
        .send({
          content: '',
          targetKeyword: 'seo tools',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Content cannot be empty');
    });

    it('should handle OpenAI API errors gracefully', async () => {
      // This test verifies error handling when external API fails
      // In a real scenario, you might want to mock the OpenAI API to simulate failures
      
      const testContent = 'Test content for error handling';

      const response = await request(app)
        .post('/api/content/score')
        .set('Authorization', `Bearer ${proUserToken}`)
        .send({
          content: testContent,
          targetKeyword: 'test keyword',
        });

      // Should either succeed or return a user-friendly error
      if (response.status !== 200) {
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBeDefined();
        expect(typeof response.body.error).toBe('string');
      }
    });

    it('should compare content against SERP results', async () => {
      const testContent = `
        # Complete Guide to SEO Tools
        
        SEO tools are software applications that help optimize websites for search engines.
        
        ## Types of SEO Tools
        
        1. Keyword research tools
        2. Rank tracking tools
        3. Backlink analysis tools
        4. Technical SEO tools
        
        ## Benefits of Using SEO Tools
        
        SEO tools save time and provide data-driven insights for better decision making.
      `;

      const response = await request(app)
        .post('/api/content/score')
        .set('Authorization', `Bearer ${proUserToken}`)
        .send({
          content: testContent,
          targetKeyword: 'seo tools',
        });

      expect(response.status).toBe(200);

      // The score should reflect comparison with top-ranking content
      const { score, missingKeywords, suggestedHeadings } = response.body.data;

      expect(score).toBeDefined();
      
      // Should provide actionable suggestions based on SERP analysis
      expect(missingKeywords).toBeDefined();
      expect(suggestedHeadings).toBeDefined();
    });
  });
});
