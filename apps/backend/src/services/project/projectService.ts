import { PrismaClient, Project } from '@prisma/client';
import { ValidationError } from '../../errors/ValidationError';
import { AuthorizationError } from '../../errors/AuthorizationError';
import { NotFoundError } from '../../errors/NotFoundError';

const prisma = new PrismaClient();

/**
 * Project data with enriched counts
 */
export interface ProjectWithCounts extends Project {
  keywordCount: number;
  competitorCount: number;
}

/**
 * Clean and validate domain format
 * @param domain - Domain to validate and clean (e.g., "https://example.com" or "example.com")
 * @returns Cleaned domain if valid, null if invalid
 */
export function cleanAndValidateDomain(domain: string): string | null {
  if (!domain || typeof domain !== 'string') {
    return null;
  }

  // Remove protocol if present
  let cleanedDomain = domain.trim();
  if (cleanedDomain.includes('://')) {
    try {
      const url = new URL(cleanedDomain);
      cleanedDomain = url.hostname;
    } catch {
      // Fallback: split on :// and take the second part
      cleanedDomain = cleanedDomain.split('://')[1];
    }
  }

  // Remove www prefix if present (optional)
  if (cleanedDomain.startsWith('www.')) {
    cleanedDomain = cleanedDomain.substring(4);
  }

  // Remove path if present
  cleanedDomain = cleanedDomain.split('/')[0];

  // Basic domain format validation
  // Must have at least one dot and valid characters
  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?)*\.[a-zA-Z]{2,}$/;
  
  return domainRegex.test(cleanedDomain) ? cleanedDomain : null;
}

/**
 * Validate domain format (legacy function for backward compatibility)
 * @param domain - Domain to validate (e.g., "example.com")
 * @returns true if domain is valid, false otherwise
 */
export function validateDomain(domain: string): boolean {
  return cleanAndValidateDomain(domain) !== null;
}

/**
 * Get current time in IST
 * @returns Date object with IST time
 */
function getISTTime(): Date {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes
  return new Date(now.getTime() + istOffset);
}

/**
 * Create a new project for a user
 * @param userId - ID of the user creating the project
 * @param userEmail - Email of the user creating the project
 * @param domain - Domain for the project (e.g., "example.com")
 * @param name - Optional project name (defaults to domain)
 * @returns Created project
 * @throws ValidationError if domain format is invalid
 */
export async function create(
  userId: string,
  userEmail: string,
  domain: string,
  name?: string
): Promise<Project> {
  // Clean and validate domain format
  const cleanedDomain = cleanAndValidateDomain(domain);
  if (!cleanedDomain) {
    throw new ValidationError('Invalid domain format. Please provide a valid domain (e.g., "example.com" or "https://example.com")');
  }

  // Create project with creator information
  const project = await prisma.project.create({
    data: {
      userId,
      ownerEmail: userEmail,
      domain: cleanedDomain,
      name: name || cleanedDomain, // Default name to cleaned domain if not provided
      createdByEmail: userEmail,
      createdAt: getISTTime(),
      // updatedByEmail should be null on creation (only set when actually updated)
    },
  });

  return project;
}

/**
 * Find all projects owned by a user with pagination (excludes soft-deleted projects)
 * @param userId - ID of the user
 * @param skip - Number of records to skip (for pagination)
 * @param take - Number of records to take (for pagination)
 * @returns Array of projects with keyword and competitor counts
 */
export async function findByUser(
  userId: string,
  skip?: number,
  take?: number
): Promise<ProjectWithCounts[]> {
  const projects = await prisma.project.findMany({
    where: { 
      userId,
      deletedAt: null, // Only show non-deleted projects
    },
    include: {
      _count: {
        select: {
          keywords: true,
          competitors: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    skip,
    take,
  });

  // Map to include counts as top-level properties
  return projects.map(project => ({
    ...project,
    keywordCount: project._count.keywords,
    competitorCount: project._count.competitors,
  }));
}

/**
 * Find a project by ID (excludes soft-deleted projects)
 * @param projectId - ID of the project
 * @returns Project if found and not deleted, null otherwise
 */
export async function findById(projectId: string): Promise<Project | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  // Return null if project is soft-deleted
  if (project && project.deletedAt) {
    return null;
  }

  return project;
}

/**
 * Verify that a user owns a project
 * @param projectId - ID of the project
 * @param userId - ID of the user
 * @returns true if user owns the project, false otherwise
 */
export async function verifyOwnership(
  projectId: string,
  userId: string
): Promise<boolean> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    return false;
  }

  return project.userId === userId;
}

/**
 * Update a project
 * @param projectId - ID of the project to update
 * @param userId - ID of the user making the update
 * @param userEmail - Email of the user making the update
 * @param data - Partial project data to update
 * @returns Updated project
 * @throws NotFoundError if project doesn't exist
 * @throws AuthorizationError if user doesn't own the project
 * @throws ValidationError if domain format is invalid
 */
export async function update(
  projectId: string,
  userId: string,
  userEmail: string,
  data: Partial<Pick<Project, 'domain' | 'name'>>
): Promise<Project> {
  // Verify project exists
  const project = await findById(projectId);
  if (!project) {
    throw new NotFoundError('Project');
  }

  // Verify ownership
  if (project.userId !== userId) {
    throw new AuthorizationError('You do not have permission to update this project');
  }

  // Clean and validate domain if it's being updated
  let updateData = { ...data };
  if (data.domain) {
    const cleanedDomain = cleanAndValidateDomain(data.domain);
    if (!cleanedDomain) {
      throw new ValidationError('Invalid domain format. Please provide a valid domain (e.g., "example.com" or "https://example.com")');
    }
    updateData.domain = cleanedDomain;
  }

  // Update project
  const updatedProject = await prisma.project.update({
    where: { id: projectId },
    data: {
      ...updateData,
      updatedAt: getISTTime(),
      updatedByEmail: userEmail,
    },
  });

  return updatedProject;
}

/**
 * Soft delete a project (sets deletedAt timestamp, deletedBy user ID, and deletedByEmail)
 * @param projectId - ID of the project to delete
 * @param userId - ID of the user making the deletion
 * @param userEmail - Email of the user making the deletion
 * @throws NotFoundError if project doesn't exist or is already deleted
 * @throws AuthorizationError if user doesn't own the project
 */
export async function deleteProject(
  projectId: string,
  userId: string,
  userEmail: string
): Promise<void> {
  // Verify project exists and is not already deleted
  const project = await findById(projectId);
  if (!project) {
    throw new NotFoundError('Project');
  }

  // Verify ownership
  if (project.userId !== userId) {
    throw new AuthorizationError('You do not have permission to delete this project');
  }

  // Soft delete: set deletedAt timestamp and deletedByEmail
  await prisma.project.update({
    where: { id: projectId },
    data: {
      deletedAt: getISTTime(),
      deletedByEmail: userEmail,
    },
  });
}
