import { PrismaClient, Ranking } from '@prisma/client';
import { ValidationError } from '../../errors/ValidationError';
import { NotFoundError } from '../../errors/NotFoundError';
import { logger } from '../../utils/logger';

const prisma = new PrismaClient();

/**
 * Ranking record structure
 */
export interface RankRecord {
  id: string;
  projectId: string;
  keyword: string;
  position: number;
  date: string;  // YYYY-MM-DD
}

/**
 * Ranking history entry with change calculation
 */
export interface RankHistoryEntry {
  date: string;
  position: number;
  change?: number;  // Change vs previous period
}

/**
 * Ranking history grouped by keyword
 */
export interface RankHistory {
  keyword: string;
  history: RankHistoryEntry[];
}

/**
 * Track a keyword ranking for a project
 * Implements upsert logic for same keyword + date
 * @param projectId - Project ID
 * @param keyword - Keyword being tracked
 * @param position - Position in search results (1-100)
 * @param date - Optional date (defaults to today in YYYY-MM-DD format)
 * @returns Stored ranking record
 * @throws NotFoundError if project doesn't exist
 * @throws ValidationError if data constraints are violated
 */
export async function track(
  projectId: string,
  keyword: string,
  position: number,
  date?: Date
): Promise<RankRecord> {
  // Verify project exists
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new NotFoundError('Project');
  }

  // Validate inputs
  validateRankingData(keyword, position);

  // Use provided date or default to today
  const rankDate = date || new Date();
  // Normalize date to remove time component (start of day in UTC)
  const normalizedDate = new Date(Date.UTC(rankDate.getUTCFullYear(), rankDate.getUTCMonth(), rankDate.getUTCDate()));
  const dateString = formatDate(normalizedDate);

  // Upsert ranking (update if exists for same keyword + date, create if not)
  // Check if ranking exists first to determine if this is create or update
  const existingRanking = await prisma.ranking.findUnique({
    where: {
      projectId_keyword_date: {
        projectId,
        keyword,
        date: normalizedDate,
      },
    },
  });

  const isUpdate = existingRanking !== null;

  const ranking = await prisma.ranking.upsert({
    where: {
      projectId_keyword_date: {
        projectId,
        keyword,
        date: normalizedDate,
      },
    },
    update: {
      position,
    },
    create: {
      projectId,
      keyword,
      position,
      date: normalizedDate,
    },
  });

  logger.info(`${isUpdate ? 'Updated' : 'Created'} ranking for keyword "${keyword}" at position ${position} for project ${projectId}`);

  return {
    id: ranking.id,
    projectId: ranking.projectId,
    keyword: ranking.keyword,
    position: ranking.position,
    date: formatDate(ranking.date),
    isUpdate,
  };
}

/**
 * Get ranking history for a project with optional filters and pagination
 * @param projectId - Project ID
 * @param keyword - Optional keyword filter
 * @param startDate - Optional start date filter
 * @param endDate - Optional end date filter
 * @param skip - Number of records to skip (for pagination)
 * @param take - Number of records to take (for pagination)
 * @returns Object with ranking history array and total count
 */
export async function getHistory(
  projectId: string,
  keyword?: string,
  startDate?: Date,
  endDate?: Date,
  skip?: number,
  take?: number
): Promise<{ history: RankHistory[]; total: number }> {
  // Default date range to last 30 days if not specified
  const end = endDate || new Date();
  const start = startDate || new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Normalize dates to start of day (remove time component) in UTC
  const normalizedStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const normalizedEnd = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate(), 23, 59, 59, 999));

  // Build query filters
  const where: any = {
    projectId,
    date: {
      gte: normalizedStart,
      lte: normalizedEnd,
    },
  };

  if (keyword) {
    where.keyword = keyword;
  }

  // Get total count
  const total = await prisma.ranking.count({ where });

  // Fetch rankings ordered by date descending
  const rankings = await prisma.ranking.findMany({
    where,
    orderBy: { date: 'desc' },
    skip,
    take,
  });

  // Group by keyword
  const grouped = groupByKeyword(rankings);

  // Calculate rank changes
  const withChanges = grouped.map(group => ({
    keyword: group.keyword,
    history: calculateChanges(group.history),
  }));

  return { history: withChanges, total };
}

/**
 * Validate ranking data constraints
 * @param keyword - Keyword to validate
 * @param position - Position to validate
 * @throws ValidationError if constraints are violated
 */
function validateRankingData(keyword: string, position: number): void {
  // Trim keyword and check if empty
  const trimmedKeyword = keyword.trim();
  if (!trimmedKeyword || trimmedKeyword.length === 0) {
    throw new ValidationError('Keyword cannot be empty');
  }

  if (keyword.length > 200) {
    throw new ValidationError('Keyword cannot exceed 200 characters');
  }

  if (!Number.isInteger(position)) {
    throw new ValidationError('Position must be an integer');
  }

  if (position < 1 || position > 100) {
    throw new ValidationError('Position must be between 1 and 100');
  }
}

/**
 * Format date to YYYY-MM-DD string using UTC
 * @param date - Date to format
 * @returns Formatted date string
 */
function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Group rankings by keyword
 * @param rankings - Array of rankings
 * @returns Array of ranking history grouped by keyword
 */
function groupByKeyword(rankings: Ranking[]): RankHistory[] {
  const groups = new Map<string, RankHistoryEntry[]>();

  for (const ranking of rankings) {
    const keyword = ranking.keyword;
    if (!groups.has(keyword)) {
      groups.set(keyword, []);
    }

    groups.get(keyword)!.push({
      date: formatDate(ranking.date),
      position: ranking.position,
    });
  }

  return Array.from(groups.entries()).map(([keyword, history]) => ({
    keyword,
    history,
  }));
}

/**
 * Calculate rank changes vs previous period
 * Assumes history is ordered by date descending
 * @param history - Array of ranking history entries
 * @returns History with change calculations
 */
function calculateChanges(history: RankHistoryEntry[]): RankHistoryEntry[] {
  if (history.length === 0) {
    return history;
  }

  const result: RankHistoryEntry[] = [];

  for (let i = 0; i < history.length; i++) {
    const current = history[i];
    const previous = history[i + 1];

    if (previous) {
      // Calculate change (negative means improvement in ranking)
      const change = current.position - previous.position;
      result.push({ ...current, change });
    } else {
      // No previous data
      result.push({ ...current });
    }
  }

  return result;
}
