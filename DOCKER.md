# Docker Deployment Guide

## Overview

This guide covers deploying the SEO SaaS Platform using Docker and Docker Compose. The platform includes four services: PostgreSQL, Redis, Backend API, and Frontend application.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- 4GB RAM minimum
- 20GB disk space

## Quick Start

### 1. Clone Repository

```bash
git clone <repository-url>
cd seo-saas-platform
```

### 2. Create Environment File

Create `.env` file in the project root:

```env
# Database
POSTGRES_PASSWORD=your-strong-postgres-password

# Redis
REDIS_PASSWORD=your-strong-redis-password

# JWT
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters

# OpenAI
OPENAI_API_KEY=sk-your-openai-api-key

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 3. Build and Start Services

```bash
# Build images
docker-compose -f docker-compose.prod.yml build

# Start services
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

### 4. Verify Deployment

```bash
# Check service status
docker-compose -f docker-compose.prod.yml ps

# Test backend
curl http://localhost:3001/health

# Test frontend
curl http://localhost:3000
```

## Docker Compose Files

### Development (docker-compose.yml)

For local development with hot-reload:

```bash
docker-compose up -d
```

Services:
- PostgreSQL on port 5432
- Redis on port 6379
- Includes test database initialization

### Production (docker-compose.prod.yml)

For production deployment:

```bash
docker-compose -f docker-compose.prod.yml up -d
```

Services:
- PostgreSQL with authentication
- Redis with password
- Backend API (built from source)
- Frontend application (built from source)

## Service Configuration

### PostgreSQL

**Image:** `postgres:14-alpine`

**Environment Variables:**
- `POSTGRES_DB`: Database name (default: seo_tool)
- `POSTGRES_USER`: Database user (default: seo_user)
- `POSTGRES_PASSWORD`: Database password (required)

**Ports:** 5432:5432

**Volumes:** `postgres-data:/var/lib/postgresql/data`

**Health Check:** `pg_isready` every 10 seconds

### Redis

**Image:** `redis:7-alpine`

**Environment Variables:**
- `REDIS_PASSWORD`: Redis password (required)

**Ports:** 6379:6379

**Volumes:** `redis-data:/data`

**Persistence:** AOF (Append Only File) enabled

**Health Check:** `redis-cli ping` every 10 seconds

### Backend

**Build:** `apps/backend/Dockerfile`

**Environment Variables:**
- `NODE_ENV`: production
- `PORT`: 3001
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `JWT_SECRET`: JWT signing secret
- `OPENAI_API_KEY`: OpenAI API key
- `LOG_LEVEL`: info

**Ports:** 3001:3001

**Volumes:** `./apps/backend/logs:/app/logs`

**Startup:** Runs Prisma migrations then starts server

### Frontend

**Build:** `apps/frontend/Dockerfile`

**Environment Variables:**
- `NODE_ENV`: production
- `NEXT_PUBLIC_API_URL`: Backend API URL

**Ports:** 3000:3000

**Dependencies:** Waits for backend to be healthy

## Docker Commands

### Build Commands

```bash
# Build all services
docker-compose -f docker-compose.prod.yml build

# Build specific service
docker-compose -f docker-compose.prod.yml build backend

# Build without cache
docker-compose -f docker-compose.prod.yml build --no-cache
```

### Start/Stop Commands

```bash
# Start all services
docker-compose -f docker-compose.prod.yml up -d

# Start specific service
docker-compose -f docker-compose.prod.yml up -d backend

# Stop all services
docker-compose -f docker-compose.prod.yml down

# Stop and remove volumes
docker-compose -f docker-compose.prod.yml down -v
```

### Logs Commands

```bash
# View all logs
docker-compose -f docker-compose.prod.yml logs

# Follow logs
docker-compose -f docker-compose.prod.yml logs -f

# View specific service logs
docker-compose -f docker-compose.prod.yml logs backend

# View last 100 lines
docker-compose -f docker-compose.prod.yml logs --tail=100
```

### Status Commands

```bash
# List running services
docker-compose -f docker-compose.prod.yml ps

# View resource usage
docker stats

# Inspect service
docker-compose -f docker-compose.prod.yml exec backend env
```

### Maintenance Commands

```bash
# Restart service
docker-compose -f docker-compose.prod.yml restart backend

# Execute command in container
docker-compose -f docker-compose.prod.yml exec backend sh

# Run database migrations
docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy

# Access PostgreSQL
docker-compose -f docker-compose.prod.yml exec postgres psql -U seo_user -d seo_tool

# Access Redis CLI
docker-compose -f docker-compose.prod.yml exec redis redis-cli -a your-password
```

## Database Management

### Run Migrations

```bash
docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```

### Backup Database

```bash
# Create backup
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U seo_user seo_tool > backup.sql

# Backup with compression
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U seo_user seo_tool | gzip > backup.sql.gz
```

### Restore Database

```bash
# Restore from backup
cat backup.sql | docker-compose -f docker-compose.prod.yml exec -T postgres psql -U seo_user seo_tool

# Restore from compressed backup
gunzip < backup.sql.gz | docker-compose -f docker-compose.prod.yml exec -T postgres psql -U seo_user seo_tool
```

### Access Database

```bash
# PostgreSQL shell
docker-compose -f docker-compose.prod.yml exec postgres psql -U seo_user -d seo_tool

# Run SQL query
docker-compose -f docker-compose.prod.yml exec postgres psql -U seo_user -d seo_tool -c "SELECT * FROM users;"
```

## Redis Management

### Access Redis CLI

```bash
docker-compose -f docker-compose.prod.yml exec redis redis-cli -a your-password
```

### Common Redis Commands

```bash
# Check connection
docker-compose -f docker-compose.prod.yml exec redis redis-cli -a your-password ping

# Get all keys
docker-compose -f docker-compose.prod.yml exec redis redis-cli -a your-password KEYS '*'

# Flush all data (use with caution!)
docker-compose -f docker-compose.prod.yml exec redis redis-cli -a your-password FLUSHALL

# Get memory usage
docker-compose -f docker-compose.prod.yml exec redis redis-cli -a your-password INFO memory
```

## Scaling

### Scale Backend Instances

```bash
# Scale to 3 backend instances
docker-compose -f docker-compose.prod.yml up -d --scale backend=3

# Note: You'll need a load balancer (nginx) to distribute traffic
```

### Load Balancer Configuration

Create `nginx.conf`:

```nginx
upstream backend {
    least_conn;
    server backend:3001;
}

server {
    listen 80;
    
    location /api {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Add nginx to docker-compose:

```yaml
nginx:
  image: nginx:alpine
  ports:
    - "80:80"
  volumes:
    - ./nginx.conf:/etc/nginx/nginx.conf:ro
  depends_on:
    - backend
```

## Monitoring

### Health Checks

All services include health checks:

```bash
# Check health status
docker-compose -f docker-compose.prod.yml ps

# View health check logs
docker inspect --format='{{json .State.Health}}' seo-backend | jq
```

### Resource Monitoring

```bash
# Real-time resource usage
docker stats

# Container resource limits
docker-compose -f docker-compose.prod.yml config
```

### Logs Monitoring

```bash
# Follow all logs
docker-compose -f docker-compose.prod.yml logs -f

# Filter by service
docker-compose -f docker-compose.prod.yml logs -f backend

# Search logs
docker-compose -f docker-compose.prod.yml logs | grep ERROR
```

## Troubleshooting

### Service Won't Start

```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs backend

# Check environment variables
docker-compose -f docker-compose.prod.yml exec backend env

# Rebuild image
docker-compose -f docker-compose.prod.yml build --no-cache backend
docker-compose -f docker-compose.prod.yml up -d backend
```

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker-compose -f docker-compose.prod.yml ps postgres

# Test connection
docker-compose -f docker-compose.prod.yml exec postgres pg_isready

# Check logs
docker-compose -f docker-compose.prod.yml logs postgres

# Verify DATABASE_URL
docker-compose -f docker-compose.prod.yml exec backend echo $DATABASE_URL
```

### Redis Connection Issues

```bash
# Check Redis is running
docker-compose -f docker-compose.prod.yml ps redis

# Test connection
docker-compose -f docker-compose.prod.yml exec redis redis-cli -a your-password ping

# Check logs
docker-compose -f docker-compose.prod.yml logs redis
```

### Out of Memory

```bash
# Check memory usage
docker stats

# Increase Docker memory limit (Docker Desktop)
# Settings > Resources > Memory

# Add memory limits to docker-compose.yml
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 512M
```

### Port Already in Use

```bash
# Find process using port
lsof -i :3001

# Change port in docker-compose.yml
ports:
  - "3002:3001"
```

## Production Best Practices

### 1. Use Environment Variables

Never hardcode secrets in docker-compose.yml:

```yaml
environment:
  JWT_SECRET: ${JWT_SECRET}  # Good
  # JWT_SECRET: hardcoded-secret  # Bad
```

### 2. Enable Resource Limits

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

### 3. Use Health Checks

All services should have health checks:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

### 4. Implement Logging

Use logging drivers:

```yaml
services:
  backend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### 5. Use Named Volumes

```yaml
volumes:
  postgres-data:
    driver: local
  redis-data:
    driver: local
```

### 6. Network Isolation

```yaml
networks:
  frontend:
  backend:
  
services:
  frontend:
    networks:
      - frontend
  backend:
    networks:
      - frontend
      - backend
  postgres:
    networks:
      - backend
```

## Security Considerations

### 1. Use Strong Passwords

Generate strong passwords:

```bash
# Generate random password
openssl rand -base64 32
```

### 2. Don't Expose Unnecessary Ports

Remove port mappings for internal services:

```yaml
# Don't expose PostgreSQL to host
postgres:
  # ports:
  #   - "5432:5432"  # Remove this
```

### 3. Run as Non-Root User

Dockerfiles already include non-root users:

```dockerfile
USER expressjs  # Backend
USER nextjs     # Frontend
```

### 4. Keep Images Updated

```bash
# Pull latest images
docker-compose -f docker-compose.prod.yml pull

# Rebuild with latest base images
docker-compose -f docker-compose.prod.yml build --pull
```

### 5. Scan for Vulnerabilities

```bash
# Scan image
docker scan seo-backend

# Use Trivy
trivy image seo-backend
```

## Cleanup

### Remove Stopped Containers

```bash
docker-compose -f docker-compose.prod.yml down
```

### Remove Volumes

```bash
# Remove all volumes (WARNING: deletes data)
docker-compose -f docker-compose.prod.yml down -v
```

### Remove Images

```bash
# Remove project images
docker-compose -f docker-compose.prod.yml down --rmi all

# Remove unused images
docker image prune -a
```

### Complete Cleanup

```bash
# Remove everything (containers, volumes, images, networks)
docker-compose -f docker-compose.prod.yml down -v --rmi all
docker system prune -a --volumes
```

---

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Main README](./README.md)
- [Deployment Guide](./DEPLOYMENT.md)
