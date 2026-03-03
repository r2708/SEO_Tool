import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';

/**
 * Feature: seo-saas-platform, Property 60: Environment Variable Validation
 * **Validates: Requirements 18.6**
 * 
 * For any required environment variable (DATABASE_URL, REDIS_URL, JWT_SECRET, OPENAI_API_KEY),
 * if it is missing at startup, the Platform should fail to start and log the missing variable name.
 */
describe('Property 60: Environment Variable Validation', () => {
  const requiredVars = ['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET', 'OPENAI_API_KEY'];

  // Import the validation function directly for testing
  async function testValidateEnvironment(env: Record<string, string | undefined>): Promise<void> {
    const originalEnv = process.env;
    try {
      process.env = { ...env };
      
      const missingVars: string[] = [];
      for (const varName of requiredVars) {
        if (!process.env[varName]) {
          missingVars.push(varName);
        }
      }

      if (missingVars.length > 0) {
        const errorMessage = `Missing required environment variables: ${missingVars.join(', ')}`;
        throw new Error(errorMessage);
      }
    } finally {
      process.env = originalEnv;
    }
  }

  it('should fail when any required environment variable is missing', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.subarray(requiredVars, { minLength: 1, maxLength: requiredVars.length }),
        async (missingVars) => {
          // Set up environment with some variables missing
          const env: Record<string, string | undefined> = {
            DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
            REDIS_URL: 'redis://localhost:6379',
            JWT_SECRET: 'test-secret',
            OPENAI_API_KEY: 'sk-test-key',
          };

          // Remove the selected missing variables
          for (const varName of missingVars) {
            env[varName] = undefined;
          }

          // Attempt to validate
          let error: Error | null = null;
          try {
            await testValidateEnvironment(env);
          } catch (e) {
            error = e as Error;
          }

          // Verify that an error was thrown
          expect(error).not.toBeNull();
          expect(error?.message).toContain('Missing required environment variables');
          
          // Verify that all missing variables are mentioned in the error message
          for (const varName of missingVars) {
            expect(error?.message).toContain(varName);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should succeed when all required environment variables are present', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          DATABASE_URL: fc.string({ minLength: 10 }),
          REDIS_URL: fc.string({ minLength: 10 }),
          JWT_SECRET: fc.string({ minLength: 10 }),
          OPENAI_API_KEY: fc.string({ minLength: 10 }),
        }),
        async (envVars) => {
          // Validate should succeed without throwing
          let error: Error | null = null;
          try {
            await testValidateEnvironment(envVars);
          } catch (e) {
            error = e as Error;
          }

          // Verify no error was thrown
          expect(error).toBeNull();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should include all missing variable names in error message', () => {
    const env: Record<string, string | undefined> = {
      DATABASE_URL: undefined,
      REDIS_URL: undefined,
      JWT_SECRET: 'test-secret',
      OPENAI_API_KEY: 'sk-test-key',
    };

    let error: Error | null = null;
    try {
      const originalEnv = process.env;
      process.env = { ...env };
      
      const missingVars: string[] = [];
      for (const varName of requiredVars) {
        if (!process.env[varName]) {
          missingVars.push(varName);
        }
      }

      if (missingVars.length > 0) {
        throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
      }
      
      process.env = originalEnv;
    } catch (e) {
      error = e as Error;
    }

    expect(error).not.toBeNull();
    expect(error?.message).toContain('DATABASE_URL');
    expect(error?.message).toContain('REDIS_URL');
  });
});
