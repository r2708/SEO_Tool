# Error Handling System

This directory contains the error handling system for the SEO SaaS Platform, implementing Requirements 14.1-14.8.

## Error Classes

### AppError (Base Class)
Base error class for all application errors with HTTP status codes and operational classification.

```typescript
import { AppError } from './errors';

throw new AppError(500, 'Something went wrong', true);
```

### ValidationError (400)
For request validation failures.

```typescript
import { ValidationError } from './errors';

throw new ValidationError('Invalid email format');
throw new ValidationError('Password must be at least 8 characters');
```

### AuthenticationError (401)
For authentication failures.

```typescript
import { AuthenticationError } from './errors';

throw new AuthenticationError(); // Default: 'Invalid credentials'
throw new AuthenticationError('Token expired');
throw new AuthenticationError('Invalid token signature');
```

### AuthorizationError (403)
For authorization/permission failures.

```typescript
import { AuthorizationError } from './errors';

throw new AuthorizationError(); // Default: 'Insufficient permissions'
throw new AuthorizationError('Pro subscription required');
throw new AuthorizationError('Admin access only');
```

### NotFoundError (404)
For resource not found errors.

```typescript
import { NotFoundError } from './errors';

throw new NotFoundError('Project'); // Message: 'Project not found'
throw new NotFoundError('User');    // Message: 'User not found'
throw new NotFoundError('Keyword'); // Message: 'Keyword not found'
```

### RateLimitError (429)
For rate limit exceeded errors.

```typescript
import { RateLimitError } from './errors';

// retryAfter in seconds
throw new RateLimitError(3600); // Retry after 1 hour
throw new RateLimitError(60);   // Retry after 1 minute
```

### ExternalServiceError (502)
For external service failures (OpenAI, web scraping, etc.).

```typescript
import { ExternalServiceError } from './errors';

throw new ExternalServiceError('OpenAI', 'API timeout');
throw new ExternalServiceError('Scraper', 'Page unreachable');
```

## Global Error Handler

The global error handler middleware automatically:
- Logs all errors with context (timestamp, userId, endpoint, method, error message)
- Returns consistent JSON responses
- Prevents internal details from being exposed in 500 errors
- Adds Retry-After header for rate limit errors

### Usage in Express

```typescript
import express from 'express';
import { errorHandler } from './middleware';

const app = express();

// ... your routes ...

// Error handler must be last middleware
app.use(errorHandler);
```

### Response Format

**Operational Errors (4xx, 502):**
```json
{
  "success": false,
  "error": "Descriptive error message"
}
```

**Rate Limit Errors (429):**
```json
{
  "success": false,
  "error": "Rate limit exceeded"
}
```
Headers: `Retry-After: 3600`

**Internal Errors (500):**
```json
{
  "success": false,
  "error": "An unexpected error occurred"
}
```
Note: Internal details are never exposed to clients.

## Usage Examples

### In Service Layer

```typescript
import { ValidationError, NotFoundError } from '../errors';

class ProjectService {
  async getProject(projectId: string, userId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });
    
    if (!project) {
      throw new NotFoundError('Project');
    }
    
    if (project.userId !== userId) {
      throw new AuthorizationError('You do not own this project');
    }
    
    return project;
  }
  
  async createProject(domain: string, userId: string) {
    if (!this.isValidDomain(domain)) {
      throw new ValidationError('Invalid domain format');
    }
    
    return await prisma.project.create({
      data: { domain, userId }
    });
  }
}
```

### In Middleware

```typescript
import { AuthenticationError, AuthorizationError } from '../errors';
import jwt from 'jsonwebtoken';

export function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    throw new AuthenticationError('No token provided');
  }
  
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (error) {
    throw new AuthenticationError('Invalid token');
  }
}

export function requireRole(role: string) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      throw new AuthorizationError(`${role} role required`);
    }
    next();
  };
}
```

### With External Services

```typescript
import { ExternalServiceError } from '../errors';
import puppeteer from 'puppeteer';

async function scrapePage(url: string) {
  let browser;
  try {
    browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url, { timeout: 30000 });
    return await page.content();
  } catch (error) {
    if (error.name === 'TimeoutError') {
      throw new ValidationError('Page unreachable or took too long to load');
    }
    throw new ExternalServiceError('Scraper', 'Failed to fetch page content');
  } finally {
    if (browser) await browser.close();
  }
}
```

## Logging

All errors are logged with structured data:

```typescript
{
  timestamp: "2024-01-15T10:30:00.000Z",
  level: "error" | "warn",
  message: "Operational error occurred" | "Unexpected error occurred",
  userId: "user-123",
  endpoint: "/api/projects",
  method: "POST",
  error: "Invalid domain format",
  stack: "Error: Invalid domain format\n    at ..."
}
```

- **Operational errors** (ValidationError, AuthenticationError, etc.) are logged with `warn` level
- **Unexpected errors** (programming errors, unknown failures) are logged with `error` level

## Testing

See `tests/unit/errors.test.ts` and `tests/unit/errorHandler.test.ts` for comprehensive test examples.
