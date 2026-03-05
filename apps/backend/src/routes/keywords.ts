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
 * List all keywords for a project with current rank if available
 * Requires authentication and project ownership
 * Validates: Requirements 5.1, 5.2
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

    // Get keywords with current rank (uses caching)
    const keywords = await keywordService.findByProject(projectId);

    // Format response
    const formattedKeywords = keywords.map(keyword => ({
      id: keyword.id,
      keyword: keyword.keyword,
      searchVolume: keyword.searchVolume,
      difficulty: parseFloat(keyword.difficulty.toString()),
      cpc: parseFloat(keyword.cpc.toString()),
      currentRank: keyword.currentRank,
      lastUpdated: keyword.lastUpdated.toISOString(),
    }));

    (res as FormattedResponse).success({ keywords: formattedKeywords });
  } catch (error) {
    next(error);
  }
});

export default router;
