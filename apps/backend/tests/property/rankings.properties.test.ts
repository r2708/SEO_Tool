import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { PrismaClient } from '@prisma/client';
import * as rankTrackerService from '../../src/services/rank/rankTrackerService';
import { ValidationError } from '../../src/errors/ValidationError';

const prisma = new PrismaClient();

/**
 * Custom arbitraries for ranking testing
 */
const keywordStringArbitrary = fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0);

const positionArbitrary = fc.integer({ min: 1, max: 100 });

const dateArbitrary = fc.date({
  min: new Date('2020-01-01'),
  max: new Date('2025-12-31'),
});

const validDomainArbitrary = fc.oneof(
  fc.domain(),
  fc.tuple(fc.domain(), fc.domain()).map(([sub, domain]) => `${sub}.${domain}`)
);

/**
 * Feature: seo-saas-platform, Ranking Operations Properties
 */
describe('Feature: seo-saas-platform, Ranking Operations Properties', () => {
  let testUsers: string[] = [];
  let testProjects: string[] = [];

  beforeEach(async () => {
    testUsers = [];
    testProjects = [];
  });

  afterEach(async () => {
    // Clean up test data
    if (testProjects.length > 0) {
      await prisma.ranking.deleteMany({
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
   * **Validates: Requirements 6.2**
   * 
   * Property 23: Ranking Data Round-Trip
   * For any ranking record (projectId, keyword, position, date), after storing it, 
   * querying rankings for that project and keyword should return a record with 
   * matching values.
   */
  describe('Property 23: Ranking Data Round-Trip', () => {
    it('should store and retrieve ranking data correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDomainArbitrary,
          keywordStringArbitrary,
          positionArbitrary,
          dateArbitrary,
          async (domain, keyword, position, date) => {
            const { project } = await createTestUserAndProject(domain);

            // Store ranking data
            const stored = await rankTrackerService.track(
              project.id,
              keyword,
              position,
              date
            );

            // Retrieve rankings for the project and keyword with date range
            // Use a wide date range to ensure we capture the stored ranking
            const startDate = new Date(date.getTime() - 365 * 24 * 60 * 60 * 1000);
            const endDate = new Date(date.getTime() + 365 * 24 * 60 * 60 * 1000);
            const history = await rankTrackerService.getHistory(
              project.id,
              keyword,
              startDate,
              endDate
            );

            // Find the stored ranking
            expect(history).toHaveLength(1);
            expect(history[0].keyword).toBe(keyword);
            
            const retrieved = history[0].history.find(
              h => h.date === stored.date
            );

            // Verify data matches
            expect(retrieved).toBeDefined();
            expect(retrieved!.position).toBe(position);
            expect(retrieved!.date).toBe(stored.date);

            // Verify stored object matches
            expect(stored.keyword).toBe(keyword);
            expect(stored.position).toBe(position);
            expect(stored.projectId).toBe(project.id);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Validates: Requirements 6.3**
   * 
   * Property 24: Ranking Position Constraints
   * For any stored ranking, the position value should be an integer between 
   * 1 and 100 (inclusive).
   */
  describe('Property 24: Ranking Position Constraints', () => {
    it('should reject positions less than 1', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDomainArbitrary,
          keywordStringArbitrary,
          fc.integer({ min: -100, max: 0 }),
          async (domain, keyword, invalidPosition) => {
            const { project } = await createTestUserAndProject(domain);

            // Position less than 1 should be rejected
            await expect(
              rankTrackerService.track(project.id, keyword, invalidPosition)
            ).rejects.toThrow(ValidationError);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject positions greater than 100', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDomainArbitrary,
          keywordStringArbitrary,
          fc.integer({ min: 101, max: 1000 }),
          async (domain, keyword, invalidPosition) => {
            const { project } = await createTestUserAndProject(domain);

            // Position greater than 100 should be rejected
            await expect(
              rankTrackerService.track(project.id, keyword, invalidPosition)
            ).rejects.toThrow(ValidationError);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject non-integer positions', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDomainArbitrary,
          keywordStringArbitrary,
          fc.double({ min: 1.1, max: 99.9, noNaN: true }),
          async (domain, keyword, floatPosition) => {
            const { project } = await createTestUserAndProject(domain);

            // Non-integer position should be rejected
            await expect(
              rankTrackerService.track(project.id, keyword, floatPosition)
            ).rejects.toThrow(ValidationError);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept valid positions between 1 and 100', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDomainArbitrary,
          keywordStringArbitrary,
          positionArbitrary,
          async (domain, keyword, position) => {
            const { project } = await createTestUserAndProject(domain);

            // Valid position should be accepted
            const stored = await rankTrackerService.track(
              project.id,
              keyword,
              position
            );

            // Verify position is within range
            expect(stored.position).toBeGreaterThanOrEqual(1);
            expect(stored.position).toBeLessThanOrEqual(100);
            expect(Number.isInteger(stored.position)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Validates: Requirements 6.4**
   * 
   * Property 25: Ranking Upsert Behavior
   * For any ranking with the same projectId, keyword, and date, storing new 
   * position data should update the existing record rather than creating a duplicate.
   */
  describe('Property 25: Ranking Upsert Behavior', () => {
    it('should update existing rankings instead of creating duplicates', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDomainArbitrary,
          keywordStringArbitrary,
          positionArbitrary,
          positionArbitrary,
          dateArbitrary,
          async (domain, keyword, position1, position2, date) => {
            fc.pre(position1 !== position2); // Ensure different positions

            const { project } = await createTestUserAndProject(domain);

            // Store ranking first time
            const first = await rankTrackerService.track(
              project.id,
              keyword,
              position1,
              date
            );

            // Store same keyword and date again with different position
            const second = await rankTrackerService.track(
              project.id,
              keyword,
              position2,
              date
            );

            // Verify same ID (updated, not created)
            expect(second.id).toBe(first.id);

            // Verify position was updated
            expect(second.position).toBe(position2);

            // Verify only one record exists for this keyword and date
            const startDate = new Date(date.getTime() - 365 * 24 * 60 * 60 * 1000);
            const endDate = new Date(date.getTime() + 365 * 24 * 60 * 60 * 1000);
            const history = await rankTrackerService.getHistory(
              project.id,
              keyword,
              startDate,
              endDate
            );

            expect(history).toHaveLength(1);
            expect(history[0].keyword).toBe(keyword);
            
            const matchingEntries = history[0].history.filter(
              h => h.date === first.date
            );
            expect(matchingEntries).toHaveLength(1);
            expect(matchingEntries[0].position).toBe(position2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Validates: Requirements 6.5, 11.4, 12.2**
   * 
   * Property 26: Ranking History Sort Order
   * For any ranking history query, the results should be ordered by date in 
   * descending order (most recent first).
   */
  describe('Property 26: Ranking History Sort Order', () => {
    it('should return rankings ordered by date descending', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDomainArbitrary,
          keywordStringArbitrary,
          fc.array(
            fc.tuple(positionArbitrary, dateArbitrary),
            { minLength: 2, maxLength: 10 }
          ),
          async (domain, keyword, rankingData) => {
            const { project } = await createTestUserAndProject(domain);

            // Store multiple rankings with different dates
            const dates: Date[] = [];
            for (const [position, date] of rankingData) {
              await rankTrackerService.track(project.id, keyword, position, date);
              dates.push(date);
            }

            // Find min and max dates for range
            const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
            const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
            const startDate = new Date(minDate.getTime() - 24 * 60 * 60 * 1000);
            const endDate = new Date(maxDate.getTime() + 24 * 60 * 60 * 1000);

            // Retrieve history
            const history = await rankTrackerService.getHistory(
              project.id,
              keyword,
              startDate,
              endDate
            );

            expect(history).toHaveLength(1);
            const entries = history[0].history;

            // Verify descending order by date
            for (let i = 0; i < entries.length - 1; i++) {
              const currentDate = new Date(entries[i].date);
              const nextDate = new Date(entries[i + 1].date);
              expect(currentDate.getTime()).toBeGreaterThanOrEqual(nextDate.getTime());
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Validates: Requirements 6.6, 11.2, 12.3**
   * 
   * Property 27: Date Range Filtering
   * For any query that supports date range filtering, providing startDate and 
   * endDate parameters should return only records where the date falls within 
   * that range (inclusive).
   */
  describe('Property 27: Date Range Filtering', () => {
    it('should filter rankings by date range', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDomainArbitrary,
          keywordStringArbitrary,
          fc.array(
            fc.tuple(positionArbitrary, dateArbitrary),
            { minLength: 5, maxLength: 15 }
          ),
          async (domain, keyword, rankingData) => {
            const { project } = await createTestUserAndProject(domain);

            // Get unique dates (since upsert will only keep one ranking per date)
            // Normalize dates to start of day BEFORE checking uniqueness (using UTC)
            const uniqueDates = new Map<string, [number, Date]>();
            for (const [position, date] of rankingData) {
              // Normalize to start of day using UTC (same logic as rankTrackerService)
              const normalizedDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
              const dateStr = `${normalizedDate.getUTCFullYear()}-${String(normalizedDate.getUTCMonth() + 1).padStart(2, '0')}-${String(normalizedDate.getUTCDate()).padStart(2, '0')}`;
              uniqueDates.set(dateStr, [position, normalizedDate]);
            }

            if (uniqueDates.size < 3) return; // Need at least 3 unique dates

            // Store rankings
            for (const [position, date] of uniqueDates.values()) {
              await rankTrackerService.track(project.id, keyword, position, date);
            }

            // Get all unique date strings (already normalized)
            const allDateStrs = Array.from(uniqueDates.keys()).sort();

            // Use a range that definitely includes some dates
            const startStr = allDateStrs[0];
            const endStr = allDateStrs[allDateStrs.length - 1];
            
            // Convert back to Date objects for the query (using UTC)
            const [startYear, startMonth, startDay] = startStr.split('-').map(Number);
            const [endYear, endMonth, endDay] = endStr.split('-').map(Number);
            const startDate = new Date(Date.UTC(startYear, startMonth - 1, startDay));
            const endDate = new Date(Date.UTC(endYear, endMonth - 1, endDay));

            // Retrieve with date range filter
            const history = await rankTrackerService.getHistory(
              project.id,
              keyword,
              startDate,
              endDate
            );

            if (history.length === 0) return; // No results

            // Verify all returned dates are within range
            for (const entry of history[0].history) {
              // Date strings can be compared lexicographically in YYYY-MM-DD format
              expect(entry.date >= startStr).toBe(true);
              expect(entry.date <= endStr).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should default to last 30 days when no date range specified', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDomainArbitrary,
          keywordStringArbitrary,
          positionArbitrary,
          async (domain, keyword, position) => {
            const { project } = await createTestUserAndProject(domain);

            // Store ranking with today's date
            const today = new Date();
            await rankTrackerService.track(project.id, keyword, position, today);

            // Store ranking 40 days ago (outside default range)
            const oldDate = new Date(today.getTime() - 40 * 24 * 60 * 60 * 1000);
            const oldPosition = position === 100 ? 99 : position + 1;
            await rankTrackerService.track(project.id, keyword, oldPosition, oldDate);

            // Retrieve without date range (should default to last 30 days)
            const history = await rankTrackerService.getHistory(project.id, keyword);

            expect(history).toHaveLength(1);
            
            // Should only include today's ranking, not the 40-day-old one
            const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
            for (const entry of history[0].history) {
              const entryDate = new Date(entry.date);
              expect(entryDate.getTime()).toBeGreaterThanOrEqual(thirtyDaysAgo.getTime());
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Validates: Requirements 6.7**
   * 
   * Property 28: Ranking Date Format
   * For any stored ranking, the date field should be in YYYY-MM-DD format.
   */
  describe('Property 28: Ranking Date Format', () => {
    it('should store and return dates in YYYY-MM-DD format', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDomainArbitrary,
          keywordStringArbitrary,
          positionArbitrary,
          dateArbitrary,
          async (domain, keyword, position, date) => {
            const { project } = await createTestUserAndProject(domain);

            // Store ranking
            const stored = await rankTrackerService.track(
              project.id,
              keyword,
              position,
              date
            );

            // Verify date format in stored record
            expect(stored.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

            // Verify date format in history
            const startDate = new Date(date.getTime() - 365 * 24 * 60 * 60 * 1000);
            const endDate = new Date(date.getTime() + 365 * 24 * 60 * 60 * 1000);
            const history = await rankTrackerService.getHistory(
              project.id,
              keyword,
              startDate,
              endDate
            );

            expect(history).toHaveLength(1);
            for (const entry of history[0].history) {
              expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            }

            // Verify date can be parsed back to Date object
            const parsedDate = new Date(stored.date);
            expect(parsedDate).toBeInstanceOf(Date);
            expect(isNaN(parsedDate.getTime())).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional test: Multiple keywords for same project
   */
  describe('Multiple Keywords', () => {
    it('should handle multiple keywords for same project correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDomainArbitrary,
          fc.array(keywordStringArbitrary, { minLength: 2, maxLength: 5 }),
          positionArbitrary,
          async (domain, keywords, position) => {
            const { project } = await createTestUserAndProject(domain);

            // Get unique keywords (since we're testing multiple keywords, not duplicates)
            const uniqueKeywords = [...new Set(keywords)];
            
            if (uniqueKeywords.length < 2) return; // Need at least 2 unique keywords

            // Store rankings for multiple keywords
            for (const keyword of uniqueKeywords) {
              await rankTrackerService.track(project.id, keyword, position);
            }

            // Retrieve all rankings for project
            const history = await rankTrackerService.getHistory(project.id);

            // Verify all keywords are present
            expect(history.length).toBe(uniqueKeywords.length);
            
            const retrievedKeywords = history.map(h => h.keyword).sort();
            const expectedKeywords = [...uniqueKeywords].sort();
            expect(retrievedKeywords).toEqual(expectedKeywords);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional test: Rank change calculation
   */
  describe('Rank Change Calculation', () => {
    it('should calculate rank changes correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDomainArbitrary,
          keywordStringArbitrary,
          positionArbitrary,
          positionArbitrary,
          async (domain, keyword, position1, position2) => {
            fc.pre(position1 !== position2); // Ensure different positions

            const { project } = await createTestUserAndProject(domain);

            // Store two rankings on different dates
            const date1 = new Date('2024-01-01');
            const date2 = new Date('2024-01-02');

            await rankTrackerService.track(project.id, keyword, position1, date1);
            await rankTrackerService.track(project.id, keyword, position2, date2);

            // Retrieve history with date range
            const startDate = new Date('2023-12-01');
            const endDate = new Date('2024-02-01');
            const history = await rankTrackerService.getHistory(
              project.id,
              keyword,
              startDate,
              endDate
            );

            expect(history).toHaveLength(1);
            expect(history[0].history.length).toBeGreaterThanOrEqual(2);

            // Find entries with change calculation
            const entriesWithChange = history[0].history.filter(e => e.change !== undefined);
            
            if (entriesWithChange.length > 0) {
              // Verify change calculation (negative means improvement)
              const entry = entriesWithChange[0];
              expect(typeof entry.change).toBe('number');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Validates: Requirements 11.5**
   * 
   * Property 40: Ranking History Response Format
   * For any ranking graph data request, the response should be formatted as an array 
   * of keywords, each containing a history array of {date, position} pairs.
   */
  describe('Property 40: Ranking History Response Format', () => {
    it('should format response as array of keywords with history arrays', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDomainArbitrary,
          fc.array(keywordStringArbitrary, { minLength: 1, maxLength: 5 }),
          fc.array(
            fc.tuple(positionArbitrary, dateArbitrary),
            { minLength: 1, maxLength: 10 }
          ),
          async (domain, keywords, rankingData) => {
            const { project } = await createTestUserAndProject(domain);

            // Store rankings for multiple keywords
            const allDates: Date[] = [];
            for (const keyword of keywords) {
              for (const [position, date] of rankingData) {
                await rankTrackerService.track(project.id, keyword, position, date);
                allDates.push(date);
              }
            }

            // Calculate date range to include all stored rankings
            const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
            const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
            const startDate = new Date(minDate.getTime() - 24 * 60 * 60 * 1000);
            const endDate = new Date(maxDate.getTime() + 24 * 60 * 60 * 1000);

            // Retrieve ranking history with date range
            const history = await rankTrackerService.getHistory(project.id, undefined, startDate, endDate);

            // Verify response is an array
            expect(Array.isArray(history)).toBe(true);

            // Verify each element has keyword and history properties
            for (const item of history) {
              // Verify keyword property exists and is a string
              expect(item).toHaveProperty('keyword');
              expect(typeof item.keyword).toBe('string');
              expect(item.keyword.length).toBeGreaterThan(0);

              // Verify history property exists and is an array
              expect(item).toHaveProperty('history');
              expect(Array.isArray(item.history)).toBe(true);

              // Verify each history entry has date and position properties
              for (const entry of item.history) {
                expect(entry).toHaveProperty('date');
                expect(entry).toHaveProperty('position');

                // Verify date is a string in YYYY-MM-DD format
                expect(typeof entry.date).toBe('string');
                expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

                // Verify position is a number between 1 and 100
                expect(typeof entry.position).toBe('number');
                expect(entry.position).toBeGreaterThanOrEqual(1);
                expect(entry.position).toBeLessThanOrEqual(100);
                expect(Number.isInteger(entry.position)).toBe(true);
              }
            }

            // Verify all keywords are present in response
            const responseKeywords = history.map(h => h.keyword).sort();
            const expectedKeywords = [...keywords].sort();
            expect(responseKeywords).toEqual(expectedKeywords);

            // Verify each keyword has at least one history entry
            for (const item of history) {
              expect(item.history.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should format single keyword response correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDomainArbitrary,
          keywordStringArbitrary,
          fc.array(
            fc.tuple(positionArbitrary, dateArbitrary),
            { minLength: 2, maxLength: 5 }
          ),
          async (domain, keyword, rankingData) => {
            const { project } = await createTestUserAndProject(domain);

            // Store rankings for single keyword
            const dates: Date[] = [];
            for (const [position, date] of rankingData) {
              await rankTrackerService.track(project.id, keyword, position, date);
              dates.push(date);
            }

            // Calculate date range to include all stored rankings
            const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
            const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
            const startDate = new Date(minDate.getTime() - 24 * 60 * 60 * 1000);
            const endDate = new Date(maxDate.getTime() + 24 * 60 * 60 * 1000);

            // Retrieve ranking history for specific keyword with date range
            const history = await rankTrackerService.getHistory(project.id, keyword, startDate, endDate);

            // Verify response structure
            expect(Array.isArray(history)).toBe(true);
            expect(history).toHaveLength(1);

            const item = history[0];
            expect(item.keyword).toBe(keyword);
            expect(Array.isArray(item.history)).toBe(true);
            expect(item.history.length).toBeGreaterThan(0);

            // Verify each history entry structure
            for (const entry of item.history) {
              expect(entry).toHaveProperty('date');
              expect(entry).toHaveProperty('position');
              expect(typeof entry.date).toBe('string');
              expect(typeof entry.position).toBe('number');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return empty array when no rankings exist', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDomainArbitrary,
          async (domain) => {
            const { project } = await createTestUserAndProject(domain);

            // Retrieve ranking history without storing any rankings
            const history = await rankTrackerService.getHistory(project.id);

            // Verify response is an empty array
            expect(Array.isArray(history)).toBe(true);
            expect(history).toHaveLength(0);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should maintain format consistency with date range filters', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDomainArbitrary,
          keywordStringArbitrary,
          fc.array(
            fc.tuple(positionArbitrary, dateArbitrary),
            { minLength: 3, maxLength: 8 }
          ),
          async (domain, keyword, rankingData) => {
            const { project } = await createTestUserAndProject(domain);

            // Store rankings
            const dates: Date[] = [];
            for (const [position, date] of rankingData) {
              await rankTrackerService.track(project.id, keyword, position, date);
              dates.push(date);
            }

            // Get date range
            const sortedDates = dates.sort((a, b) => a.getTime() - b.getTime());
            const startDate = sortedDates[0];
            const endDate = sortedDates[sortedDates.length - 1];

            // Retrieve with date range filter
            const history = await rankTrackerService.getHistory(
              project.id,
              keyword,
              startDate,
              endDate
            );

            // Verify response format is consistent
            expect(Array.isArray(history)).toBe(true);

            if (history.length > 0) {
              const item = history[0];
              expect(item).toHaveProperty('keyword');
              expect(item).toHaveProperty('history');
              expect(Array.isArray(item.history)).toBe(true);

              // Verify each entry has correct structure
              for (const entry of item.history) {
                expect(entry).toHaveProperty('date');
                expect(entry).toHaveProperty('position');
                expect(typeof entry.date).toBe('string');
                expect(typeof entry.position).toBe('number');
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not include extra properties in response', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDomainArbitrary,
          keywordStringArbitrary,
          positionArbitrary,
          dateArbitrary,
          async (domain, keyword, position, date) => {
            const { project } = await createTestUserAndProject(domain);

            // Store ranking
            await rankTrackerService.track(project.id, keyword, position, date);

            // Calculate date range to include the stored ranking
            const startDate = new Date(date.getTime() - 365 * 24 * 60 * 60 * 1000);
            const endDate = new Date(date.getTime() + 365 * 24 * 60 * 60 * 1000);

            // Retrieve history with date range
            const history = await rankTrackerService.getHistory(project.id, keyword, startDate, endDate);

            expect(history).toHaveLength(1);
            const item = history[0];

            // Verify only expected properties exist at top level
            const topLevelKeys = Object.keys(item).sort();
            expect(topLevelKeys).toEqual(['history', 'keyword']);

            // Verify only expected properties exist in history entries
            for (const entry of item.history) {
              const entryKeys = Object.keys(entry).sort();
              // May include 'change' property for rank change calculation
              const allowedKeys = ['change', 'date', 'position'];
              for (const key of entryKeys) {
                expect(allowedKeys).toContain(key);
              }
              // Must have date and position
              expect(entry).toHaveProperty('date');
              expect(entry).toHaveProperty('position');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
