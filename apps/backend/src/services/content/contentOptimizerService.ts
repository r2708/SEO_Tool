import { scraperQueue } from '../scraper/scraper-queue.service';
import { CacheKeys, CacheTTL } from '../cache/cacheKeys';
import { RedisCache } from '../cache/RedisCache';
import { logger } from '../../utils/logger';
import * as cheerio from 'cheerio';
import { config } from '../../config/env';

// Initialize cache
const cache = new RedisCache(config.REDIS_URL);

/**
 * Represents a single SERP result with extracted content
 */
export interface SERPResult {
  url: string;
  title: string;
  keywords: string[];
  headings: string[];
}

/**
 * Fetches top SERP results for a target keyword using SerpAPI
 * @param keyword - The target keyword to search for
 * @param limit - Number of results to fetch (default: 10)
 * @returns Array of SERP results with extracted content
 */
export async function fetchSERPResults(
  keyword: string,
  limit: number = 10
): Promise<SERPResult[]> {
  // Check cache first
  const cacheKey = CacheKeys.serp(keyword);
  const cached = await cache.get<SERPResult[]>(cacheKey);
  
  if (cached) {
    logger.info(`SERP results retrieved from cache for keyword: ${keyword}`);
    return cached;
  }

  logger.info(`Fetching real-time SERP results from SerpAPI for keyword: ${keyword}`);

  // Get real SERP URLs from SerpAPI
  const serpUrls = await fetchRealSerpUrls(keyword, limit);

  if (serpUrls.length === 0) {
    logger.warn(`No SERP results found for keyword: ${keyword}`);
    return [];
  }

  // Scrape each SERP result URL to extract content
  const serpResults: SERPResult[] = [];
  
  for (const url of serpUrls) {
    try {
      const html = await scraperQueue.scrape(url);
      const extracted = extractContentFromHtml(html, url);
      serpResults.push(extracted);
      logger.debug(`Extracted content from SERP result: ${url}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.warn(`Failed to scrape SERP result ${url}: ${errorMessage}`);
      // Continue with other results even if one fails
    }
  }

  // Cache the results for 24 hours
  await cache.set(cacheKey, serpResults, CacheTTL.SERP);
  logger.info(`Cached ${serpResults.length} SERP results for keyword: ${keyword}`);

  return serpResults;
}

/**
 * Fetches real SERP URLs from SerpAPI
 * @param keyword - The search keyword
 * @param limit - Number of URLs to fetch
 * @returns Array of real URLs from Google search results
 */
async function fetchRealSerpUrls(keyword: string, limit: number): Promise<string[]> {
  try {
    const apiKey = config.SERPAPI_KEY;
    if (!apiKey) {
      logger.error('SERPAPI_KEY not configured');
      throw new Error('SERPAPI_KEY environment variable not set');
    }

    const axios = (await import('axios')).default;
    
    // Build SerpAPI request
    const searchUrl = 'https://serpapi.com/search.json';
    const params = {
      engine: 'google',
      q: keyword,
      location: 'United States',
      google_domain: 'google.com',
      device: 'desktop',
      api_key: apiKey,
      num: Math.min(limit, 100) // SerpAPI supports up to 100 results
    };

    logger.info(`Calling SerpAPI for keyword: "${keyword}"`);

    const response = await axios.get(searchUrl, { params });
    
    if (response.status !== 200) {
      throw new Error(`SerpAPI returned status ${response.status}`);
    }

    const data = response.data;
    
    if (!data.organic_results || data.organic_results.length === 0) {
      logger.warn(`No organic results from SerpAPI for keyword: ${keyword}`);
      return [];
    }

    // Extract URLs from organic results
    const urls = data.organic_results
      .slice(0, limit)
      .map((result: any) => result.link)
      .filter((url: string) => url && url.startsWith('http'));

    logger.info(`Fetched ${urls.length} real SERP URLs from SerpAPI for keyword: ${keyword}`);
    return urls;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Failed to fetch SERP URLs from SerpAPI: ${errorMessage}`);
    throw new Error(`Failed to fetch real-time SERP data: ${errorMessage}`);
  }
}

/**
 * Extracts keywords and headings from HTML content
 * @param html - The HTML content to parse
 * @param url - The URL of the page
 * @returns Extracted SERP result data
 */
function extractContentFromHtml(html: string, url: string): SERPResult {
  const $ = cheerio.load(html);

  // Extract title
  const title = $('title').text().trim() || '';

  // Extract keywords from meta tags
  const metaKeywords = $('meta[name="keywords"]').attr('content') || '';
  const keywordsFromMeta = metaKeywords
    .split(',')
    .map(k => k.trim())
    .filter(k => k.length > 0);

  // Extract keywords from content (simple word frequency approach)
  const bodyText = $('body').text().toLowerCase();
  const words = bodyText.match(/\b[a-z]{3,}\b/g) || [];
  const wordFreq = new Map<string, number>();
  
  words.forEach(word => {
    wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
  });

  // Get top keywords by frequency (excluding common stop words)
  const stopWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use']);
  const contentKeywords = Array.from(wordFreq.entries())
    .filter(([word]) => !stopWords.has(word))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word);

  // Combine meta keywords and content keywords
  const allKeywords = [...new Set([...keywordsFromMeta, ...contentKeywords])];

  // Extract headings (H1, H2, H3)
  const headings: string[] = [];
  $('h1, h2, h3').each((_, element) => {
    const heading = $(element).text().trim();
    if (heading) {
      headings.push(heading);
    }
  });

  return {
    url,
    title,
    keywords: allKeywords,
    headings,
  };
}

/**
 * AI analysis result from OpenAI
 */
export interface AIAnalysis {
  score: number;
  missingKeywords: string[];
  suggestedHeadings: string[];
  recommendations: string[];
}

/**
 * Complete content score with analysis metrics
 */
export interface ContentScore {
  score: number;
  missingKeywords: string[];
  suggestedHeadings: string[];
  analysis: {
    keywordDensity: number;
    readabilityScore: number;
    contentLength: number;
    recommendedLength: number;
  };
}

/**
 * Analyzes content using OpenAI API by comparing against SERP results
 * @param content - User's blog content to analyze
 * @param serpResults - Top SERP results for comparison
 * @param targetKeyword - The target keyword for optimization
 * @returns AI analysis with score, missing keywords, and suggestions
 */
export async function analyzeWithAI(
  content: string,
  serpResults: SERPResult[],
  targetKeyword: string
): Promise<AIAnalysis> {
  try {
    const { config } = await import('../../config/env');
    const openaiApiKey = config.OPENAI_API_KEY;

    // Prepare SERP summary for the prompt
    const serpSummary = serpResults
      .map((result, index) => {
        return `Result ${index + 1}:
Title: ${result.title}
Top Keywords: ${result.keywords.slice(0, 10).join(', ')}
Headings: ${result.headings.slice(0, 5).join(', ')}`;
      })
      .join('\n\n');

    // Create the prompt for OpenAI
    const prompt = `Analyze this content for SEO optimization targeting keyword "${targetKeyword}".
Compare against top-ranking content and provide structured feedback.

User Content:
${content}

Top Ranking Content Summary:
${serpSummary}

Provide your analysis in the following JSON format:
{
  "score": <number 0-100>,
  "missingKeywords": [<array of important keywords missing from user content>],
  "suggestedHeadings": [<array of heading suggestions based on top-ranking content>],
  "recommendations": [<array of specific improvement recommendations>]
}

Focus on:
1. Keyword usage and density compared to top results
2. Heading structure and organization
3. Content comprehensiveness
4. Missing topics covered by top-ranking pages`;

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an SEO expert analyzing content. Always respond with valid JSON only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API request failed with status ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content;

    if (!aiResponse) {
      throw new Error('No response from OpenAI API');
    }

    // Parse the JSON response
    const analysis: AIAnalysis = JSON.parse(aiResponse);

    // Validate the response structure
    if (
      typeof analysis.score !== 'number' ||
      !Array.isArray(analysis.missingKeywords) ||
      !Array.isArray(analysis.suggestedHeadings)
    ) {
      throw new Error('Invalid response structure from OpenAI');
    }

    // Ensure score is within valid range
    analysis.score = Math.max(0, Math.min(100, analysis.score));

    logger.info(`OpenAI analysis completed for keyword: ${targetKeyword}, score: ${analysis.score}`);
    return analysis;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`OpenAI content analysis failed: ${errorMessage}`);
    
    // Provide user-friendly error messages
    if (error instanceof Error) {
      if (error.message.includes('API request failed')) {
        throw new Error('Content analysis service is temporarily unavailable. Please try again later.');
      }
      if (error.message.includes('Invalid response')) {
        throw new Error('Content analysis returned unexpected results. Please try again.');
      }
      if (error.message.includes('JSON')) {
        throw new Error('Failed to process content analysis results. Please try again.');
      }
    }
    
    throw new Error('An error occurred during content analysis. Please try again later.');
  }
}

/**
 * Calculates content metrics for analysis
 * @param content - The content to analyze
 * @param targetKeyword - The target keyword
 * @returns Analysis metrics
 */
function calculateContentMetrics(content: string, targetKeyword: string) {
  const contentLength = content.length;
  const words = content.toLowerCase().match(/\b[a-z]+\b/g) || [];
  const wordCount = words.length;

  // Calculate keyword density
  const keywordOccurrences = content
    .toLowerCase()
    .split(targetKeyword.toLowerCase()).length - 1;
  const keywordDensity = wordCount > 0 ? (keywordOccurrences / wordCount) * 100 : 0;

  // Simple readability score (Flesch Reading Ease approximation)
  // Higher score = easier to read (0-100 scale)
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
  const syllables = words.reduce((count, word) => count + estimateSyllables(word), 0);
  
  const avgWordsPerSentence = sentences > 0 ? wordCount / sentences : 0;
  const avgSyllablesPerWord = wordCount > 0 ? syllables / wordCount : 0;
  
  const readabilityScore = Math.max(
    0,
    Math.min(
      100,
      206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord
    )
  );

  // Recommended length based on typical blog post (1500-2500 words)
  const recommendedLength = wordCount < 1500 ? 1500 : wordCount > 2500 ? 2500 : wordCount;

  return {
    keywordDensity: parseFloat(keywordDensity.toFixed(2)),
    readabilityScore: parseFloat(readabilityScore.toFixed(2)),
    contentLength: wordCount,
    recommendedLength,
  };
}

/**
 * Estimates syllable count for a word (simple heuristic)
 * @param word - The word to analyze
 * @returns Estimated syllable count
 */
function estimateSyllables(word: string): number {
  word = word.toLowerCase();
  if (word.length <= 3) return 1;
  
  const vowels = 'aeiouy';
  let count = 0;
  let previousWasVowel = false;
  
  for (let i = 0; i < word.length; i++) {
    const isVowel = vowels.includes(word[i]);
    if (isVowel && !previousWasVowel) {
      count++;
    }
    previousWasVowel = isVowel;
  }
  
  // Adjust for silent 'e'
  if (word.endsWith('e')) {
    count--;
  }
  
  return Math.max(1, count);
}

/**
 * Scores content by analyzing it against SERP results using OpenAI
 * @param content - User's blog content
 * @param targetKeyword - Target keyword for optimization
 * @returns Complete content score with analysis
 */
export async function scoreContent(
  content: string,
  targetKeyword: string
): Promise<ContentScore> {
  logger.info(`Starting content scoring for keyword: ${targetKeyword}`);

  // Fetch SERP results (top 10)
  const serpResults = await fetchSERPResults(targetKeyword, 10);

  if (serpResults.length === 0) {
    logger.warn(`No SERP results found for keyword: ${targetKeyword}`);
    throw new Error('Unable to fetch comparison data for content analysis');
  }

  // Analyze with OpenAI
  const aiAnalysis = await analyzeWithAI(content, serpResults, targetKeyword);

  // Calculate content metrics
  const metrics = calculateContentMetrics(content, targetKeyword);

  // Combine results
  const contentScore: ContentScore = {
    score: aiAnalysis.score,
    missingKeywords: aiAnalysis.missingKeywords,
    suggestedHeadings: aiAnalysis.suggestedHeadings,
    analysis: metrics,
  };

  logger.info(`Content scoring completed for keyword: ${targetKeyword}, final score: ${contentScore.score}`);
  return contentScore;
}
