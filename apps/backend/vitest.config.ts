import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    threads: false, // Disable worker threads to prevent Prisma cleanup issues
    poolOptions: {
      threads: {
        singleThread: true, // Run tests sequentially to prevent race conditions
      },
    },
    setupFiles: ['./tests/setup.ts'], // Global test setup
    testTimeout: 15000, // Increase timeout to 15 seconds for property tests
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', '**/*.test.ts'],
    },
  },
});
