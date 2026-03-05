import { scrapePage } from './scraper.service';
import { logger } from '../../utils/logger';

interface QueuedRequest {
  url: string;
  resolve: (value: string) => void;
  reject: (error: Error) => void;
}

/**
 * Manages a queue of scraping requests with concurrency control
 * Limits concurrent scraping operations to 5 simultaneous requests
 */
class ScraperQueue {
  private queue: QueuedRequest[] = [];
  private activeCount: number = 0;
  private readonly maxConcurrent: number = 5;

  /**
   * Add a scraping request to the queue
   * @param url - The URL to scrape
   * @returns Promise that resolves with the scraped HTML content
   */
  async scrape(url: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      // Add request to queue
      this.queue.push({ url, resolve, reject });
      logger.debug(`Added URL to scraping queue: ${url}. Queue size: ${this.queue.length}`);
      
      // Try to process the queue
      this.processQueue();
    });
  }

  /**
   * Process queued requests up to the concurrency limit
   */
  private processQueue(): void {
    // Process requests while we have capacity and items in queue
    while (this.activeCount < this.maxConcurrent && this.queue.length > 0) {
      const request = this.queue.shift();
      if (request) {
        this.executeRequest(request);
      }
    }
  }

  /**
   * Execute a single scraping request
   * @param request - The queued request to execute
   */
  private async executeRequest(request: QueuedRequest): Promise<void> {
    this.activeCount++;
    logger.debug(`Executing scraping request for ${request.url}. Active: ${this.activeCount}/${this.maxConcurrent}`);

    try {
      const html = await scrapePage(request.url);
      request.resolve(html);
    } catch (error) {
      request.reject(error as Error);
    } finally {
      this.activeCount--;
      logger.debug(`Completed scraping request. Active: ${this.activeCount}/${this.maxConcurrent}, Queue: ${this.queue.length}`);
      
      // Process next item in queue if available
      this.processQueue();
    }
  }

  /**
   * Get the current number of active scraping operations
   * @returns The number of active operations
   */
  getActiveCount(): number {
    return this.activeCount;
  }

  /**
   * Get the current queue size
   * @returns The number of queued requests
   */
  getQueueSize(): number {
    return this.queue.length;
  }
}

// Export singleton instance
export const scraperQueue = new ScraperQueue();
