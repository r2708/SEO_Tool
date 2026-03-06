import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { app } from '../../src/index';
import { generateToken } from '../../src/services/auth/jwt';

const prisma = new PrismaClient();

/**
 * **Validates: Requirements 20.4, 20.5**
 * 
 * Property 63: Pagination Configuration
 * For any paginated list endpoint, the platform should:
 * - Use default page size of 50 when not specified
 * - Cap page size at maximum of 100
 * - Set page size to 1 when less than 1
 * - Include pagination metadata (total, page, pageSize, totalPages)
 * - Calculate totalPages as Math.ceil(total / pageSize)
 */
describe('Feature: seo-saas-platform, Pagination Properties', () => {
  let testUserId: string;
  let testToken: string;
  let testProjectId: string;

  beforeEach(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: `test-${Date.now()}@example.com`,
        password: 'hashedpassword',
        role: 'Free',
      },
    });
    testUserId = user.id;
    testToken = generateToken(user.id, user.role);

    // Create test project
    const project = await prisma.project.create({
      data: {
        domain: 'example.com',
        name: 'Test Project',
        userId: testUserId,
      },
    });
    testProjectId = project.id;
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.ranking.deleteMany({ where: { projectId: testProjectId } });

    await prisma.keyword.deleteMany({ where: { projectId: testProjectId } });
    await prisma.competitor.deleteMany({ where: { projectId: testProjectId } });
    await prisma.project.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
  });

  describe('Property 63: Pagination Configuration', () => {
    it('should use default page size of 50 when not specified', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 51, max: 150 }),
          async (itemCount: number) => {
            // Create test projects
            const projects = await Promise.all(
              Array.from({ length: itemCount }, (_, i) =>
                prisma.project.create({
                  data: {
                    domain: `example${i}.com`,
                    name: `Project ${i}`,
                    userId: testUserId,
                  },
                })
              )
            );

            // Request without page size parameter
            const response = await request(app)
              .get('/api/projects')
              .set('Authorization', `Bearer ${testToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.pagination.pageSize).toBe(50);
            expect(response.body.data.projects.length).toBeLessThanOrEqual(50);

            // Clean up
            await prisma.project.deleteMany({
              where: { id: { in: projects.map((p) => p.id) } },
            });
          }
        ),
        { numRuns: 5 }
      );
    });

    it('should cap page size at maximum of 100', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 101, max: 500 }),
          async (requestedPageSize: number) => {
            // Request with page size > 100
            const response = await request(app)
              .get(`/api/projects?pageSize=${requestedPageSize}`)
              .set('Authorization', `Bearer ${testToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.pagination.pageSize).toBe(100);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should set page size to 1 when less than 1', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: -100, max: 0 }),
          async (requestedPageSize: number) => {
            // Request with page size <= 0
            const response = await request(app)
              .get(`/api/projects?pageSize=${requestedPageSize}`)
              .set('Authorization', `Bearer ${testToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.pagination.pageSize).toBe(1);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should include pagination metadata with total, page, pageSize, totalPages', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 1, max: 5 }),
          async (pageSize: number, page: number) => {
            // Request with pagination parameters
            const response = await request(app)
              .get(`/api/projects?page=${page}&pageSize=${pageSize}`)
              .set('Authorization', `Bearer ${testToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.pagination).toHaveProperty('total');
            expect(response.body.data.pagination).toHaveProperty('page');
            expect(response.body.data.pagination).toHaveProperty('pageSize');
            expect(response.body.data.pagination).toHaveProperty('totalPages');
            expect(typeof response.body.data.pagination.total).toBe('number');
            expect(typeof response.body.data.pagination.page).toBe('number');
            expect(typeof response.body.data.pagination.pageSize).toBe('number');
            expect(typeof response.body.data.pagination.totalPages).toBe('number');
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should calculate totalPages as Math.ceil(total / pageSize)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 10, max: 100 }),
          fc.integer({ min: 1, max: 50 }),
          async (itemCount: number, pageSize: number) => {
            // Create test projects
            const projects = await Promise.all(
              Array.from({ length: itemCount }, (_, i) =>
                prisma.project.create({
                  data: {
                    domain: `example${i}-${Date.now()}.com`,
                    name: `Project ${i}`,
                    userId: testUserId,
                  },
                })
              )
            );

            // Request with specific page size
            const response = await request(app)
              .get(`/api/projects?pageSize=${pageSize}`)
              .set('Authorization', `Bearer ${testToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            const { total, pageSize: actualPageSize, totalPages } = response.body.data.pagination;
            const expectedTotalPages = Math.ceil(total / actualPageSize);
            expect(totalPages).toBe(expectedTotalPages);

            // Clean up
            await prisma.project.deleteMany({
              where: { id: { in: projects.map((p) => p.id) } },
            });
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should paginate GET /api/keywords/:projectId correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 10, max: 80 }),
          fc.integer({ min: 5, max: 30 }),
          async (keywordCount: number, pageSize: number) => {
            // Create test keywords
            const keywords = await Promise.all(
              Array.from({ length: keywordCount }, (_, i) =>
                prisma.keyword.create({
                  data: {
                    projectId: testProjectId,
                    keyword: `keyword${i}-${Date.now()}`,
                    searchVolume: 1000,
                    difficulty: 50,
                    cpc: 1.5,
                  },
                })
              )
            );

            // Request with pagination
            const response = await request(app)
              .get(`/api/keywords/${testProjectId}?pageSize=${pageSize}`)
              .set('Authorization', `Bearer ${testToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.pagination).toBeDefined();
            expect(response.body.data.pagination.total).toBe(keywordCount);
            expect(response.body.data.pagination.pageSize).toBe(pageSize);
            expect(response.body.data.keywords.length).toBeLessThanOrEqual(pageSize);

            // Clean up
            await prisma.keyword.deleteMany({
              where: { id: { in: keywords.map((k) => k.id) } },
            });
          }
        ),
        { numRuns: 5 }
      );
    });

    it('should paginate GET /api/rank/history/:projectId correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 10, max: 60 }),
          fc.integer({ min: 5, max: 25 }),
          async (rankingCount: number, pageSize: number) => {
            // Create test rankings
            const rankings = await Promise.all(
              Array.from({ length: rankingCount }, (_, i) =>
                prisma.ranking.create({
                  data: {
                    projectId: testProjectId,
                    keyword: `keyword${i % 10}`,
                    position: Math.floor(Math.random() * 100) + 1,
                    date: new Date(Date.now() - i * 86400000), // Different dates
                  },
                })
              )
            );

            // Request with pagination
            const response = await request(app)
              .get(`/api/rank/history/${testProjectId}?pageSize=${pageSize}`)
              .set('Authorization', `Bearer ${testToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.pagination).toBeDefined();
            expect(response.body.data.pagination.pageSize).toBe(pageSize);

            // Clean up
            await prisma.ranking.deleteMany({
              where: { id: { in: rankings.map((r) => r.id) } },
            });
          }
        ),
        { numRuns: 5 }
      );
    });

    it('should paginate GET /api/competitors/:projectId correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 5, max: 40 }),
          fc.integer({ min: 3, max: 20 }),
          async (competitorCount: number, pageSize: number) => {
            // Create test competitors
            const competitors = await Promise.all(
              Array.from({ length: competitorCount }, (_, i) =>
                prisma.competitor.create({
                  data: {
                    projectId: testProjectId,
                    domain: `competitor${i}-${Date.now()}.com`,
                  },
                })
              )
            );

            // Request with pagination
            const response = await request(app)
              .get(`/api/competitors/${testProjectId}?pageSize=${pageSize}`)
              .set('Authorization', `Bearer ${testToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.pagination).toBeDefined();
            expect(response.body.data.pagination.total).toBe(competitorCount);
            expect(response.body.data.pagination.pageSize).toBe(pageSize);
            expect(response.body.data.competitors.length).toBeLessThanOrEqual(pageSize);

            // Clean up
            await prisma.competitor.deleteMany({
              where: { id: { in: competitors.map((c) => c.id) } },
            });
          }
        ),
        { numRuns: 5 }
      );
    });

    it('should handle empty results with correct pagination metadata', async () => {
      // Request page beyond available data
      const response = await request(app)
        .get('/api/projects?page=999&pageSize=50')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.projects).toHaveLength(0);
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.pagination.page).toBe(999);
      expect(response.body.data.pagination.pageSize).toBe(50);
    });

    it('should handle single page results correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }),
          async (itemCount: number) => {
            // Create fewer items than page size
            const projects = await Promise.all(
              Array.from({ length: itemCount }, (_, i) =>
                prisma.project.create({
                  data: {
                    domain: `single${i}-${Date.now()}.com`,
                    name: `Single ${i}`,
                    userId: testUserId,
                  },
                })
              )
            );

            // Request with default page size (50)
            const response = await request(app)
              .get('/api/projects')
              .set('Authorization', `Bearer ${testToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.pagination.totalPages).toBe(1);

            // Clean up
            await prisma.project.deleteMany({
              where: { id: { in: projects.map((p) => p.id) } },
            });
          }
        ),
        { numRuns: 5 }
      );
    });

    it('should handle multiple pages with remainder correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 51, max: 99 }),
          async (itemCount: number) => {
            // Create items that will result in 2 pages with remainder
            const projects = await Promise.all(
              Array.from({ length: itemCount }, (_, i) =>
                prisma.project.create({
                  data: {
                    domain: `multi${i}-${Date.now()}.com`,
                    name: `Multi ${i}`,
                    userId: testUserId,
                  },
                })
              )
            );

            // Request with default page size (50)
            const response = await request(app)
              .get('/api/projects')
              .set('Authorization', `Bearer ${testToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.pagination.totalPages).toBe(2);
            expect(response.body.data.pagination.total).toBeGreaterThanOrEqual(itemCount);

            // Clean up
            await prisma.project.deleteMany({
              where: { id: { in: projects.map((p) => p.id) } },
            });
          }
        ),
        { numRuns: 3 }
      );
    });
  });
});
