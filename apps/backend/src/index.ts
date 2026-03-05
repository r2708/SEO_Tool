import express from 'express';
import { config } from './config/env';
import { responseFormatter } from './middleware/responseFormatter';
import { errorHandler } from './middleware/errorHandler';
import projectRoutes from './routes/projects';

// Create Express application
const app = express();

// Middleware stack
app.use(express.json()); // Body parser for JSON
app.use(responseFormatter); // Response formatting

// Mount API routes
app.use('/api/projects', projectRoutes);

// Global error handler (must be last)
app.use(errorHandler);

// Start server
const PORT = config.PORT || 3001;

app.listen(PORT, () => {
  console.log('SEO SaaS Backend - Started successfully');
  console.log(`Environment: ${config.NODE_ENV}`);
  console.log(`Server listening on port ${PORT}`);
  console.log('All required environment variables validated successfully');
});
