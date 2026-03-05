import { PrismaClient } from '@prisma/client';
import { JSDOM } from 'jsdom';
import { scrapePage } from '../scraper/scraper.service';
import { ValidationError } from '../../errors/ValidationError';
import { logger } from '../../utils/logger';

const prisma = new PrismaClient();

/**
 * Title analysis result
 */
export interface TitleAnalysis {
  content: string;
  length: number;
  optimal: boolean;  // 50-60 characters
}

/**
 * Meta description analysis result
 */
export interface MetaAnalysis {
  content: string;
  length: number;
  optimal: boolean;  // 150-160 characters
}

/**
 * Heading structure analysis
 */
export interface HeadingAnalysis {
  h1Count: number;
  h2Count: number;
  structure: string[];
}

/**
 * Image analysis result
 */
export interface ImageAnalysis {
  total: number;
  missingAlt: number;
}

/**
 * Link analysis result
 */
export interface LinkAnalysis {
  internal: number;
  broken: string[];
}

/**
 * Complete SEO analysis result
 */
export interface SEOAnalysis {
  url: string;
  score: number;
  title: TitleAnalysis;
  metaDescription: MetaAnalysis;
  headings: HeadingAnalysis;
  images: ImageAnalysis;
  links: LinkAnalysis;
  recommendations: string[];
  analyzedAt: Date;
}

/**
 * Score history entry
 */
export interface ScoreHistory {
  score: number;
  url: string;
  date: Date;
  scoreChange: number | null;
}

/**
 * Analyze a URL for SEO elements and calculate score
 * @param url - URL to analyze
 * @param projectId - Optional project ID to store score history
 * @returns Complete SEO analysis
 */
export async function analyze(url: string, projectId?: string): Promise<SEOAnalysis> {
  // Validate URL format
  try {
    new URL(url);
  } catch {
    throw new ValidationError('Invalid URL format');
  }

  // Scrape the page
  const html = await scrapePage(url);

  // Parse HTML and extract elements
  const dom = new JSDOM(html);
  const document = dom.window.document;

  const title = extractTitle(document);
  const metaDescription = extractMetaDescription(document);
  const headings = extractHeadings(document);
  const images = extractImages(document);
  const links = await extractLinks(document, url);

  // Calculate SEO score
  const score = calculateScore({
    title,
    metaDescription,
    headings,
    images,
    links,
  });

  // Generate recommendations
  const recommendations = generateRecommendations({
    title,
    metaDescription,
    headings,
    images,
    links,
  });

  const analysis: SEOAnalysis = {
    url,
    score,
    title,
    metaDescription,
    headings,
    images,
    links,
    recommendations,
    analyzedAt: new Date(),
  };

  // Store score if projectId provided
  if (projectId) {
    await storeScore(projectId, url, score, analysis);
  }

  logger.info(`SEO analysis completed for ${url} with score ${score}`);

  return analysis;
}

/**
 * Extract title tag content and length
 */
function extractTitle(document: Document): TitleAnalysis {
  const titleElement = document.querySelector('title');
  const rawContent = titleElement?.textContent || '';
  const content = rawContent.trim();
  const length = content.length;
  const optimal = length >= 50 && length <= 60;

  return { content, length, optimal };
}

/**
 * Extract meta description content and length
 */
function extractMetaDescription(document: Document): MetaAnalysis {
  const metaElement = document.querySelector('meta[name="description"]');
  const rawContent = metaElement?.getAttribute('content') || '';
  const content = rawContent.trim();
  const length = content.length;
  const optimal = length >= 150 && length <= 160;

  return { content, length, optimal };
}

/**
 * Extract heading structure (H1 and H2 counts)
 */
function extractHeadings(document: Document): HeadingAnalysis {
  const h1Elements = document.querySelectorAll('h1');
  const h2Elements = document.querySelectorAll('h2');

  const h1Count = h1Elements.length;
  const h2Count = h2Elements.length;

  const structure: string[] = [];
  h1Elements.forEach(h1 => {
    const text = h1.textContent?.trim();
    if (text) structure.push(`H1: ${text}`);
  });
  h2Elements.forEach(h2 => {
    const text = h2.textContent?.trim();
    if (text) structure.push(`H2: ${text}`);
  });

  return { h1Count, h2Count, structure };
}

/**
 * Extract image data and count missing alt attributes
 */
function extractImages(document: Document): ImageAnalysis {
  const imgElements = document.querySelectorAll('img');
  const total = imgElements.length;
  let missingAlt = 0;

  imgElements.forEach(img => {
    const alt = img.getAttribute('alt');
    if (!alt || alt.trim() === '') {
      missingAlt++;
    }
  });

  return { total, missingAlt };
}

/**
 * Extract internal links and identify broken links
 */
async function extractLinks(document: Document, baseUrl: string): Promise<LinkAnalysis> {
  const linkElements = document.querySelectorAll('a[href]');
  const base = new URL(baseUrl);
  let internal = 0;
  const broken: string[] = [];

  const linkChecks: Promise<void>[] = [];

  linkElements.forEach(link => {
    const href = link.getAttribute('href');
    if (!href) return;

    try {
      const linkUrl = new URL(href, baseUrl);
      
      // Count internal links (same domain)
      if (linkUrl.hostname === base.hostname) {
        internal++;
      }

      // Check for broken links (basic check)
      linkChecks.push(checkLink(linkUrl.href, broken));
    } catch {
      // Invalid URL, skip
    }
  });

  // Wait for all link checks to complete
  await Promise.all(linkChecks);

  return { internal, broken };
}

/**
 * Check if a link is broken by making a HEAD request
 */
async function checkLink(url: string, broken: string[]): Promise<void> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (response.status >= 400) {
      broken.push(url);
    }
  } catch {
    // If fetch fails, consider it broken
    broken.push(url);
  }
}

/**
 * Calculate SEO score based on analysis
 * Scoring algorithm:
 * - Title optimal (50-60 chars): +15 points
 * - Meta description optimal (150-160 chars): +15 points
 * - Single H1: +10 points
 * - Multiple H2s: +10 points
 * - All images have alt: +15 points
 * - No broken links: +15 points
 * - Internal links > 3: +10 points
 * - Base score: 10 points
 * Total: 0-100
 */
export function calculateScore(analysis: {
  title: TitleAnalysis;
  metaDescription: MetaAnalysis;
  headings: HeadingAnalysis;
  images: ImageAnalysis;
  links: LinkAnalysis;
}): number {
  let score = 10; // Base score

  // Title optimal
  if (analysis.title.optimal) {
    score += 15;
  }

  // Meta description optimal
  if (analysis.metaDescription.optimal) {
    score += 15;
  }

  // Single H1
  if (analysis.headings.h1Count === 1) {
    score += 10;
  }

  // Multiple H2s
  if (analysis.headings.h2Count >= 2) {
    score += 10;
  }

  // All images have alt
  if (analysis.images.total > 0 && analysis.images.missingAlt === 0) {
    score += 15;
  }

  // No broken links
  if (analysis.links.broken.length === 0) {
    score += 15;
  }

  // Internal links > 3
  if (analysis.links.internal > 3) {
    score += 10;
  }

  // Ensure score is within 0-100 range
  return Math.max(0, Math.min(100, score));
}

/**
 * Generate recommendations based on analysis
 */
function generateRecommendations(analysis: {
  title: TitleAnalysis;
  metaDescription: MetaAnalysis;
  headings: HeadingAnalysis;
  images: ImageAnalysis;
  links: LinkAnalysis;
}): string[] {
  const recommendations: string[] = [];

  if (!analysis.title.optimal) {
    if (analysis.title.length < 50) {
      recommendations.push('Title tag is too short. Aim for 50-60 characters.');
    } else if (analysis.title.length > 60) {
      recommendations.push('Title tag is too long. Aim for 50-60 characters.');
    }
  }

  if (!analysis.metaDescription.optimal) {
    if (analysis.metaDescription.length < 150) {
      recommendations.push('Meta description is too short. Aim for 150-160 characters.');
    } else if (analysis.metaDescription.length > 160) {
      recommendations.push('Meta description is too long. Aim for 150-160 characters.');
    }
  }

  if (analysis.headings.h1Count === 0) {
    recommendations.push('Add an H1 heading to your page.');
  } else if (analysis.headings.h1Count > 1) {
    recommendations.push('Use only one H1 heading per page.');
  }

  if (analysis.headings.h2Count < 2) {
    recommendations.push('Add more H2 headings to structure your content.');
  }

  if (analysis.images.missingAlt > 0) {
    recommendations.push(`${analysis.images.missingAlt} image(s) are missing alt attributes.`);
  }

  if (analysis.links.broken.length > 0) {
    recommendations.push(`Fix ${analysis.links.broken.length} broken link(s).`);
  }

  if (analysis.links.internal <= 3) {
    recommendations.push('Add more internal links to improve site navigation.');
  }

  return recommendations;
}

/**
 * Store SEO score in history
 */
export async function storeScore(
  projectId: string,
  url: string,
  score: number,
  analysis: SEOAnalysis
): Promise<void> {
  await prisma.sEOScore.create({
    data: {
      projectId,
      url,
      score,
      analysis: analysis as any, // Store as JSON
    },
  });

  logger.info(`Stored SEO score ${score} for project ${projectId}`);
}

/**
 * Get SEO score history for a project
 * @param projectId - Project ID
 * @param startDate - Optional start date filter
 * @param endDate - Optional end date filter
 * @returns Array of score history entries with score change
 */
export async function getScoreHistory(
  projectId: string,
  startDate?: Date,
  endDate?: Date
): Promise<ScoreHistory[]> {
  // Build query filters
  const where: any = { projectId };

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = startDate;
    }
    if (endDate) {
      where.createdAt.lte = endDate;
    }
  }

  // Fetch scores ordered by timestamp descending
  const scores = await prisma.sEOScore.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  // Calculate score changes
  const history: ScoreHistory[] = scores.map((score, index) => {
    const previous = scores[index + 1];
    let scoreChange: number | null = null;

    if (previous) {
      scoreChange = ((score.score - previous.score) / previous.score) * 100;
    }

    return {
      score: score.score,
      url: score.url,
      date: score.createdAt,
      scoreChange,
    };
  });

  return history;
}
