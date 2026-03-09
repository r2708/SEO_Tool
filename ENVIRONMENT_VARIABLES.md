# Environment Variables Documentation

## Overview

This document provides comprehensive documentation for all environment variables used in the SEO SaaS Platform. Environment variables are used to configure the application for different environments (development, production, test).

## Table of Contents

- [Quick Start](#quick-start)
- [Required Variables](#required-variables)
- [Optional Variables](#optional-variables)
- [Environment-Specific Configuration](#environment-specific-configuration)
- [Security Best Practices](#security-best-practices)
- [Troubleshooting](#troubleshooting)

## Quick Start

### Development Setup

1. Copy the development template:
```bash
cd apps/backend
cp .env.development.template .env
```

2. Update the following required variables:
- `OPENAI_API_KEY`: Your OpenAI API key

3. Start the application:
```bash
npm run dev
```

### Production Setup

1. Copy the production template:
```bash
cd apps/backend
cp .env.production.template .env.production
```

2. Update ALL variables with production values
3. Generate strong secrets (see [Security Best Practices](#security-best-practices))

## Required Variables

### DATABASE_URL

**Description:** PostgreSQL database connection string

**Format:** `postgresql://username:password@host:port/database[?options]`

**Examples:**
```bash
# Development
DATABASE_URL="postgresql://postgres:1234@localhost:5432/seo_tool"

# Production with SSL
DATABASE_URL="postgresql://seo_admin:strong_password@db.example.com:5432/seo_tool_production?sslmode=require"

# With connection pooling
DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=30"
```

**Options:**
- `sslmode=require`: Enable SSL (required for production)
- `connection_limit=N`: Maximum number of connections
- `pool_timeout=N`: Connection timeout in seconds
- `schema=name`: PostgreSQL schema name

**Validation:**
- Must be a valid PostgreSQL connection string
- Application will fail to start if invalid or unreachable

**Security:**
- Use strong passwords (minimum 16 characters)
- Enable SSL in production (`sslmode=require`)
- Restrict database access to application servers only

---

### REDIS_URL

**Description:** Redis cache connection string

**Format:** `redis://[:password@]host:port[/database]`

**Examples:**
```bash
# Development (no password)
REDIS_URL="redis://localhost:6379"

# Production (with password)
REDIS_URL="redis://:strong_redis_password@redis.example.com:6379"

# With database number
REDIS_URL="redis://:password@localhost:6379/0"

# With TLS
REDIS_URL="rediss://:password@redis.example.com:6380"
```

**Options:**
- `/N`: Redis database number (0-15)
- `rediss://`: Use TLS encryption

**Validation:**
- Must be a valid Redis connection string
- Application will fail to start if invalid or unreachable

**Security:**
- Always use password authentication in production
- Use TLS encryption for remote connections
- Restrict Redis access to application servers only

---

### JWT_SECRET

**Description:** Secret key for signing JWT authentication tokens

**Format:** String (minimum 32 characters recommended)

**Examples:**
```bash
# Development (simple)
JWT_SECRET="development-secret-key-change-in-production"

# Production (strong random)
JWT_SECRET="a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6"
```

**Generation:**
```bash
# Generate strong secret (Node.js)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate strong secret (OpenSSL)
openssl rand -hex 32

# Generate strong secret (Python)
python -c "import secrets; print(secrets.token_hex(32))"
```

**Validation:**
- Must be a non-empty string
- Minimum 32 characters recommended for security
- Application will fail to start if missing

**Security:**
- Use different secrets for each environment
- Never commit secrets to version control
- Rotate secrets every 90 days
- Use cryptographically secure random generation

---

### OPENAI_API_KEY

**Description:** OpenAI API key for AI-powered content optimization

**Format:** `sk-...` (starts with "sk-")

**Examples:**
```bash
OPENAI_API_KEY="sk-proj-1234567890abcdefghijklmnopqrstuvwxyz"
```

**Obtaining:**
1. Sign up at https://platform.openai.com
2. Navigate to API Keys section
3. Create new secret key
4. Copy and store securely

**Validation:**
- Must start with "sk-"
- Application will fail to start if missing
- Content optimization features will fail if invalid

**Security:**
- Use separate keys for development and production
- Set usage limits in OpenAI dashboard
- Monitor API usage regularly
- Rotate keys if compromised

**Cost Management:**
- Set monthly spending limits in OpenAI dashboard
- Monitor usage in application logs
- Implement rate limiting for content optimization endpoints

---

## Optional Variables

### PORT

**Description:** Port number for the backend server

**Default:** `3001`

**Examples:**
```bash
PORT=3001  # Default
PORT=8080  # Alternative
```

**Validation:**
- Must be a valid port number (1-65535)
- Port must not be in use by another application

---

### NODE_ENV

**Description:** Node.js environment mode

**Default:** `development`

**Valid Values:**
- `development`: Development mode with debug logging
- `production`: Production mode with optimizations
- `test`: Test mode for running tests

**Examples:**
```bash
NODE_ENV=development  # Development
NODE_ENV=production   # Production
NODE_ENV=test         # Testing
```

**Effects:**
- Controls logging verbosity
- Enables/disables debug features
- Affects error message detail
- Influences caching behavior

---

### LOG_LEVEL

**Description:** Logging verbosity level

**Default:** `info`

**Valid Values:**
- `error`: Only errors
- `warn`: Warnings and errors
- `info`: Informational messages, warnings, and errors
- `debug`: All messages including debug information

**Examples:**
```bash
LOG_LEVEL=error   # Production (minimal)
LOG_LEVEL=info    # Production (standard)
LOG_LEVEL=debug   # Development (verbose)
```

**Recommendations:**
- Development: `debug`
- Production: `info` or `warn`
- Test: `error`

---

### SHOW_STACK_TRACES

**Description:** Include stack traces in error responses

**Default:** `false`

**Valid Values:**
- `true`: Include stack traces (development only)
- `false`: Hide stack traces (production)

**Examples:**
```bash
SHOW_STACK_TRACES=true   # Development
SHOW_STACK_TRACES=false  # Production
```

**Security:**
- Always set to `false` in production
- Stack traces can expose sensitive information

---

### PRISMA_TELEMETRY_DISABLED

**Description:** Disable Prisma telemetry data collection

**Default:** `false`

**Valid Values:**
- `true`: Disable telemetry
- `false`: Enable telemetry

**Examples:**
```bash
PRISMA_TELEMETRY_DISABLED=true
```

---

## Environment-Specific Configuration

### Development Environment

**File:** `.env` or `.env.development`

**Characteristics:**
- Local database and Redis
- Simple passwords acceptable
- Debug logging enabled
- Detailed error messages
- Hot reload enabled

**Example:**
```env
DATABASE_URL="postgresql://postgres:1234@localhost:5432/seo_tool"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="development-secret-key"
OPENAI_API_KEY="sk-your-dev-key"
PORT=3001
NODE_ENV=development
LOG_LEVEL=debug
SHOW_STACK_TRACES=true
PRISMA_TELEMETRY_DISABLED=true
```

---

### Production Environment

**File:** `.env.production`

**Characteristics:**
- Remote database and Redis with SSL
- Strong passwords required
- Minimal logging
- Generic error messages
- Optimized for performance

**Example:**
```env
DATABASE_URL="postgresql://seo_admin:strong_password@db.example.com:5432/seo_tool_production?sslmode=require"
REDIS_URL="redis://:strong_redis_password@redis.example.com:6379"
JWT_SECRET="a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6"
OPENAI_API_KEY="sk-your-production-key"
PORT=3001
NODE_ENV=production
LOG_LEVEL=info
SHOW_STACK_TRACES=false
PRISMA_TELEMETRY_DISABLED=true
```

---

### Test Environment

**File:** `.env.test`

**Characteristics:**
- Separate test database
- Separate Redis database number
- Simple secrets acceptable
- Minimal logging
- Fast execution

**Example:**
```env
DATABASE_URL="postgresql://postgres:1234@localhost:5432/seo_tool_test"
REDIS_URL="redis://localhost:6379/1"
JWT_SECRET="test-secret-key"
OPENAI_API_KEY="sk-test-key"
PORT=3002
NODE_ENV=test
LOG_LEVEL=error
SHOW_STACK_TRACES=true
PRISMA_TELEMETRY_DISABLED=true
```

---

## Security Best Practices

### 1. Never Commit Secrets

**Bad:**
```bash
# .env file committed to git
git add .env
git commit -m "Add environment variables"
```

**Good:**
```bash
# Add .env to .gitignore
echo ".env" >> .gitignore
echo ".env.*" >> .gitignore
echo "!.env.*.template" >> .gitignore
```

### 2. Use Strong Passwords

**Bad:**
```env
DATABASE_URL="postgresql://user:password@localhost:5432/db"
JWT_SECRET="secret"
```

**Good:**
```env
DATABASE_URL="postgresql://user:Kx9#mP2$vL8@qR5&nT7!wY4^zB6*@localhost:5432/db"
JWT_SECRET="a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6"
```

### 3. Use Different Secrets Per Environment

**Bad:**
```env
# Same JWT_SECRET in all environments
JWT_SECRET="same-secret-everywhere"
```

**Good:**
```env
# Development
JWT_SECRET="dev-secret-a1b2c3d4"

# Production
JWT_SECRET="prod-secret-x9y8z7w6"

# Test
JWT_SECRET="test-secret-m5n4o3p2"
```

### 4. Rotate Secrets Regularly

**Schedule:**
- JWT_SECRET: Every 90 days
- Database passwords: Every 90 days
- API keys: Every 180 days or when compromised

**Process:**
1. Generate new secret
2. Update environment variables
3. Restart application
4. Verify functionality
5. Revoke old secret

### 5. Restrict Access

**Database:**
```sql
-- Create user with limited permissions
CREATE USER seo_app WITH PASSWORD 'strong_password';
GRANT CONNECT ON DATABASE seo_tool TO seo_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO seo_app;
```

**Redis:**
```conf
# redis.conf
bind 127.0.0.1
requirepass strong_redis_password
```

### 6. Use Environment-Specific Keys

**OpenAI:**
- Development: Test key with low rate limits
- Production: Production key with appropriate limits
- Monitor usage separately

### 7. Enable SSL/TLS

**Database:**
```env
DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"
```

**Redis:**
```env
REDIS_URL="rediss://:password@host:6380"
```

### 8. Validate Environment Variables

The application validates all required environment variables on startup:

```typescript
// Validation happens in src/config/env.ts
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}
```

---

## Troubleshooting

### Application Won't Start

**Error:** "DATABASE_URL is required"

**Solution:**
```bash
# Check if .env file exists
ls -la apps/backend/.env

# Copy template if missing
cp apps/backend/.env.development.template apps/backend/.env

# Verify DATABASE_URL is set
grep DATABASE_URL apps/backend/.env
```

---

### Database Connection Failed

**Error:** "Connection refused" or "Authentication failed"

**Solution:**
```bash
# Test database connection
psql $DATABASE_URL

# Check PostgreSQL is running
pg_isready

# Verify credentials
echo $DATABASE_URL
```

---

### Redis Connection Failed

**Error:** "Redis connection refused"

**Solution:**
```bash
# Test Redis connection
redis-cli -u $REDIS_URL ping

# Check Redis is running
redis-cli ping

# Verify password
redis-cli -a your-password ping
```

---

### Invalid JWT Secret

**Error:** "JWT_SECRET must be at least 32 characters"

**Solution:**
```bash
# Generate new secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Update .env file
JWT_SECRET="<generated-secret>"
```

---

### OpenAI API Errors

**Error:** "Invalid API key" or "Rate limit exceeded"

**Solution:**
```bash
# Verify API key format
echo $OPENAI_API_KEY | grep "^sk-"

# Check API key in OpenAI dashboard
# https://platform.openai.com/api-keys

# Check usage limits
# https://platform.openai.com/usage
```

---

## Environment Variable Checklist

### Development
- [ ] DATABASE_URL set to local database
- [ ] REDIS_URL set to local Redis
- [ ] JWT_SECRET set (any value)
- [ ] OPENAI_API_KEY set (development key)
- [ ] NODE_ENV=development
- [ ] LOG_LEVEL=debug

### Production
- [ ] DATABASE_URL with SSL enabled
- [ ] REDIS_URL with password
- [ ] JWT_SECRET (strong random, 32+ chars)
- [ ] OPENAI_API_KEY (production key)
- [ ] NODE_ENV=production
- [ ] LOG_LEVEL=info or warn
- [ ] SHOW_STACK_TRACES=false
- [ ] All secrets rotated from development
- [ ] Monitoring configured
- [ ] Backups configured

### Test
- [ ] DATABASE_URL set to test database
- [ ] REDIS_URL set to test Redis (different DB number)
- [ ] JWT_SECRET set (any value)
- [ ] OPENAI_API_KEY set (test key or mock)
- [ ] NODE_ENV=test
- [ ] LOG_LEVEL=error

---

## Additional Resources

- [Main README](./README.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [Docker Guide](./DOCKER.md)
- [API Documentation](./API_DOCUMENTATION.md)
