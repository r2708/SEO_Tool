# SEO SaaS Platform

Full-stack TypeScript SEO analysis platform with Next.js frontend and Express backend.

## Prerequisites

- Node.js 18+
- PostgreSQL
- Redis (via Docker or Homebrew)
- Docker (optional, for Redis)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Redis

**Option A: Using Docker (Recommended)**
```bash
docker compose up -d redis
```

**Option B: Using Homebrew (Mac)**
```bash
brew install redis
brew services start redis
```

Verify Redis is running:
```bash
# Docker
docker exec seo_tool-redis-1 redis-cli ping

# Homebrew
redis-cli ping
```

Expected output: `PONG`

### 3. Database Setup

```bash
cd apps/backend
cp .env.example .env
# Edit .env with your database credentials
npx prisma migrate dev
```

### 4. Run Tests

```bash
cd apps/backend
npm test -- --run
```

### 5. Start Development Server

```bash
cd apps/backend
npm run dev
```

## Project Structure

```
.
├── apps/
│   ├── backend/          # Express API server
│   │   ├── src/
│   │   │   ├── routes/   # API endpoints
│   │   │   ├── services/ # Business logic
│   │   │   ├── middleware/
│   │   │   └── utils/
│   │   ├── tests/        # Test suites
│   │   └── prisma/       # Database schema
│   └── frontend/         # Next.js app (TBD)
└── docker-compose.yml    # Redis container
```

## Environment Variables

Required in `apps/backend/.env`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/seo_tool"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-secret-key"
OPENAI_API_KEY="your-openai-key"
PORT=3001
NODE_ENV=development
```

## API Endpoints

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/projects` - List projects
- `POST /api/projects` - Create project
- `POST /api/keywords/research` - Research keywords
- `POST /api/rank/track` - Track rankings
- `POST /api/audit` - SEO audit
- `POST /api/competitors/analyze` - Competitor analysis
- `POST /api/content/score` - Content optimization (Pro)
- `GET /api/dashboard` - Dashboard metrics

## Testing

The project includes comprehensive test coverage:

- **Property-based tests**: Validate correctness properties
- **Integration tests**: Test API endpoints and database operations
- **Unit tests**: Test individual components

## Known Issues

- Prisma cleanup issue in concurrent test execution (tests pass but crash at end)
- Workaround: Tests run sequentially with `threads: false` in vitest config

## License

MIT
