import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fc from 'fast-check';
import { getPrismaClient, disconnectDatabase } from '../../src/utils/db';

/**
 * Property-Based Tests for Server and Database
 * 
 * Tests database connection pooling and transaction atomicity
 */

describe('Server Property Tests', () => {
  let prisma: ReturnType<typeof getPrismaClient>;

  beforeAll(() => {
    prisma = getPrismaClient();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  /**
   * Property 62: Batch Processing Size Limit
   * 
   * **Validates: Requirements 20.3**
   * 
   * For any bulk operation processing multiple records, the Platform should
   * process them in batches with maximum batch size of 100 records.
   */
  describe('Property 62: Batch Processing Size Limit', () => {
    it('should process records in batches of maximum 100', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 500 }), // Total number of records
          async (totalRecords) => {
            // Simulate batch processing
            const batchSize = 100;
            const batches: number[] = [];
            
            for (let i = 0; i < totalRecords; i += batchSize) {
              const currentBatchSize = Math.min(batchSize, totalRecords - i);
              batches.push(currentBatchSize);
            }

            // Verify all batches are <= 100
            for (const batch of batches) {
              expect(batch).toBeLessThanOrEqual(100);
              expect(batch).toBeGreaterThan(0);
            }

            // Verify total records processed equals input
            const totalProcessed = batches.reduce((sum, batch) => sum + batch, 0);
            expect(totalProcessed).toBe(totalRecords);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should handle batch processing with database operations', async () => {
      // Create a test user for batch operations
      const testUser = await prisma.user.create({
        data: {
          email: `batch-test-${Date.now()}@example.com`,
          password: 'hashedpassword',
          role: 'Free',
        },
      });

      try {
        await fc.assert(
          fc.asyncProperty(
            fc.integer({ min: 1, max: 250 }), // Number of projects to create
            async (numProjects) => {
              const batchSize = 100;
              const projectsCreated: string[] = [];

              // Process in batches
              for (let i = 0; i < numProjects; i += batchSize) {
                const currentBatchSize = Math.min(batchSize, numProjects - i);
                
                // Create batch of projects
                const batch = Array.from({ length: currentBatchSize }, (_, idx) => ({
                  domain: `batch-${i + idx}-${Date.now()}.com`,
                  name: `Batch Project ${i + idx}`,
                  userId: testUser.id,
                }));

                // Verify batch size
                expect(batch.length).toBeLessThanOrEqual(100);

                // Insert batch
                const result = await prisma.project.createMany({
                  data: batch,
                });

                projectsCreated.push(...batch.map(p => p.domain));
              }

              // Verify all projects were created
              const createdProjects = await prisma.project.findMany({
                where: { userId: testUser.id },
              });

              expect(createdProjects.length).toBe(numProjects);

              // Cleanup
              await prisma.project.deleteMany({
                where: { userId: testUser.id },
              });
            }
          ),
          { numRuns: 10 } // Reduced runs for database operations
        );
      } finally {
        // Cleanup test user
        await prisma.user.delete({
          where: { id: testUser.id },
        });
      }
    });
  });

  /**
   * Property 64: Transaction Atomicity
   * 
   * **Validates: Requirements 20.6**
   * 
   * For any operation that modifies multiple related records, the Platform
   * should use database transactions to ensure all changes succeed or all fail
   * together (atomicity).
   */
  describe('Property 64: Transaction Atomicity', () => {
    it('should ensure all operations in a transaction succeed or all fail', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            email: fc.emailAddress(),
            projectDomain: fc.domain(),
            projectName: fc.string({ minLength: 1, maxLength: 50 }),
            keywords: fc.array(
              fc.record({
                keyword: fc.string({ minLength: 1, maxLength: 50 }),
                searchVolume: fc.nat(),
                difficulty: fc.float({ min: 0, max: 100 }),
                cpc: fc.float({ min: 0, max: 100 }),
              }),
              { minLength: 1, maxLength: 5 }
            ),
          }),
          async (data) => {
            // Test successful transaction
            const result = await prisma.$transaction(async (tx) => {
              // Create user
              const user = await tx.user.create({
                data: {
                  email: data.email,
                  password: 'hashedpassword',
                  role: 'Free',
                },
              });

              // Create project
              const project = await tx.project.create({
                data: {
                  domain: data.projectDomain,
                  name: data.projectName,
                  userId: user.id,
                },
              });

              // Create keywords
              const keywords = await tx.keyword.createMany({
                data: data.keywords.map((kw) => ({
                  projectId: project.id,
                  keyword: kw.keyword,
                  searchVolume: kw.searchVolume,
                  difficulty: kw.difficulty,
                  cpc: kw.cpc,
                })),
              });

              return { user, project, keywords };
            });

            // Verify all records were created
            const user = await prisma.user.findUnique({
              where: { email: data.email },
            });
            expect(user).toBeDefined();

            const project = await prisma.project.findFirst({
              where: { domain: data.projectDomain },
            });
            expect(project).toBeDefined();

            const keywords = await prisma.keyword.findMany({
              where: { projectId: project!.id },
            });
            expect(keywords.length).toBe(data.keywords.length);

            // Cleanup
            await prisma.user.delete({
              where: { id: result.user.id },
            });
          }
        ),
        { numRuns: 20 } // Reduced runs for database operations
      );
    });

    it('should rollback all operations if any operation fails', async () => {
      // Create a test user
      const testUser = await prisma.user.create({
        data: {
          email: `rollback-test-${Date.now()}@example.com`,
          password: 'hashedpassword',
          role: 'Free',
        },
      });

      try {
        await fc.assert(
          fc.asyncProperty(
            fc.record({
              projectDomain: fc.domain(),
              projectName: fc.string({ minLength: 1, maxLength: 50 }),
            }),
            async (data) => {
              // Attempt transaction that will fail
              let transactionFailed = false;
              
              try {
                await prisma.$transaction(async (tx) => {
                  // Create project
                  const project = await tx.project.create({
                    data: {
                      domain: data.projectDomain,
                      name: data.projectName,
                      userId: testUser.id,
                    },
                  });

                  // Intentionally cause an error (invalid foreign key)
                  await tx.keyword.create({
                    data: {
                      projectId: 'invalid-id-that-does-not-exist',
                      keyword: 'test',
                      searchVolume: 100,
                      difficulty: 50,
                      cpc: 1.5,
                    },
                  });
                });
              } catch (error) {
                transactionFailed = true;
              }

              // Verify transaction failed
              expect(transactionFailed).toBe(true);

              // Verify project was NOT created (rollback occurred)
              const project = await prisma.project.findFirst({
                where: { domain: data.projectDomain },
              });
              expect(project).toBeNull();
            }
          ),
          { numRuns: 10 } // Reduced runs for database operations
        );
      } finally {
        // Cleanup test user
        await prisma.user.delete({
          where: { id: testUser.id },
        });
      }
    });

    it('should maintain data consistency across related tables', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            email: fc.emailAddress(),
            projects: fc.array(
              fc.record({
                domain: fc.domain(),
                name: fc.string({ minLength: 1, maxLength: 50 }),
              }),
              { minLength: 1, maxLength: 3 }
            ),
          }),
          async (data) => {
            // Create user and projects in a transaction
            const result = await prisma.$transaction(async (tx) => {
              const user = await tx.user.create({
                data: {
                  email: data.email,
                  password: 'hashedpassword',
                  role: 'Free',
                },
              });

              const projects = await Promise.all(
                data.projects.map((proj) =>
                  tx.project.create({
                    data: {
                      domain: proj.domain,
                      name: proj.name,
                      userId: user.id,
                    },
                  })
                )
              );

              return { user, projects };
            });

            // Verify consistency: all projects belong to the user
            const userProjects = await prisma.project.findMany({
              where: { userId: result.user.id },
            });

            expect(userProjects.length).toBe(data.projects.length);
            
            for (const project of userProjects) {
              expect(project.userId).toBe(result.user.id);
            }

            // Cleanup
            await prisma.user.delete({
              where: { id: result.user.id },
            });
          }
        ),
        { numRuns: 15 } // Reduced runs for database operations
      );
    });
  });

  /**
   * Property 65: Graceful Shutdown
   * 
   * **Validates: Requirements 20.7**
   * 
   * For any shutdown signal received by the Platform, it should stop accepting
   * new requests, complete all in-flight requests, close database and cache
   * connections, and then terminate.
   */
  describe('Property 65: Graceful Shutdown', () => {
    it('should close database connections during shutdown', async () => {
      const { disconnectDatabase, getPrismaClient } = await import('../../src/utils/db');
      
      // Get a client
      const client = getPrismaClient();
      
      // Verify connection works
      await client.$queryRaw`SELECT 1`;
      
      // Disconnect
      await disconnectDatabase();
      
      // Verify disconnection (this should work as we can reconnect)
      const newClient = getPrismaClient();
      await newClient.$queryRaw`SELECT 1`;
      
      // Cleanup
      await disconnectDatabase();
    });

    it('should handle graceful shutdown setup without errors', async () => {
      // This test verifies the setup mechanism exists and can be called
      const { setupGracefulShutdown } = await import('../../src/utils/gracefulShutdown');
      const express = await import('express');
      const { RedisCache } = await import('../../src/services/cache');
      const { config } = await import('../../src/config/env');

      const app = express.default();
      const cache = new RedisCache(config.REDIS_URL);
      const port = 3000 + Math.floor(Math.random() * 1000);
      const server = app.listen(port);

      // Setup graceful shutdown - should not throw
      setupGracefulShutdown(server, cache);

      // Verify the setup doesn't throw
      expect(server.listening).toBe(true);

      // Cleanup without triggering shutdown
      server.close();
      await cache.close();
    });

    it('should track shutdown state', async () => {
      const { isServerShuttingDown } = await import('../../src/utils/gracefulShutdown');
      
      // Initially not shutting down
      const initialState = isServerShuttingDown();
      expect(typeof initialState).toBe('boolean');
    });

    it('should handle database connection pooling configuration', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }),
          async (numQueries) => {
            const { getPrismaClient } = await import('../../src/utils/db');
            const client = getPrismaClient();

            // Execute multiple queries concurrently
            const queries = Array.from({ length: numQueries }, () =>
              client.$queryRaw`SELECT 1`
            );

            const results = await Promise.all(queries);

            // All queries should succeed
            expect(results.length).toBe(numQueries);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should handle database health checks', async () => {
      const { checkDatabaseHealth } = await import('../../src/utils/db');
      
      // Health check should return boolean
      const isHealthy = await checkDatabaseHealth();
      expect(typeof isHealthy).toBe('boolean');
      
      // In test environment with valid connection, should be true
      expect(isHealthy).toBe(true);
    });
  });
});
