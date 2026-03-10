import express from 'express';
import cors from 'cors';
import { config } from './config/env';
import { responseFormatter } from './middleware/responseFormatter';
import { errorHandler } from './middleware/errorHandler';
import { authenticate } from './middleware/authenticate';
import { RedisCache } from './services/cache';
import { createRateLimiter } from './middleware/rateLimit';
import authRoutes from './routes/auth';
import projectRoutes from './routes/projects';
import keywordRoutes from './routes/keywords';
import rankRoutes from './routes/rank';
import rankAutoRoutes from './routes/rankAuto';
import auditRoutes from './routes/audit';
import competitorRoutes from './routes/competitors';
import contentRoutes from './routes/content';
import dashboardRoutes from './routes/dashboard';
import { logger } from './utils/logger';
import { getPrismaClient } from './utils/db';

// Create Express application
const app = express();

// Initialize cache service
const cache = new RedisCache(config.REDIS_URL);

// Get Prisma client with connection pooling
const prisma = getPrismaClient();

// Middleware stack (order matters!)
app.use(express.json()); // Body parser for JSON
app.use(cors()); // CORS middleware
app.use(responseFormatter); // Response formatting

// Mount API routes
app.use('/api/auth', authRoutes); // Auth routes (no authentication required)
app.use('/api/projects', authenticate, createRateLimiter(cache), projectRoutes);
app.use('/api/keywords', authenticate, createRateLimiter(cache), keywordRoutes);
app.use('/api/rank', authenticate, createRateLimiter(cache), rankRoutes);
app.use('/api/rank', authenticate, createRateLimiter(cache), rankAutoRoutes);
app.use('/api/audit', authenticate, createRateLimiter(cache), auditRoutes);
app.use('/api/competitors', authenticate, createRateLimiter(cache), competitorRoutes);
app.use('/api/content', authenticate, createRateLimiter(cache), contentRoutes);
app.use('/api/dashboard', authenticate, createRateLimiter(cache), dashboardRoutes);

// Global error handler (must be last)
app.use(errorHandler);

// Export app, cache, and prisma for use in other modules
export { app, cache, prisma };

// Start server only if this file is run directly
if (require.main === module) {
  const PORT = config.PORT || 3001;

  // Startup function with proper initialization
  async function startServer() {
    try {
      // Step 1: Validate environment variables (already done in config module)
      logger.info('Environment variables validated successfully');

      // Step 2: Connect to database
      logger.info('Connecting to database...');
      const { connectDatabase } = require('./utils/db');
      await connectDatabase();

      // Step 3: Connect to Redis (already initialized in cache)
      logger.info('Connecting to Redis...');
      // Redis connection is handled automatically by RedisCache constructor
      // Wait a moment for connection to establish
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 4: Start Express server
      logger.info('Starting Express server...');
      const server = app.listen(PORT, () => {
        logger.info('SEO SaaS Backend - Started successfully', {
          environment: config.NODE_ENV,
          port: PORT,
        });
        console.log('SEO SaaS Backend - Started successfully');
        console.log(`Environment: ${config.NODE_ENV}`);
        console.log(`Server listening on port ${PORT}`);
        console.log('All required environment variables validated successfully');
      });

      // Step 5: Setup graceful shutdown handlers
      const { setupGracefulShutdown } = require('./utils/gracefulShutdown');
      setupGracefulShutdown(server, cache);
      logger.info('Graceful shutdown handlers configured');
    } catch (error) {
      logger.error('Failed to start server', {
        error: error instanceof Error ? error.message : String(error),
      });
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  // Start the server
  startServer();
}
