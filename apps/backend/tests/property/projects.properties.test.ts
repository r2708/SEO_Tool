import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { PrismaClient } from '@prisma/client';
import * as projectService from '../../src/services/project/projectService';
import { ValidationError } from '../../src/errors/ValidationError';
import { AuthorizationError } from '../../src/errors/AuthorizationError';

const prisma = new PrismaClient();

/**
 * Custom arbitraries for project testing
 */
const validDomainArbitrary = fc.oneof(
  fc.domain(),
  fc.tuple(fc.domain(), fc.domain()).map(([sub, domain]) => `${sub}.${domain}`)
);

const invalidDomainArbitrary = fc.oneof(
  fc.string().map(s => `https://${s}`),
  fc.string().map(s => `http://${s}`),
  fc.constant('not a domain'),
  fc.constant('example'),
  fc.constant('.com'),
  fc.string().filter(s => !s.includes('.'))
);

const projectNameArbitrary = fc.string({ minLength: 1, maxLength: 100 });

/**
 * Feature: seo-saas-platform, Project Operations Properties
 */
describe('Feature: seo-saas-platform, Project Operations Properties', () => {
  let testUsers: string[] = [];

  beforeEach(async () => {
    // Clean up any existing test data
    testUsers = [];
  });

  afterEach(async () => {
    // Clean up all test users and their projects
    if (testUsers.length > 0) {
      await prisma.project.deleteMany({
        where: { userId: { in: testUsers } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: testUsers } },
      });
    }
  });

  /**
   * **Validates: Requirements 4.1**
   * 
   * Property 13: Domain Format Validation
   * For any project creation request, the Platform should validate that the domain 
   * follows valid domain format (e.g., "example.com" without protocol) and reject 
   * invalid formats.
   */
  describe('Property 13: Domain Format Validation', () => {
    it('should accept valid domain formats without protocol', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDomainArbitrary,
          async (domain) => {
            // Create test user
            const user = await prisma.user.create({
              data: {
                email: `test-${Date.now()}-${Math.random()}@example.com`,
                password: 'hashedpassword',
                role: 'Free',
              },
            });
            testUsers.push(user.id);

            // Valid domain should be accepted
            const isValid = projectService.validateDomain(domain);
            expect(isValid).toBe(true);

            // Should be able to create project with valid domain
            const project = await projectService.create(user.id, domain);
            expect(project.domain).toBe(domain);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid domain formats', async () => {
      await fc.assert(
        fc.asyncProperty(
          invalidDomainArbitrary,
          async (invalidDomain) => {
            // Create test user
            const user = await prisma.user.create({
              data: {
                email: `test-${Date.now()}-${Math.random()}@example.com`,
                password: 'hashedpassword',
                role: 'Free',
              },
            });
            testUsers.push(user.id);

            // Invalid domain should be rejected
            const isValid = projectService.validateDomain(invalidDomain);
            expect(isValid).toBe(false);

            // Should throw ValidationError when trying to create project
            await expect(
              projectService.create(user.id, invalidDomain)
            ).rejects.toThrow(ValidationError);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Validates: Requirements 4.2**
   * 
   * Property 14: Project Storage Round-Trip
   * For any valid project creation request, after creating the project, querying 
   * the database should return a project with matching domain, user ID, and a 
   * creation timestamp.
   */
  describe('Property 14: Project Storage Round-Trip', () => {
    it('should store and retrieve project data correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDomainArbitrary,
          fc.option(projectNameArbitrary, { nil: undefined }),
          async (domain, name) => {
            // Create test user
            const user = await prisma.user.create({
              data: {
                email: `test-${Date.now()}-${Math.random()}@example.com`,
                password: 'hashedpassword',
                role: 'Free',
              },
            });
            testUsers.push(user.id);

            // Create project
            const createdProject = await projectService.create(user.id, domain, name);

            // Query database directly
            const storedProject = await prisma.project.findUnique({
              where: { id: createdProject.id },
            });

            // Verify data matches
            expect(storedProject).toBeDefined();
            expect(storedProject!.domain).toBe(domain);
            expect(storedProject!.userId).toBe(user.id);
            expect(storedProject!.name).toBe(name || domain); // Default name is domain
            expect(storedProject!.createdAt).toBeDefined();
            expect(storedProject!.createdAt).toBeInstanceOf(Date);

            // Verify through service method
            const foundProject = await projectService.findById(createdProject.id);
            expect(foundProject).toBeDefined();
            expect(foundProject!.domain).toBe(domain);
            expect(foundProject!.userId).toBe(user.id);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Validates: Requirements 4.3**
   * 
   * Property 15: Multiple Projects Per User
   * For any user, creating multiple projects should result in all projects being 
   * associated with that user's ID and retrievable via user project queries.
   */
  describe('Property 15: Multiple Projects Per User', () => {
    it('should allow users to create and retrieve multiple projects', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(validDomainArbitrary, { minLength: 1, maxLength: 5 }),
          async (domains) => {
            // Create test user
            const user = await prisma.user.create({
              data: {
                email: `test-${Date.now()}-${Math.random()}@example.com`,
                password: 'hashedpassword',
                role: 'Free',
              },
            });
            testUsers.push(user.id);

            // Create multiple projects for the user
            const createdProjects = [];
            for (const domain of domains) {
              const project = await projectService.create(user.id, domain);
              createdProjects.push(project);
            }

            // Retrieve all projects for the user
            const userProjects = await projectService.findByUser(user.id);

            // Verify all projects are associated with the user
            expect(userProjects).toHaveLength(domains.length);
            expect(userProjects.every(p => p.userId === user.id)).toBe(true);

            // Verify all created projects are in the retrieved list
            const retrievedIds = userProjects.map(p => p.id);
            for (const created of createdProjects) {
              expect(retrievedIds).toContain(created.id);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Validates: Requirements 4.4**
   * 
   * Property 16: New Project Initialization
   * For any newly created project, the keywords and competitors collections 
   * should be empty (zero count).
   */
  describe('Property 16: New Project Initialization', () => {
    it('should initialize projects with empty keywords and competitors', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDomainArbitrary,
          async (domain) => {
            // Create test user
            const user = await prisma.user.create({
              data: {
                email: `test-${Date.now()}-${Math.random()}@example.com`,
                password: 'hashedpassword',
                role: 'Free',
              },
            });
            testUsers.push(user.id);

            // Create project
            const project = await projectService.create(user.id, domain);

            // Query project with counts
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

            // Verify empty collections
            expect(projectWithCounts).toBeDefined();
            expect(projectWithCounts!._count.keywords).toBe(0);
            expect(projectWithCounts!._count.competitors).toBe(0);

            // Verify through service method
            const userProjects = await projectService.findByUser(user.id);
            const foundProject = userProjects.find(p => p.id === project.id);
            expect(foundProject).toBeDefined();
            expect(foundProject!.keywordCount).toBe(0);
            expect(foundProject!.competitorCount).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Validates: Requirements 4.5**
   * 
   * Property 17: Project Data Isolation
   * For any user, querying their projects should return only projects where the 
   * userId matches their ID, never returning projects owned by other users.
   */
  describe('Property 17: Project Data Isolation', () => {
    it('should return only projects owned by the requesting user', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(validDomainArbitrary, { minLength: 1, maxLength: 3 }),
          fc.array(validDomainArbitrary, { minLength: 1, maxLength: 3 }),
          async (user1Domains, user2Domains) => {
            // Create two test users
            const user1 = await prisma.user.create({
              data: {
                email: `test1-${Date.now()}-${Math.random()}@example.com`,
                password: 'hashedpassword',
                role: 'Free',
              },
            });
            testUsers.push(user1.id);

            const user2 = await prisma.user.create({
              data: {
                email: `test2-${Date.now()}-${Math.random()}@example.com`,
                password: 'hashedpassword',
                role: 'Free',
              },
            });
            testUsers.push(user2.id);

            // Create projects for user1
            const user1ProjectIds = [];
            for (const domain of user1Domains) {
              const project = await projectService.create(user1.id, domain);
              user1ProjectIds.push(project.id);
            }

            // Create projects for user2
            const user2ProjectIds = [];
            for (const domain of user2Domains) {
              const project = await projectService.create(user2.id, domain);
              user2ProjectIds.push(project.id);
            }

            // Query projects for user1
            const user1Projects = await projectService.findByUser(user1.id);

            // Verify user1 only sees their own projects
            expect(user1Projects).toHaveLength(user1Domains.length);
            expect(user1Projects.every(p => p.userId === user1.id)).toBe(true);
            expect(user1Projects.every(p => user1ProjectIds.includes(p.id))).toBe(true);
            expect(user1Projects.every(p => !user2ProjectIds.includes(p.id))).toBe(true);

            // Query projects for user2
            const user2Projects = await projectService.findByUser(user2.id);

            // Verify user2 only sees their own projects
            expect(user2Projects).toHaveLength(user2Domains.length);
            expect(user2Projects.every(p => p.userId === user2.id)).toBe(true);
            expect(user2Projects.every(p => user2ProjectIds.includes(p.id))).toBe(true);
            expect(user2Projects.every(p => !user1ProjectIds.includes(p.id))).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Validates: Requirements 4.6**
   * 
   * Property 18: Project Ownership Verification
   * For any project update or delete request, the operation should succeed only 
   * if the requesting user's ID matches the project's userId, otherwise returning 
   * an authorization error.
   */
  describe('Property 18: Project Ownership Verification', () => {
    it('should allow updates only by project owner', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDomainArbitrary,
          validDomainArbitrary,
          projectNameArbitrary,
          async (initialDomain, newDomain, newName) => {
            fc.pre(initialDomain !== newDomain); // Ensure domains are different

            // Create two test users
            const owner = await prisma.user.create({
              data: {
                email: `owner-${Date.now()}-${Math.random()}@example.com`,
                password: 'hashedpassword',
                role: 'Free',
              },
            });
            testUsers.push(owner.id);

            const nonOwner = await prisma.user.create({
              data: {
                email: `nonowner-${Date.now()}-${Math.random()}@example.com`,
                password: 'hashedpassword',
                role: 'Free',
              },
            });
            testUsers.push(nonOwner.id);

            // Create project owned by owner
            const project = await projectService.create(owner.id, initialDomain);

            // Verify ownership check
            const isOwner = await projectService.verifyOwnership(project.id, owner.id);
            expect(isOwner).toBe(true);

            const isNotOwner = await projectService.verifyOwnership(project.id, nonOwner.id);
            expect(isNotOwner).toBe(false);

            // Owner should be able to update
            const updated = await projectService.update(project.id, owner.id, {
              domain: newDomain,
              name: newName,
            });
            expect(updated.domain).toBe(newDomain);
            expect(updated.name).toBe(newName);

            // Non-owner should not be able to update
            await expect(
              projectService.update(project.id, nonOwner.id, { name: 'Unauthorized' })
            ).rejects.toThrow(AuthorizationError);

            // Verify project was not modified by unauthorized attempt
            const projectAfterFailedUpdate = await projectService.findById(project.id);
            expect(projectAfterFailedUpdate!.name).toBe(newName);
            expect(projectAfterFailedUpdate!.name).not.toBe('Unauthorized');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow deletion only by project owner', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDomainArbitrary,
          async (domain) => {
            // Create two test users
            const owner = await prisma.user.create({
              data: {
                email: `owner-${Date.now()}-${Math.random()}@example.com`,
                password: 'hashedpassword',
                role: 'Free',
              },
            });
            testUsers.push(owner.id);

            const nonOwner = await prisma.user.create({
              data: {
                email: `nonowner-${Date.now()}-${Math.random()}@example.com`,
                password: 'hashedpassword',
                role: 'Free',
              },
            });
            testUsers.push(nonOwner.id);

            // Create project owned by owner
            const project = await projectService.create(owner.id, domain);

            // Non-owner should not be able to delete
            await expect(
              projectService.deleteProject(project.id, nonOwner.id)
            ).rejects.toThrow(AuthorizationError);

            // Verify project still exists
            const projectAfterFailedDelete = await projectService.findById(project.id);
            expect(projectAfterFailedDelete).toBeDefined();
            expect(projectAfterFailedDelete!.id).toBe(project.id);

            // Owner should be able to delete
            await projectService.deleteProject(project.id, owner.id);

            // Verify project is deleted
            const projectAfterDelete = await projectService.findById(project.id);
            expect(projectAfterDelete).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should cascade delete related data when project is deleted by owner', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDomainArbitrary,
          fc.string({ minLength: 1, maxLength: 50 }),
          validDomainArbitrary,
          async (projectDomain, keyword, competitorDomain) => {
            fc.pre(projectDomain !== competitorDomain); // Ensure domains are different

            // Create test user
            const owner = await prisma.user.create({
              data: {
                email: `owner-${Date.now()}-${Math.random()}@example.com`,
                password: 'hashedpassword',
                role: 'Free',
              },
            });
            testUsers.push(owner.id);

            // Create project
            const project = await projectService.create(owner.id, projectDomain);

            // Add keyword
            const keywordRecord = await prisma.keyword.create({
              data: {
                projectId: project.id,
                keyword,
                searchVolume: 1000,
                difficulty: 50,
                cpc: 1.5,
              },
            });

            // Add competitor
            const competitorRecord = await prisma.competitor.create({
              data: {
                projectId: project.id,
                domain: competitorDomain,
              },
            });

            // Delete project
            await projectService.deleteProject(project.id, owner.id);

            // Verify project is deleted
            const deletedProject = await projectService.findById(project.id);
            expect(deletedProject).toBeNull();

            // Verify keyword is cascade deleted
            const deletedKeyword = await prisma.keyword.findUnique({
              where: { id: keywordRecord.id },
            });
            expect(deletedKeyword).toBeNull();

            // Verify competitor is cascade deleted
            const deletedCompetitor = await prisma.competitor.findUnique({
              where: { id: competitorRecord.id },
            });
            expect(deletedCompetitor).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
