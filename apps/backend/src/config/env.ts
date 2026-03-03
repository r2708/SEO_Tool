import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

interface EnvironmentConfig {
  DATABASE_URL: string;
  REDIS_URL: string;
  JWT_SECRET: string;
  OPENAI_API_KEY: string;
  PORT: number;
  NODE_ENV: string;
  LOG_LEVEL: string;
}

const requiredEnvVars = [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'OPENAI_API_KEY',
] as const;

/**
 * Validates that all required environment variables are present.
 * Throws an error and logs missing variables if validation fails.
 * @throws {Error} If any required environment variable is missing
 */
export function validateEnvironment(): void {
  const missingVars: string[] = [];

  for (const varName of requiredEnvVars) {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  }

  if (missingVars.length > 0) {
    const errorMessage = `Missing required environment variables: ${missingVars.join(', ')}`;
    console.error(errorMessage);
    throw new Error(errorMessage);
  }
}

/**
 * Returns the validated environment configuration.
 * Must call validateEnvironment() first to ensure all variables are present.
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  return {
    DATABASE_URL: process.env.DATABASE_URL!,
    REDIS_URL: process.env.REDIS_URL!,
    JWT_SECRET: process.env.JWT_SECRET!,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY!,
    PORT: parseInt(process.env.PORT || '3001', 10),
    NODE_ENV: process.env.NODE_ENV || 'development',
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  };
}

// Validate environment on module load
validateEnvironment();

export const config = getEnvironmentConfig();
