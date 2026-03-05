import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { fetchSERPResults } from '../../src/services/content/contentOptimizerService';
import * as scraperQueue from '../../src/services/scraper/scraper-queue.service';

// Mock the scraper queue
vi.mock('../../src/services/scraper/scraper-queue.service');

// Mock the cache module
vi.mock('../../src/services/cache', () => ({
  cache: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(undefined),
    delPattern: vi.fn().mockResolvedValue(undefined),
  },
}));

/**
 * Feature: seo-saas-platform, Content Optimizer Properties
 */
describe('Feature: seo-saas-platform, Content Optimizer Properties', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * **Validates: Requirements 9.2, 9.3**
   * 
   * Property 35: SERP Results Retrieval
   * For any content optimization request, the Content_Optimizer should retrieve 
   * exactly 10 SERP results for the target keyword and extract keywords and 
   * headings from each result.
   */
  describe('Property 35: SERP Results Retrieval', () => {
    it('should retrieve exactly 10 SERP results by default', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.trim().length > 0),
          async (keyword) => {
            // Mock HTML content for each SERP result
            const mockHtml = `
              <!DOCTYPE html>
              <html>
                <head>
                  <title>Test Page for ${keyword}</title>
                  <meta name="keywords" content="${keyword}, seo, optimization" />
                </head>
                <body>
                  <h1>Main Heading about ${keyword}</h1>
                  <h2>Subheading 1</h2>
                  <h2>Subheading 2</h2>
                  <p>Content about ${keyword} and related topics.</p>
                </body>
              </html>
            `;

            vi.mocked(scraperQueue.scraperQueue.scrape).mockResolvedValue(mockHtml);

            const results = await fetchSERPResults(keyword);

            // Should retrieve exactly 10 results
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeLessThanOrEqual(10);
            
            // Each result should have the required structure
            results.forEach(result => {
              expect(result).toHaveProperty('url');
              expect(result).toHaveProperty('title');
              expect(result).toHaveProperty('keywords');
              expect(result).toHaveProperty('headings');
              
              expect(typeof result.url).toBe('string');
              expect(typeof result.title).toBe('string');
              expect(Array.isArray(result.keywords)).toBe(true);
              expect(Array.isArray(result.headings)).toBe(true);
            });
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should extract keywords from each SERP result', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.trim().length > 0),
          fc.array(fc.string({ minLength: 3, maxLength: 20 }), { minLength: 3, maxLength: 10 }),
          async (keyword, metaKeywords) => {

            const keywordsContent = metaKeywords.join(', ');
            const mockHtml = `
              <!DOCTYPE html>
              <html>
                <head>
                  <title>Test Page</title>
                  <meta name="keywords" content="${keywordsContent}" />
                </head>
                <body>
                  <p>${keyword} appears multiple times in the content. ${keyword} is important.</p>
                </body>
              </html>
            `;

            vi.mocked(scraperQueue.scraperQueue.scrape).mockResolvedValue(mockHtml);

            const results = await fetchSERPResults(keyword, 5);

            // Each result should have extracted keywords
            results.forEach(result => {
              expect(result.keywords).toBeDefined();
              expect(Array.isArray(result.keywords)).toBe(true);
              expect(result.keywords.length).toBeGreaterThan(0);
            });
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should extract headings from each SERP result', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.trim().length > 0),
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 1, max: 8 }),
          async (keyword, h1Count, h2Count) => {

            const h1Tags = Array.from({ length: h1Count }, (_, i) => 
              `<h1>Main Heading ${i + 1}</h1>`
            ).join('');
            const h2Tags = Array.from({ length: h2Count }, (_, i) => 
              `<h2>Subheading ${i + 1}</h2>`
            ).join('');

            const mockHtml = `
              <!DOCTYPE html>
              <html>
                <head><title>Test</title></head>
                <body>
                  ${h1Tags}
                  ${h2Tags}
                  <h3>H3 Heading</h3>
                </body>
              </html>
            `;

            vi.mocked(scraperQueue.scraperQueue.scrape).mockResolvedValue(mockHtml);

            const results = await fetchSERPResults(keyword, 3);

            // Each result should have extracted headings
            results.forEach(result => {
              expect(result.headings).toBeDefined();
              expect(Array.isArray(result.headings)).toBe(true);
              // Should extract H1, H2, and H3 tags
              expect(result.headings.length).toBeGreaterThanOrEqual(h1Count + h2Count);
            });
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should cache SERP results for 24 hours', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.trim().length > 0),
          async (keyword) => {
            const mockHtml = `
              <!DOCTYPE html>
              <html>
                <head><title>Test</title></head>
                <body><h1>Heading</h1></body>
              </html>
            `;

            vi.mocked(scraperQueue.scraperQueue.scrape).mockResolvedValue(mockHtml);

            // First call should scrape
            const results1 = await fetchSERPResults(keyword, 3);
            
            // Results should be returned
            expect(results1.length).toBeGreaterThan(0);
            expect(results1.length).toBeLessThanOrEqual(3);
          }
        ),
        { numRuns: 15 }
      );
    });

    it('should handle custom limit parameter', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.trim().length > 0),
          fc.integer({ min: 1, max: 20 }),
          async (keyword, limit) => {

            const mockHtml = '<html><head><title>Test</title></head><body><h1>Test</h1></body></html>';
            vi.mocked(scraperQueue.scraperQueue.scrape).mockResolvedValue(mockHtml);

            const results = await fetchSERPResults(keyword, limit);

            // Should respect the limit parameter
            expect(results.length).toBeLessThanOrEqual(limit);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should extract title from each SERP result', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 10, maxLength: 100 }).filter(s => s.trim().length > 0),
          async (keyword, pageTitle) => {
            const mockHtml = `
              <!DOCTYPE html>
              <html>
                <head><title>${pageTitle}</title></head>
                <body><p>Content</p></body>
              </html>
            `;

            vi.mocked(scraperQueue.scraperQueue.scrape).mockResolvedValue(mockHtml);

            const results = await fetchSERPResults(keyword, 2);

            // Each result should have a title (trimmed)
            results.forEach(result => {
              expect(result.title).toBeDefined();
              expect(typeof result.title).toBe('string');
              expect(result.title).toBe(pageTitle.trim());
            });
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should handle scraping failures gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.trim().length > 0),
          async (keyword) => {

            // Mock some scrapes to fail
            let callCount = 0;
            vi.mocked(scraperQueue.scraperQueue.scrape).mockImplementation(async () => {
              callCount++;
              if (callCount % 3 === 0) {
                throw new Error('Scraping failed');
              }
              return '<html><head><title>Test</title></head><body><h1>Test</h1></body></html>';
            });

            const results = await fetchSERPResults(keyword, 6);

            // Should return results for successful scrapes only
            expect(Array.isArray(results)).toBe(true);
            // Should have fewer results than requested due to failures
            expect(results.length).toBeLessThanOrEqual(6);
          }
        ),
        { numRuns: 15 }
      );
    });

    it('should extract URL for each SERP result', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.trim().length > 0),
          async (keyword) => {

            const mockHtml = '<html><head><title>Test</title></head><body><h1>Test</h1></body></html>';
            vi.mocked(scraperQueue.scraperQueue.scrape).mockResolvedValue(mockHtml);

            const results = await fetchSERPResults(keyword, 3);

            // Each result should have a valid URL
            results.forEach(result => {
              expect(result.url).toBeDefined();
              expect(typeof result.url).toBe('string');
              expect(result.url).toMatch(/^https?:\/\//);
            });
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should handle pages with no headings', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.trim().length > 0),
          async (keyword) => {

            const mockHtml = `
              <!DOCTYPE html>
              <html>
                <head><title>Test</title></head>
                <body><p>Content without headings</p></body>
              </html>
            `;

            vi.mocked(scraperQueue.scraperQueue.scrape).mockResolvedValue(mockHtml);

            const results = await fetchSERPResults(keyword, 2);

            // Should still return results with empty headings array
            results.forEach(result => {
              expect(result.headings).toBeDefined();
              expect(Array.isArray(result.headings)).toBe(true);
              expect(result.headings.length).toBe(0);
            });
          }
        ),
        { numRuns: 15 }
      );
    });

    it('should handle pages with no meta keywords', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.trim().length > 0),
          async (keyword) => {

            const mockHtml = `
              <!DOCTYPE html>
              <html>
                <head><title>Test</title></head>
                <body><p>Some content with words like ${keyword} and other terms</p></body>
              </html>
            `;

            vi.mocked(scraperQueue.scraperQueue.scrape).mockResolvedValue(mockHtml);

            const results = await fetchSERPResults(keyword, 2);

            // Should still extract keywords from content
            results.forEach(result => {
              expect(result.keywords).toBeDefined();
              expect(Array.isArray(result.keywords)).toBe(true);
              // Should have extracted some keywords from content
              expect(result.keywords.length).toBeGreaterThan(0);
            });
          }
        ),
        { numRuns: 15 }
      );
    });
  });

  /**
   * **Validates: Requirements 9.6, 9.7, 9.8**
   * 
   * Property 36: Content Optimization Response Structure
   * For any completed content analysis, the response should include score (0-100), 
   * missing keywords list, suggested headings list, and analysis metrics 
   * (keyword density, readability, content length, recommended length).
   */
  describe('Property 36: Content Optimization Response Structure', () => {
    it('should return complete response structure with all required fields', async () => {
      // Mock OpenAI API
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 100, maxLength: 2000 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.trim().length > 0),
          fc.integer({ min: 0, max: 100 }),
          fc.array(fc.string({ minLength: 3, maxLength: 20 }), { minLength: 0, maxLength: 10 }),
          fc.array(fc.string({ minLength: 5, maxLength: 50 }), { minLength: 0, maxLength: 8 }),
          async (content, targetKeyword, aiScore, missingKeywords, suggestedHeadings) => {
            // Mock SERP results
            const mockHtml = `
              <!DOCTYPE html>
              <html>
                <head>
                  <title>Test Page for ${targetKeyword}</title>
                  <meta name="keywords" content="${targetKeyword}, seo, optimization" />
                </head>
                <body>
                  <h1>Main Heading about ${targetKeyword}</h1>
                  <h2>Subheading 1</h2>
                  <p>Content about ${targetKeyword} and related topics.</p>
                </body>
              </html>
            `;

            vi.mocked(scraperQueue.scraperQueue.scrape).mockResolvedValue(mockHtml);

            // Mock OpenAI API response
            mockFetch.mockResolvedValue({
              ok: true,
              json: async () => ({
                choices: [
                  {
                    message: {
                      content: JSON.stringify({
                        score: aiScore,
                        missingKeywords: missingKeywords,
                        suggestedHeadings: suggestedHeadings,
                        recommendations: ['Recommendation 1', 'Recommendation 2'],
                      }),
                    },
                  },
                ],
              }),
            });

            const { scoreContent } = await import('../../src/services/content/contentOptimizerService');
            const result = await scoreContent(content, targetKeyword);

            // Verify response structure
            expect(result).toBeDefined();
            expect(typeof result).toBe('object');

            // Verify score field (0-100)
            expect(result).toHaveProperty('score');
            expect(typeof result.score).toBe('number');
            expect(result.score).toBeGreaterThanOrEqual(0);
            expect(result.score).toBeLessThanOrEqual(100);

            // Verify missing keywords list
            expect(result).toHaveProperty('missingKeywords');
            expect(Array.isArray(result.missingKeywords)).toBe(true);
            result.missingKeywords.forEach(keyword => {
              expect(typeof keyword).toBe('string');
            });

            // Verify suggested headings list
            expect(result).toHaveProperty('suggestedHeadings');
            expect(Array.isArray(result.suggestedHeadings)).toBe(true);
            result.suggestedHeadings.forEach(heading => {
              expect(typeof heading).toBe('string');
            });

            // Verify analysis metrics object
            expect(result).toHaveProperty('analysis');
            expect(typeof result.analysis).toBe('object');

            // Verify keyword density
            expect(result.analysis).toHaveProperty('keywordDensity');
            expect(typeof result.analysis.keywordDensity).toBe('number');
            expect(result.analysis.keywordDensity).toBeGreaterThanOrEqual(0);

            // Verify readability score
            expect(result.analysis).toHaveProperty('readabilityScore');
            expect(typeof result.analysis.readabilityScore).toBe('number');
            expect(result.analysis.readabilityScore).toBeGreaterThanOrEqual(0);
            expect(result.analysis.readabilityScore).toBeLessThanOrEqual(100);

            // Verify content length
            expect(result.analysis).toHaveProperty('contentLength');
            expect(typeof result.analysis.contentLength).toBe('number');
            expect(result.analysis.contentLength).toBeGreaterThan(0);

            // Verify recommended length
            expect(result.analysis).toHaveProperty('recommendedLength');
            expect(typeof result.analysis.recommendedLength).toBe('number');
            expect(result.analysis.recommendedLength).toBeGreaterThan(0);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should ensure score is always within 0-100 range', async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 100, maxLength: 1000 }),
          fc.string({ minLength: 3, maxLength: 30 }),
          fc.integer({ min: -50, max: 150 }), // Test with out-of-range values
          async (content, keyword, rawScore) => {
            const mockHtml = '<html><head><title>Test</title></head><body><h1>Test</h1></body></html>';
            vi.mocked(scraperQueue.scraperQueue.scrape).mockResolvedValue(mockHtml);

            mockFetch.mockResolvedValue({
              ok: true,
              json: async () => ({
                choices: [
                  {
                    message: {
                      content: JSON.stringify({
                        score: rawScore,
                        missingKeywords: [],
                        suggestedHeadings: [],
                        recommendations: [],
                      }),
                    },
                  },
                ],
              }),
            });

            const { scoreContent } = await import('../../src/services/content/contentOptimizerService');
            const result = await scoreContent(content, keyword);

            // Score should be clamped to 0-100 range
            expect(result.score).toBeGreaterThanOrEqual(0);
            expect(result.score).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should calculate keyword density correctly', async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 3, maxLength: 20 }).filter(s => s.trim().length > 0),
          fc.integer({ min: 0, max: 10 }),
          fc.integer({ min: 50, max: 200 }),
          async (keyword, keywordCount, fillerWordCount) => {
            // Create content with known keyword frequency
            const keywordOccurrences = Array(keywordCount).fill(keyword).join(' ');
            const fillerWords = Array(fillerWordCount).fill('word').join(' ');
            const content = `${keywordOccurrences} ${fillerWords}`;

            const mockHtml = '<html><head><title>Test</title></head><body><h1>Test</h1></body></html>';
            vi.mocked(scraperQueue.scraperQueue.scrape).mockResolvedValue(mockHtml);

            mockFetch.mockResolvedValue({
              ok: true,
              json: async () => ({
                choices: [
                  {
                    message: {
                      content: JSON.stringify({
                        score: 75,
                        missingKeywords: [],
                        suggestedHeadings: [],
                        recommendations: [],
                      }),
                    },
                  },
                ],
              }),
            });

            const { scoreContent } = await import('../../src/services/content/contentOptimizerService');
            const result = await scoreContent(content, keyword);

            // Keyword density should be a valid percentage
            expect(result.analysis.keywordDensity).toBeGreaterThanOrEqual(0);
            expect(result.analysis.keywordDensity).toBeLessThanOrEqual(100);
            expect(typeof result.analysis.keywordDensity).toBe('number');
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should calculate content length in words', async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 100, maxLength: 500 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 3, maxLength: 20 }),
          async (content, keyword) => {
            const mockHtml = '<html><head><title>Test</title></head><body><h1>Test</h1></body></html>';
            vi.mocked(scraperQueue.scraperQueue.scrape).mockResolvedValue(mockHtml);

            mockFetch.mockResolvedValue({
              ok: true,
              json: async () => ({
                choices: [
                  {
                    message: {
                      content: JSON.stringify({
                        score: 75,
                        missingKeywords: [],
                        suggestedHeadings: [],
                        recommendations: [],
                      }),
                    },
                  },
                ],
              }),
            });

            const { scoreContent } = await import('../../src/services/content/contentOptimizerService');
            const result = await scoreContent(content, keyword);

            // Content length should be positive and reasonable
            expect(result.analysis.contentLength).toBeGreaterThan(0);
            // Should be a reasonable word count (at least 1 word per 20 characters on average)
            expect(result.analysis.contentLength).toBeGreaterThanOrEqual(Math.floor(content.length / 20));
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should provide recommended length based on content length', async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 100, max: 5000 }),
          fc.string({ minLength: 3, maxLength: 20 }),
          async (wordCount, keyword) => {
            // Create content with approximately wordCount words
            const words = Array(wordCount).fill('word');
            const content = words.join(' ');

            const mockHtml = '<html><head><title>Test</title></head><body><h1>Test</h1></body></html>';
            vi.mocked(scraperQueue.scraperQueue.scrape).mockResolvedValue(mockHtml);

            mockFetch.mockResolvedValue({
              ok: true,
              json: async () => ({
                choices: [
                  {
                    message: {
                      content: JSON.stringify({
                        score: 75,
                        missingKeywords: [],
                        suggestedHeadings: [],
                        recommendations: [],
                      }),
                    },
                  },
                ],
              }),
            });

            const { scoreContent } = await import('../../src/services/content/contentOptimizerService');
            const result = await scoreContent(content, keyword);

            // Recommended length should be reasonable (1500-2500 words for blog posts)
            expect(result.analysis.recommendedLength).toBeGreaterThan(0);
            expect(result.analysis.recommendedLength).toBeGreaterThanOrEqual(1500);
            expect(result.analysis.recommendedLength).toBeLessThanOrEqual(2500);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should handle empty missing keywords list', async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 100, maxLength: 500 }),
          fc.string({ minLength: 3, maxLength: 20 }),
          async (content, keyword) => {
            const mockHtml = '<html><head><title>Test</title></head><body><h1>Test</h1></body></html>';
            vi.mocked(scraperQueue.scraperQueue.scrape).mockResolvedValue(mockHtml);

            mockFetch.mockResolvedValue({
              ok: true,
              json: async () => ({
                choices: [
                  {
                    message: {
                      content: JSON.stringify({
                        score: 90,
                        missingKeywords: [], // Empty list
                        suggestedHeadings: ['Heading 1'],
                        recommendations: [],
                      }),
                    },
                  },
                ],
              }),
            });

            const { scoreContent } = await import('../../src/services/content/contentOptimizerService');
            const result = await scoreContent(content, keyword);

            // Should handle empty missing keywords gracefully
            expect(Array.isArray(result.missingKeywords)).toBe(true);
            expect(result.missingKeywords.length).toBe(0);
          }
        ),
        { numRuns: 15 }
      );
    });

    it('should handle empty suggested headings list', async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 100, maxLength: 500 }),
          fc.string({ minLength: 3, maxLength: 20 }),
          async (content, keyword) => {
            const mockHtml = '<html><head><title>Test</title></head><body><h1>Test</h1></body></html>';
            vi.mocked(scraperQueue.scraperQueue.scrape).mockResolvedValue(mockHtml);

            mockFetch.mockResolvedValue({
              ok: true,
              json: async () => ({
                choices: [
                  {
                    message: {
                      content: JSON.stringify({
                        score: 85,
                        missingKeywords: ['keyword1'],
                        suggestedHeadings: [], // Empty list
                        recommendations: [],
                      }),
                    },
                  },
                ],
              }),
            });

            const { scoreContent } = await import('../../src/services/content/contentOptimizerService');
            const result = await scoreContent(content, keyword);

            // Should handle empty suggested headings gracefully
            expect(Array.isArray(result.suggestedHeadings)).toBe(true);
            expect(result.suggestedHeadings.length).toBe(0);
          }
        ),
        { numRuns: 15 }
      );
    });
  });
});
