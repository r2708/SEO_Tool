import axios from 'axios';
import { ValidationError, ExternalServiceError } from '../../errors';
import { logger } from '../../utils/logger';
import { track } from './rankTrackerService';

/**
 * SerpAPI search result interface
 */
interface SerpApiResult {
  position: number;
  title: string;
  link: string;
  snippet: string;
  displayed_link: string;
}

/**
 * SerpAPI response interface
 */
interface SerpApiResponse {
  search_parameters: {
    engine: string;
    q: string;
    location: string;
    google_domain: string;
    device: string;
  };
  search_information: {
    query_displayed: string;
    total_results: number;
    time_taken_displayed: number;
  };
  organic_results: SerpApiResult[];
}

/**
 * Gets ranking position from SerpAPI
 * @param keyword - Keyword to search for
 * @param targetDomain - Domain to find in results
 * @returns Ranking position (1-100) or null if not found
 */
export async function getSerpApiRank(
  keyword: string, 
  targetDomain: string
): Promise<number | null> {
  try {
    const apiKey = process.env.SERPAPI_KEY;
    if (!apiKey) {
      throw new ValidationError('SERPAPI_KEY environment variable not set');
    }

    // Build SerpAPI request URL
    const searchUrl = `https://serpapi.com/search.json`;
    const params = {
      engine: 'google',
      q: keyword,
      location: 'United States',
      google_domain: 'google.com',
      device: 'desktop',
      api_key: apiKey,
      num: 100 // Get up to 100 results
    };

    logger.info(`Searching SerpAPI for: "${keyword}"`);

    // Make request to SerpAPI
    const response = await axios.get<SerpApiResponse>(searchUrl, { params });
    
    if (response.status !== 200) {
      throw new ExternalServiceError('SerpApi', `HTTP ${response.status}`);
    }

    const data = response.data;
    
    if (!data.organic_results || data.organic_results.length === 0) {
      logger.warn(`No organic results found for keyword: ${keyword}`);
      return null;
    }

    logger.info(`Found ${data.organic_results.length} organic results for "${keyword}"`);

    // Find target domain in results
    for (const result of data.organic_results) {
      try {
        const resultUrl = new URL(result.link);
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

    logger.info(`${targetDomain} not found in top ${data.organic_results.length} results for "${keyword}"`);
    return null;

  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.error?.message || error.message;
      
      logger.error(`SerpAPI error for keyword "${keyword}":`, { status, message });
      
      if (status === 401) {
        throw new ValidationError('Invalid SerpAPI key');
      } else if (status === 429) {
        throw new ValidationError('SerpAPI rate limit exceeded');
      } else {
        throw new ExternalServiceError('SerpApi', message);
      }
    }
    
    logger.error(`SerpAPI search failed for keyword "${keyword}":`, error);
    throw new ExternalServiceError('SerpApi', 'Failed to fetch search results');
  }
}

/**
 * Track rankings for multiple keywords using SerpAPI
 * @param projectId - Project ID
 * @param keywords - Array of keywords to track
 * @param domain - Domain to search for
 */
export async function trackKeywordRankingsWithSerpApi(
  projectId: string,
  keywords: string[],
  domain: string
): Promise<{ keyword: string; position: number | null; error?: string }[]> {
  const results = [];
  
  for (const keyword of keywords) {
    try {
      // Add delay between requests to avoid rate limiting
      if (results.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      const position = await getSerpApiRank(keyword, domain);
      
      // Store ranking in database if found
      if (position !== null) {
        await track(projectId, keyword, position);
      }
      
      results.push({ keyword, position });
      
    } catch (error) {
      logger.error(`Failed to track ranking for "${keyword}":`, error as Error);
      results.push({ 
        keyword, 
        position: null, 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  return results;
}

/**
 * Quick test function to check if SerpAPI works
 */
export async function testSerpApi(): Promise<void> {
  try {
    const position = await getSerpApiRank('web development', 'github.com');
    console.log(`GitHub found at position: ${position}`);
  } catch (error) {
    console.error('Test failed:', error);
  }
}
