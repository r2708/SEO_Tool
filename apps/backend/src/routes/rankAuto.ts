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
    
    // Track rankings for all keywords using SerpAPI
    const results = await trackKeywordRankingsWithSerpApi(
      projectId, 
      keywordStrings, 
      project.domain
    );

    (res as FormattedResponse).success({
      projectId,
      domain: project.domain,
      trackedKeywords: keywordStrings.length,
      results,
      summary: {
        found: results.filter((r: any) => r.position !== null).length,
        notFound: results.filter((r: any) => r.position === null).length,
        errors: results.filter((r: any) => r.error).length
      }
    });

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

export default router;
