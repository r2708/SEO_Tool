import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/authenticate';
import { FormattedResponse } from '../middleware/responseFormatter';
import { CachedKeywordService } from '../services/keyword/cachedKeywordService';
import { RedisCache } from '../services/cache/RedisCache';
import { config } from '../config/env';
import { ValidationError } from '../errors/ValidationError';
import { AuthorizationError } from '../errors/AuthorizationError';
import * as projectService from '../services/project/projectService';

const router = Router();

// Initialize cache and cached keyword service
const cache = new RedisCache(config.REDIS_URL);
const keywordService = new CachedKeywordService(cache);

/**
 * POST /api/keywords/research
 * Research and store keywords for a project
 * Requires authentication and project ownership
 * Validates: Requirements 5.1, 5.2
 */
router.post('/research', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { projectId, keywords } = req.body;
    const userId = req.user!.id;

    // Validate request body
    if (!projectId) {
      throw new ValidationError('projectId is required');
    }

    if (!keywords || !Array.isArray(keywords)) {
      throw new ValidationError('keywords must be an array');
    }

    if (keywords.length === 0) {
      throw new ValidationError('keywords array cannot be empty');
    }

    // Verify project ownership
    const isOwner = await projectService.verifyOwnership(projectId, userId);
    if (!isOwner) {
      throw new AuthorizationError('You do not have permission to access this project');
    }

    // Research and store keywords
    const results = await keywordService.research(projectId, keywords);

    // Format response
    const formattedResults = results.map(keyword => ({
      keyword: keyword.keyword,
      searchVolume: keyword.searchVolume,
      difficulty: parseFloat(keyword.difficulty.toString()),
      cpc: parseFloat(keyword.cpc.toString()),
      lastUpdated: keyword.lastUpdated.toISOString(),
    }));

    (res as FormattedResponse).success({ keywords: formattedResults });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/keywords/:projectId
 * List all keywords for a project with current rank if available and pagination
 * Requires authentication and project ownership
 * Validates: Requirements 5.1, 5.2, 20.4, 20.5
 */
router.get('/:projectId', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { projectId } = req.params;
    const userId = req.user!.id;

    // Verify project ownership
    const isOwner = await projectService.verifyOwnership(projectId, userId);
    if (!isOwner) {
      throw new AuthorizationError('You do not have permission to access this project');
    }

    // Parse pagination parameters
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const parsedPageSize = parseInt(req.query.pageSize as string);
    const pageSize = Math.min(100, Math.max(1, isNaN(parsedPageSize) ? 50 : parsedPageSize));

    // Calculate skip and take for Prisma
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    // Get keywords with current rank (uses caching)
    const { keywords, total } = await keywordService.findByProject(projectId, skip, take);

    // Format response
    const formattedKeywords = keywords.map(keyword => ({
      id: keyword.id,
      keyword: keyword.keyword,
      searchVolume: keyword.searchVolume,
      difficulty: parseFloat(keyword.difficulty.toString()),
      cpc: parseFloat(keyword.cpc.toString()),
      currentRank: keyword.currentRank,
      lastUpdated: keyword.lastUpdated instanceof Date 
        ? keyword.lastUpdated.toISOString() 
        : keyword.lastUpdated, // Already a string from cache
    }));

    // Calculate total pages
    const totalPages = Math.ceil(total / pageSize);

    (res as FormattedResponse).success({
      keywords: formattedKeywords,
      pagination: {
        total,
        page,
        pageSize,
        totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
