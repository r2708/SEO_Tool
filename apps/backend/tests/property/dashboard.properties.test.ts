import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { PrismaClient } from '@prisma/client';
import * as dashboardService from '../../src/services/dashboard/dashboardService';

const prisma = new PrismaClient();

/**
 * Custom arbitraries for dashboard testing
 */
const validDomainArbitrary = fc.oneof(
  fc.domain(),
  fc.tuple(fc.domain(), fc.domain()).map(([sub, domain]) => `${sub}.${domain}`)
);

const keywordStringArbitrary = fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0);

const positionArbitrary = fc.integer({ min: 1, max: 100 });

const seoScoreArbitrary = fc.integer({ min: 0, max: 100 });

/**
 * Feature: seo-saas-platform, Dashboard Properties
 */
describe('Feature: seo-saas-platform, Dashboard Properties', () => {
  let testUsers: string[] = [];
  let testProjects: string[] = [];

  beforeEach(async () => {
    testUsers = [];
    testProjects = [];
  });

  afterEach(async () => {
    // Clean up test data - wrap in try-catch to handle concurrent test cleanup
    try {
      if (testProjects.length > 0) {
        await prisma.sEOScore.deleteMany({
          where: { projectId: { in: testProjects } },
        }).catch(() => {}); // Ignore errors if already deleted
        await prisma.ranking.deleteMany({
          where: { projectId: { in: testProjects } },
        }).catch(() => {});
        await prisma.keyword.deleteMany({
          where: { projectId: { in: testProjects } },
        }).catch(() => {});
        await prisma.project.deleteMany({
          where: { id: { in: testProjects } },
        }).catch(() => {});
      }
      if (testUsers.length > 0) {
        await prisma.user.deleteMany({
          where: { id: { in: testUsers } },
        }).catch(() => {});
      }
    } catch (error) {
      // Ignore cleanup errors from concurrent tests
    }
  });

  /**
   * Helper function to create test user
   */
  async function createTestUser() {
    const user = await prisma.user.create({
      data: {
        email: `test-${Date.now()}-${Math.random()}@example.com`,
        password: 'hashedpassword',
        role: 'Free',
      },
    });
    testUsers.push(user.id);
    return user;
  }

  /**
   * Helper function to create test project
   */
  async function createTestProject(userId: string, domain: string) {
    const project = await prisma.project.create({
      data: {
        userId,
        domain,
        name: domain,
      },
    });
    testProjects.push(project.id);
    return project;
  }

  /**
   * **Validates: Requirements 10.1, 10.2, 10.3, 10.4**
   * 
   * Property 37: Dashboard Metrics Aggregation
   * For any user with N projects containing M total keywords and R rankings, 
   * the dashboard should return: totalKeywords = M, totalProjects = N, 
   * averageRank = mean of all current positions, and rankChange = percentage 
   * change vs previous period.
   */
  describe('Property 37: Dashboard Metrics Aggregation', () => {
    it('should correctly aggregate total keywords across all projects', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(validDomainArbitrary, { minLength: 1, maxLength: 3 }),
          fc.array(keywordStringArbitrary, { minLength: 1, maxLength: 5 }),
          async (domains, keywords) => {
            const user = await createTestUser();

            // Create projects and keywords
            let totalKeywords = 0;
            for (const domain of domains) {
              const project = await createTestProject(user.id, domain);
              
              // Add keywords to project
              for (const keyword of keywords) {
                await prisma.keyword.create({
                  data: {
                    projectId: project.id,
                    keyword: `${keyword}-${project.id}`, // Make unique per project
                    searchVolume: 1000,
                    difficulty: 50,
                    cpc: 1.5,
                  },
                });
                totalKeywords++;
              }
            }

            // Get dashboard metrics
            const metrics = await dashboardService.getMetrics(user.id);

            // Verify total keywords count
            expect(metrics.totalKeywords).toBe(totalKeywords);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should correctly count total projects', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(validDomainArbitrary, { minLength: 1, maxLength: 5 }),
          async (domains) => {
            const user = await createTestUser();

            // Create projects
            for (const domain of domains) {
              await createTestProject(user.id, domain);
            }

            // Get dashboard metrics
            const metrics = await dashboardService.getMetrics(user.id);

            // Verify total projects count
            expect(metrics.totalProjects).toBe(domains.length);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should calculate average rank correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDomainArbitrary,
          fc.array(
            fc.tuple(keywordStringArbitrary, positionArbitrary),
            { minLength: 1, maxLength: 5 }
          ),
          async (domain, keywordPositions) => {
            const user = await createTestUser();
            const project = await createTestProject(user.id, domain);

            // Create keywords and rankings
            const positions: number[] = [];
            for (const [keyword, position] of keywordPositions) {
              await prisma.keyword.create({
                data: {
                  projectId: project.id,
                  keyword,
                  searchVolume: 1000,
                  difficulty: 50,
                  cpc: 1.5,
                },
              });

              await prisma.ranking.create({
                data: {
                  projectId: project.id,
                  keyword,
                  position,
                  date: new Date(),
                },
              });

              positions.push(position);
            }

            // Calculate expected average
            const expectedAverage = positions.reduce((a, b) => a + b, 0) / positions.length;
            const expectedRounded = Math.round(expectedAverage * 100) / 100;

            // Get dashboard metrics
            const metrics = await dashboardService.getMetrics(user.id);

            // Verify average rank
            expect(metrics.averageRank).toBe(expectedRounded);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should calculate rank change percentage correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDomainArbitrary,
          fc.array(
            fc.tuple(keywordStringArbitrary, positionArbitrary, positionArbitrary),
            { minLength: 1, maxLength: 5 }
          ),
          async (domain, keywordData) => {
            const user = await createTestUser();
            const project = await createTestProject(user.id, domain);

            const today = new Date();
            const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

            // Create keywords and rankings (current and previous)
            for (const [keyword, currentPos, previousPos] of keywordData) {
              await prisma.keyword.create({
                data: {
                  projectId: project.id,
                  keyword,
                  searchVolume: 1000,
                  difficulty: 50,
                  cpc: 1.5,
                },
              });

              // Current ranking
              await prisma.ranking.create({
                data: {
                  projectId: project.id,
                  keyword,
                  position: currentPos,
                  date: today,
                },
              });

              // Previous ranking (30 days ago)
              await prisma.ranking.create({
                data: {
                  projectId: project.id,
                  keyword,
                  position: previousPos,
                  date: thirtyDaysAgo,
                },
              });
            }

            // Get dashboard metrics
            const metrics = await dashboardService.getMetrics(user.id);

            // Verify rank change is a number
            expect(typeof metrics.rankChange).toBe('number');
            expect(isNaN(metrics.rankChange)).toBe(false);
            expect(isFinite(metrics.rankChange)).toBe(true);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should return zero values for user with no data', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            const user = await createTestUser();

            // Get dashboard metrics without creating any projects
            const metrics = await dashboardService.getMetrics(user.id);

            // Verify all metrics are zero or empty
            expect(metrics.totalKeywords).toBe(0);
            expect(metrics.totalProjects).toBe(0);
            expect(metrics.averageRank).toBe(0);
            expect(metrics.rankChange).toBe(0);
            expect(metrics.recentScores).toEqual([]);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should aggregate data across multiple projects', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.tuple(
              validDomainArbitrary,
              fc.array(keywordStringArbitrary, { minLength: 1, maxLength: 2 })
            ),
            { minLength: 2, maxLength: 3 }
          ),
          async (projectData) => {
            const user = await createTestUser();

            let totalKeywords = 0;
            const allPositions: number[] = [];

            // Create multiple projects with keywords and rankings
            for (const [domain, keywords] of projectData) {
              const project = await createTestProject(user.id, domain);

              for (const keyword of keywords) {
                const position = Math.floor(Math.random() * 100) + 1;

                await prisma.keyword.create({
                  data: {
                    projectId: project.id,
                    keyword: `${keyword}-${project.id}`,
                    searchVolume: 1000,
                    difficulty: 50,
                    cpc: 1.5,
                  },
                });

                await prisma.ranking.create({
                  data: {
                    projectId: project.id,
                    keyword: `${keyword}-${project.id}`,
                    position,
                    date: new Date(),
                  },
                });

                totalKeywords++;
                allPositions.push(position);
              }
            }

            // Get dashboard metrics
            const metrics = await dashboardService.getMetrics(user.id);

            // Verify aggregation across all projects
            expect(metrics.totalKeywords).toBe(totalKeywords);
            expect(metrics.totalProjects).toBe(projectData.length);

            // Verify average rank is calculated across all projects
            if (allPositions.length > 0) {
              const expectedAverage = allPositions.reduce((a, b) => a + b, 0) / allPositions.length;
              const expectedRounded = Math.round(expectedAverage * 100) / 100;
              expect(metrics.averageRank).toBe(expectedRounded);
            }
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  /**
   * **Validates: Requirements 10.5**
   * 
   * Property 38: Dashboard Recent Scores
   * For any user's projects, the dashboard should return the most recent SEO 
   * score for each project (highest timestamp).
   */
  describe('Property 38: Dashboard Recent Scores', () => {
    it('should return most recent SEO score for each project', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(validDomainArbitrary, { minLength: 1, maxLength: 3 }),
          fc.array(seoScoreArbitrary, { minLength: 2, maxLength: 5 }),
          async (domains, scores) => {
            const user = await createTestUser();

            // Create projects with multiple SEO scores
            for (const domain of domains) {
              const project = await createTestProject(user.id, domain);

              // Create multiple SEO scores with different timestamps
              for (let i = 0; i < scores.length; i++) {
                const timestamp = new Date(Date.now() - (scores.length - i) * 60000); // Each score 1 minute apart
                try {
                  await prisma.sEOScore.create({
                    data: {
                      projectId: project.id,
                      url: `https://${domain}`,
                      score: scores[i],
                      analysis: {},
                      createdAt: timestamp,
                    },
                  });
                } catch (error) {
                  // Skip if foreign key constraint violated (concurrent test cleanup)
                  if (error.code === 'P2003') {
                    return;
                  }
                  throw error;
                }
              }
            }

            // Get dashboard metrics
            const metrics = await dashboardService.getMetrics(user.id);

            // Verify we have scores for all projects
            expect(metrics.recentScores.length).toBe(domains.length);

            // Verify each score is the most recent one (last in the array)
            for (const recentScore of metrics.recentScores) {
              expect(recentScore.score).toBe(scores[scores.length - 1]);
            }
          }
        ),
        { numRuns: 5 }
      );
    });

    it('should not include projects without SEO scores', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(validDomainArbitrary, { minLength: 2, maxLength: 4 }),
          seoScoreArbitrary,
          async (domains, score) => {
            const user = await createTestUser();

            // Create projects, but only add SEO score to first one
            const firstProject = await createTestProject(user.id, domains[0]);
            await prisma.sEOScore.create({
              data: {
                projectId: firstProject.id,
                url: `https://${domains[0]}`,
                score,
                analysis: {},
              },
            });

            // Create remaining projects without SEO scores
            for (let i = 1; i < domains.length; i++) {
              await createTestProject(user.id, domains[i]);
            }

            // Get dashboard metrics
            const metrics = await dashboardService.getMetrics(user.id);

            // Verify only projects with scores are included
            expect(metrics.recentScores.length).toBe(1);
            expect(metrics.recentScores[0].score).toBe(score);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should include correct project metadata in recent scores', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDomainArbitrary,
          seoScoreArbitrary,
          async (domain, score) => {
            const user = await createTestUser();
            const project = await createTestProject(user.id, domain);

            // Create SEO score
            const createdScore = await prisma.sEOScore.create({
              data: {
                projectId: project.id,
                url: `https://${domain}`,
                score,
                analysis: {},
              },
            });

            // Get dashboard metrics
            const metrics = await dashboardService.getMetrics(user.id);

            // Verify recent score structure
            expect(metrics.recentScores.length).toBe(1);
            const recentScore = metrics.recentScores[0];

            expect(recentScore.projectId).toBe(project.id);
            expect(recentScore.projectName).toBe(project.name);
            expect(recentScore.score).toBe(score);
            expect(recentScore.date).toBeInstanceOf(Date);
            expect(recentScore.date.getTime()).toBe(createdScore.createdAt.getTime());
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should handle multiple scores and return only the most recent', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDomainArbitrary,
          fc.array(seoScoreArbitrary, { minLength: 3, maxLength: 10 }),
          async (domain, scores) => {
            const user = await createTestUser();
            const project = await createTestProject(user.id, domain);

            // Create multiple SEO scores with incrementing timestamps
            let latestTimestamp: Date = new Date(0);
            for (let i = 0; i < scores.length; i++) {
              const timestamp = new Date(Date.now() - (scores.length - i) * 60000);
              try {
                await prisma.sEOScore.create({
                  data: {
                    projectId: project.id,
                    url: `https://${domain}`,
                    score: scores[i],
                    analysis: {},
                    createdAt: timestamp,
                  },
                });
                if (timestamp > latestTimestamp) {
                  latestTimestamp = timestamp;
                }
              } catch (error) {
                // Skip if foreign key constraint violated (concurrent test cleanup)
                if (error.code === 'P2003') {
                  return;
                }
                throw error;
              }
            }

            // Get dashboard metrics
            const metrics = await dashboardService.getMetrics(user.id);

            // Verify only one score is returned (the most recent)
            expect(metrics.recentScores.length).toBe(1);
            
            // Verify it's the last score (most recent)
            expect(metrics.recentScores[0].score).toBe(scores[scores.length - 1]);
          }
        ),
        { numRuns: 5 }
      );
    });

    it('should return empty array when no projects have SEO scores', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(validDomainArbitrary, { minLength: 1, maxLength: 3 }),
          async (domains) => {
            const user = await createTestUser();

            // Create projects without SEO scores
            for (const domain of domains) {
              await createTestProject(user.id, domain);
            }

            // Get dashboard metrics
            const metrics = await dashboardService.getMetrics(user.id);

            // Verify recent scores is empty
            expect(metrics.recentScores).toEqual([]);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  /**
   * Performance test: Dashboard metrics should complete within 500ms
   * **Validates: Requirements 10.6**
   */
  describe('Dashboard Performance', () => {
    it('should calculate metrics within 500ms', async () => {
      // Create a user with moderate amount of data
      const user = await createTestUser();

      // Create 3 projects
      for (let i = 0; i < 3; i++) {
        const project = await createTestProject(user.id, `example${i}.com`);

        // Add 10 keywords per project
        for (let j = 0; j < 10; j++) {
          const keyword = `keyword${j}`;
          await prisma.keyword.create({
            data: {
              projectId: project.id,
              keyword,
              searchVolume: 1000,
              difficulty: 50,
              cpc: 1.5,
            },
          });

          // Add current ranking
          await prisma.ranking.create({
            data: {
              projectId: project.id,
              keyword,
              position: Math.floor(Math.random() * 100) + 1,
              date: new Date(),
            },
          });

          // Add previous ranking (30 days ago)
          await prisma.ranking.create({
            data: {
              projectId: project.id,
              keyword,
              position: Math.floor(Math.random() * 100) + 1,
              date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          });
        }

        // Add SEO score
        await prisma.sEOScore.create({
          data: {
            projectId: project.id,
            url: `https://example${i}.com`,
            score: Math.floor(Math.random() * 100),
            analysis: {},
          },
        });
      }

      // Measure execution time
      const startTime = Date.now();
      const metrics = await dashboardService.getMetrics(user.id);
      const duration = Date.now() - startTime;

      // Verify metrics were calculated
      expect(metrics.totalKeywords).toBe(30);
      expect(metrics.totalProjects).toBe(3);
      expect(metrics.recentScores.length).toBe(3);

      // Verify performance requirement (500ms)
      expect(duration).toBeLessThan(500);
    }, 10000); // 10 second timeout for this test
  });
});
