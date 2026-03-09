import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { PrismaClient } from '@prisma/client';
import * as competitorService from '../../src/services/competitor/competitorService';

const prisma = new PrismaClient();

/**
 * Custom arbitraries for competitor testing
 */
const validDomainArbitrary = fc.oneof(
  fc.domain(),
  fc.tuple(fc.domain(), fc.domain()).map(([sub, domain]) => `${sub}.${domain}`)
);

const keywordArrayArbitrary = fc.array(
  fc.string({ minLength: 3, maxLength: 50 }).map(s => s.toLowerCase()),
  { minLength: 1, maxLength: 20 }
);

/**
 * Feature: seo-saas-platform, Competitor Operations Properties
 */
describe('Feature: seo-saas-platform, Competitor Operations Properties', () => {
  let testUsers: string[] = [];
  let testProjects: string[] = [];
  let testCompetitors: string[] = [];

  beforeEach(async () => {
    testUsers = [];
    testProjects = [];
    testCompetitors = [];
  });

  afterEach(async () => {
    // Clean up test data
    if (testCompetitors.length > 0) {
      await prisma.competitorKeyword.deleteMany({
        where: { competitorId: { in: testCompetitors } },
      });
      await prisma.competitor.deleteMany({
        where: { id: { in: testCompetitors } },
      });
    }
    if (testProjects.length > 0) {
      await prisma.keyword.deleteMany({
        where: { projectId: { in: testProjects } },
      });
      await prisma.project.deleteMany({
        where: { id: { in: testProjects } },
      });
    }
    if (testUsers.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: testUsers } },
      });
    }
  });

  /**
   * Helper function to create test user and project
   */
  async function createTestUserAndProject(domain: string) {
    const user = await prisma.user.create({
      data: {
        email: `test-${Date.now()}-${Math.random()}@example.com`,
        password: 'hashedpassword',
        role: 'Free',
      },
    });
    testUsers.push(user.id);

    const project = await prisma.project.create({
      data: {
        userId: user.id,
        domain,
        name: domain,
      },
    });
    testProjects.push(project.id);

    return { user, project };
  }

  /**
   * Helper function to create competitor with keywords directly in database
   */
  async function createCompetitorWithKeywords(
    projectId: string,
    domain: string,
    keywords: string[]
  ) {
    const competitor = await prisma.competitor.create({
      data: {
        projectId,
        domain,
        lastAnalyzed: new Date(),
      },
    });
    testCompetitors.push(competitor.id);

    // Remove duplicates from keywords array
    const uniqueKeywords = Array.from(new Set(keywords));

    if (uniqueKeywords.length > 0) {
      await prisma.competitorKeyword.createMany({
        data: uniqueKeywords.map(keyword => ({
          competitorId: competitor.id,
          keyword,
        })),
      });
    }

    return competitor;
  }

  /**
   * Helper function to create project keywords
   */
  async function createProjectKeywords(projectId: string, keywords: string[]) {
    if (keywords.length > 0) {
      await prisma.keyword.createMany({
        data: keywords.map(keyword => ({
          projectId,
          keyword,
          searchVolume: 1000,
          difficulty: 50,
          cpc: 1.5,
        })),
      });
    }
  }

  /**
   * **Validates: Requirements 8.2, 8.3**
   * 
   * Property 32: Competitor Keyword Extraction
   * For any competitor domain analysis, the Platform should extract keywords from 
   * the competitor's pages and store the association between competitor ID and keywords.
   * 
   * Note: This test uses mock data instead of actual scraping to avoid external dependencies
   */
  describe('Property 32: Competitor Keyword Extraction', () => {
    it('should store competitor-keyword associations correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDomainArbitrary,
          validDomainArbitrary,
          keywordArrayArbitrary,
          async (projectDomain, competitorDomain, keywords) => {
            fc.pre(projectDomain !== competitorDomain); // Ensure different domains

            const { project } = await createTestUserAndProject(projectDomain);

            // Create competitor with keywords directly (simulating extraction)
            const competitor = await createCompetitorWithKeywords(
              project.id,
              competitorDomain,
              keywords
            );

            // Retrieve competitor keywords
            const storedKeywords = await competitorService.getCompetitorKeywords(competitor.id);

            // Verify all keywords are stored
            expect(storedKeywords).toHaveLength(keywords.length);

            // Verify each keyword is present
            for (const keyword of keywords) {
              expect(storedKeywords).toContain(keyword);
            }

            // Verify competitor is associated with project
            const { competitors } = await competitorService.findByProject(project.id);
            const foundCompetitor = competitors.find(c => c.domain === competitorDomain);
            expect(foundCompetitor).toBeDefined();
            expect(foundCompetitor!.keywordCount).toBe(keywords.length);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should handle empty keyword extraction', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDomainArbitrary,
          validDomainArbitrary,
          async (projectDomain, competitorDomain) => {
            fc.pre(projectDomain !== competitorDomain);

            const { project } = await createTestUserAndProject(projectDomain);

            // Create competitor with no keywords
            const competitor = await createCompetitorWithKeywords(
              project.id,
              competitorDomain,
              []
            );

            // Retrieve competitor keywords
            const storedKeywords = await competitorService.getCompetitorKeywords(competitor.id);

            // Verify no keywords stored
            expect(storedKeywords).toHaveLength(0);

            // Verify competitor still exists
            const { competitors } = await competitorService.findByProject(project.id);
            const foundCompetitor = competitors.find(c => c.domain === competitorDomain);
            expect(foundCompetitor).toBeDefined();
            expect(foundCompetitor!.keywordCount).toBe(0);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  /**
   * **Validates: Requirements 8.4, 8.5**
   * 
   * Property 33: Keyword Overlap Calculation
   * For any project with keywords K1 and competitor with keywords K2, the overlap 
   * calculation should correctly identify: shared keywords (K1 ∩ K2), competitor-only 
   * keywords (K2 - K1), and user-only keywords (K1 - K2).
   */
  describe('Property 33: Keyword Overlap Calculation', () => {
    it('should correctly calculate keyword overlap', async () => {
      await fc.assert(
        fc.asyncProperty(
          keywordArrayArbitrary,
          keywordArrayArbitrary,
          async (userKeywords, competitorKeywords) => {
            // Calculate expected overlap using sets
            const userSet = new Set(userKeywords.map(k => k.toLowerCase()));
            const competitorSet = new Set(competitorKeywords.map(k => k.toLowerCase()));

            const expectedShared = Array.from(userSet).filter(k => competitorSet.has(k));
            const expectedCompetitorOnly = Array.from(competitorSet).filter(k => !userSet.has(k));
            const expectedUserOnly = Array.from(userSet).filter(k => !competitorSet.has(k));

            // Calculate overlap using service
            const overlap = competitorService.calculateOverlap(userKeywords, competitorKeywords);

            // Verify shared keywords (intersection)
            expect(overlap.shared.sort()).toEqual(expectedShared.sort());

            // Verify competitor-only keywords (difference)
            expect(overlap.competitorOnly.sort()).toEqual(expectedCompetitorOnly.sort());

            // Verify user-only keywords (difference)
            expect(overlap.userOnly.sort()).toEqual(expectedUserOnly.sort());

            // Verify no overlap between sets
            const sharedSet = new Set(overlap.shared);
            const competitorOnlySet = new Set(overlap.competitorOnly);
            const userOnlySet = new Set(overlap.userOnly);

            // Shared and competitor-only should not overlap
            for (const keyword of overlap.shared) {
              expect(competitorOnlySet.has(keyword)).toBe(false);
            }

            // Shared and user-only should not overlap
            for (const keyword of overlap.shared) {
              expect(userOnlySet.has(keyword)).toBe(false);
            }

            // Competitor-only and user-only should not overlap
            for (const keyword of overlap.competitorOnly) {
              expect(userOnlySet.has(keyword)).toBe(false);
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should handle complete overlap (all keywords shared)', async () => {
      await fc.assert(
        fc.asyncProperty(
          keywordArrayArbitrary,
          async (keywords) => {
            // Both user and competitor have same keywords
            const overlap = competitorService.calculateOverlap(keywords, keywords);

            // All keywords should be shared
            expect(overlap.shared.sort()).toEqual(
              Array.from(new Set(keywords.map(k => k.toLowerCase()))).sort()
            );

            // No competitor-only or user-only keywords
            expect(overlap.competitorOnly).toHaveLength(0);
            expect(overlap.userOnly).toHaveLength(0);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should handle no overlap (completely different keywords)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 3, maxLength: 20 }).map(s => `user-${s}`), {
            minLength: 1,
            maxLength: 10,
          }),
          fc.array(fc.string({ minLength: 3, maxLength: 20 }).map(s => `comp-${s}`), {
            minLength: 1,
            maxLength: 10,
          }),
          async (userKeywords, competitorKeywords) => {
            const overlap = competitorService.calculateOverlap(userKeywords, competitorKeywords);

            // No shared keywords
            expect(overlap.shared).toHaveLength(0);

            // All user keywords are user-only
            expect(overlap.userOnly.sort()).toEqual(
              Array.from(new Set(userKeywords.map(k => k.toLowerCase()))).sort()
            );

            // All competitor keywords are competitor-only
            expect(overlap.competitorOnly.sort()).toEqual(
              Array.from(new Set(competitorKeywords.map(k => k.toLowerCase()))).sort()
            );
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should be case-insensitive', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 3, maxLength: 20 }), { minLength: 1, maxLength: 10 }),
          async (keywords) => {
            // Create mixed case versions
            const userKeywords = keywords.map(k => k.toLowerCase());
            const competitorKeywords = keywords.map(k => k.toUpperCase());

            const overlap = competitorService.calculateOverlap(userKeywords, competitorKeywords);

            // All keywords should be shared (case-insensitive)
            expect(overlap.shared.length).toBeGreaterThan(0);
            expect(overlap.competitorOnly).toHaveLength(0);
            expect(overlap.userOnly).toHaveLength(0);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  /**
   * **Validates: Requirements 8.6, 8.7**
   * 
   * Property 34: Competitor Data Round-Trip
   * For any competitor analysis, after storing the competitor domain and lastAnalyzed 
   * timestamp, querying competitors for that project should return the stored data.
   */
  describe('Property 34: Competitor Data Round-Trip', () => {
    it('should store and retrieve competitor data correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDomainArbitrary,
          validDomainArbitrary,
          keywordArrayArbitrary,
          async (projectDomain, competitorDomain, keywords) => {
            fc.pre(projectDomain !== competitorDomain);

            const { project } = await createTestUserAndProject(projectDomain);

            const beforeStore = new Date();

            // Create competitor
            const competitor = await createCompetitorWithKeywords(
              project.id,
              competitorDomain,
              keywords
            );

            const afterStore = new Date();

            // Retrieve competitors for project
            const { competitors } = await competitorService.findByProject(project.id);

            // Find the stored competitor
            const retrieved = competitors.find(c => c.domain === competitorDomain);

            // Verify competitor data
            expect(retrieved).toBeDefined();
            expect(retrieved!.domain).toBe(competitorDomain);
            expect(retrieved!.projectId).toBe(project.id);
            expect(retrieved!.keywordCount).toBe(keywords.length);

            // Verify lastAnalyzed timestamp is within time window
            expect(retrieved!.lastAnalyzed).toBeDefined();
            expect(retrieved!.lastAnalyzed).toBeInstanceOf(Date);
            expect(retrieved!.lastAnalyzed.getTime()).toBeGreaterThanOrEqual(
              beforeStore.getTime() - 1000
            );
            expect(retrieved!.lastAnalyzed.getTime()).toBeLessThanOrEqual(
              afterStore.getTime() + 1000
            );

            // Verify competitor ID matches
            expect(retrieved!.id).toBe(competitor.id);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should return all competitors for a project', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDomainArbitrary,
          fc.array(validDomainArbitrary, { minLength: 1, maxLength: 5 }),
          async (projectDomain, competitorDomains) => {
            // Ensure unique competitor domains
            const uniqueCompetitorDomains = Array.from(new Set(competitorDomains)).filter(
              d => d !== projectDomain
            );
            fc.pre(uniqueCompetitorDomains.length > 0);

            const { project } = await createTestUserAndProject(projectDomain);

            // Create multiple competitors
            for (const competitorDomain of uniqueCompetitorDomains) {
              await createCompetitorWithKeywords(project.id, competitorDomain, ['keyword1', 'keyword2']);
            }

            // Retrieve all competitors
            const { competitors } = await competitorService.findByProject(project.id);

            // Verify all competitors are returned
            expect(competitors).toHaveLength(uniqueCompetitorDomains.length);

            // Verify each competitor domain is present
            const retrievedDomains = competitors.map(c => c.domain).sort();
            expect(retrievedDomains).toEqual(uniqueCompetitorDomains.sort());

            // Verify all have correct project ID
            for (const competitor of competitors) {
              expect(competitor.projectId).toBe(project.id);
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should update lastAnalyzed on re-analysis', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDomainArbitrary,
          validDomainArbitrary,
          async (projectDomain, competitorDomain) => {
            fc.pre(projectDomain !== competitorDomain);

            const { project } = await createTestUserAndProject(projectDomain);

            // Create competitor first time
            const first = await createCompetitorWithKeywords(
              project.id,
              competitorDomain,
              ['keyword1']
            );

            // Wait a bit to ensure timestamp difference
            await new Promise(resolve => setTimeout(resolve, 50));

            const beforeUpdate = new Date();

            // Update competitor (simulate re-analysis)
            const updated = await prisma.competitor.update({
              where: { id: first.id },
              data: { lastAnalyzed: new Date() },
            });

            const afterUpdate = new Date();

            // Verify lastAnalyzed was updated (with more lenient timing)
            expect(updated.lastAnalyzed.getTime()).toBeGreaterThan(first.lastAnalyzed.getTime());
            expect(updated.lastAnalyzed.getTime()).toBeGreaterThanOrEqual(
              beforeUpdate.getTime() - 2000
            );
            expect(updated.lastAnalyzed.getTime()).toBeLessThanOrEqual(
              afterUpdate.getTime() + 2000
            );

            // Verify same competitor ID
            expect(updated.id).toBe(first.id);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should return empty array for project with no competitors', async () => {
      await fc.assert(
        fc.asyncProperty(validDomainArbitrary, async (projectDomain) => {
          const { project } = await createTestUserAndProject(projectDomain);

          // Retrieve competitors (should be empty)
          const { competitors } = await competitorService.findByProject(project.id);

          expect(competitors).toHaveLength(0);
        }),
        { numRuns: 10 }
      );
    });
  });
});
