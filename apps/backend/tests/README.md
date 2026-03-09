# Testing Infrastructure

This directory contains all tests for the SEO SaaS Platform backend.

## Test Structure

```
tests/
├── helpers/          # Test utilities and fixtures
│   ├── test-db.ts   # Database helper functions
│   ├── fixtures.ts  # Test data fixtures
│   └── auth-helper.ts # Authentication helpers
├── property/         # Property-based tests (fast-check)
├── integration/      # Integration tests
├── unit/            # Unit tests
└── setup.ts         # Global test setup
```

## Setup

### 1. Database Setup

The tests use a separate test database to avoid affecting development data.

**Environment Variables:**
- `DATABASE_URL`: Main database connection
- `TEST_DATABASE_URL`: Test database connection (used during tests)

**Create Test Database:**

If using Docker:
```bash
docker-compose up -d postgres
```

The test database `seo_tool_test` will be created automatically.

If using local PostgreSQL:
```bash
createdb seo_tool_test
```

**Run Migrations:**
```bash
cd apps/backend
DATABASE_URL="postgresql://postgres:1234@localhost:5432/seo_tool_test" npx prisma migrate deploy
```

### 2. Redis Setup

Tests use a separate Redis database (database 1) to avoid conflicts.

**Environment Variables:**
- `REDIS_URL`: Main Redis connection (database 0)
- `TEST_REDIS_URL`: Test Redis connection (database 1)

Start Redis:
```bash
docker-compose up -d redis
```

### 3. Environment Configuration

Copy `.env.example` to `.env` and configure:

```env
# Test Database
TEST_DATABASE_URL="postgresql://postgres:1234@localhost:5432/seo_tool_test"

# Test Redis
TEST_REDIS_URL="redis://localhost:6379/1"

# Other required variables
JWT_SECRET="test-secret-key"
OPENAI_API_KEY="your-test-api-key"
```

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test Suites
```bash
# Property-based tests only
npm test -- property

# Integration tests only
npm test -- integration

# Unit tests only
npm test -- unit

# Specific test file
npm test -- auth.properties.test.ts
```

### Watch Mode
```bash
npm test -- --watch
```

### Coverage
```bash
npm test -- --coverage
```

## Test Types

### Property-Based Tests

Located in `tests/property/`, these tests use `fast-check` to verify universal properties across many generated inputs.

**Example:**
```typescript
import fc from 'fast-check';

test('Property: Email validation', () => {
  fc.assert(
    fc.property(fc.emailAddress(), (email) => {
      const result = validateEmail(email);
      expect(result).toBe(true);
    })
  );
});
```

**Properties Tested:**
- Properties 1-65 covering all requirements
- 100+ iterations per property
- Validates correctness across input space

### Integration Tests

Located in `tests/integration/`, these tests verify complete workflows across multiple components.

**Example:**
```typescript
test('Complete user registration and login flow', async () => {
  // Register user
  const registerResponse = await request(app)
    .post('/api/auth/register')
    .send({ email: 'test@example.com', password: 'password123' });
  
  expect(registerResponse.status).toBe(201);
  
  // Login with credentials
  const loginResponse = await request(app)
    .post('/api/auth/login')
    .send({ email: 'test@example.com', password: 'password123' });
  
  expect(loginResponse.status).toBe(200);
  expect(loginResponse.body.data.token).toBeDefined();
});
```

### Unit Tests

Located in `tests/unit/`, these tests verify individual functions and components in isolation.

## Test Helpers

### Database Helpers

```typescript
import { cleanupDatabase, getPrismaClient } from './helpers/test-db';

beforeEach(async () => {
  await cleanupDatabase(); // Clean database before each test
});
```

### Fixtures

```typescript
import { createTestUser, createTestProject, testUsers } from './helpers/fixtures';

// Create test user
const user = await createTestUser(testUsers.free);

// Create test project
const project = await createTestProject(user.id, 'example.com');
```

### Authentication

```typescript
import { generateTestToken, createAuthHeader } from './helpers/auth-helper';

// Generate token
const token = generateTestToken(userId, 'Pro');

// Create auth header for requests
const headers = createAuthHeader(userId, 'Pro');
```

## Best Practices

1. **Isolation**: Each test should be independent and not rely on other tests
2. **Cleanup**: Always clean up test data after tests
3. **Fixtures**: Use fixtures for consistent test data
4. **Mocking**: Mock external services (OpenAI, web scraping) in unit tests
5. **Real Services**: Use real database and Redis in integration tests
6. **Property Tests**: Write property tests for universal correctness
7. **Edge Cases**: Test boundary conditions and error cases

## Troubleshooting

### Database Connection Issues

If tests fail with database connection errors:

1. Ensure PostgreSQL is running
2. Verify `TEST_DATABASE_URL` is set correctly
3. Run migrations on test database
4. Check database permissions

### Redis Connection Issues

If tests fail with Redis connection errors:

1. Ensure Redis is running
2. Verify `TEST_REDIS_URL` is set correctly
3. Check Redis is accessible on port 6379

### Test Timeouts

If property tests timeout:

1. Reduce number of iterations (default: 100)
2. Simplify test generators
3. Check for infinite loops in code

### Flaky Tests

If tests pass/fail inconsistently:

1. Check for race conditions
2. Ensure proper cleanup between tests
3. Verify test isolation
4. Check for shared state

## CI/CD Integration

Tests are designed to run in CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Setup Database
  run: |
    docker-compose up -d postgres redis
    sleep 5
    npm run migrate:test

- name: Run Tests
  run: npm test
  env:
    TEST_DATABASE_URL: postgresql://postgres:1234@localhost:5432/seo_tool_test
    TEST_REDIS_URL: redis://localhost:6379/1
    JWT_SECRET: test-secret
```
