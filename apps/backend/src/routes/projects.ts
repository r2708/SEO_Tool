import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/authenticate';
import { FormattedResponse } from '../middleware/responseFormatter';
import * as projectService from '../services/project/projectService';
import { AuthorizationError } from '../errors/AuthorizationError';
import { NotFoundError } from '../errors/NotFoundError';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

/**
 * POST /api/projects
 * Create a new project
 * Requires authentication
 * Validates: Requirements 4.1, 4.2
 */
router.post('/', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { domain, name } = req.body;
    const userId = req.user!.id;
    const userEmail = req.user!.email;

    // Create project
    const project = await projectService.create(userId, userEmail, domain, name);

    // Return project data
    (res as FormattedResponse).success({
      id: project.id,
      ownerEmail: project.ownerEmail,
      domain: project.domain,
      name: project.name,
      createdByEmail: project.createdByEmail,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      updatedByEmail: project.updatedByEmail,
      deletedAt: project.deletedAt?.toISOString() || null,
      deletedByEmail: project.deletedByEmail,
    }, 201);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/projects
 * List all projects for the authenticated user with pagination
 * Returns enriched data with keyword count, competitor count, and last audit score
 * Requires authentication
 * Validates: Requirements 4.5, 20.4, 20.5
 */
router.get('/', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;

    // Parse pagination parameters
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const parsedPageSize = parseInt(req.query.pageSize as string);
    const pageSize = Math.min(100, Math.max(1, isNaN(parsedPageSize) ? 50 : parsedPageSize));

    // Calculate skip and take for Prisma
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    // Get total count
    const total = await prisma.project.count({
      where: { userId },
    });

    // Get projects with counts
    const projectsWithCounts = await projectService.findByUser(userId, skip, take);

    // Enrich with last audit score
    const enrichedProjects = await Promise.all(
      projectsWithCounts.map(async (project) => {
        // Get most recent SEO score for this project
        const lastScore = await prisma.sEOScore.findFirst({
          where: { projectId: project.id },
          orderBy: { createdAt: 'desc' },
          select: { score: true },
        });

        return {
          id: project.id,
          domain: project.domain,
          name: project.name,
          keywordCount: project.keywordCount,
          competitorCount: project.competitorCount,
          lastAuditScore: lastScore?.score,
          createdAt: project.createdAt.toISOString(),
        };
      })
    );

    // Calculate total pages
    const totalPages = Math.ceil(total / pageSize);

    (res as FormattedResponse).success({
      projects: enrichedProjects,
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

/**
 * GET /api/projects/:id
 * Get project details by ID
 * Returns enriched data with keyword count, competitor count, and last audit score
 * Requires authentication and ownership
 * Validates: Requirements 4.5, 4.6
 */
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const projectId = req.params.id;
    const userId = req.user!.id;

    // Get project first
    const project = await projectService.findById(projectId);
    if (!project) {
      throw new NotFoundError('Project');
    }

    // Verify ownership
    if (project.userId !== userId) {
      throw new AuthorizationError('You do not have permission to access this project');
    }

    // Get counts
    const counts = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        _count: {
          select: {
            keywords: true,
            competitors: true,
          },
        },
      },
    });

    // Get most recent SEO score
    const lastScore = await prisma.sEOScore.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: { score: true },
    });

    (res as FormattedResponse).success({
      id: project.id,
      domain: project.domain,
      name: project.name,
      keywordCount: counts?._count.keywords || 0,
      competitorCount: counts?._count.competitors || 0,
      lastAuditScore: lastScore?.score,
      createdAt: project.createdAt.toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/projects/:id
 * Update a project
 * Requires authentication and ownership
 * Validates: Requirements 4.6
 */
router.put('/:id', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const projectId = req.params.id;
    const userId = req.user!.id;
    const userEmail = req.user!.email;
    const { domain, name } = req.body;

    // Update project (service handles ownership verification)
    const updatedProject = await projectService.update(projectId, userId, userEmail, { domain, name });

    (res as FormattedResponse).success({
      id: updatedProject.id,
      domain: updatedProject.domain,
      name: updatedProject.name,
      updatedAt: updatedProject.updatedAt.toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/projects/:id
 * Delete a project and all related data
 * Requires authentication and ownership
 * Validates: Requirements 4.6
 */
router.delete('/:id', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const projectId = req.params.id;
    const userId = req.user!.id;
    const userEmail = req.user!.email;

    // Delete project (service handles ownership verification and soft delete)
    await projectService.deleteProject(projectId, userId, userEmail);

    (res as FormattedResponse).success({});
  } catch (error) {
    next(error);
  }
});

export default router;
