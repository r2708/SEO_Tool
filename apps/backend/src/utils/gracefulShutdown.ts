import { Server } from 'http';
import { logger } from './logger';
import { disconnectDatabase } from './db';
import { CacheService } from '../services/cache';

/**
 * Graceful Shutdown Handler
 * 
 * Handles SIGTERM and SIGINT signals to gracefully shutdown the server:
 * 1. Stop accepting new requests
 * 2. Wait for in-flight requests to complete
 * 3. Close database connections
 * 4. Close Redis connections
 * 5. Exit process
 * 
 * Validates: Requirements 20.7
 */

let isShuttingDown = false;

/**
 * Setup graceful shutdown handlers for the server
 * 
 * @param server - HTTP server instance
 * @param cache - Cache service instance
 */
export function setupGracefulShutdown(server: Server, cache: CacheService): void {
  // Handle SIGTERM signal (e.g., from Kubernetes, Docker)
  process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received: starting graceful shutdown');
    gracefulShutdown(server, cache, 'SIGTERM');
  });

  // Handle SIGINT signal (e.g., Ctrl+C)
  process.on('SIGINT', () => {
    logger.info('SIGINT signal received: starting graceful shutdown');
    gracefulShutdown(server, cache, 'SIGINT');
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught exception occurred', {
      error: error.message,
      stack: error.stack,
    });
    gracefulShutdown(server, cache, 'uncaughtException');
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: any) => {
    logger.error('Unhandled promise rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
    });
    gracefulShutdown(server, cache, 'unhandledRejection');
  });
}

/**
 * Perform graceful shutdown
 * 
 * @param server - HTTP server instance
 * @param cache - Cache service instance
 * @param signal - Signal that triggered the shutdown
 */
async function gracefulShutdown(
  server: Server,
  cache: CacheService,
  signal: string
): Promise<void> {
  // Prevent multiple shutdown attempts
  if (isShuttingDown) {
    logger.warn('Shutdown already in progress, ignoring signal', { signal });
    return;
  }

  isShuttingDown = true;

  logger.info('Starting graceful shutdown', { signal });

  // Set a timeout for forced shutdown (30 seconds)
  const forceShutdownTimeout = setTimeout(() => {
    logger.error('Graceful shutdown timeout exceeded, forcing exit');
    process.exit(1);
  }, 30000);

  try {
    // Step 1: Stop accepting new requests
    logger.info('Closing HTTP server (stop accepting new requests)');
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) {
          logger.error('Error closing HTTP server', { error: err.message });
          reject(err);
        } else {
          logger.info('HTTP server closed successfully');
          resolve();
        }
      });
    });

    // Step 2: In-flight requests are automatically waited for by server.close()
    logger.info('All in-flight requests completed');

    // Step 3: Close database connections
    logger.info('Closing database connections');
    await disconnectDatabase();

    // Step 4: Close Redis connections
    logger.info('Closing Redis connections');
    await cache.close();

    // Clear the force shutdown timeout
    clearTimeout(forceShutdownTimeout);

    logger.info('Graceful shutdown completed successfully');

    // Step 5: Exit process
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', {
      error: error instanceof Error ? error.message : String(error),
    });

    // Clear the force shutdown timeout
    clearTimeout(forceShutdownTimeout);

    // Exit with error code
    process.exit(1);
  }
}

/**
 * Check if the server is currently shutting down
 * Can be used in middleware to reject new requests during shutdown
 */
export function isServerShuttingDown(): boolean {
  return isShuttingDown;
}
