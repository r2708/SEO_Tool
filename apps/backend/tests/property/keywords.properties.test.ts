import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { PrismaClient } from '@prisma/client';
import * as keywordService from '../../src/services/keyword/keywordService';
import { ValidationError } from '../../src/errors/ValidationError';

const prisma = new PrismaClient();

/**
 * Custom arbitraries for keyword testing
 */
const keywordStringArbitrary = fc.string({ minLength: 1, maxLength: 200 });

const keywordDataArbitrary = fc.record({
  keyword: keywordStringArbitrary,
  searchVolume: fc.nat(),
  difficulty: fc.float({ min: 0, max: 100, noNaN: true }),
  cpc: fc.float({ min: 0, max: 1000, noNaN: true }),
});

const validDomainArbitrary = fc.oneof(
  fc.domain(),
  fc.tuple(fc.domain(), fc.domain()).map(([sub, domain]) => `${sub}.${domain}`)
);

/**
 * Feature: seo-saas-platform, Keyword Operations Properties
 */
describe('Feature: seo-saas-platform, Keyword Operations Properties', () => {
  let testUsers: string[] = [];
  let testProjects: string[] = [];

  beforeEach(async () => {
    testUsers = [];
    testProjects = [];
  });

  afterEach(async () => {
    // Clean up test data
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
   * **Validates: Requirements 5.2**
   * 
   * Property 19: Keyword Data Round-Trip
   * For any keyword research data (keyword, searchVolume, difficulty, cpc), after 
   * storing it for a project, retrieving keywords for that project should return 
   * data with all fields matching the stored values.
   */
  describe('Property 19: Keyword Data Round-Trip', () => {
    it('should store and retrieve keyword data correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDomainArbitrary,
          keywordDataArbitrary,
          async (domain, keywordData) => {
            const { project } = await createTestUserAndProject(domain);

            // Store keyword data
            const stored = await keywordService.upsert(project.id, keywordData);

            // Retrieve keywords for the project
            const { keywords } = await keywordService.findByProject(project.id);

            // Find the stored keyword
            const retrieved = keywords.find(k => k.keyword === keywordData.keyword);

            // Verify data matches
            expect(retrieved).toBeDefined();
            expect(retrieved!.keyword).toBe(keywordData.keyword);
            expect(retrieved!.searchVolume).toBe(keywordData.searchVolume);
            expect(parseFloat(retrieved!.difficulty.toString())).toBeCloseTo(keywordData.difficulty, 2);
            expect(parseFloat(retrieved!.cpc.toString())).toBeCloseTo(keywordData.cpc, 2);
            expect(retrieved!.lastUpdated).toBeDefined();
            expect(retrieved!.lastUpdated).toBeInstanceOf(Date);

            // Verify stored object matches
            expect(stored.keyword).toBe(keywordData.keyword);
            expect(stored.searchVolume).toBe(keywordData.searchVolume);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  /**
   * **Validates: Requirements 5.3**
   * 
   * Property 20: Keyword Upsert Behavior
   * For any keyword that already exists for a project (same projectId and keyword), 
   * storing new data should update the existing record rather than creating a duplicate.
   */
  describe('Property 20: Keyword Upsert Behavior', () => {
    it('should update existing keywords instead of creating duplicates', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDomainArbitrary,
          keywordStringArbitrary,
          fc.nat(),
          fc.float({ min: 0, max: 100, noNaN: true }),
          fc.float({ min: 0, max: 1000, noNaN: true }),
          fc.nat(),
          fc.float({ min: 0, max: 100, noNaN: true }),
          fc.float({ min: 0, max: 1000, noNaN: true }),
          async (domain, keyword, sv1, diff1, cpc1, sv2, diff2, cpc2) => {
            const { project } = await createTestUserAndProject(domain);

            // Store keyword first time
            const first = await keywordService.upsert(project.id, {
              keyword,
              searchVolume: sv1,
              difficulty: diff1,
              cpc: cpc1,
            });

            // Store same keyword again with different data
            const second = await keywordService.upsert(project.id, {
              keyword,
              searchVolume: sv2,
              difficulty: diff2,
              cpc: cpc2,
            });

            // Verify same ID (updated, not created)
            expect(second.id).toBe(first.id);

            // Verify data was updated
            expect(second.searchVolume).toBe(sv2);
            expect(parseFloat(second.difficulty.toString())).toBeCloseTo(diff2, 2);
            expect(parseFloat(second.cpc.toString())).toBeCloseTo(cpc2, 2);

            // Verify only one record exists
            const { keywords } = await keywordService.findByProject(project.id);
            const matchingKeywords = keywords.filter(k => k.keyword === keyword);
            expect(matchingKeywords).toHaveLength(1);

            // Verify the record has the updated data
            expect(matchingKeywords[0].searchVolume).toBe(sv2);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  /**
   * **Validates: Requirements 5.4, 5.5, 5.6**
   * 
   * Property 21: Keyword Data Type Constraints
   * For any stored keyword, searchVolume should be an integer, difficulty should 
   * be a decimal between 0 and 100, and cpc should be a non-negative decimal.
   */
  describe('Property 21: Keyword Data Type Constraints', () => {
    it('should enforce searchVolume as non-negative integer', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDomainArbitrary,
          keywordStringArbitrary,
          fc.integer({ min: -1000, max: -1 }),
          async (domain, keyword, negativeVolume) => {
            const { project } = await createTestUserAndProject(domain);

            // Negative search volume should be rejected
            await expect(
              keywordService.upsert(project.id, {
                keyword,
                searchVolume: negativeVolume,
                difficulty: 50,
                cpc: 1.5,
              })
            ).rejects.toThrow(ValidationError);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should enforce difficulty between 0 and 100', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDomainArbitrary,
          keywordStringArbitrary,
          fc.oneof(
            fc.float({ min: Math.fround(-100), max: Math.fround(-0.01), noNaN: true }),
            fc.float({ min: Math.fround(100.01), max: Math.fround(200), noNaN: true })
          ),
          async (domain, keyword, invalidDifficulty) => {
            const { project } = await createTestUserAndProject(domain);

            // Difficulty outside 0-100 range should be rejected
            await expect(
              keywordService.upsert(project.id, {
                keyword,
                searchVolume: 1000,
                difficulty: invalidDifficulty,
                cpc: 1.5,
              })
            ).rejects.toThrow(ValidationError);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should enforce cpc as non-negative decimal', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDomainArbitrary,
          keywordStringArbitrary,
          fc.float({ min: Math.fround(-1000), max: Math.fround(-0.01), noNaN: true }),
          async (domain, keyword, negativeCpc) => {
            const { project } = await createTestUserAndProject(domain);

            // Negative CPC should be rejected
            await expect(
              keywordService.upsert(project.id, {
                keyword,
                searchVolume: 1000,
                difficulty: 50,
                cpc: negativeCpc,
              })
            ).rejects.toThrow(ValidationError);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should accept valid data type constraints', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDomainArbitrary,
          keywordDataArbitrary,
          async (domain, keywordData) => {
            const { project } = await createTestUserAndProject(domain);

            // Valid data should be accepted
            const stored = await keywordService.upsert(project.id, keywordData);

            // Verify types
            expect(Number.isInteger(stored.searchVolume)).toBe(true);
            expect(stored.searchVolume).toBeGreaterThanOrEqual(0);
            
            const difficulty = parseFloat(stored.difficulty.toString());
            expect(difficulty).toBeGreaterThanOrEqual(0);
            expect(difficulty).toBeLessThanOrEqual(100);
            
            const cpc = parseFloat(stored.cpc.toString());
            expect(cpc).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  /**
   * **Validates: Requirements 5.7**
   * 
   * Property 22: Keyword Timestamp Generation
   * For any keyword data storage operation, the lastUpdated field should be set 
   * to the current timestamp.
   */
  describe('Property 22: Keyword Timestamp Generation', () => {
    it('should set lastUpdated to current timestamp on create', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDomainArbitrary,
          keywordDataArbitrary,
          async (domain, keywordData) => {
            const { project } = await createTestUserAndProject(domain);

            const beforeStore = new Date();
            
            // Store keyword
            const stored = await keywordService.upsert(project.id, keywordData);
            
            const afterStore = new Date();

            // Verify lastUpdated is within the time window
            expect(stored.lastUpdated).toBeDefined();
            expect(stored.lastUpdated).toBeInstanceOf(Date);
            expect(stored.lastUpdated.getTime()).toBeGreaterThanOrEqual(beforeStore.getTime() - 1000);
            expect(stored.lastUpdated.getTime()).toBeLessThanOrEqual(afterStore.getTime() + 1000);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should update lastUpdated timestamp on upsert', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDomainArbitrary,
          keywordStringArbitrary,
          fc.nat(),
          fc.nat(),
          async (domain, keyword, sv1, sv2) => {
            fc.pre(sv1 !== sv2); // Ensure different values

            const { project } = await createTestUserAndProject(domain);

            // Store keyword first time
            const first = await keywordService.upsert(project.id, {
              keyword,
              searchVolume: sv1,
              difficulty: 50,
              cpc: 1.5,
            });

            // Wait a bit to ensure timestamp difference
            await new Promise(resolve => setTimeout(resolve, 10));

            const beforeUpdate = new Date();

            // Update keyword
            const second = await keywordService.upsert(project.id, {
              keyword,
              searchVolume: sv2,
              difficulty: 60,
              cpc: 2.0,
            });

            const afterUpdate = new Date();

            // Verify lastUpdated was updated
            expect(second.lastUpdated.getTime()).toBeGreaterThan(first.lastUpdated.getTime());
            expect(second.lastUpdated.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime() - 1000);
            expect(second.lastUpdated.getTime()).toBeLessThanOrEqual(afterUpdate.getTime() + 1000);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  /**
   * Additional test: Batch processing for research function
   */
  describe('Batch Processing', () => {
    it('should handle batch keyword research correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDomainArbitrary,
          fc.array(keywordStringArbitrary, { minLength: 1, maxLength: 10 }),
          async (domain, keywords) => {
            const { project } = await createTestUserAndProject(domain);

            // Research multiple keywords
            const results = await keywordService.research(project.id, keywords);

            // Verify all keywords were processed
            expect(results).toHaveLength(keywords.length);

            // Verify all keywords are stored
            const { keywords: stored } = await keywordService.findByProject(project.id);
            expect(stored).toHaveLength(keywords.length);

            // Verify each keyword is present
            for (const keyword of keywords) {
              const found = stored.find(k => k.keyword === keyword);
              expect(found).toBeDefined();
              expect(found!.searchVolume).toBeGreaterThanOrEqual(0);
              expect(parseFloat(found!.difficulty.toString())).toBeGreaterThanOrEqual(0);
              expect(parseFloat(found!.difficulty.toString())).toBeLessThanOrEqual(100);
              expect(parseFloat(found!.cpc.toString())).toBeGreaterThanOrEqual(0);
            }
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});
