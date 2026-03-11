import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/authenticate';
import { FormattedResponse } from '../middleware/responseFormatter';
import { getSerpApiRank, trackKeywordRankingsWithSerpApi } from '../services/rank/serpApiRankTracker';
import * as projectService from '../services/project/projectService';
import * as keywordService from '../services/keyword/keywordService';
import { ValidationError, AuthorizationError } from '../errors';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

/**
 * POST /api/rank/auto-track
 * Automatically track rankings for all keywords in a project
 * Requires authentication and project ownership
 * 
 * NOTE: This starts a background job and returns immediately
 * Use GET /api/rank/history/:projectId to see results
 */
router.post('/auto-track', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { projectId } = req.body;
    const userId = req.user!.id;

    // Validate request
    if (!projectId) {
      throw new ValidationError('projectId is required');
    }

    // Verify project ownership
    const isOwner = await projectService.verifyOwnership(projectId, userId);
    if (!isOwner) {
      throw new AuthorizationError('You do not have permission to access this project');
    }

    // Get project details
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      throw new ValidationError('Project not found');
    }

    // Get all keywords for this project
    const { keywords } = await keywordService.findByProject(projectId);
    
    if (keywords.length === 0) {
      throw new ValidationError('No keywords found for this project');
    }

    // Extract keyword strings
    const keywordStrings = keywords.map(k => k.keyword);
    
    // Start background job (don't await)
    // This allows the response to return immediately
    trackKeywordRankingsWithSerpApi(
      projectId, 
      keywordStrings, 
      project.domain
    ).catch(error => {
      // Log error but don't throw (background job)
      console.error('Background ranking tracking error:', error);
    });

    // Return immediately with job started status
    (res as FormattedResponse).success({
      projectId,
      domain: project.domain,
      status: 'started',
      message: 'Ranking tracking started in background',
      totalKeywords: keywordStrings.length,
      estimatedTime: `${keywordStrings.length} seconds`,
      note: 'Check /api/rank/history/:projectId to see results'
    }, 202); // 202 Accepted - request accepted for processing

  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/rank/check-keyword
 * Check ranking for a single keyword
 * Requires authentication and project ownership
 */
router.post('/check-keyword', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { projectId, keyword } = req.body;
    const userId = req.user!.id;

    // Validate request
    if (!projectId) {
      throw new ValidationError('projectId is required');
    }

    if (!keyword) {
      throw new ValidationError('keyword is required');
    }

    // Verify project ownership
    const isOwner = await projectService.verifyOwnership(projectId, userId);
    if (!isOwner) {
      throw new AuthorizationError('You do not have permission to access this project');
    }

    // Get project details
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      throw new ValidationError('Project not found');
    }

    // Get ranking for keyword using SerpAPI
    const position = await getSerpApiRank(keyword, project.domain);

    (res as FormattedResponse).success({
      projectId,
      keyword,
      domain: project.domain,
      position,
      found: position !== null
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/rank/tracking-status/:projectId
 * Check if there are recent rankings (within last 5 minutes)
 * Helps determine if background tracking is complete
 */
router.get('/tracking-status/:projectId', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { projectId } = req.params;
    const userId = req.user!.id;

    // Verify project ownership
    const isOwner = await projectService.verifyOwnership(projectId, userId);
    if (!isOwner) {
      throw new AuthorizationError('You do not have permission to access this project');
    }

    // Get keywords count
    const { total: totalKeywords } = await keywordService.findByProject(projectId, 0, 1);

    // Get recent rankings (last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentRankings = await prisma.ranking.findMany({
      where: {
        projectId,
        date: {
          gte: fiveMinutesAgo
        }
      },
      distinct: ['keyword'],
      select: {
        keyword: true,
        position: true,
        date: true
      }
    });

    const trackedCount = recentRankings.length;
    const isComplete = trackedCount >= totalKeywords;

    (res as FormattedResponse).success({
      projectId,
      totalKeywords,
      trackedKeywords: trackedCount,
      isComplete,
      progress: totalKeywords > 0 ? Math.round((trackedCount / totalKeywords) * 100) : 0,
      recentRankings: recentRankings.map(r => ({
        keyword: r.keyword,
        position: r.position,
        date: r.date
      }))
    });

  } catch (error) {
    next(error);
  }
});

export default router;
