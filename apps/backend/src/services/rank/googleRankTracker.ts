import puppeteer, { Browser, Page } from 'puppeteer';
import { ValidationError, ExternalServiceError } from '../../errors';
import { logger } from '../../utils/logger';
import { track } from './rankTrackerService';

/**
 * Google SERP result interface
 */
interface GoogleResult {
  title: string;
  url: string;
  snippet: string;
  position: number;
}

/**
 * Scrapes Google search results and finds ranking position for a specific domain
 * @param keyword - Keyword to search for
 * @param targetDomain - Domain to find in results
 * @returns Ranking position (1-100) or null if not found
 */
export async function getGoogleRank(
  keyword: string, 
  targetDomain: string
): Promise<number | null> {
  let browser: Browser | null = null;
  
  try {
    // Launch browser with stealth settings
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    
    // Set user agent to avoid detection
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Build Google search URL
    const searchQuery = encodeURIComponent(keyword);
    const searchUrl = `https://www.google.com/search?q=${searchQuery}&num=100`;
    
    logger.info(`Searching Google for: "${keyword}"`);
    
    // Navigate to Google
    await page.goto(searchUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Wait for results to load
    await page.waitForSelector('div[data-ved]', { timeout: 10000 });
    
    // Extract search results
    const results = await page.evaluate((targetDomain): GoogleResult[] => {
      const searchResults: GoogleResult[] = [];
      
      // Find all search result elements
      const resultElements = document.querySelectorAll('div[data-ved]');
      
      resultElements.forEach((element, index) => {
        // Skip if not a proper search result
        const linkElement = element.querySelector('a[href]');
        if (!linkElement) return;
        
        const url = linkElement.getAttribute('href');
        if (!url || url.startsWith('#')) return;
        
        // Extract title
        const titleElement = element.querySelector('h3');
        const title = titleElement?.textContent?.trim() || '';
        
        // Extract snippet
        const snippetElement = element.querySelector('[data-ved] span');
        const snippet = snippetElement?.textContent?.trim() || '';
        
        // Clean URL
        let cleanUrl = url;
        if (url.startsWith('/url?q=')) {
          cleanUrl = new URL(url.split('/url?q=')[1].split('&')[0]).href;
        }
        
        searchResults.push({
          title,
          url: cleanUrl,
          snippet,
          position: index + 1
        });
      });
      
      return searchResults;
    }, targetDomain);
    
    logger.info(`Found ${results.length} search results for "${keyword}"`);
    
    // Find target domain in results
    for (const result of results) {
      try {
        const resultUrl = new URL(result.url);
        const resultDomain = resultUrl.hostname.replace('www.', '');
        const cleanTargetDomain = targetDomain.replace('www.', '');
        
        if (resultDomain.includes(cleanTargetDomain) || cleanTargetDomain.includes(resultDomain)) {
          logger.info(`Found ${targetDomain} at position ${result.position} for "${keyword}"`);
          return result.position;
        }
      } catch (error) {
        // Skip invalid URLs
        continue;
      }
    }
    
    logger.info(`${targetDomain} not found in top ${results.length} results for "${keyword}"`);
    return null;
    
  } catch (error: any) {
    if (error.name === 'TimeoutError') {
      logger.warn(`Google search timeout for keyword: ${keyword}`);
      throw new ValidationError('Google search timeout');
    }
    
    logger.error(`Google search failed for keyword "${keyword}":`, error as Error);
    throw new ExternalServiceError('Google', 'Failed to fetch search results');
    
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (error) {
        logger.warn('Failed to close browser:', error as Error);
      }
    }
  }
}

/**
 * Track rankings for multiple keywords
 * @param projectId - Project ID
 * @param keywords - Array of keywords to track
 * @param domain - Domain to search for
 */
export async function trackKeywordRankings(
  projectId: string,
  keywords: string[],
  domain: string
): Promise<{ keyword: string; position: number | null }[]> {
  const results = [];
  
  for (const keyword of keywords) {
    try {
      // Add delay between requests to avoid rate limiting
      if (results.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
      }
      
      const position = await getGoogleRank(keyword, domain);
      
      // Store ranking in database if found
      if (position !== null) {
        await track(projectId, keyword, position);
      }
      
      results.push({ keyword, position });
      
    } catch (error) {
      logger.error(`Failed to track ranking for "${keyword}":`, error as Error);
      results.push({ keyword, position: null });
    }
  }
  
  return results;
}

/**
 * Quick test function to check if Google scraping works
 */
export async function testGoogleScraping(): Promise<void> {
  try {
    const position = await getGoogleRank('web development', 'github.com');
    console.log(`GitHub found at position: ${position}`);
  } catch (error) {
    console.error('Test failed:', error);
  }
}
