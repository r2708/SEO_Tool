import puppeteer, { Browser } from 'puppeteer';
import { ValidationError, ExternalServiceError } from '../../errors';
import { logger } from '../../utils/logger';

/**
 * Scrapes a web page and returns its HTML content after JavaScript execution
 * @param url - The URL to scrape
 * @returns The HTML content of the page
 * @throws ValidationError if the page is unreachable or times out
 * @throws ExternalServiceError if scraping fails for other reasons
 */
export async function scrapePage(url: string): Promise<string> {
  let browser: Browser | null = null;

  try {
    // Launch browser
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    // Navigate to URL with 30-second timeout
    // Wait for networkidle0 to ensure JavaScript execution completes
    await page.goto(url, {
      timeout: 30000,
      waitUntil: 'networkidle0',
    });

    // Extract HTML content after JavaScript rendering
    const html = await page.content();

    logger.info(`Successfully scraped page: ${url}`);
    return html;
  } catch (error: any) {
    // Handle timeout errors specifically
    if (error.name === 'TimeoutError' || error.message?.toLowerCase().includes('timeout')) {
      logger.warn(`Page timeout for URL: ${url}`);
      throw new ValidationError('Page unreachable or took too long to load');
    }

    // Handle other scraping errors
    logger.error(`Scraping failed for ${url}:`, error);
    throw new ExternalServiceError('Scraper', 'Failed to fetch page content');
  } finally {
    // Always close browser instance to free resources
    if (browser) {
      try {
        await browser.close();
        logger.debug('Browser instance closed');
      } catch (closeError) {
        // Log but don't throw - browser cleanup failure shouldn't fail the scrape
        logger.warn('Failed to close browser:', closeError);
      }
    }
  }
}
