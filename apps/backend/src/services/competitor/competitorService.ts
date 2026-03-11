import { PrismaClient, Competitor, CompetitorKeyword } from '@prisma/client';
import { ValidationError } from '../../errors/ValidationError';
import { NotFoundError } from '../../errors/NotFoundError';
import { logger } from '../../utils/logger';
import { scrapePage } from '../scraper/scraper.service';
import * as cheerio from 'cheerio';

const prisma = new PrismaClient();

/**
 * Competitor with keyword count
 */
export interface CompetitorWithCount extends Competitor {
  keywordCount: number;
}

/**
 * Competitor keyword with ranking data
 */
export interface CompetitorKeywordWithRanking {
  keyword: string;
  position: number | null;
  searchVolume: number | null;
  difficulty: number | null;
  cpc: number | null;
  lastUpdated: Date;
}

/**
 * Competitor analysis result with ranking data
 */
export interface CompetitorAnalysis {
  competitor: string;
  keywords: CompetitorKeywordWithRanking[];
  overlap: KeywordOverlap;
  lastAnalyzed: Date;
}

/**
 * Keyword overlap calculation result
 */
export interface KeywordOverlap {
  shared: string[];
  competitorOnly: string[];
  userOnly: string[];
}

/**
 * Extract keywords from a competitor domain
 * Scrapes the domain and extracts keywords from meta tags, headings, and content
 * @param domain - Competitor domain to analyze
 * @returns Array of extracted keywords
 */
export async function extractKeywords(domain: string): Promise<string[]> {
  // Ensure domain has protocol
  const url = domain.startsWith('http') ? domain : `https://${domain}`;
  
  // Scrape the page
  const html = await scrapePage(url);
  
  // Parse HTML with cheerio
  const $ = cheerio.load(html);
  
  const keywords = new Set<string>();
  
  // Extract from meta keywords tag
  const metaKeywords = $('meta[name="keywords"]').attr('content');
  if (metaKeywords) {
    metaKeywords.split(',').forEach(kw => {
      const trimmed = kw.trim().toLowerCase();
      if (trimmed) keywords.add(trimmed);
    });
  }
  
  // Extract from meta description
  const metaDescription = $('meta[name="description"]').attr('content');
  if (metaDescription) {
    // Extract significant words (3+ characters)
    const words = metaDescription.toLowerCase().match(/\b\w{3,}\b/g) || [];
    words.forEach(word => keywords.add(word));
  }
  
  // Extract from title
  const title = $('title').text();
  if (title) {
    const words = title.toLowerCase().match(/\b\w{3,}\b/g) || [];
    words.forEach(word => keywords.add(word));
  }
  
  // Extract from headings (h1, h2, h3)
  $('h1, h2, h3').each((_, element) => {
    const text = $(element).text();
    const words = text.toLowerCase().match(/\b\w{3,}\b/g) || [];
    words.forEach(word => keywords.add(word));
  });
  
  // Extract from first paragraph of content
  const firstParagraph = $('p').first().text();
  if (firstParagraph) {
    const words = firstParagraph.toLowerCase().match(/\b\w{3,}\b/g) || [];
    // Take first 20 words to avoid too many generic terms
    words.slice(0, 20).forEach(word => keywords.add(word));
  }
  
  // Filter out common stop words
  const stopWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use']);
  
  const filteredKeywords = Array.from(keywords).filter(kw => !stopWords.has(kw));
  
  logger.info(`Extracted ${filteredKeywords.length} keywords from ${domain}`);
  return filteredKeywords;
}

/**
 * Analyze a competitor domain and store results (background processing)
 * @param projectId - Project ID to associate competitor with
 * @param competitorDomain - Competitor domain to analyze
 * @returns Initial analysis with basic data, ranking data processed in background
 */
export async function analyzeBackground(
  projectId: string,
  competitorDomain: string
): Promise<CompetitorAnalysis> {
  // Verify project exists
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new NotFoundError('Project');
  }

  // Validate domain
  if (!competitorDomain || competitorDomain.trim().length === 0) {
    throw new ValidationError('Competitor domain is required');
  }

  // Extract keywords from competitor
  const competitorKeywords = await extractKeywords(competitorDomain);

  // Store or update competitor
  const competitor = await prisma.competitor.upsert({
    where: {
      projectId_domain: {
        projectId,
        domain: competitorDomain,
      },
    },
    update: {
      lastAnalyzed: new Date(),
    },
    create: {
      projectId,
      domain: competitorDomain,
      lastAnalyzed: new Date(),
    },
  });

  // Delete existing competitor keywords
  await prisma.competitorKeyword.deleteMany({
    where: { competitorId: competitor.id },
  });

  // Store keywords immediately without ranking data
  if (competitorKeywords.length > 0) {
    await prisma.competitorKeyword.createMany({
      data: competitorKeywords.map(keyword => ({
        competitorId: competitor.id,
        keyword,
        position: null,
        searchVolume: null,
        difficulty: null,
        cpc: null,
        lastUpdated: new Date(),
      })),
    });
  }

  // Start background ranking analysis (don't await)
  processRankingDataInBackground(competitor.id, competitorKeywords, competitorDomain)
    .catch(error => {
      logger.error(`Background ranking analysis failed for competitor ${competitorDomain}:`, error);
    });

  // Get user's project keywords for overlap calculation
  const userKeywords = await prisma.keyword.findMany({
    where: { projectId },
    select: { keyword: true },
  });

  const userKeywordList = userKeywords.map(k => k.keyword.toLowerCase());

  // Calculate overlap using just keyword strings
  const overlap = calculateOverlap(userKeywordList, competitorKeywords);

  logger.info(`Analyzed competitor ${competitorDomain} for project ${projectId} (ranking data processing in background)`);

  // Return basic analysis with empty ranking data
  const basicKeywords: CompetitorKeywordWithRanking[] = competitorKeywords.map(keyword => ({
    keyword,
    position: null,
    searchVolume: null,
    difficulty: null,
    cpc: null,
    lastUpdated: new Date(),
  }));

  return {
    competitor: competitorDomain,
    keywords: basicKeywords,
    overlap,
    lastAnalyzed: competitor.lastAnalyzed,
  };
}

/**
 * Process ranking data in background
 */
async function processRankingDataInBackground(
  competitorId: string,
  keywords: string[],
  competitorDomain: string
): Promise<void> {
  logger.info(`Starting background ranking analysis for ${keywords.length} keywords`);

  // Limit to top 15 keywords for performance
  const limitedKeywords = keywords.slice(0, 15);
  
  // Import services
  const { getSerpApiRank } = await import('../rank/serpApiRankTracker');
  const keywordService = await import('../keyword/keywordService');

  for (let i = 0; i < limitedKeywords.length; i++) {
    const keyword = limitedKeywords[i];
    
    try {
      logger.info(`Background processing ${i + 1}/${limitedKeywords.length}: "${keyword}"`);
      
      // Get keyword metrics and ranking
      const [metrics, position] = await Promise.all([
        keywordService.getKeywordMetrics(keyword),
        getSerpApiRank(keyword, competitorDomain)
      ]);
      
      // Update the keyword record
      await prisma.competitorKeyword.updateMany({
        where: {
          competitorId,
          keyword,
        },
        data: {
          position,
          searchVolume: metrics.searchVolume,
          difficulty: metrics.difficulty,
          cpc: metrics.cpc,
          lastUpdated: new Date(),
        },
      });
      
      logger.info(`✓ Background updated "${keyword}": position=${position || 'Not ranked'}`);
    } catch (error) {
      logger.warn(`✗ Background failed for "${keyword}":`, { error: error instanceof Error ? error.message : String(error) });
    }
    
    // Delay between requests
    if (i < limitedKeywords.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  logger.info(`Background ranking analysis completed for competitor ${competitorDomain}`);
}

/**
 * Analyze a competitor domain and store results (original method with full processing)
 * @param projectId - Project ID to associate competitor with
 * @param competitorDomain - Competitor domain to analyze
 * @returns Competitor analysis with overlap data
 */
export async function analyze(
  projectId: string,
  competitorDomain: string
): Promise<CompetitorAnalysis> {
  // Verify project exists
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new NotFoundError('Project');
  }

  // Validate domain
  if (!competitorDomain || competitorDomain.trim().length === 0) {
    throw new ValidationError('Competitor domain is required');
  }

  // Extract keywords from competitor
  const competitorKeywords = await extractKeywords(competitorDomain);

  // Store or update competitor
  const competitor = await prisma.competitor.upsert({
    where: {
      projectId_domain: {
        projectId,
        domain: competitorDomain,
      },
    },
    update: {
      lastAnalyzed: new Date(),
    },
    create: {
      projectId,
      domain: competitorDomain,
      lastAnalyzed: new Date(),
    },
  });

  // Delete existing competitor keywords
  await prisma.competitorKeyword.deleteMany({
    where: { competitorId: competitor.id },
  });

  // Store competitor keywords with ranking data
  if (competitorKeywords.length > 0) {
    // Limit keywords to avoid timeout - take top 20 most relevant keywords
    const limitedKeywords = competitorKeywords.slice(0, 20);
    logger.info(`Processing ${limitedKeywords.length} keywords (limited from ${competitorKeywords.length} for performance)`);

    // Import ranking services
    const { getSerpApiRank } = await import('../rank/serpApiRankTracker');
    const keywordService = await import('../keyword/keywordService');

    const keywordData = [];
    
    // Process keywords one by one to avoid overwhelming SERP API
    for (let i = 0; i < limitedKeywords.length; i++) {
      const keyword = limitedKeywords[i];
      
      try {
        logger.info(`Processing keyword ${i + 1}/${limitedKeywords.length}: "${keyword}"`);
        
        // Get keyword metrics (search volume, difficulty, CPC)
        const metrics = await keywordService.getKeywordMetrics(keyword);
        
        // Get competitor ranking for this keyword
        const position = await getSerpApiRank(keyword, competitorDomain);
        
        keywordData.push({
          competitorId: competitor.id,
          keyword,
          position,
          searchVolume: metrics.searchVolume,
          difficulty: metrics.difficulty,
          cpc: metrics.cpc,
          lastUpdated: new Date(),
        });
        
        logger.info(`✓ Processed "${keyword}": position=${position || 'Not ranked'}, volume=${metrics.searchVolume}`);
      } catch (error) {
        logger.warn(`✗ Failed to get data for keyword "${keyword}":`, { error: error instanceof Error ? error.message : String(error) });
        // Store keyword without ranking data
        keywordData.push({
          competitorId: competitor.id,
          keyword,
          position: null,
          searchVolume: null,
          difficulty: null,
          cpc: null,
          lastUpdated: new Date(),
        });
      }
      
      // Add delay between each keyword to respect API limits
      if (i < limitedKeywords.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
      }
    }

    // Store remaining keywords without ranking data (for overlap calculation)
    const remainingKeywords = competitorKeywords.slice(20);
    for (const keyword of remainingKeywords) {
      keywordData.push({
        competitorId: competitor.id,
        keyword,
        position: null,
        searchVolume: null,
        difficulty: null,
        cpc: null,
        lastUpdated: new Date(),
      });
    }

    // Store all keyword data
    await prisma.competitorKeyword.createMany({
      data: keywordData,
    });
    
    logger.info(`Stored ${keywordData.length} keywords (${limitedKeywords.length} with ranking data) for competitor ${competitorDomain}`);
  }

  // Get user's project keywords
  const userKeywords = await prisma.keyword.findMany({
    where: { projectId },
    select: { keyword: true },
  });

  const userKeywordList = userKeywords.map(k => k.keyword.toLowerCase());

  // Get competitor keywords with ranking data
  const competitorKeywordsWithRanking = await prisma.competitorKeyword.findMany({
    where: { competitorId: competitor.id },
    select: {
      keyword: true,
      position: true,
      searchVolume: true,
      difficulty: true,
      cpc: true,
      lastUpdated: true,
    },
  });

  // Convert Decimal types to numbers for the interface
  const formattedKeywords: CompetitorKeywordWithRanking[] = competitorKeywordsWithRanking.map(k => ({
    keyword: k.keyword,
    position: k.position,
    searchVolume: k.searchVolume,
    difficulty: k.difficulty ? parseFloat(k.difficulty.toString()) : null,
    cpc: k.cpc ? parseFloat(k.cpc.toString()) : null,
    lastUpdated: k.lastUpdated,
  }));

  // Calculate overlap using just keyword strings
  const competitorKeywordStrings = formattedKeywords.map(k => k.keyword);
  const overlap = calculateOverlap(userKeywordList, competitorKeywordStrings);

  logger.info(`Analyzed competitor ${competitorDomain} for project ${projectId}`);

  return {
    competitor: competitorDomain,
    keywords: formattedKeywords,
    overlap,
    lastAnalyzed: competitor.lastAnalyzed,
  };
}

/**
 * Calculate keyword overlap between user and competitor
 * @param userKeywords - User's project keywords
 * @param competitorKeywords - Competitor's keywords
 * @returns Keyword overlap data
 */
export function calculateOverlap(
  userKeywords: string[],
  competitorKeywords: string[]
): KeywordOverlap {
  const userSet = new Set(userKeywords.map(k => k.toLowerCase()));
  const competitorSet = new Set(competitorKeywords.map(k => k.toLowerCase()));

  // Shared keywords (intersection)
  const shared = Array.from(userSet).filter(k => competitorSet.has(k));

  // Competitor-only keywords (difference)
  const competitorOnly = Array.from(competitorSet).filter(k => !userSet.has(k));

  // User-only keywords (difference)
  const userOnly = Array.from(userSet).filter(k => !competitorSet.has(k));

  return {
    shared,
    competitorOnly,
    userOnly,
  };
}

/**
 * Find all competitors for a project with pagination
 * @param projectId - Project ID
 * @param skip - Number of records to skip (for pagination)
 * @param take - Number of records to take (for pagination)
 * @returns Object with competitors array and total count
 */
export async function findByProject(
  projectId: string,
  skip?: number,
  take?: number
): Promise<{ competitors: CompetitorWithCount[]; total: number }> {
  // Get total count
  const total = await prisma.competitor.count({
    where: { projectId },
  });

  // Get paginated competitors
  const competitors = await prisma.competitor.findMany({
    where: { projectId },
    include: {
      _count: {
        select: { competitorKeywords: true },
      },
    },
    orderBy: { lastAnalyzed: 'desc' },
    skip,
    take,
  });

  const competitorsWithCount = competitors.map(competitor => ({
    id: competitor.id,
    projectId: competitor.projectId,
    domain: competitor.domain,
    lastAnalyzed: competitor.lastAnalyzed,
    createdAt: competitor.createdAt,
    keywordCount: competitor._count.competitorKeywords,
  }));

  return { competitors: competitorsWithCount, total };
}

/**
 * Get competitor keywords with ranking data
 * @param competitorId - Competitor ID
 * @returns Array of keywords with ranking information
 */
export async function getCompetitorKeywordsWithRanking(competitorId: string): Promise<CompetitorKeywordWithRanking[]> {
  const keywords = await prisma.competitorKeyword.findMany({
    where: { competitorId },
    select: {
      keyword: true,
      position: true,
      searchVolume: true,
      difficulty: true,
      cpc: true,
      lastUpdated: true,
    },
    orderBy: [
      { position: 'asc' }, // Ranked keywords first
      { searchVolume: 'desc' }, // Then by search volume
    ],
  });

  // Convert Decimal types to numbers
  return keywords.map(k => ({
    keyword: k.keyword,
    position: k.position,
    searchVolume: k.searchVolume,
    difficulty: k.difficulty ? parseFloat(k.difficulty.toString()) : null,
    cpc: k.cpc ? parseFloat(k.cpc.toString()) : null,
    lastUpdated: k.lastUpdated,
  }));
}
