import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import * as projectService from './projectService';
import { ValidationError } from '../../errors/ValidationError';
import { AuthorizationError } from '../../errors/AuthorizationError';
import { NotFoundError } from '../../errors/NotFoundError';

const prisma = new PrismaClient();

describe('Project Service', () => {
  let testUserId: string;
  let testUserId2: string;

  beforeEach(async () => {
    // Create test users
    const user1 = await prisma.user.create({
      data: {
        email: `test-${Date.now()}@example.com`,
        password: 'hashedpassword',
        role: 'Free',
      },
    });
    testUserId = user1.id;

    const user2 = await prisma.user.create({
      data: {
        email: `test2-${Date.now()}@example.com`,
        password: 'hashedpassword',
        role: 'Free',
      },
    });
    testUserId2 = user2.id;
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.project.deleteMany({
      where: {
        userId: {
          in: [testUserId, testUserId2],
        },
      },
    });
    await prisma.user.deleteMany({
      where: {
        id: {
          in: [testUserId, testUserId2],
        },
      },
    });
  });

  describe('validateDomain', () => {
    it('should accept valid domain without protocol', () => {
      expect(projectService.validateDomain('example.com')).toBe(true);
      expect(projectService.validateDomain('subdomain.example.com')).toBe(true);
      expect(projectService.validateDomain('my-site.co.uk')).toBe(true);
    });

    it('should reject domain with protocol', () => {
      expect(projectService.validateDomain('https://example.com')).toBe(false);
      expect(projectService.validateDomain('http://example.com')).toBe(false);
    });

    it('should reject invalid domain formats', () => {
      expect(projectService.validateDomain('not a domain')).toBe(false);
      expect(projectService.validateDomain('example')).toBe(false);
      expect(projectService.validateDomain('.com')).toBe(false);
    });
  });

  describe('create', () => {
    it('should create a project with valid domain', async () => {
      const project = await projectService.create(testUserId, 'example.com');

      expect(project).toBeDefined();
      expect(project.domain).toBe('example.com');
      expect(project.userId).toBe(testUserId);
      expect(project.name).toBe('example.com'); // Default name
    });

    it('should create a project with custom name', async () => {
      const project = await projectService.create(
        testUserId,
        'example.com',
        'My Project'
      );

      expect(project.name).toBe('My Project');
    });

    it('should throw ValidationError for invalid domain', async () => {
      await expect(
        projectService.create(testUserId, 'https://example.com')
      ).rejects.toThrow(ValidationError);
    });

    it('should initialize empty keywords and competitors collections', async () => {
      const project = await projectService.create(testUserId, 'example.com');

      const projectWithCounts = await prisma.project.findUnique({
        where: { id: project.id },
        include: {
          _count: {
            select: {
              keywords: true,
              competitors: true,
            },
          },
        },
      });

      expect(projectWithCounts?._count.keywords).toBe(0);
      expect(projectWithCounts?._count.competitors).toBe(0);
    });
  });

  describe('findByUser', () => {
    it('should return only projects owned by the user', async () => {
      // Create projects for user 1
      await projectService.create(testUserId, 'example1.com');
      await projectService.create(testUserId, 'example2.com');

      // Create project for user 2
      await projectService.create(testUserId2, 'example3.com');

      const user1Projects = await projectService.findByUser(testUserId);
      const user2Projects = await projectService.findByUser(testUserId2);

      expect(user1Projects).toHaveLength(2);
      expect(user2Projects).toHaveLength(1);
      expect(user1Projects.every(p => p.userId === testUserId)).toBe(true);
      expect(user2Projects.every(p => p.userId === testUserId2)).toBe(true);
    });

    it('should return projects with keyword and competitor counts', async () => {
      const project = await projectService.create(testUserId, 'example.com');

      // Add a keyword
      await prisma.keyword.create({
        data: {
          projectId: project.id,
          keyword: 'test keyword',
          searchVolume: 1000,
          difficulty: 50,
          cpc: 1.5,
        },
      });

      // Add a competitor
      await prisma.competitor.create({
        data: {
          projectId: project.id,
          domain: 'competitor.com',
        },
      });

      const projects = await projectService.findByUser(testUserId);

      expect(projects[0].keywordCount).toBe(1);
      expect(projects[0].competitorCount).toBe(1);
    });

    it('should return empty array for user with no projects', async () => {
      const projects = await projectService.findByUser(testUserId);
      expect(projects).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should return project when it exists', async () => {
      const created = await projectService.create(testUserId, 'example.com');
      const found = await projectService.findById(created.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.domain).toBe('example.com');
    });

    it('should return null when project does not exist', async () => {
      const found = await projectService.findById('non-existent-id');
      expect(found).toBeNull();
    });
  });

  describe('verifyOwnership', () => {
    it('should return true when user owns the project', async () => {
      const project = await projectService.create(testUserId, 'example.com');
      const isOwner = await projectService.verifyOwnership(project.id, testUserId);

      expect(isOwner).toBe(true);
    });

    it('should return false when user does not own the project', async () => {
      const project = await projectService.create(testUserId, 'example.com');
      const isOwner = await projectService.verifyOwnership(project.id, testUserId2);

      expect(isOwner).toBe(false);
    });

    it('should return false when project does not exist', async () => {
      const isOwner = await projectService.verifyOwnership('non-existent-id', testUserId);
      expect(isOwner).toBe(false);
    });
  });

  describe('update', () => {
    it('should update project domain when user owns it', async () => {
      const project = await projectService.create(testUserId, 'example.com');
      const updated = await projectService.update(project.id, testUserId, {
        domain: 'newdomain.com',
      });

      expect(updated.domain).toBe('newdomain.com');
    });

    it('should update project name when user owns it', async () => {
      const project = await projectService.create(testUserId, 'example.com');
      const updated = await projectService.update(project.id, testUserId, {
        name: 'Updated Name',
      });

      expect(updated.name).toBe('Updated Name');
    });

    it('should throw NotFoundError when project does not exist', async () => {
      await expect(
        projectService.update('non-existent-id', testUserId, { name: 'Test' })
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw AuthorizationError when user does not own project', async () => {
      const project = await projectService.create(testUserId, 'example.com');

      await expect(
        projectService.update(project.id, testUserId2, { name: 'Test' })
      ).rejects.toThrow(AuthorizationError);
    });

    it('should throw ValidationError for invalid domain', async () => {
      const project = await projectService.create(testUserId, 'example.com');

      await expect(
        projectService.update(project.id, testUserId, {
          domain: 'https://invalid.com',
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('deleteProject', () => {
    it('should delete project when user owns it', async () => {
      const project = await projectService.create(testUserId, 'example.com');

      await projectService.deleteProject(project.id, testUserId);

      const found = await projectService.findById(project.id);
      expect(found).toBeNull();
    });

    it('should cascade delete related keywords', async () => {
      const project = await projectService.create(testUserId, 'example.com');

      // Add a keyword
      const keyword = await prisma.keyword.create({
        data: {
          projectId: project.id,
          keyword: 'test keyword',
          searchVolume: 1000,
          difficulty: 50,
          cpc: 1.5,
        },
      });

      await projectService.deleteProject(project.id, testUserId);

      // Verify keyword was deleted
      const foundKeyword = await prisma.keyword.findUnique({
        where: { id: keyword.id },
      });
      expect(foundKeyword).toBeNull();
    });

    it('should cascade delete related competitors', async () => {
      const project = await projectService.create(testUserId, 'example.com');

      // Add a competitor
      const competitor = await prisma.competitor.create({
        data: {
          projectId: project.id,
          domain: 'competitor.com',
        },
      });

      await projectService.deleteProject(project.id, testUserId);

      // Verify competitor was deleted
      const foundCompetitor = await prisma.competitor.findUnique({
        where: { id: competitor.id },
      });
      expect(foundCompetitor).toBeNull();
    });

    it('should throw NotFoundError when project does not exist', async () => {
      await expect(
        projectService.deleteProject('non-existent-id', testUserId)
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw AuthorizationError when user does not own project', async () => {
      const project = await projectService.create(testUserId, 'example.com');

      await expect(
        projectService.deleteProject(project.id, testUserId2)
      ).rejects.toThrow(AuthorizationError);
    });
  });
});
