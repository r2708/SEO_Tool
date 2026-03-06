import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';

const prisma = new PrismaClient();

/**
 * Dashboard Service
 * 
 * Aggregates metrics across all user projects:
 * - Total keywords count
 * - Average ranking position
 * - Rank change percentage vs previous 30-day period
 * - Total projects count
 * - Most recent SEO score for each project
 * 
 * Performance requirement: Must complete within 500ms
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */

export interface DashboardMetrics {
  totalKeywords: number;
  averageRank: number;
  rankChange: number;
  totalProjects: number;
  recentScores: Array<{
    projectId: string;
    projectName: string;
    score: number;
    date: Date;
  }>;
}

/**
 * Get dashboard metrics for a user
 * Aggregates data across all user projects
 * @param userId - User ID
 * @returns Dashboard metrics
 */
export async function getMetrics(userId: string): Promise<DashboardMetrics> {
  const startTime = Date.now();

  try {
    // Execute all queries in parallel for performance
    const [
      projects,
      totalKeywords,
      currentRankings,
      previousRankings,
      recentScores,
    ] = await Promise.all([
      // Get all user projects
      prisma.project.findMany({
        where: { userId },
        select: { id: true, name: true },
      }),

      // Count total keywords across all projects
      prisma.keyword.count({
        where: {
          project: { userId },
        },
      }),

      // Get most recent rankings for each keyword (current period)
      getCurrentRankings(userId),

      // Get rankings from 30 days ago (previous period)
      getPreviousRankings(userId),

      // Get most recent SEO score for each project
      getRecentScores(userId),
    ]);

    // Calculate average rank from current rankings
    const averageRank = calculateAverageRank(currentRankings);

    // Calculate rank change percentage
    const rankChange = calculateRankChange(currentRankings, previousRankings);

    const metrics: DashboardMetrics = {
      totalKeywords,
      averageRank,
      rankChange,
      totalProjects: projects.length,
      recentScores,
    };

    const duration = Date.now() - startTime;
    logger.info(`Dashboard metrics calculated in ${duration}ms for user ${userId}`);

    // Log warning if exceeding performance requirement
    if (duration > 500) {
      logger.warn(`Dashboard metrics exceeded 500ms threshold: ${duration}ms`);
    }

    return metrics;
  } catch (error) {
    logger.error('Failed to get dashboard metrics', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get current rankings (most recent for each keyword)
 * @param userId - User ID
 * @returns Array of current rankings
 */
async function getCurrentRankings(userId: string): Promise<Array<{ keyword: string; position: number }>> {
  // Get all project IDs for the user
  const projects = await prisma.project.findMany({
    where: { userId },
    select: { id: true },
  });

  const projectIds = projects.map((p) => p.id);

  if (projectIds.length === 0) {
    return [];
  }

  // Get the most recent ranking for each keyword across all projects
  const rankings = await prisma.ranking.groupBy({
    by: ['projectId', 'keyword'],
    where: {
      projectId: { in: projectIds },
    },
    _max: {
      date: true,
    },
  });

  // Fetch the actual position values for the most recent dates
  const currentRankings = await Promise.all(
    rankings.map(async (r) => {
      const ranking = await prisma.ranking.findFirst({
        where: {
          projectId: r.projectId,
          keyword: r.keyword,
          date: r._max.date!,
        },
        select: {
          keyword: true,
          position: true,
        },
      });
      return ranking;
    })
  );

  return currentRankings.filter((r): r is { keyword: string; position: number } => r !== null);
}

/**
 * Get rankings from 30 days ago
 * @param userId - User ID
 * @returns Array of previous rankings
 */
async function getPreviousRankings(userId: string): Promise<Array<{ keyword: string; position: number }>> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get all project IDs for the user
  const projects = await prisma.project.findMany({
    where: { userId },
    select: { id: true },
  });

  const projectIds = projects.map((p) => p.id);

  if (projectIds.length === 0) {
    return [];
  }

  // Get rankings closest to 30 days ago for each keyword
  const rankings = await prisma.ranking.findMany({
    where: {
      projectId: { in: projectIds },
      date: {
        lte: thirtyDaysAgo,
      },
    },
    orderBy: {
      date: 'desc',
    },
  });

  // Group by keyword and take the most recent one before 30 days ago
  const keywordMap = new Map<string, { keyword: string; position: number }>();
  
  for (const ranking of rankings) {
    const key = `${ranking.projectId}-${ranking.keyword}`;
    if (!keywordMap.has(key)) {
      keywordMap.set(key, {
        keyword: ranking.keyword,
        position: ranking.position,
      });
    }
  }

  return Array.from(keywordMap.values());
}

/**
 * Get most recent SEO score for each project
 * @param userId - User ID
 * @returns Array of recent scores
 */
async function getRecentScores(
  userId: string
): Promise<Array<{ projectId: string; projectName: string; score: number; date: Date }>> {
  // Get all projects with their most recent SEO score
  const projects = await prisma.project.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      seoScores: {
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
        select: {
          score: true,
          createdAt: true,
        },
      },
    },
  });

  // Map to the required format, filtering out projects without scores
  return projects
    .filter((p) => p.seoScores.length > 0)
    .map((p) => ({
      projectId: p.id,
      projectName: p.name,
      score: p.seoScores[0].score,
      date: p.seoScores[0].createdAt,
    }));
}

/**
 * Calculate average ranking position
 * @param rankings - Array of current rankings
 * @returns Average position (0 if no rankings)
 */
function calculateAverageRank(rankings: Array<{ keyword: string; position: number }>): number {
  if (rankings.length === 0) {
    return 0;
  }

  const sum = rankings.reduce((acc, r) => acc + r.position, 0);
  return Math.round((sum / rankings.length) * 100) / 100; // Round to 2 decimal places
}

/**
 * Calculate rank change percentage vs previous period
 * Positive change means improvement (lower position number)
 * @param currentRankings - Current rankings
 * @param previousRankings - Rankings from 30 days ago
 * @returns Percentage change (positive = improvement)
 */
function calculateRankChange(
  currentRankings: Array<{ keyword: string; position: number }>,
  previousRankings: Array<{ keyword: string; position: number }>
): number {
  if (currentRankings.length === 0 || previousRankings.length === 0) {
    return 0;
  }

  // Create a map of previous rankings by keyword
  const previousMap = new Map<string, number>();
  previousRankings.forEach((r) => {
    previousMap.set(r.keyword, r.position);
  });

  // Calculate change for keywords that exist in both periods
  let totalChange = 0;
  let matchingKeywords = 0;

  currentRankings.forEach((current) => {
    const previous = previousMap.get(current.keyword);
    if (previous !== undefined) {
      // Lower position is better, so improvement is negative change
      // We invert it so positive percentage means improvement
      const change = previous - current.position;
      totalChange += change;
      matchingKeywords++;
    }
  });

  if (matchingKeywords === 0) {
    return 0;
  }

  // Calculate average change
  const avgChange = totalChange / matchingKeywords;
  
  // Calculate percentage based on average previous position
  const matchingPrevious = currentRankings
    .filter((c) => previousMap.has(c.keyword))
    .map((c) => previousMap.get(c.keyword)!);
  
  const avgPreviousPosition = matchingPrevious.reduce((a, b) => a + b, 0) / matchingPrevious.length;

  if (avgPreviousPosition === 0) {
    return 0;
  }

  const percentageChange = (avgChange / avgPreviousPosition) * 100;
  return Math.round(percentageChange * 100) / 100; // Round to 2 decimal places
}
