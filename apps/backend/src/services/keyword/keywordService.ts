import { PrismaClient, Keyword } from '@prisma/client';
import { ValidationError } from '../../errors/ValidationError';
import { NotFoundError } from '../../errors/NotFoundError';
import { logger } from '../../utils/logger';

const prisma = new PrismaClient();

/**
 * Keyword data structure for research operations
 */
export interface KeywordData {
  keyword: string;
  searchVolume: number;
  difficulty: number;  // 0-100
  cpc: number;        // USD
}

/**
 * Keyword with optional current rank
 */
export interface KeywordWithRank extends Keyword {
  currentRank?: number;
}

/**
 * Mock external keyword API to get metrics
 * In production, this would integrate with a real API like SEMrush, Ahrefs, etc.
 * @param keyword - Keyword to research
 * @returns Keyword metrics
 */
async function fetchKeywordMetrics(keyword: string): Promise<KeywordData> {
  // Mock implementation - generates realistic-looking data
  // In production, replace with actual API call
  const hash = keyword.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  return {
    keyword,
    searchVolume: Math.floor((hash % 50000) + 100),
    difficulty: parseFloat(((hash % 100) / 1.5 + 10).toFixed(2)),
    cpc: parseFloat(((hash % 500) / 100 + 0.5).toFixed(2)),
  };
}

/**
 * Research keywords and store their metrics
 * Implements batch processing and upsert logic
 * @param projectId - Project ID to associate keywords with
 * @param keywords - Array of keywords to research
 * @returns Array of stored keyword data
 * @throws NotFoundError if project doesn't exist
 * @throws ValidationError if data constraints are violated
 */
export async function research(
  projectId: string,
  keywords: string[]
): Promise<Keyword[]> {
  // Verify project exists
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new NotFoundError('Project');
  }

  // Validate keywords array
  if (!Array.isArray(keywords) || keywords.length === 0) {
    throw new ValidationError('Keywords must be a non-empty array');
  }

  // Process keywords in batches of 100
  const BATCH_SIZE = 100;
  const results: Keyword[] = [];

  for (let i = 0; i < keywords.length; i += BATCH_SIZE) {
    const batch = keywords.slice(i, i + BATCH_SIZE);
    
    // Fetch metrics for each keyword in the batch
    const keywordDataPromises = batch.map(keyword => fetchKeywordMetrics(keyword));
    const keywordDataArray = await Promise.all(keywordDataPromises);

    // Upsert keywords (update if exists, create if not)
    const upsertPromises = keywordDataArray.map(data => 
      upsert(projectId, data)
    );

    const batchResults = await Promise.all(upsertPromises);
    results.push(...batchResults);
  }

  logger.info(`Researched and stored ${results.length} keywords for project ${projectId}`);
  return results;
}

/**
 * Upsert a single keyword (update if exists, create if not)
 * @param projectId - Project ID
 * @param keywordData - Keyword data to store
 * @returns Stored keyword
 * @throws ValidationError if data constraints are violated
 */
export async function upsert(
  projectId: string,
  keywordData: KeywordData
): Promise<Keyword> {
  // Validate data constraints
  validateKeywordData(keywordData);

  const keyword = await prisma.keyword.upsert({
    where: {
      projectId_keyword: {
        projectId,
        keyword: keywordData.keyword,
      },
    },
    update: {
      searchVolume: keywordData.searchVolume,
      difficulty: keywordData.difficulty,
      cpc: keywordData.cpc,
      lastUpdated: new Date(),
    },
    create: {
      projectId,
      keyword: keywordData.keyword,
      searchVolume: keywordData.searchVolume,
      difficulty: keywordData.difficulty,
      cpc: keywordData.cpc,
      lastUpdated: new Date(),
    },
  });

  return keyword;
}

/**
 * Validate keyword data constraints
 * @param data - Keyword data to validate
 * @throws ValidationError if constraints are violated
 */
function validateKeywordData(data: KeywordData): void {
  if (!data.keyword || data.keyword.length === 0) {
    throw new ValidationError('Keyword cannot be empty');
  }

  if (data.keyword.length > 200) {
    throw new ValidationError('Keyword cannot exceed 200 characters');
  }

  if (!Number.isInteger(data.searchVolume) || data.searchVolume < 0) {
    throw new ValidationError('Search volume must be a non-negative integer');
  }

  if (typeof data.difficulty !== 'number' || data.difficulty < 0 || data.difficulty > 100) {
    throw new ValidationError('Difficulty must be a number between 0 and 100');
  }

  if (typeof data.cpc !== 'number' || data.cpc < 0) {
    throw new ValidationError('CPC must be a non-negative number');
  }
}

/**
 * Find all keywords for a project with optional current rank
 * @param projectId - Project ID
 * @returns Array of keywords with current rank if available
 */
export async function findByProject(projectId: string): Promise<KeywordWithRank[]> {
  const keywords = await prisma.keyword.findMany({
    where: { projectId },
    orderBy: { lastUpdated: 'desc' },
  });

  // Get current rankings for each keyword (most recent date)
  const keywordsWithRank = await Promise.all(
    keywords.map(async (keyword) => {
      const latestRanking = await prisma.ranking.findFirst({
        where: {
          projectId,
          keyword: keyword.keyword,
        },
        orderBy: { date: 'desc' },
      });

      return {
        ...keyword,
        currentRank: latestRanking?.position,
      };
    })
  );

  return keywordsWithRank;
}

/**
 * Delete a keyword
 * @param projectId - Project ID
 * @param keyword - Keyword to delete
 */
export async function deleteKeyword(
  projectId: string,
  keyword: string
): Promise<void> {
  await prisma.keyword.delete({
    where: {
      projectId_keyword: {
        projectId,
        keyword,
      },
    },
  });

  logger.info(`Deleted keyword "${keyword}" from project ${projectId}`);
}
