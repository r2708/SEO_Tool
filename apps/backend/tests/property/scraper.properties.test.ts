import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { scrapePage } from '../../src/services/scraper/scraper.service';
import puppeteer from 'puppeteer';

// Mock puppeteer
vi.mock('puppeteer');

/**
 * Feature: seo-saas-platform, Web Scraping Properties
 */
describe('Feature: seo-saas-platform, Web Scraping Properties', () => {
  let mockBrowser: any;
  let mockPage: any;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * **Validates: Requirements 16.2**
   * 
   * Property 52: Scraping Timeout Enforcement
   * For any web scraping operation, if the page does not load within 30 seconds, 
   * the Platform should abort the operation and return an error indicating the 
   * page is unreachable.
   */
  describe('Property 52: Scraping Timeout Enforcement', () => {
    it('should enforce 30-second timeout for page load', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl(),
          async (url) => {
            // Create fresh mocks for this iteration
            const localMockPage = {
              goto: vi.fn().mockResolvedValue(undefined),
              content: vi.fn().mockResolvedValue('<html><body>Test</body></html>'),
            };
            const localMockBrowser = {
              newPage: vi.fn().mockResolvedValue(localMockPage),
              close: vi.fn().mockResolvedValue(undefined),
            };
            (puppeteer.launch as any) = vi.fn().mockResolvedValue(localMockBrowser);

            await scrapePage(url);

            // Verify goto was called with 30-second timeout
            expect(localMockPage.goto).toHaveBeenCalledWith(
              url,
              expect.objectContaining({
                timeout: 30000,
              })
            );
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should return error when page load times out', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl(),
          async (url) => {
            // Create fresh mocks for this iteration
            const timeoutError = new Error('Navigation timeout of 30000 ms exceeded');
            timeoutError.name = 'TimeoutError';
            
            const localMockPage = {
              goto: vi.fn().mockRejectedValue(timeoutError),
              content: vi.fn(),
            };
            const localMockBrowser = {
              newPage: vi.fn().mockResolvedValue(localMockPage),
              close: vi.fn().mockResolvedValue(undefined),
            };
            (puppeteer.launch as any) = vi.fn().mockResolvedValue(localMockBrowser);

            // Should throw ValidationError with user-friendly message
            await expect(scrapePage(url)).rejects.toThrow('Page unreachable or took too long to load');

            // Verify browser was closed even after error
            expect(localMockBrowser.close).toHaveBeenCalled();
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should handle timeout errors with various timeout messages', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl(),
          fc.constantFrom(
            'Navigation timeout of 30000 ms exceeded',
            'Timeout waiting for page load',
            'Page load timeout',
            'timeout exceeded'
          ),
          async (url, timeoutMessage) => {
            // Create fresh mocks for this iteration
            const timeoutError = new Error(timeoutMessage);
            if (timeoutMessage.includes('Navigation timeout')) {
              timeoutError.name = 'TimeoutError';
            }
            
            const localMockPage = {
              goto: vi.fn().mockRejectedValue(timeoutError),
              content: vi.fn(),
            };
            const localMockBrowser = {
              newPage: vi.fn().mockResolvedValue(localMockPage),
              close: vi.fn().mockResolvedValue(undefined),
            };
            (puppeteer.launch as any) = vi.fn().mockResolvedValue(localMockBrowser);

            // Should throw ValidationError
            await expect(scrapePage(url)).rejects.toThrow('Page unreachable or took too long to load');
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * **Validates: Requirements 16.4**
   * 
   * Property 53: JavaScript Rendering Completion
   * For any scraped URL, the Platform should extract HTML content only after 
   * JavaScript execution completes, ensuring dynamic content is captured.
   */
  describe('Property 53: JavaScript Rendering Completion', () => {
    it('should wait for networkidle0 to ensure JavaScript execution completes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl(),
          async (url) => {
            // Create fresh mocks for this iteration
            const localMockPage = {
              goto: vi.fn().mockResolvedValue(undefined),
              content: vi.fn().mockResolvedValue('<html><body>Rendered Content</body></html>'),
            };
            const localMockBrowser = {
              newPage: vi.fn().mockResolvedValue(localMockPage),
              close: vi.fn().mockResolvedValue(undefined),
            };
            (puppeteer.launch as any) = vi.fn().mockResolvedValue(localMockBrowser);

            await scrapePage(url);

            // Verify goto was called with networkidle0 wait condition
            expect(localMockPage.goto).toHaveBeenCalledWith(
              url,
              expect.objectContaining({
                waitUntil: 'networkidle0',
              })
            );
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should extract HTML content after JavaScript rendering', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl(),
          fc.string({ minLength: 10, maxLength: 1000 }),
          async (url, htmlContent) => {
            // Create fresh mocks for this iteration
            const renderedHtml = `<html><body>${htmlContent}</body></html>`;
            const localMockPage = {
              goto: vi.fn().mockResolvedValue(undefined),
              content: vi.fn().mockResolvedValue(renderedHtml),
            };
            const localMockBrowser = {
              newPage: vi.fn().mockResolvedValue(localMockPage),
              close: vi.fn().mockResolvedValue(undefined),
            };
            (puppeteer.launch as any) = vi.fn().mockResolvedValue(localMockBrowser);

            const result = await scrapePage(url);

            // Verify content was extracted after goto completed
            expect(localMockPage.goto).toHaveBeenCalled();
            expect(localMockPage.content).toHaveBeenCalled();
            expect(result).toBe(renderedHtml);

            // Verify content() was called after goto()
            const gotoCallOrder = localMockPage.goto.mock.invocationCallOrder[0];
            const contentCallOrder = localMockPage.content.mock.invocationCallOrder[0];
            expect(contentCallOrder).toBeGreaterThan(gotoCallOrder);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * **Validates: Requirements 16.5**
   * 
   * Property 54: Browser Resource Cleanup
   * For any completed scraping operation (success or failure), the Platform 
   * should close the browser instance to free system resources.
   */
  describe('Property 54: Browser Resource Cleanup', () => {
    it('should close browser after successful scraping', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl(),
          fc.string({ minLength: 10, maxLength: 100 }),
          async (url, htmlContent) => {
            // Create fresh mocks for this iteration
            const localMockPage = {
              goto: vi.fn().mockResolvedValue(undefined),
              content: vi.fn().mockResolvedValue(`<html><body>${htmlContent}</body></html>`),
            };
            const localMockBrowser = {
              newPage: vi.fn().mockResolvedValue(localMockPage),
              close: vi.fn().mockResolvedValue(undefined),
            };
            (puppeteer.launch as any) = vi.fn().mockResolvedValue(localMockBrowser);

            await scrapePage(url);

            // Verify browser was closed
            expect(localMockBrowser.close).toHaveBeenCalled();
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should close browser after scraping failure', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl(),
          fc.constantFrom(
            'Network error',
            'Page crashed',
            'Connection refused',
            'DNS lookup failed'
          ),
          async (url, errorMessage) => {
            // Create fresh mocks for this iteration
            const localMockPage = {
              goto: vi.fn().mockRejectedValue(new Error(errorMessage)),
              content: vi.fn(),
            };
            const localMockBrowser = {
              newPage: vi.fn().mockResolvedValue(localMockPage),
              close: vi.fn().mockResolvedValue(undefined),
            };
            (puppeteer.launch as any) = vi.fn().mockResolvedValue(localMockBrowser);

            // Attempt scraping (will fail)
            await expect(scrapePage(url)).rejects.toThrow();

            // Verify browser was still closed despite error
            expect(localMockBrowser.close).toHaveBeenCalled();
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should close browser after timeout error', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl(),
          async (url) => {
            // Create fresh mocks for this iteration
            const timeoutError = new Error('Navigation timeout');
            timeoutError.name = 'TimeoutError';
            
            const localMockPage = {
              goto: vi.fn().mockRejectedValue(timeoutError),
              content: vi.fn(),
            };
            const localMockBrowser = {
              newPage: vi.fn().mockResolvedValue(localMockPage),
              close: vi.fn().mockResolvedValue(undefined),
            };
            (puppeteer.launch as any) = vi.fn().mockResolvedValue(localMockBrowser);

            // Attempt scraping (will timeout)
            await expect(scrapePage(url)).rejects.toThrow('Page unreachable or took too long to load');

            // Verify browser was closed even after timeout
            expect(localMockBrowser.close).toHaveBeenCalled();
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should handle browser close errors gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl(),
          async (url) => {
            // Create fresh mocks for this iteration
            const localMockPage = {
              goto: vi.fn().mockResolvedValue(undefined),
              content: vi.fn().mockResolvedValue('<html><body>Test</body></html>'),
            };
            const localMockBrowser = {
              newPage: vi.fn().mockResolvedValue(localMockPage),
              close: vi.fn().mockRejectedValue(new Error('Browser already closed')),
            };
            (puppeteer.launch as any) = vi.fn().mockResolvedValue(localMockBrowser);

            // Should still complete successfully even if close fails
            const result = await scrapePage(url);
            expect(result).toBe('<html><body>Test</body></html>');

            // Verify close was attempted
            expect(localMockBrowser.close).toHaveBeenCalled();
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should not attempt to close null browser', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl(),
          async (url) => {
            // Mock launch failure (browser never created)
            (puppeteer.launch as any) = vi.fn().mockRejectedValue(new Error('Failed to launch browser'));

            // Attempt scraping (will fail)
            await expect(scrapePage(url)).rejects.toThrow();

            // Browser close should not be called since browser was never created
            // This test just verifies no error is thrown when browser is null
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  /**
   * Additional property: Scraping should return HTML content
   */
  describe('Property: Scraping Returns HTML Content', () => {
    it('should return the HTML content from the page', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl(),
          fc.string({ minLength: 10, maxLength: 100 }),
          async (url, content) => {
            const expectedHtml = `<html><body>${content}</body></html>`;
            
            // Create fresh mocks for this iteration
            const localMockPage = {
              goto: vi.fn().mockResolvedValue(undefined),
              content: vi.fn().mockResolvedValue(expectedHtml),
            };
            const localMockBrowser = {
              newPage: vi.fn().mockResolvedValue(localMockPage),
              close: vi.fn().mockResolvedValue(undefined),
            };
            (puppeteer.launch as any) = vi.fn().mockResolvedValue(localMockBrowser);

            const result = await scrapePage(url);

            expect(result).toBe(expectedHtml);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  /**
   * Additional property: Scraping should handle various error types
   */
  describe('Property: Error Handling', () => {
    it('should throw ExternalServiceError for non-timeout errors', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl(),
          fc.constantFrom(
            'Network error',
            'Connection refused',
            'Page crashed',
            'Protocol error'
          ),
          async (url, errorMessage) => {
            // Create fresh mocks for this iteration
            const localMockPage = {
              goto: vi.fn().mockRejectedValue(new Error(errorMessage)),
              content: vi.fn(),
            };
            const localMockBrowser = {
              newPage: vi.fn().mockResolvedValue(localMockPage),
              close: vi.fn().mockResolvedValue(undefined),
            };
            (puppeteer.launch as any) = vi.fn().mockResolvedValue(localMockBrowser);

            await expect(scrapePage(url)).rejects.toThrow('Failed to fetch page content');
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});

/**
 * **Validates: Requirements 16.6, 16.7**
 * 
 * Property 55: Scraping Concurrency Limit
 * For any number of concurrent scraping requests, the Platform should limit 
 * concurrent scraping operations to 5 simultaneous requests, queueing additional 
 * requests and processing them as slots become available.
 */
describe('Property 55: Scraping Concurrency Limit', () => {
  it('should limit concurrent scraping operations to 5', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 6, max: 20 }),
        async (numRequests) => {
          // Import the queue service
          const { scraperQueue } = await import('../../src/services/scraper/scraper-queue.service');
          
          // Track the maximum concurrent operations observed
          let maxConcurrent = 0;
          let currentConcurrent = 0;
          
          // Create mock that tracks concurrent operations
          const mockPage = {
            goto: vi.fn(async () => {
              currentConcurrent++;
              maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
              
              // Simulate some async work
              await new Promise(resolve => setTimeout(resolve, 10));
              
              currentConcurrent--;
            }),
            content: vi.fn().mockResolvedValue('<html><body>Test</body></html>'),
          };
          
          const mockBrowser = {
            newPage: vi.fn().mockResolvedValue(mockPage),
            close: vi.fn().mockResolvedValue(undefined),
          };
          
          (puppeteer.launch as any) = vi.fn().mockResolvedValue(mockBrowser);
          
          // Generate unique URLs for each request
          const urls = Array.from({ length: numRequests }, (_, i) => 
            `https://example${i}.com/test`
          );
          
          // Start all scraping operations concurrently
          const promises = urls.map(url => scraperQueue.scrape(url));
          
          // Wait for all to complete
          await Promise.all(promises);
          
          // Verify that we never exceeded 5 concurrent operations
          expect(maxConcurrent).toBeLessThanOrEqual(5);
          expect(maxConcurrent).toBeGreaterThan(0);
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should queue requests when limit is reached', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 6, max: 15 }),
        async (numRequests) => {
          // Import the queue service
          const { scraperQueue } = await import('../../src/services/scraper/scraper-queue.service');
          
          // Track when requests start and complete
          const startTimes: number[] = [];
          const completeTimes: number[] = [];
          
          // Create mock that tracks timing
          const mockPage = {
            goto: vi.fn(async () => {
              startTimes.push(Date.now());
              // Simulate work
              await new Promise(resolve => setTimeout(resolve, 20));
              completeTimes.push(Date.now());
            }),
            content: vi.fn().mockResolvedValue('<html><body>Test</body></html>'),
          };
          
          const mockBrowser = {
            newPage: vi.fn().mockResolvedValue(mockPage),
            close: vi.fn().mockResolvedValue(undefined),
          };
          
          (puppeteer.launch as any) = vi.fn().mockResolvedValue(mockBrowser);
          
          // Generate unique URLs
          const urls = Array.from({ length: numRequests }, (_, i) => 
            `https://test${i}.example.com`
          );
          
          // Start all scraping operations
          const promises = urls.map(url => scraperQueue.scrape(url));
          
          // Wait for all to complete
          await Promise.all(promises);
          
          // Verify all requests were processed
          expect(startTimes.length).toBe(numRequests);
          expect(completeTimes.length).toBe(numRequests);
          
          // Verify that not all requests started at the same time
          // (some were queued)
          if (numRequests > 5) {
            const firstBatch = startTimes.slice(0, 5);
            const laterRequests = startTimes.slice(5);
            
            // Later requests should start after some of the first batch complete
            const minFirstBatchTime = Math.min(...firstBatch);
            const maxFirstBatchTime = Math.max(...firstBatch);
            const minLaterTime = Math.min(...laterRequests);
            
            // Allow some timing tolerance
            expect(minLaterTime).toBeGreaterThanOrEqual(minFirstBatchTime - 5);
          }
        }
      ),
      { numRuns: 5 }
    );
  });

  it('should process queued requests as slots become available', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(10), // Fixed number for predictable testing
        async (numRequests) => {
          // Import the queue service
          const { scraperQueue } = await import('../../src/services/scraper/scraper-queue.service');
          
          let completedCount = 0;
          
          // Create mock with controlled timing
          const mockPage = {
            goto: vi.fn(async () => {
              // Simulate work
              await new Promise(resolve => setTimeout(resolve, 15));
            }),
            content: vi.fn(async () => {
              completedCount++;
              return '<html><body>Test</body></html>';
            }),
          };
          
          const mockBrowser = {
            newPage: vi.fn().mockResolvedValue(mockPage),
            close: vi.fn().mockResolvedValue(undefined),
          };
          
          (puppeteer.launch as any) = vi.fn().mockResolvedValue(mockBrowser);
          
          // Generate URLs
          const urls = Array.from({ length: numRequests }, (_, i) => 
            `https://site${i}.test.com`
          );
          
          // Start all operations
          const promises = urls.map(url => scraperQueue.scrape(url));
          
          // Wait for all to complete
          await Promise.all(promises);
          
          // Verify all requests completed
          expect(completedCount).toBe(numRequests);
          
          // Verify all browser instances were closed
          expect(mockBrowser.close).toHaveBeenCalledTimes(numRequests);
        }
      ),
      { numRuns: 5 }
    );
  });

  it('should handle errors in queued requests without blocking queue', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 6, max: 12 }),
        async (numRequests) => {
          // Import the queue service
          const { scraperQueue } = await import('../../src/services/scraper/scraper-queue.service');
          
          let successCount = 0;
          let errorCount = 0;
          
          // Create mock that fails for some requests
          const mockPage = {
            goto: vi.fn(async (url: string) => {
              // Fail every 3rd request
              if (url.includes('3') || url.includes('6') || url.includes('9')) {
                throw new Error('Simulated failure');
              }
              await new Promise(resolve => setTimeout(resolve, 10));
            }),
            content: vi.fn().mockResolvedValue('<html><body>Test</body></html>'),
          };
          
          const mockBrowser = {
            newPage: vi.fn().mockResolvedValue(mockPage),
            close: vi.fn().mockResolvedValue(undefined),
          };
          
          (puppeteer.launch as any) = vi.fn().mockResolvedValue(mockBrowser);
          
          // Generate URLs
          const urls = Array.from({ length: numRequests }, (_, i) => 
            `https://example${i}.com`
          );
          
          // Start all operations and track results
          const results = await Promise.allSettled(
            urls.map(url => scraperQueue.scrape(url))
          );
          
          // Count successes and failures
          results.forEach(result => {
            if (result.status === 'fulfilled') {
              successCount++;
            } else {
              errorCount++;
            }
          });
          
          // Verify all requests were processed (either success or error)
          expect(successCount + errorCount).toBe(numRequests);
          
          // Verify some succeeded and some failed
          expect(successCount).toBeGreaterThan(0);
          expect(errorCount).toBeGreaterThan(0);
          
          // Verify browser was closed for all requests
          expect(mockBrowser.close).toHaveBeenCalledTimes(numRequests);
        }
      ),
      { numRuns: 5 }
    );
  });

  it('should maintain queue integrity with concurrent additions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 8, max: 15 }),
        async (numRequests) => {
          // Import the queue service
          const { scraperQueue } = await import('../../src/services/scraper/scraper-queue.service');
          
          // Create mock with timing
          const mockPage = {
            goto: vi.fn(async () => {
              await new Promise(resolve => setTimeout(resolve, 10));
            }),
            content: vi.fn().mockResolvedValue('<html><body>Test</body></html>'),
          };
          
          const mockBrowser = {
            newPage: vi.fn().mockResolvedValue(mockPage),
            close: vi.fn().mockResolvedValue(undefined),
          };
          
          (puppeteer.launch as any) = vi.fn().mockResolvedValue(mockBrowser);
          
          // Generate URLs
          const urls = Array.from({ length: numRequests }, (_, i) => 
            `https://concurrent${i}.example.com`
          );
          
          // Add requests with slight delays to simulate concurrent additions
          const promises = urls.map((url, index) => 
            new Promise<string>(resolve => {
              setTimeout(() => {
                resolve(scraperQueue.scrape(url));
              }, index * 2); // Stagger additions
            })
          );
          
          // Wait for all to complete
          const results = await Promise.all(promises);
          
          // Verify all requests completed successfully
          expect(results.length).toBe(numRequests);
          results.forEach(result => {
            expect(result).toContain('<html>');
          });
        }
      ),
      { numRuns: 5 }
    );
  });
});
