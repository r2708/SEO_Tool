import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { analyze, calculateScore } from '../../src/services/seo/seoAnalyzerService';
import * as scraperService from '../../src/services/scraper/scraper.service';

// Mock the scraper service
vi.mock('../../src/services/scraper/scraper.service');

/**
 * Feature: seo-saas-platform, SEO Analyzer Properties
 */
describe('Feature: seo-saas-platform, SEO Analyzer Properties', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * **Validates: Requirements 7.2, 7.3, 7.4, 7.5, 7.6, 7.7**
   * 
   * Property 29: SEO Analysis Element Extraction
   * For any web page URL, the SEO_Analyzer should extract and return all required 
   * elements: title tag, meta description, H1/H2 counts, images with/without alt 
   * attributes, internal link count, and broken links.
   */
  describe('Property 29: SEO Analysis Element Extraction', () => {
    it('should extract title tag content and length', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl(),
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          async (url, titleContent) => {
            const html = `
              <!DOCTYPE html>
              <html>
                <head>
                  <title>${titleContent}</title>
                </head>
                <body></body>
              </html>
            `;

            vi.mocked(scraperService.scrapePage).mockResolvedValue(html);

            const result = await analyze(url);
            const expectedContent = titleContent.trim();

            expect(result.title).toBeDefined();
            expect(result.title.content).toBe(expectedContent);
            expect(result.title.length).toBe(expectedContent.length);
            expect(typeof result.title.optimal).toBe('boolean');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should extract meta description content and length', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl(),
          fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
          async (url, metaContent) => {
            // Escape HTML entities to prevent breaking the HTML structure
            const escapedContent = metaContent
              .replace(/&/g, '&amp;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#39;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;');

            const html = `
              <!DOCTYPE html>
              <html>
                <head>
                  <meta name="description" content="${escapedContent}" />
                </head>
                <body></body>
              </html>
            `;

            vi.mocked(scraperService.scrapePage).mockResolvedValue(html);

            const result = await analyze(url);
            const expectedContent = metaContent.trim();

            expect(result.metaDescription).toBeDefined();
            expect(result.metaDescription.content).toBe(expectedContent);
            expect(result.metaDescription.length).toBe(expectedContent.length);
            expect(typeof result.metaDescription.optimal).toBe('boolean');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should count H1 and H2 tags correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl(),
          fc.integer({ min: 0, max: 5 }),
          fc.integer({ min: 0, max: 10 }),
          async (url, h1Count, h2Count) => {
            const h1Tags = Array.from({ length: h1Count }, (_, i) => 
              `<h1>Heading 1 - ${i}</h1>`
            ).join('');
            const h2Tags = Array.from({ length: h2Count }, (_, i) => 
              `<h2>Heading 2 - ${i}</h2>`
            ).join('');

            const html = `
              <!DOCTYPE html>
              <html>
                <body>
                  ${h1Tags}
                  ${h2Tags}
                </body>
              </html>
            `;

            vi.mocked(scraperService.scrapePage).mockResolvedValue(html);

            const result = await analyze(url);

            expect(result.headings).toBeDefined();
            expect(result.headings.h1Count).toBe(h1Count);
            expect(result.headings.h2Count).toBe(h2Count);
            expect(Array.isArray(result.headings.structure)).toBe(true);
            expect(result.headings.structure.length).toBe(h1Count + h2Count);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should count total images and images missing alt attributes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl(),
          fc.integer({ min: 0, max: 10 }),
          fc.integer({ min: 0, max: 10 }),
          async (url, imagesWithAlt, imagesWithoutAlt) => {
            const withAlt = Array.from({ length: imagesWithAlt }, (_, i) => 
              `<img src="image${i}.jpg" alt="Image ${i}" />`
            ).join('');
            const withoutAlt = Array.from({ length: imagesWithoutAlt }, (_, i) => 
              `<img src="noalt${i}.jpg" />`
            ).join('');

            const html = `
              <!DOCTYPE html>
              <html>
                <body>
                  ${withAlt}
                  ${withoutAlt}
                </body>
              </html>
            `;

            vi.mocked(scraperService.scrapePage).mockResolvedValue(html);

            const result = await analyze(url);

            expect(result.images).toBeDefined();
            expect(result.images.total).toBe(imagesWithAlt + imagesWithoutAlt);
            expect(result.images.missingAlt).toBe(imagesWithoutAlt);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should count internal links', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl(),
          fc.integer({ min: 0, max: 10 }),
          fc.integer({ min: 0, max: 5 }),
          async (url, internalCount, externalCount) => {
            const baseUrl = new URL(url);
            const internalLinks = Array.from({ length: internalCount }, (_, i) => 
              `<a href="${baseUrl.origin}/page${i}">Internal ${i}</a>`
            ).join('');
            const externalLinks = Array.from({ length: externalCount }, (_, i) => 
              `<a href="https://external${i}.com">External ${i}</a>`
            ).join('');

            const html = `
              <!DOCTYPE html>
              <html>
                <body>
                  ${internalLinks}
                  ${externalLinks}
                </body>
              </html>
            `;

            vi.mocked(scraperService.scrapePage).mockResolvedValue(html);

            // Mock fetch for link checking
            global.fetch = vi.fn().mockResolvedValue({
              status: 200,
            } as Response);

            const result = await analyze(url);

            expect(result.links).toBeDefined();
            expect(result.links.internal).toBe(internalCount);
            expect(Array.isArray(result.links.broken)).toBe(true);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should extract all required elements in a single analysis', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl(),
          fc.string({ minLength: 10, maxLength: 60 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 50, maxLength: 160 }).filter(s => s.trim().length > 0),
          fc.integer({ min: 1, max: 3 }),
          fc.integer({ min: 2, max: 8 }),
          fc.integer({ min: 1, max: 10 }),
          async (url, title, metaDesc, h1Count, h2Count, imageCount) => {
            // Escape HTML entities to prevent breaking the HTML structure
            const escapeHtml = (str: string) => str
              .replace(/&/g, '&amp;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#39;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;');

            const escapedTitle = escapeHtml(title);
            const escapedMeta = escapeHtml(metaDesc);

            const h1Tags = Array.from({ length: h1Count }, (_, i) => 
              `<h1>H1 ${i}</h1>`
            ).join('');
            const h2Tags = Array.from({ length: h2Count }, (_, i) => 
              `<h2>H2 ${i}</h2>`
            ).join('');
            const images = Array.from({ length: imageCount }, (_, i) => 
              `<img src="img${i}.jpg" alt="Image ${i}" />`
            ).join('');

            const html = `
              <!DOCTYPE html>
              <html>
                <head>
                  <title>${escapedTitle}</title>
                  <meta name="description" content="${escapedMeta}" />
                </head>
                <body>
                  ${h1Tags}
                  ${h2Tags}
                  ${images}
                  <a href="${url}/page1">Link 1</a>
                  <a href="${url}/page2">Link 2</a>
                </body>
              </html>
            `;

            vi.mocked(scraperService.scrapePage).mockResolvedValue(html);

            // Mock fetch for link checking
            global.fetch = vi.fn().mockResolvedValue({
              status: 200,
            } as Response);

            const result = await analyze(url);
            const expectedTitle = title.trim();
            const expectedMeta = metaDesc.trim();

            // Verify all elements are present
            expect(result.title).toBeDefined();
            expect(result.metaDescription).toBeDefined();
            expect(result.headings).toBeDefined();
            expect(result.images).toBeDefined();
            expect(result.links).toBeDefined();

            // Verify structure
            expect(result.title.content).toBe(expectedTitle);
            expect(result.metaDescription.content).toBe(expectedMeta);
            expect(result.headings.h1Count).toBe(h1Count);
            expect(result.headings.h2Count).toBe(h2Count);
            expect(result.images.total).toBe(imageCount);
            expect(result.images.missingAlt).toBe(0);
            expect(result.links.internal).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should handle pages with missing elements gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl(),
          async (url) => {
            const html = `
              <!DOCTYPE html>
              <html>
                <body>
                  <p>Minimal page with no SEO elements</p>
                </body>
              </html>
            `;

            vi.mocked(scraperService.scrapePage).mockResolvedValue(html);

            const result = await analyze(url);

            // Should still return all required fields with default values
            expect(result.title.content).toBe('');
            expect(result.title.length).toBe(0);
            expect(result.metaDescription.content).toBe('');
            expect(result.metaDescription.length).toBe(0);
            expect(result.headings.h1Count).toBe(0);
            expect(result.headings.h2Count).toBe(0);
            expect(result.images.total).toBe(0);
            expect(result.images.missingAlt).toBe(0);
            expect(result.links.internal).toBe(0);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should return analysis with timestamp', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl(),
          async (url) => {
            const html = '<html><body>Test</body></html>';
            vi.mocked(scraperService.scrapePage).mockResolvedValue(html);

            const beforeAnalysis = new Date();
            const result = await analyze(url);
            const afterAnalysis = new Date();

            expect(result.analyzedAt).toBeDefined();
            expect(result.analyzedAt).toBeInstanceOf(Date);
            expect(result.analyzedAt.getTime()).toBeGreaterThanOrEqual(beforeAnalysis.getTime());
            expect(result.analyzedAt.getTime()).toBeLessThanOrEqual(afterAnalysis.getTime());
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should return recommendations array', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl(),
          async (url) => {
            const html = '<html><body>Test</body></html>';
            vi.mocked(scraperService.scrapePage).mockResolvedValue(html);

            const result = await analyze(url);

            expect(result.recommendations).toBeDefined();
            expect(Array.isArray(result.recommendations)).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * **Validates: Requirements 7.8, 7.9**
   * 
   * Property 30: SEO Score Range
   * For any SEO analysis or content optimization, the calculated score should be 
   * an integer between 0 and 100 (inclusive).
   */
  describe('Property 30: SEO Score Range', () => {
    it('should always return a score between 0 and 100', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl(),
          fc.string({ minLength: 0, maxLength: 100 }),
          fc.string({ minLength: 0, maxLength: 200 }),
          fc.integer({ min: 0, max: 5 }),
          fc.integer({ min: 0, max: 10 }),
          fc.integer({ min: 0, max: 20 }),
          async (url, title, metaDesc, h1Count, h2Count, imageCount) => {
            const html = `
              <!DOCTYPE html>
              <html>
                <head>
                  <title>${title}</title>
                  <meta name="description" content="${metaDesc}" />
                </head>
                <body>
                  ${Array.from({ length: h1Count }, () => '<h1>H1</h1>').join('')}
                  ${Array.from({ length: h2Count }, () => '<h2>H2</h2>').join('')}
                  ${Array.from({ length: imageCount }, (_, i) => 
                    i % 2 === 0 ? '<img src="img.jpg" alt="Alt" />' : '<img src="img.jpg" />'
                  ).join('')}
                </body>
              </html>
            `;

            vi.mocked(scraperService.scrapePage).mockResolvedValue(html);

            // Mock fetch for link checking
            global.fetch = vi.fn().mockResolvedValue({
              status: 200,
            } as Response);

            const result = await analyze(url);

            expect(result.score).toBeGreaterThanOrEqual(0);
            expect(result.score).toBeLessThanOrEqual(100);
            expect(Number.isInteger(result.score)).toBe(true);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should calculate score using the scoring algorithm', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.boolean(), // title optimal
          fc.boolean(), // meta optimal
          fc.integer({ min: 0, max: 3 }), // h1 count
          fc.integer({ min: 0, max: 5 }), // h2 count
          fc.integer({ min: 0, max: 10 }), // total images
          fc.integer({ min: 0, max: 10 }), // missing alt
          fc.integer({ min: 0, max: 5 }), // broken links
          fc.integer({ min: 0, max: 10 }), // internal links
          async (titleOpt, metaOpt, h1Count, h2Count, totalImages, missingAlt, brokenCount, internalCount) => {
            const analysis = {
              title: { content: '', length: 0, optimal: titleOpt },
              metaDescription: { content: '', length: 0, optimal: metaOpt },
              headings: { h1Count, h2Count, structure: [] },
              images: { total: totalImages, missingAlt },
              links: { internal: internalCount, broken: Array(brokenCount).fill('') },
            };

            const score = calculateScore(analysis);

            // Verify score is in valid range
            expect(score).toBeGreaterThanOrEqual(0);
            expect(score).toBeLessThanOrEqual(100);

            // Verify base score
            expect(score).toBeGreaterThanOrEqual(10);

            // Verify scoring components
            let expectedScore = 10;
            if (titleOpt) expectedScore += 15;
            if (metaOpt) expectedScore += 15;
            if (h1Count === 1) expectedScore += 10;
            if (h2Count >= 2) expectedScore += 10;
            if (totalImages > 0 && missingAlt === 0) expectedScore += 15;
            if (brokenCount === 0) expectedScore += 15;
            if (internalCount > 3) expectedScore += 10;

            expect(score).toBe(Math.max(0, Math.min(100, expectedScore)));
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  /**
   * **Validates: Requirements 7.8, 7.9**
   * 
   * Property 31: SEO Analysis Response Completeness
   * For any completed SEO analysis, the response should include the score and 
   * structured analysis data for all evaluated elements (title, meta, headings, 
   * images, links).
   */
  describe('Property 31: SEO Analysis Response Completeness', () => {
    it('should return complete analysis structure', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl(),
          async (url) => {
            const html = `
              <!DOCTYPE html>
              <html>
                <head>
                  <title>Test Title</title>
                  <meta name="description" content="Test description" />
                </head>
                <body>
                  <h1>Main Heading</h1>
                  <h2>Subheading</h2>
                  <img src="test.jpg" alt="Test" />
                  <a href="${url}/page">Link</a>
                </body>
              </html>
            `;

            vi.mocked(scraperService.scrapePage).mockResolvedValue(html);

            // Mock fetch
            global.fetch = vi.fn().mockResolvedValue({
              status: 200,
            } as Response);

            const result = await analyze(url);

            // Verify all required top-level fields
            expect(result).toHaveProperty('url');
            expect(result).toHaveProperty('score');
            expect(result).toHaveProperty('title');
            expect(result).toHaveProperty('metaDescription');
            expect(result).toHaveProperty('headings');
            expect(result).toHaveProperty('images');
            expect(result).toHaveProperty('links');
            expect(result).toHaveProperty('recommendations');
            expect(result).toHaveProperty('analyzedAt');

            // Verify title structure
            expect(result.title).toHaveProperty('content');
            expect(result.title).toHaveProperty('length');
            expect(result.title).toHaveProperty('optimal');

            // Verify metaDescription structure
            expect(result.metaDescription).toHaveProperty('content');
            expect(result.metaDescription).toHaveProperty('length');
            expect(result.metaDescription).toHaveProperty('optimal');

            // Verify headings structure
            expect(result.headings).toHaveProperty('h1Count');
            expect(result.headings).toHaveProperty('h2Count');
            expect(result.headings).toHaveProperty('structure');

            // Verify images structure
            expect(result.images).toHaveProperty('total');
            expect(result.images).toHaveProperty('missingAlt');

            // Verify links structure
            expect(result.links).toHaveProperty('internal');
            expect(result.links).toHaveProperty('broken');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should include score in the response', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl(),
          async (url) => {
            const html = '<html><body>Test</body></html>';
            vi.mocked(scraperService.scrapePage).mockResolvedValue(html);

            const result = await analyze(url);

            expect(typeof result.score).toBe('number');
            expect(result.score).toBeGreaterThanOrEqual(0);
            expect(result.score).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should include URL in the response', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl(),
          async (url) => {
            const html = '<html><body>Test</body></html>';
            vi.mocked(scraperService.scrapePage).mockResolvedValue(html);

            const result = await analyze(url);

            expect(result.url).toBe(url);
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  /**
   * **Validates: Requirements 12.1**
   * 
   * Property 41: SEO Score Storage Round-Trip
   * For any completed SEO audit with projectId, after storing the score and timestamp, 
   * querying score history for that project should return a record with matching score 
   * and timestamp.
   */
  describe('Property 41: SEO Score Storage Round-Trip', () => {
    it('should store and retrieve SEO scores with matching data', async () => {
      const { storeScore, getScoreHistory } = await import('../../src/services/seo/seoAnalyzerService');
      const { getPrismaClient } = await import('../helpers/test-db');
      const prisma = getPrismaClient();

      try {
        await fc.assert(
          fc.asyncProperty(
            fc.webUrl(),
            fc.integer({ min: 0, max: 100 }),
            async (url, score) => {
              let user, project;
              try {
                // Create test user and project
                user = await prisma.user.create({
                  data: {
                    email: `test-${Date.now()}-${Math.random()}@example.com`,
                    password: 'hashedpassword',
                    role: 'Free',
                  },
                });

                project = await prisma.project.create({
                  data: {
                    domain: 'example.com',
                    name: 'Test Project',
                    userId: user.id,
                  },
                });

                // Create a mock analysis object
                const mockAnalysis = {
                  url,
                  score,
                  title: { content: 'Test', length: 4, optimal: false },
                  metaDescription: { content: 'Test desc', length: 9, optimal: false },
                  headings: { h1Count: 1, h2Count: 2, structure: ['h1', 'h2', 'h2'] },
                  images: { total: 5, missingAlt: 1 },
                  links: { internal: 3, broken: [] },
                  recommendations: ['Test recommendation'],
                  analyzedAt: new Date(),
                };

                // Store the score
                const beforeStore = new Date();
                await storeScore(project.id, url, score, mockAnalysis);
                const afterStore = new Date();

                // Retrieve score history
                const history = await getScoreHistory(project.id);

                // Verify the stored score is in the history
                expect(history.length).toBeGreaterThan(0);
                
                const storedScore = history.find(h => h.url === url && h.score === score);
                expect(storedScore).toBeDefined();
                expect(storedScore!.score).toBe(score);
                expect(storedScore!.url).toBe(url);
                expect(storedScore!.date).toBeInstanceOf(Date);
                expect(storedScore!.date.getTime()).toBeGreaterThanOrEqual(beforeStore.getTime());
                // Allow small timing buffer (10ms) for database operations
                expect(storedScore!.date.getTime()).toBeLessThanOrEqual(afterStore.getTime() + 10);
              } finally {
                // Clean up - always delete even if test fails
                if (project) {
                  await prisma.project.delete({ where: { id: project.id } }).catch(() => {});
                }
                if (user) {
                  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
                }
              }
            }
          ),
          { numRuns: 5 }
        );
      } finally {
        // No need to disconnect as we're using the shared client
      }
    });

    it('should preserve all analysis data in storage', async () => {
      const { storeScore } = await import('../../src/services/seo/seoAnalyzerService');
      const { getPrismaClient } = await import('../helpers/test-db');
      const prisma = getPrismaClient();

      try {
        await fc.assert(
          fc.asyncProperty(
            fc.webUrl(),
            fc.integer({ min: 0, max: 100 }),
            fc.string({ minLength: 10, maxLength: 60 }),
            fc.string({ minLength: 50, maxLength: 160 }),
            async (url, score, title, metaDesc) => {
              let user, project;
              try {
                // Create test user and project
                user = await prisma.user.create({
                  data: {
                    email: `test-${Date.now()}-${Math.random()}@example.com`,
                    password: 'hashedpassword',
                    role: 'Free',
                  },
                });

                project = await prisma.project.create({
                  data: {
                    domain: 'example.com',
                    name: 'Test Project',
                    userId: user.id,
                  },
                });

                const mockAnalysis = {
                  url,
                  score,
                  title: { content: title, length: title.length, optimal: title.length >= 50 && title.length <= 60 },
                  metaDescription: { content: metaDesc, length: metaDesc.length, optimal: metaDesc.length >= 150 && metaDesc.length <= 160 },
                  headings: { h1Count: 1, h2Count: 3, structure: ['h1', 'h2', 'h2', 'h2'] },
                  images: { total: 10, missingAlt: 2 },
                  links: { internal: 5, broken: ['http://broken.com'] },
                  recommendations: ['Add more keywords', 'Improve meta description'],
                  analyzedAt: new Date(),
                };

                await storeScore(project.id, url, score, mockAnalysis);

                // Retrieve the stored record directly from database
                const stored = await prisma.sEOScore.findFirst({
                  where: { projectId: project.id, url },
                  orderBy: { createdAt: 'desc' },
                });

                expect(stored).toBeDefined();
                expect(stored!.score).toBe(score);
                expect(stored!.url).toBe(url);
                expect(stored!.projectId).toBe(project.id);
                
                // Verify analysis is stored as JSON
                const storedAnalysis = stored!.analysis as any;
                expect(storedAnalysis).toBeDefined();
                expect(storedAnalysis.title.content).toBe(title);
                expect(storedAnalysis.metaDescription.content).toBe(metaDesc);
              } finally {
                // Clean up - always delete even if test fails
                if (project) {
                  await prisma.project.delete({ where: { id: project.id } }).catch(() => {});
                }
                if (user) {
                  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
                }
              }
            }
          ),
          { numRuns: 5 }
        );
      } finally {
        // No need to disconnect as we're using the shared client
      }
    });
  });

  /**
   * **Validates: Requirements 12.4**
   * 
   * Property 42: Score Change Calculation
   * For any SEO score history with at least 2 audits, the score change percentage 
   * should be calculated as ((current - previous) / previous) * 100.
   */
  describe('Property 42: Score Change Calculation', () => {
    it('should calculate score change percentage correctly', async () => {
      const { storeScore, getScoreHistory } = await import('../../src/services/seo/seoAnalyzerService');
      const { getPrismaClient } = await import('../helpers/test-db');
      const prisma = getPrismaClient();

      try {
        await fc.assert(
          fc.asyncProperty(
            fc.webUrl(),
            fc.integer({ min: 1, max: 100 }),
            fc.integer({ min: 1, max: 100 }),
            async (url, score1, score2) => {
              let user, project;
              try {
                // Create test user and project
                user = await prisma.user.create({
                  data: {
                    email: `test-${Date.now()}-${Math.random()}@example.com`,
                    password: 'hashedpassword',
                    role: 'Free',
                  },
                });

                project = await prisma.project.create({
                  data: {
                    domain: 'example.com',
                    name: 'Test Project',
                    userId: user.id,
                  },
                });

                const mockAnalysis1 = {
                  url,
                  score: score1,
                  title: { content: 'Test', length: 4, optimal: false },
                  metaDescription: { content: 'Test', length: 4, optimal: false },
                  headings: { h1Count: 1, h2Count: 2, structure: [] },
                  images: { total: 5, missingAlt: 1 },
                  links: { internal: 3, broken: [] },
                  recommendations: [],
                  analyzedAt: new Date(),
                };

                const mockAnalysis2 = {
                  ...mockAnalysis1,
                  score: score2,
                };

                // Store first score
                await storeScore(project.id, url, score1, mockAnalysis1);
                
                // Wait a bit to ensure different timestamps
                await new Promise(resolve => setTimeout(resolve, 10));
                
                // Store second score
                await storeScore(project.id, url, score2, mockAnalysis2);

                // Retrieve history
                const history = await getScoreHistory(project.id);

                // History should be ordered by date descending (newest first)
                expect(history.length).toBeGreaterThanOrEqual(2);
                
                // The most recent score should be score2
                const mostRecent = history[0];
                expect(mostRecent.score).toBe(score2);

                // Calculate expected score change
                const expectedChange = ((score2 - score1) / score1) * 100;
                
                // Verify score change is calculated correctly
                expect(mostRecent.scoreChange).not.toBeNull();
                expect(mostRecent.scoreChange).toBeCloseTo(expectedChange, 2);

                // The older score should have null scoreChange (no previous score)
                const older = history.find(h => h.score === score1);
                if (older && history.indexOf(older) === history.length - 1) {
                  expect(older.scoreChange).toBeNull();
                }
              } finally {
                // Clean up - always delete even if test fails
                if (project) {
                  await prisma.project.delete({ where: { id: project.id } }).catch(() => {});
                }
                if (user) {
                  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
                }
              }
            }
          ),
          { numRuns: 5 }
        );
      } finally {
        // No need to disconnect as we're using the shared client
      }
    });

    it('should return null for score change when no previous audit exists', async () => {
      const { storeScore, getScoreHistory } = await import('../../src/services/seo/seoAnalyzerService');
      const { getPrismaClient } = await import('../helpers/test-db');
      const prisma = getPrismaClient();

      try {
        await fc.assert(
          fc.asyncProperty(
            fc.webUrl(),
            fc.integer({ min: 0, max: 100 }),
            async (url, score) => {
              let user, project;
              try {
                // Create test user and project
                user = await prisma.user.create({
                  data: {
                    email: `test-${Date.now()}-${Math.random()}@example.com`,
                    password: 'hashedpassword',
                    role: 'Free',
                  },
                });

                project = await prisma.project.create({
                  data: {
                    domain: 'example.com',
                    name: 'Test Project',
                    userId: user.id,
                  },
                });

                const mockAnalysis = {
                  url,
                  score,
                  title: { content: 'Test', length: 4, optimal: false },
                  metaDescription: { content: 'Test', length: 4, optimal: false },
                  headings: { h1Count: 1, h2Count: 2, structure: [] },
                  images: { total: 5, missingAlt: 1 },
                  links: { internal: 3, broken: [] },
                  recommendations: [],
                  analyzedAt: new Date(),
                };

                // Store only one score
                await storeScore(project.id, url, score, mockAnalysis);

                // Retrieve history
                const history = await getScoreHistory(project.id);

                expect(history.length).toBe(1);
                expect(history[0].score).toBe(score);
                expect(history[0].scoreChange).toBeNull();
              } finally {
                // Clean up - always delete even if test fails
                if (project) {
                  await prisma.project.delete({ where: { id: project.id } }).catch(() => {});
                }
                if (user) {
                  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
                }
              }
            }
          ),
          { numRuns: 5 }
        );
      } finally {
        // No need to disconnect as we're using the shared client
      }
    });

    it('should handle multiple scores and calculate changes correctly', async () => {
      const { storeScore, getScoreHistory } = await import('../../src/services/seo/seoAnalyzerService');
      const { getPrismaClient } = await import('../helpers/test-db');
      const prisma = getPrismaClient();

      try {
        await fc.assert(
          fc.asyncProperty(
            fc.webUrl(),
            fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 3, maxLength: 5 }),
            async (url, scores) => {
              // Create test user and project
              const user = await prisma.user.create({
                data: {
                  email: `test-${Date.now()}-${Math.random()}@example.com`,
                  password: 'hashedpassword',
                  role: 'Free',
                },
              });

              const project = await prisma.project.create({
                data: {
                  domain: 'example.com',
                  name: 'Test Project',
                  userId: user.id,
                },
              });

              try {
                // Store multiple scores
                for (const score of scores) {
                  const mockAnalysis = {
                    url,
                    score,
                    title: { content: 'Test', length: 4, optimal: false },
                    metaDescription: { content: 'Test', length: 4, optimal: false },
                    headings: { h1Count: 1, h2Count: 2, structure: [] },
                    images: { total: 5, missingAlt: 1 },
                    links: { internal: 3, broken: [] },
                    recommendations: [],
                    analyzedAt: new Date(),
                  };

                  await storeScore(project.id, url, score, mockAnalysis);
                  await new Promise(resolve => setTimeout(resolve, 10));
                }

                // Retrieve history
                const history = await getScoreHistory(project.id);

                expect(history.length).toBe(scores.length);

                // Verify each score change calculation
                for (let i = 0; i < history.length; i++) {
                  if (i < history.length - 1) {
                    // Should have a score change
                    const current = history[i].score;
                    const previous = history[i + 1].score;
                    const expectedChange = ((current - previous) / previous) * 100;
                    
                    expect(history[i].scoreChange).not.toBeNull();
                    expect(history[i].scoreChange).toBeCloseTo(expectedChange, 2);
                  } else {
                    // Last (oldest) score should have null change
                    expect(history[i].scoreChange).toBeNull();
                  }
                }
              } finally {
                // Clean up - always delete even if test fails
                await prisma.project.delete({ where: { id: project.id } }).catch(() => {});
                await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
              }
            }
          ),
          { numRuns: 15 }
        );
      } finally {
        // No need to disconnect as we're using the shared client
      }
    });

    it('should handle date range filtering correctly', async () => {
      const { storeScore, getScoreHistory } = await import('../../src/services/seo/seoAnalyzerService');
      const { getPrismaClient } = await import('../helpers/test-db');
      const prisma = getPrismaClient();

      try {
        await fc.assert(
          fc.asyncProperty(
            fc.webUrl(),
            async (url) => {
              // Create test user and project
              const user = await prisma.user.create({
                data: {
                  email: `test-${Date.now()}-${Math.random()}@example.com`,
                  password: 'hashedpassword',
                  role: 'Free',
                },
              });

              const project = await prisma.project.create({
                data: {
                  domain: 'example.com',
                  name: 'Test Project',
                  userId: user.id,
                },
              });

              const now = new Date();
              const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
              const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

              // Store a score
              const mockAnalysis = {
                url,
                score: 75,
                title: { content: 'Test', length: 4, optimal: false },
                metaDescription: { content: 'Test', length: 4, optimal: false },
                headings: { h1Count: 1, h2Count: 2, structure: [] },
                images: { total: 5, missingAlt: 1 },
                links: { internal: 3, broken: [] },
                recommendations: [],
                analyzedAt: new Date(),
              };

              await storeScore(project.id, url, 75, mockAnalysis);

              // Query with date range that includes the score
              const historyIncluded = await getScoreHistory(project.id, yesterday, tomorrow);
              expect(historyIncluded.length).toBeGreaterThan(0);

              // Query with date range that excludes the score
              const historyExcluded = await getScoreHistory(project.id, tomorrow, new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000));
              expect(historyExcluded.length).toBe(0);

              // Clean up
              await prisma.project.delete({ where: { id: project.id } });
              await prisma.user.delete({ where: { id: user.id } });
            }
          ),
          { numRuns: 10 }
        );
      } finally {
        // No need to disconnect as we're using the shared client
      }
    });
  });
});
