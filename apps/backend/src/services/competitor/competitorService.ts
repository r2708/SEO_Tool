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
 * Competitor analysis result
 */
export interface CompetitorAnalysis {
  competitor: string;
  keywords: string[];
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
 * Analyze a competitor domain and store results
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

  // Store competitor keywords
  if (competitorKeywords.length > 0) {
    await prisma.competitorKeyword.createMany({
      data: competitorKeywords.map(keyword => ({
        competitorId: competitor.id,
        keyword,
      })),
    });
  }

  // Get user's project keywords
  const userKeywords = await prisma.keyword.findMany({
    where: { projectId },
    select: { keyword: true },
  });

  const userKeywordList = userKeywords.map(k => k.keyword.toLowerCase());

  // Calculate overlap
  const overlap = calculateOverlap(userKeywordList, competitorKeywords);

  logger.info(`Analyzed competitor ${competitorDomain} for project ${projectId}`);

  return {
    competitor: competitorDomain,
    keywords: competitorKeywords,
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
 * Get competitor keywords
 * @param competitorId - Competitor ID
 * @returns Array of keywords
 */
export async function getCompetitorKeywords(competitorId: string): Promise<string[]> {
  const keywords = await prisma.competitorKeyword.findMany({
    where: { competitorId },
    select: { keyword: true },
  });

  return keywords.map(k => k.keyword);
}
