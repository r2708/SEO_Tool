import puppeteer, { Browser } from 'puppeteer';
import axios from 'axios';
import { ValidationError, ExternalServiceError } from '../../errors';
import { logger } from '../../utils/logger';

/**
 * Fallback HTTP scraper when Puppeteer fails
 * @param url - The URL to scrape
 * @returns The HTML content of the page
 */
async function scrapeWithHTTP(url: string): Promise<string> {
  try {
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
      },
    });

    logger.info(`Successfully scraped page with HTTP fallback: ${url}`);
    return response.data;
  } catch (error: any) {
    logger.error(`HTTP scraping failed for ${url}:`, error.message);
    throw new ExternalServiceError('HTTP Scraper', 'Failed to fetch page content via HTTP');
  }
}

/**
 * Scrapes a web page and returns its HTML content after JavaScript execution
 * Falls back to HTTP scraping if Puppeteer fails
 * @param url - The URL to scrape
 * @returns The HTML content of the page
 * @throws ValidationError if the page is unreachable or times out
 * @throws ExternalServiceError if scraping fails for other reasons
 */
export async function scrapePage(url: string): Promise<string> {
  let browser: Browser | null = null;

  try {
    // Try Puppeteer first for JavaScript-rendered content
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ],
    });

    const page = await browser.newPage();
    
    // Set default navigation timeout
    await page.setDefaultNavigationTimeout(30000);
    
    // Add small delay after page creation to ensure frame initialization
    await new Promise(resolve => setTimeout(resolve, 100));

    // Navigate to URL with 30-second timeout
    // Wait for networkidle0 to ensure JavaScript execution completes
    await page.goto(url, {
      timeout: 30000,
      waitUntil: 'networkidle0',
    });

    // Extract HTML content after JavaScript rendering
    const html = await page.content();

    logger.info(`Successfully scraped page with Puppeteer: ${url}`);
    return html;
  } catch (error: any) {
    logger.warn(`Puppeteer scraping failed for ${url}, trying HTTP fallback:`, error.message);
    
    // Close browser if it was opened
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        logger.warn('Failed to close browser after error', { error: closeError });
      }
      browser = null;
    }

    // Try HTTP fallback
    try {
      return await scrapeWithHTTP(url);
    } catch (httpError) {
      // Handle timeout errors specifically
      if (error.name === 'TimeoutError' || error.message?.toLowerCase().includes('timeout')) {
        logger.warn(`Page timeout for URL: ${url}`);
        throw new ValidationError('Page unreachable or took too long to load');
      }

      // Both methods failed
      logger.error(`All scraping methods failed for ${url}`);
      throw new ExternalServiceError('Scraper', 'Failed to fetch page content');
    }
  } finally {
    // Always close browser instance to free resources
    if (browser) {
      try {
        await browser.close();
        logger.debug('Browser instance closed');
      } catch (closeError) {
        // Log but don't throw - browser cleanup failure shouldn't fail the scrape
        logger.warn('Failed to close browser', {
          error: closeError instanceof Error ? closeError.message : String(closeError)
        });
      }
    }
  }
}
