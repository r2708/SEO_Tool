import { config } from './config/env';

// Backend entry point
console.log('SEO SaaS Backend - Starting...');
console.log(`Environment: ${config.NODE_ENV}`);
console.log(`Port: ${config.PORT}`);
console.log('All required environment variables validated successfully');
