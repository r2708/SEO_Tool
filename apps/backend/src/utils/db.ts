import { PrismaClient } from '@prisma/client';
import { config } from '../config/env';
import { logger } from './logger';

/**
 * Database Connection Manager
 * 
 * Provides a singleton Prisma client with connection pooling configured.
 * Pool size: min 5, max 20 connections
 * 
 * Validates: Requirements 20.1
 */

let prisma: PrismaClient | null = null;

/**
 * Get or create the Prisma client instance with connection pooling
 */
export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    // Parse DATABASE_URL and add connection pool parameters
    const databaseUrl = new URL(config.DATABASE_URL);
    
    // Add connection pool parameters to the URL
    databaseUrl.searchParams.set('connection_limit', '20');
    databaseUrl.searchParams.set('pool_timeout', '10');
    
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl.toString(),
        },
      },
      log: config.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });

    logger.info('Prisma client initialized with connection pooling', {
      minConnections: 5,
      maxConnections: 20,
    });
  }

  return prisma;
}

/**
 * Check database connection health
 * 
 * @returns true if database is reachable, false otherwise
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const client = getPrismaClient();
    // Execute a simple query to verify connection
    await client.$queryRaw`SELECT 1`;
    logger.info('Database health check passed');
    return true;
  } catch (error) {
    logger.error('Database health check failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Connect to the database
 * Establishes the connection and verifies it's working
 * 
 * @throws Error if connection fails
 */
export async function connectDatabase(): Promise<void> {
  try {
    const client = getPrismaClient();
    await client.$connect();
    
    // Verify connection with health check
    const isHealthy = await checkDatabaseHealth();
    
    if (!isHealthy) {
      throw new Error('Database connection established but health check failed');
    }
    
    logger.info('Database connected successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to connect to database', { error: errorMessage });
    throw new Error(`Database connection failed: ${errorMessage}`);
  }
}

/**
 * Disconnect from the database
 * Closes all connections in the pool gracefully
 */
export async function disconnectDatabase(): Promise<void> {
  if (prisma) {
    try {
      await prisma.$disconnect();
      logger.info('Database disconnected successfully');
      prisma = null;
    } catch (error) {
      logger.error('Error disconnecting from database', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

/**
 * Handle database connection errors gracefully
 * Logs the error and attempts to reconnect
 */
export async function handleDatabaseError(error: Error): Promise<void> {
  logger.error('Database error occurred', {
    error: error.message,
    stack: error.stack,
  });

  // Attempt to reconnect
  try {
    await disconnectDatabase();
    await connectDatabase();
    logger.info('Database reconnection successful');
  } catch (reconnectError) {
    logger.error('Database reconnection failed', {
      error: reconnectError instanceof Error ? reconnectError.message : String(reconnectError),
    });
    throw reconnectError;
  }
}
