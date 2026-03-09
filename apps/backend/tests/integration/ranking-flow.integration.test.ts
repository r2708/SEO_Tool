import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { responseFormatter } from '../../src/middleware/responseFormatter';
import { errorHandler } from '../../src/middleware/errorHandler';
import rankRoutes from '../../src/routes/rank';
import { generateToken } from '../../src/services/auth/jwt';

const prisma = new PrismaClient();

describe('Ranking Tracking and History Retrieval Flow Integration Tests', () => {
  let app: Express;
  let testUserId: string;
  let testToken: string;
  let testProjectId: string;

  beforeAll(async () => {
    // Set up Express app with middleware
    app = express();
    app.use(express.json());
    app.use(responseFormatter as any);
    app.use('/api/rank', rankRoutes);
    app.use(errorHandler as any);

    // Create a test user
    const testUser = await prisma.user.create({
      data: {
        email: `test-ranking-${Date.now()}@example.com`,
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
        name: 'Ranking Test Project',
        userId: testUserId,
      },
    });
    testProjectId = testProject.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.ranking.deleteMany({ where: { projectId: testProjectId } });
    await prisma.project.delete({ where: { id: testProjectId } });
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up rankings before each test
    await prisma.ranking.deleteMany({ where: { projectId: testProjectId } });
  });

  describe('Complete Ranking Tracking and History Flow', () => {
    it('should track rankings and retrieve history', async () => {
      const keyword = 'seo tools';

      // Step 1: Track ranking for day 1
      const track1Response = await request(app)
        .post('/api/rank/track')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          projectId: testProjectId,
          keyword,
          position: 15,
        });

      expect(track1Response.status).toBe(201);
      expect(track1Response.body.success).toBe(true);
      expect(track1Response.body.data).toMatchObject({
        id: expect.any(String),
        projectId: testProjectId,
        keyword,
        position: 15,
        date: expect.any(String),
      });

      // Step 2: Track ranking for day 2 (simulate improvement)
      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 100));

      const track2Response = await request(app)
        .post('/api/rank/track')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          projectId: testProjectId,
          keyword,
          position: 12,
        });

      expect(track2Response.status).toBe(201);
      expect(track2Response.body.data.position).toBe(12);

      // Step 3: Track ranking for day 3 (simulate further improvement)
      await new Promise(resolve => setTimeout(resolve, 100));

      const track3Response = await request(app)
        .post('/api/rank/track')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          projectId: testProjectId,
          keyword,
          position: 8,
        });

      expect(track3Response.status).toBe(201);
      expect(track3Response.body.data.position).toBe(8);

      // Step 4: Retrieve ranking history
      const historyResponse = await request(app)
        .get(`/api/rank/history/${testProjectId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .query({ keyword });

      expect(historyResponse.status).toBe(200);
      expect(historyResponse.body.success).toBe(true);
      expect(historyResponse.body.data.rankings).toHaveLength(1);
      
      const rankingHistory = historyResponse.body.data.rankings[0];
      expect(rankingHistory.keyword).toBe(keyword);
      expect(rankingHistory.history).toHaveLength(3);

      // Verify history is ordered by date descending (most recent first)
      expect(rankingHistory.history[0].position).toBe(8);
      expect(rankingHistory.history[1].position).toBe(12);
      expect(rankingHistory.history[2].position).toBe(15);
    });

    it('should track multiple keywords and retrieve all history', async () => {
      const keywords = ['keyword 1', 'keyword 2', 'keyword 3'];

      // Track rankings for multiple keywords
      for (let i = 0; i < keywords.length; i++) {
        await request(app)
          .post('/api/rank/track')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            projectId: testProjectId,
            keyword: keywords[i],
            position: 10 + i,
          });
      }

      // Retrieve all rankings (no keyword filter)
      const historyResponse = await request(app)
        .get(`/api/rank/history/${testProjectId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(historyResponse.status).toBe(200);
      expect(historyResponse.body.data.rankings).toHaveLength(3);

      // Verify all keywords are present
      const returnedKeywords = historyResponse.body.data.rankings.map((r: any) => r.keyword);
      expect(returnedKeywords).toContain('keyword 1');
      expect(returnedKeywords).toContain('keyword 2');
      expect(returnedKeywords).toContain('keyword 3');
    });

    it('should update ranking when tracking same keyword on same date', async () => {
      const keyword = 'test keyword';

      // Track ranking first time
      const firstTrack = await request(app)
        .post('/api/rank/track')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          projectId: testProjectId,
          keyword,
          position: 20,
        });

      expect(firstTrack.status).toBe(201);
      const firstId = firstTrack.body.data.id;

      // Track same keyword on same date (should update)
      const secondTrack = await request(app)
        .post('/api/rank/track')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          projectId: testProjectId,
          keyword,
          position: 18,
        });

      expect(secondTrack.status).toBe(201);

      // Verify only one ranking exists with updated position
      const history = await request(app)
        .get(`/api/rank/history/${testProjectId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .query({ keyword });

      expect(history.body.data.rankings[0].history).toHaveLength(1);
      expect(history.body.data.rankings[0].history[0].position).toBe(18);
    });

    it('should filter ranking history by date range', async () => {
      const keyword = 'date filter test';
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const twoDaysAgo = new Date(today);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      // Create rankings with specific dates
      await prisma.ranking.createMany({
        data: [
          {
            projectId: testProjectId,
            keyword,
            position: 10,
            date: twoDaysAgo,
          },
          {
            projectId: testProjectId,
            keyword,
            position: 8,
            date: yesterday,
          },
          {
            projectId: testProjectId,
            keyword,
            position: 5,
            date: today,
          },
        ],
      });

      // Filter to get only yesterday and today
      const startDate = yesterday.toISOString().split('T')[0];
      const endDate = today.toISOString().split('T')[0];

      const historyResponse = await request(app)
        .get(`/api/rank/history/${testProjectId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .query({ keyword, startDate, endDate });

      expect(historyResponse.status).toBe(200);
      expect(historyResponse.body.data.rankings[0].history).toHaveLength(2);
      
      // Verify only yesterday and today are returned
      const positions = historyResponse.body.data.rankings[0].history.map((h: any) => h.position);
      expect(positions).toContain(5);
      expect(positions).toContain(8);
      expect(positions).not.toContain(10);
    });

    it('should validate position is between 1 and 100', async () => {
      // Test position too low
      const lowResponse = await request(app)
        .post('/api/rank/track')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          projectId: testProjectId,
          keyword: 'test',
          position: 0,
        });

      expect(lowResponse.status).toBe(400);
      expect(lowResponse.body.success).toBe(false);

      // Test position too high
      const highResponse = await request(app)
        .post('/api/rank/track')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          projectId: testProjectId,
          keyword: 'test',
          position: 101,
        });

      expect(highResponse.status).toBe(400);
      expect(highResponse.body.success).toBe(false);
    });

    it('should reject tracking for non-owned project', async () => {
      // Create another user and their project
      const otherUser = await prisma.user.create({
        data: {
          email: `other-rank-${Date.now()}@example.com`,
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

      // Try to track ranking for other user's project
      const response = await request(app)
        .post('/api/rank/track')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          projectId: otherProject.id,
          keyword: 'test',
          position: 10,
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);

      // Clean up
      await prisma.project.delete({ where: { id: otherProject.id } });
      await prisma.user.delete({ where: { id: otherUser.id } });
    });

    it('should return empty history for project with no rankings', async () => {
      const historyResponse = await request(app)
        .get(`/api/rank/history/${testProjectId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(historyResponse.status).toBe(200);
      expect(historyResponse.body.data.rankings).toHaveLength(0);
    });
  });
});
