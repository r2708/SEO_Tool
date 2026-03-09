# SEO SaaS Platform

A comprehensive, full-stack TypeScript SEO analysis platform providing keyword research, rank tracking, on-page SEO analysis, competitor analysis, and AI-powered content optimization.

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Features

### Core Features
- **User Authentication**: JWT-based authentication with role-based access control (Free, Pro, Admin)
- **Project Management**: Create and manage multiple SEO projects per user
- **Keyword Research**: Research and store keyword data (search volume, difficulty, CPC)
- **Rank Tracking**: Track keyword rankings over time with historical data
- **SEO Audit**: Analyze on-page SEO elements (title, meta, headings, images, links)
- **Competitor Analysis**: Analyze competitor keywords and identify opportunities
- **AI Content Optimization**: AI-powered content scoring and optimization suggestions (Pro feature)
- **Dashboard Metrics**: Comprehensive dashboard with key SEO metrics

### Technical Features
- **Caching**: Redis-based caching for optimal performance
- **Rate Limiting**: Role-based API rate limiting (Free: 100/hr, Pro: 1000/hr)
- **Web Scraping**: Puppeteer-based scraping with JavaScript rendering
- **Error Handling**: Comprehensive error handling and structured logging
- **Property-Based Testing**: Extensive test coverage with fast-check
- **Type Safety**: Full TypeScript implementation with Prisma ORM

## Architecture

### System Overview

```
┌─────────────────┐
│  Next.js        │
│  Frontend       │
│  (Port 3000)    │
└────────┬────────┘
         │
         │ HTTP/REST
         │
┌────────▼────────┐
│  Express API    │
│  Gateway        │
│  (Port 3001)    │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼──┐  ┌──▼───┐
│Redis │  │Postgre│
│Cache │  │  SQL  │
└──────┘  └───┬──┘
              │
         ┌────┴────┐
         │ Prisma  │
         │   ORM   │
         └─────────┘
```

### Technology Stack

**Backend:**
- Node.js + Express
- TypeScript
- Prisma ORM
- PostgreSQL
- Redis
- JWT Authentication
- Winston Logger
- Puppeteer (Web Scraping)
- OpenAI API (Content Optimization)

**Frontend:**
- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- Recharts (Data Visualization)

**Testing:**
- Vitest
- fast-check (Property-Based Testing)
- Supertest (API Testing)

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **PostgreSQL**: v14.0 or higher
- **Redis**: v7.0 or higher
- **Docker** (optional, for Redis): v20.0 or higher
- **OpenAI API Key**: For content optimization features

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd seo-saas-platform
```

### 2. Install Dependencies

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd apps/backend
npm install
```

### 3. Start Redis

**Option A: Using Docker (Recommended)**
```bash
# From project root
docker compose up -d redis
```

**Option B: Using Homebrew (macOS)**
```bash
brew install redis
brew services start redis
```

**Option C: Using apt (Ubuntu/Debian)**
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis-server
```

**Verify Redis is Running:**
```bash
# Docker
docker exec seo_tool-redis-1 redis-cli ping

# Local installation
redis-cli ping
```

Expected output: `PONG`

## Environment Variables

### Backend Environment Variables

Create a `.env` file in `apps/backend/` directory:

```env
# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/seo_tool"

# Redis Configuration
REDIS_URL="redis://localhost:6379"

# JWT Configuration
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"

# OpenAI Configuration
OPENAI_API_KEY="sk-your-openai-api-key"

# Server Configuration
PORT=3001
NODE_ENV=development

# Logging Configuration (optional)
LOG_LEVEL=info
```

### Environment Variable Descriptions

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string | - |
| `REDIS_URL` | Yes | Redis connection string | - |
| `JWT_SECRET` | Yes | Secret key for JWT token signing | - |
| `OPENAI_API_KEY` | Yes | OpenAI API key for content optimization | - |
| `PORT` | No | Backend server port | 3001 |
| `NODE_ENV` | No | Environment (development/production/test) | development |
| `LOG_LEVEL` | No | Logging level (error/warn/info/debug) | info |

### Security Notes

- **Never commit `.env` files** to version control
- Use strong, randomly generated values for `JWT_SECRET` in production
- Rotate secrets regularly
- Use environment-specific `.env` files for different environments

## Database Setup

### 1. Create PostgreSQL Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE seo_tool;

# Create user (optional)
CREATE USER seo_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE seo_tool TO seo_user;

# Exit psql
\q
```

### 2. Run Database Migrations

```bash
cd apps/backend

# Copy environment template
cp .env.example .env

# Edit .env with your database credentials
nano .env

# Run migrations
npx prisma migrate dev

# Generate Prisma Client
npx prisma generate
```

### 3. Verify Database Setup

```bash
# View database schema
npx prisma studio
```

This opens Prisma Studio at `http://localhost:5555` where you can view and edit data.

## Running the Application

### Development Mode

**Backend:**
```bash
cd apps/backend
npm run dev
```

The API server will start at `http://localhost:3001`

**Frontend:**
```bash
cd apps/frontend
npm run dev
```

The frontend will start at `http://localhost:3000`

### Production Mode

**Build:**
```bash
# Backend
cd apps/backend
npm run build

# Frontend
cd apps/frontend
npm run build
```

**Start:**
```bash
# Backend
cd apps/backend
npm start

# Frontend
cd apps/frontend
npm start
```

## API Documentation

### Base URL

```
Development: http://localhost:3001
Production: https://your-domain.com
```

### Authentication

All protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Endpoints

#### Authentication

**Register User**
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword123"
}

Response (201):
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "role": "Free",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

**Login**
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword123"
}

Response (200):
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "role": "Free"
    }
  }
}
```

#### Projects

**Create Project**
```http
POST /api/projects
Authorization: Bearer <token>
Content-Type: application/json

{
  "domain": "example.com",
  "name": "My Website"
}

Response (201):
{
  "success": true,
  "data": {
    "id": "uuid",
    "domain": "example.com",
    "name": "My Website",
    "userId": "uuid",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**List Projects**
```http
GET /api/projects
Authorization: Bearer <token>

Response (200):
{
  "success": true,
  "data": {
    "projects": [
      {
        "id": "uuid",
        "domain": "example.com",
        "name": "My Website",
        "keywordCount": 10,
        "competitorCount": 3,
        "lastAuditScore": 85,
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

#### Keywords

**Research Keywords**
```http
POST /api/keywords/research
Authorization: Bearer <token>
Content-Type: application/json

{
  "projectId": "uuid",
  "keywords": ["seo tools", "keyword research", "rank tracking"]
}

Response (200):
{
  "success": true,
  "data": {
    "keywords": [
      {
        "keyword": "seo tools",
        "searchVolume": 12000,
        "difficulty": 65.5,
        "cpc": 3.25,
        "lastUpdated": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

#### Rank Tracking

**Track Ranking**
```http
POST /api/rank/track
Authorization: Bearer <token>
Content-Type: application/json

{
  "projectId": "uuid",
  "keyword": "seo tools",
  "position": 15
}

Response (201):
{
  "success": true,
  "data": {
    "id": "uuid",
    "projectId": "uuid",
    "keyword": "seo tools",
    "position": 15,
    "date": "2024-01-01"
  }
}
```

**Get Ranking History**
```http
GET /api/rank/history/:projectId?keyword=seo+tools&startDate=2024-01-01&endDate=2024-01-31
Authorization: Bearer <token>

Response (200):
{
  "success": true,
  "data": {
    "rankings": [
      {
        "keyword": "seo tools",
        "history": [
          { "date": "2024-01-01", "position": 15 },
          { "date": "2024-01-02", "position": 14 }
        ]
      }
    ]
  }
}
```

#### SEO Audit

**Audit URL**
```http
POST /api/audit
Authorization: Bearer <token>
Content-Type: application/json

{
  "url": "https://example.com",
  "projectId": "uuid"
}

Response (200):
{
  "success": true,
  "data": {
    "url": "https://example.com",
    "score": 85,
    "analysis": {
      "title": {
        "content": "Example Domain",
        "length": 14,
        "optimal": true
      },
      "metaDescription": {
        "content": "Example meta description",
        "length": 25,
        "optimal": false
      },
      "headings": {
        "h1Count": 1,
        "h2Count": 3,
        "structure": ["H1: Main Title", "H2: Section 1"]
      },
      "images": {
        "total": 5,
        "missingAlt": 1
      },
      "links": {
        "internal": 10,
        "broken": []
      }
    },
    "recommendations": [
      "Increase meta description length to 150-160 characters",
      "Add alt text to 1 image"
    ],
    "analyzedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### Competitor Analysis

**Analyze Competitor**
```http
POST /api/competitors/analyze
Authorization: Bearer <token>
Content-Type: application/json

{
  "projectId": "uuid",
  "competitorDomain": "competitor.com"
}

Response (200):
{
  "success": true,
  "data": {
    "competitor": "competitor.com",
    "keywords": ["keyword1", "keyword2"],
    "overlap": {
      "shared": ["keyword1"],
      "competitorOnly": ["keyword2"],
      "userOnly": ["keyword3"]
    },
    "lastAnalyzed": "2024-01-01T00:00:00.000Z"
  }
}
```

#### Content Optimization (Pro Feature)

**Score Content**
```http
POST /api/content/score
Authorization: Bearer <token>
Content-Type: application/json

{
  "content": "Your blog post content here...",
  "targetKeyword": "seo optimization"
}

Response (200):
{
  "success": true,
  "data": {
    "score": 78,
    "missingKeywords": ["keyword density", "meta tags"],
    "suggestedHeadings": ["How to Optimize SEO", "Best Practices"],
    "analysis": {
      "keywordDensity": 2.5,
      "readabilityScore": 65,
      "contentLength": 1200,
      "recommendedLength": 1500
    }
  }
}
```

#### Dashboard

**Get Dashboard Metrics**
```http
GET /api/dashboard
Authorization: Bearer <token>

Response (200):
{
  "success": true,
  "data": {
    "totalKeywords": 25,
    "averageRank": 18.5,
    "rankChange": 5.2,
    "totalProjects": 3,
    "recentScores": [
      {
        "projectId": "uuid",
        "projectName": "My Website",
        "score": 85,
        "date": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

### Rate Limits

| Role | Requests per Hour |
|------|-------------------|
| Free | 100 |
| Pro | 1,000 |
| Admin | Unlimited |

When rate limit is exceeded, the API returns:
```json
{
  "success": false,
  "error": "Rate limit exceeded"
}
```
With HTTP status `429` and `Retry-After` header.

### Error Responses

All errors follow this format:
```json
{
  "success": false,
  "error": "Error message description"
}
```

Common HTTP status codes:
- `400` - Validation error
- `401` - Authentication error (invalid/missing token)
- `403` - Authorization error (insufficient permissions)
- `404` - Resource not found
- `429` - Rate limit exceeded
- `500` - Internal server error

## Development Workflow

### Code Style

The project uses ESLint and Prettier for code formatting:

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

### Database Migrations

**Create a new migration:**
```bash
cd apps/backend
npx prisma migrate dev --name migration_name
```

**Apply migrations:**
```bash
npx prisma migrate deploy
```

**Reset database (development only):**
```bash
npx prisma migrate reset
```

### Adding New Features

1. Update Prisma schema if needed (`apps/backend/prisma/schema.prisma`)
2. Run migrations: `npx prisma migrate dev`
3. Create service in `apps/backend/src/services/`
4. Create route in `apps/backend/src/routes/`
5. Add tests in `apps/backend/tests/`
6. Update API documentation

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes and commit
git add .
git commit -m "feat: add your feature"

# Push to remote
git push origin feature/your-feature-name

# Create pull request
```

## Testing

### Running Tests

**All tests:**
```bash
cd apps/backend
npm test
```

**Specific test file:**
```bash
npm test -- path/to/test.test.ts
```

**Watch mode:**
```bash
npm test -- --watch
```

**Coverage report:**
```bash
npm run test:coverage
```

### Test Types

**Unit Tests** (`tests/unit/`)
- Test individual functions and components
- Mock external dependencies
- Fast execution

**Integration Tests** (`tests/integration/`)
- Test API endpoints end-to-end
- Use test database
- Test service interactions

**Property-Based Tests** (`tests/property/`)
- Test universal properties with randomized inputs
- Use fast-check library
- 100+ iterations per property

### Writing Tests

**Unit Test Example:**
```typescript
import { describe, it, expect } from 'vitest';
import { validateEmail } from '../utils/validation';

describe('Email Validation', () => {
  it('should validate correct email format', () => {
    expect(validateEmail('user@example.com')).toBe(true);
  });

  it('should reject invalid email format', () => {
    expect(validateEmail('invalid-email')).toBe(false);
  });
});
```

**Property Test Example:**
```typescript
import fc from 'fast-check';
import { describe, it } from 'vitest';

describe('Property: Email Validation', () => {
  it('should validate all valid emails', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.emailAddress(),
        async (email) => {
          const result = await validateEmail(email);
          expect(result).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Test Database

Tests use a separate test database configured in `.env.test`:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/seo_tool_test"
```

The test database is automatically reset before each test run.

## Project Structure

```
seo-saas-platform/
├── apps/
│   ├── backend/                    # Express API server
│   │   ├── src/
│   │   │   ├── config/            # Configuration files
│   │   │   │   └── env.ts         # Environment validation
│   │   │   ├── errors/            # Custom error classes
│   │   │   │   ├── AppError.ts
│   │   │   │   ├── ValidationError.ts
│   │   │   │   ├── AuthenticationError.ts
│   │   │   │   └── ...
│   │   │   ├── middleware/        # Express middleware
│   │   │   │   ├── authenticate.ts
│   │   │   │   ├── authorize.ts
│   │   │   │   ├── rateLimit.ts
│   │   │   │   ├── errorHandler.ts
│   │   │   │   └── responseFormatter.ts
│   │   │   ├── routes/            # API route handlers
│   │   │   │   ├── auth.ts
│   │   │   │   ├── projects.ts
│   │   │   │   ├── keywords.ts
│   │   │   │   ├── rank.ts
│   │   │   │   ├── audit.ts
│   │   │   │   ├── competitors.ts
│   │   │   │   ├── content.ts
│   │   │   │   └── dashboard.ts
│   │   │   ├── services/          # Business logic
│   │   │   │   ├── auth/
│   │   │   │   │   └── auth.service.ts
│   │   │   │   ├── cache/
│   │   │   │   │   └── cache.service.ts
│   │   │   │   ├── project/
│   │   │   │   │   └── project.service.ts
│   │   │   │   ├── keyword/
│   │   │   │   │   └── keyword.service.ts
│   │   │   │   ├── rank/
│   │   │   │   │   └── rank.service.ts
│   │   │   │   ├── seo/
│   │   │   │   │   └── seo.service.ts
│   │   │   │   ├── competitor/
│   │   │   │   │   └── competitor.service.ts
│   │   │   │   ├── content/
│   │   │   │   │   └── content.service.ts
│   │   │   │   ├── dashboard/
│   │   │   │   │   └── dashboard.service.ts
│   │   │   │   └── scraper/
│   │   │   │       └── scraper.service.ts
│   │   │   ├── utils/             # Utility functions
│   │   │   │   ├── db.ts          # Database client
│   │   │   │   ├── logger.ts      # Winston logger
│   │   │   │   └── gracefulShutdown.ts
│   │   │   └── index.ts           # Application entry point
│   │   ├── tests/                 # Test suites
│   │   │   ├── unit/              # Unit tests
│   │   │   ├── integration/       # Integration tests
│   │   │   ├── property/          # Property-based tests
│   │   │   ├── helpers/           # Test utilities
│   │   │   │   ├── fixtures.ts
│   │   │   │   ├── test-db.ts
│   │   │   │   └── auth-helper.ts
│   │   │   └── setup.ts           # Test setup
│   │   ├── prisma/                # Database schema
│   │   │   ├── schema.prisma      # Prisma schema
│   │   │   └── migrations/        # Database migrations
│   │   ├── logs/                  # Application logs
│   │   ├── .env                   # Environment variables
│   │   ├── .env.example           # Environment template
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vitest.config.ts       # Test configuration
│   └── frontend/                  # Next.js application
│       ├── app/                   # Next.js App Router
│       │   ├── (auth)/
│       │   │   ├── login/
│       │   │   └── register/
│       │   ├── (dashboard)/
│       │   │   ├── page.tsx       # Dashboard home
│       │   │   ├── projects/
│       │   │   ├── audit/
│       │   │   └── content/
│       │   └── layout.tsx
│       ├── components/            # React components
│       ├── lib/                   # Frontend utilities
│       ├── public/                # Static assets
│       └── package.json
├── packages/
│   └── shared-types/              # Shared TypeScript types
├── scripts/                       # Utility scripts
│   └── init-test-db.sh           # Test database setup
├── docker-compose.yml             # Docker services
├── package.json                   # Root package.json
├── tsconfig.json                  # Root TypeScript config
└── README.md                      # This file
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

### Quick Deployment Checklist

- [ ] Set all required environment variables
- [ ] Use strong `JWT_SECRET` (32+ characters)
- [ ] Configure PostgreSQL with SSL
- [ ] Configure Redis with password
- [ ] Run database migrations
- [ ] Build application (`npm run build`)
- [ ] Set `NODE_ENV=production`
- [ ] Configure reverse proxy (nginx)
- [ ] Set up SSL certificates
- [ ] Configure monitoring and logging
- [ ] Set up automated backups
- [ ] Test all endpoints

## Troubleshooting

### Redis Connection Issues

**Problem:** Cannot connect to Redis

**Solution:**
```bash
# Check if Redis is running
redis-cli ping

# If using Docker
docker ps | grep redis
docker logs seo_tool-redis-1

# Restart Redis
docker compose restart redis
```

### Database Connection Issues

**Problem:** Cannot connect to PostgreSQL

**Solution:**
```bash
# Check PostgreSQL is running
pg_isready

# Test connection
psql -U username -d seo_tool

# Check DATABASE_URL in .env
echo $DATABASE_URL
```

### Migration Issues

**Problem:** Prisma migration fails

**Solution:**
```bash
# Reset database (development only)
npx prisma migrate reset

# Force deploy migrations
npx prisma migrate deploy --force

# Regenerate Prisma Client
npx prisma generate
```

### Test Failures

**Problem:** Tests fail with database errors

**Solution:**
```bash
# Ensure test database exists
createdb seo_tool_test

# Run migrations on test database
DATABASE_URL="postgresql://user:pass@localhost:5432/seo_tool_test" npx prisma migrate deploy

# Clear test database
npm run test:db:reset
```

### Port Already in Use

**Problem:** Port 3001 already in use

**Solution:**
```bash
# Find process using port
lsof -i :3001

# Kill process
kill -9 <PID>

# Or change PORT in .env
PORT=3002
```

### OpenAI API Errors

**Problem:** Content optimization fails

**Solution:**
- Verify `OPENAI_API_KEY` is set correctly
- Check API key has sufficient credits
- Verify API key permissions
- Check OpenAI API status

## License

MIT License - see [LICENSE](./LICENSE) file for details

---

**Need Help?**
- Check [API Documentation](#api-documentation)
- Review [Troubleshooting](#troubleshooting)
- Open an issue on GitHub
- Contact support team
