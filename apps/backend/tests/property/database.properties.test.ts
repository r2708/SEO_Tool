import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import fc from 'fast-check';
import { getPrismaClient, cleanupDatabase, disconnectDatabase } from '../helpers/test-db';
import { Prisma } from '@prisma/client';

const prisma = getPrismaClient();

describe('Database Constraints Property Tests', () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  afterAll(async () => {
    await cleanupDatabase();
    await disconnectDatabase();
  });

  describe('Feature: seo-saas-platform, Property 56: Foreign Key Constraint Enforcement', () => {
    it('should reject operations with non-existent foreign key references', async () => {
      // **Validates: Requirements 17.3**
      
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (nonExistentUserId, domain) => {
            // Attempt to create a project with non-existent userId
            await expect(
              prisma.project.create({
                data: {
                  domain,
                  name: 'Test Project',
                  userId: nonExistentUserId,
                },
              })
            ).rejects.toThrow();
          }
        ),
        { numRuns: 50 }
      );

      // Test with Project -> Keyword relationship
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 200 }),
          async (nonExistentProjectId, keyword) => {
            // Attempt to create a keyword with non-existent projectId
            await expect(
              prisma.keyword.create({
                data: {
                  projectId: nonExistentProjectId,
                  keyword,
                  searchVolume: 1000,
                  difficulty: 50,
                  cpc: 1.5,
                },
              })
            ).rejects.toThrow();
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Feature: seo-saas-platform, Property 57: Cascade Delete Behavior', () => {
    it('should cascade delete all related records when parent is deleted', async () => {
      // **Validates: Requirements 17.5**
      
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.string({ minLength: 8, maxLength: 50 }),
          fc.domain(),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (email, password, domain, projectName) => {
            // Create user
            const user = await prisma.user.create({
              data: {
                email,
                password,
                role: 'Free',
              },
            });

            // Create project
            const project = await prisma.project.create({
              data: {
                domain,
                name: projectName,
                userId: user.id,
              },
            });

            // Create related records
            const keyword = await prisma.keyword.create({
              data: {
                projectId: project.id,
                keyword: 'test keyword',
                searchVolume: 1000,
                difficulty: 50,
                cpc: 1.5,
              },
            });

            const ranking = await prisma.ranking.create({
              data: {
                projectId: project.id,
                keyword: 'test keyword',
                position: 5,
                date: new Date(),
              },
            });

            const competitor = await prisma.competitor.create({
              data: {
                projectId: project.id,
                domain: 'competitor.com',
              },
            });

            const competitorKeyword = await prisma.competitorKeyword.create({
              data: {
                competitorId: competitor.id,
                keyword: 'competitor keyword',
              },
            });

            const seoScore = await prisma.sEOScore.create({
              data: {
                projectId: project.id,
                url: `https://${domain}`,
                score: 85,
                analysis: { title: 'Good' },
              },
            });

            // Delete user - should cascade to all related records
            await prisma.user.delete({
              where: { id: user.id },
            });

            // Verify all related records are deleted
            const projectExists = await prisma.project.findUnique({
              where: { id: project.id },
            });
            expect(projectExists).toBeNull();

            const keywordExists = await prisma.keyword.findUnique({
              where: { id: keyword.id },
            });
            expect(keywordExists).toBeNull();

            const rankingExists = await prisma.ranking.findUnique({
              where: { id: ranking.id },
            });
            expect(rankingExists).toBeNull();

            const competitorExists = await prisma.competitor.findUnique({
              where: { id: competitor.id },
            });
            expect(competitorExists).toBeNull();

            const competitorKeywordExists = await prisma.competitorKeyword.findUnique({
              where: { id: competitorKeyword.id },
            });
            expect(competitorKeywordExists).toBeNull();

            const seoScoreExists = await prisma.sEOScore.findUnique({
              where: { id: seoScore.id },
            });
            expect(seoScoreExists).toBeNull();
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should cascade delete project-related records when project is deleted', async () => {
      // **Validates: Requirements 17.5**
      
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.string({ minLength: 8, maxLength: 50 }),
          fc.domain(),
          async (email, password, domain) => {
            // Create user
            const user = await prisma.user.create({
              data: {
                email,
                password,
                role: 'Free',
              },
            });

            // Create project
            const project = await prisma.project.create({
              data: {
                domain,
                name: 'Test Project',
                userId: user.id,
              },
            });

            // Create related records
            const keyword = await prisma.keyword.create({
              data: {
                projectId: project.id,
                keyword: 'test keyword',
                searchVolume: 1000,
                difficulty: 50,
                cpc: 1.5,
              },
            });

            const ranking = await prisma.ranking.create({
              data: {
                projectId: project.id,
                keyword: 'test keyword',
                position: 5,
                date: new Date(),
              },
            });

            // Delete project - should cascade to keywords and rankings
            await prisma.project.delete({
              where: { id: project.id },
            });

            // Verify related records are deleted
            const keywordExists = await prisma.keyword.findUnique({
              where: { id: keyword.id },
            });
            expect(keywordExists).toBeNull();

            const rankingExists = await prisma.ranking.findUnique({
              where: { id: ranking.id },
            });
            expect(rankingExists).toBeNull();

            // Cleanup
            await prisma.user.delete({ where: { id: user.id } });
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Feature: seo-saas-platform, Property 59: Unique Constraint Enforcement', () => {
    it('should enforce unique email constraint on users', async () => {
      // **Validates: Requirements 17.7**
      
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.string({ minLength: 8, maxLength: 50 }),
          fc.string({ minLength: 8, maxLength: 50 }),
          async (email, password1, password2) => {
            // Create first user
            const user1 = await prisma.user.create({
              data: {
                email,
                password: password1,
                role: 'Free',
              },
            });

            // Attempt to create second user with same email
            await expect(
              prisma.user.create({
                data: {
                  email,
                  password: password2,
                  role: 'Pro',
                },
              })
            ).rejects.toThrow();

            // Cleanup
            await prisma.user.delete({ where: { id: user1.id } });
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should enforce unique projectId+keyword constraint', async () => {
      // **Validates: Requirements 17.7**
      
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.string({ minLength: 8, maxLength: 50 }),
          fc.domain(),
          fc.string({ minLength: 1, maxLength: 200 }),
          async (email, password, domain, keyword) => {
            // Create user and project
            const user = await prisma.user.create({
              data: {
                email,
                password,
                role: 'Free',
              },
            });

            const project = await prisma.project.create({
              data: {
                domain,
                name: 'Test Project',
                userId: user.id,
              },
            });

            // Create first keyword
            const keyword1 = await prisma.keyword.create({
              data: {
                projectId: project.id,
                keyword,
                searchVolume: 1000,
                difficulty: 50,
                cpc: 1.5,
              },
            });

            // Attempt to create duplicate keyword for same project
            await expect(
              prisma.keyword.create({
                data: {
                  projectId: project.id,
                  keyword,
                  searchVolume: 2000,
                  difficulty: 60,
                  cpc: 2.0,
                },
              })
            ).rejects.toThrow();

            // Cleanup
            await prisma.user.delete({ where: { id: user.id } });
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should enforce unique projectId+keyword+date constraint on rankings', async () => {
      // **Validates: Requirements 17.7**
      
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.string({ minLength: 8, maxLength: 50 }),
          fc.domain(),
          fc.string({ minLength: 1, maxLength: 200 }),
          fc.date({ min: new Date('2000-01-01'), max: new Date('2030-12-31') }),
          async (email, password, domain, keyword, date) => {
            try {
              // Create user and project
              const user = await prisma.user.create({
                data: {
                  email,
                  password,
                  role: 'Free',
                },
              });

              const project = await prisma.project.create({
                data: {
                  domain,
                  name: 'Test Project',
                  userId: user.id,
                },
              });

              // Create first ranking
              const ranking1 = await prisma.ranking.create({
                data: {
                  projectId: project.id,
                  keyword,
                  position: 5,
                  date,
                },
              });

              // Attempt to create duplicate ranking for same project, keyword, and date
              await expect(
                prisma.ranking.create({
                  data: {
                    projectId: project.id,
                    keyword,
                    position: 10,
                    date,
                  },
                })
              ).rejects.toThrow();

              // Cleanup
              await prisma.user.delete({ where: { id: user.id } });
            } catch (error) {
              // Cleanup on error
              await cleanupDatabase();
              throw error;
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should enforce unique projectId+domain constraint on competitors', async () => {
      // **Validates: Requirements 17.7**
      
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.string({ minLength: 8, maxLength: 50 }),
          fc.domain(),
          fc.domain(),
          async (email, password, projectDomain, competitorDomain) => {
            // Create user and project
            const user = await prisma.user.create({
              data: {
                email,
                password,
                role: 'Free',
              },
            });

            const project = await prisma.project.create({
              data: {
                domain: projectDomain,
                name: 'Test Project',
                userId: user.id,
              },
            });

            // Create first competitor
            const competitor1 = await prisma.competitor.create({
              data: {
                projectId: project.id,
                domain: competitorDomain,
              },
            });

            // Attempt to create duplicate competitor for same project
            await expect(
              prisma.competitor.create({
                data: {
                  projectId: project.id,
                  domain: competitorDomain,
                },
              })
            ).rejects.toThrow();

            // Cleanup
            await prisma.user.delete({ where: { id: user.id } });
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should enforce unique competitorId+keyword constraint', async () => {
      // **Validates: Requirements 17.7**
      
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.string({ minLength: 8, maxLength: 50 }),
          fc.domain(),
          fc.domain(),
          fc.string({ minLength: 1, maxLength: 200 }),
          async (email, password, projectDomain, competitorDomain, keyword) => {
            // Create user, project, and competitor
            const user = await prisma.user.create({
              data: {
                email,
                password,
                role: 'Free',
              },
            });

            const project = await prisma.project.create({
              data: {
                domain: projectDomain,
                name: 'Test Project',
                userId: user.id,
              },
            });

            const competitor = await prisma.competitor.create({
              data: {
                projectId: project.id,
                domain: competitorDomain,
              },
            });

            // Create first competitor keyword
            const competitorKeyword1 = await prisma.competitorKeyword.create({
              data: {
                competitorId: competitor.id,
                keyword,
              },
            });

            // Attempt to create duplicate competitor keyword
            await expect(
              prisma.competitorKeyword.create({
                data: {
                  competitorId: competitor.id,
                  keyword,
                },
              })
            ).rejects.toThrow();

            // Cleanup
            await prisma.user.delete({ where: { id: user.id } });
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
