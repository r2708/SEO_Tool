# Deployment Guide

## Overview

This guide covers deploying the SEO SaaS Platform to production environments. The platform consists of a Node.js/Express backend, Next.js frontend, PostgreSQL database, and Redis cache.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Database Configuration](#database-configuration)
- [Redis Configuration](#redis-configuration)
- [Application Deployment](#application-deployment)
- [Reverse Proxy Setup](#reverse-proxy-setup)
- [SSL Configuration](#ssl-configuration)
- [Monitoring and Logging](#monitoring-and-logging)
- [Backup and Recovery](#backup-and-recovery)
- [Scaling Considerations](#scaling-considerations)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Server Requirements

**Minimum Specifications:**
- CPU: 2 cores
- RAM: 4GB
- Storage: 20GB SSD
- OS: Ubuntu 20.04 LTS or later

**Recommended Specifications:**
- CPU: 4 cores
- RAM: 8GB
- Storage: 50GB SSD
- OS: Ubuntu 22.04 LTS

### Software Requirements

- Node.js 18.x or higher
- PostgreSQL 14.x or higher
- Redis 7.x or higher
- Nginx (for reverse proxy)
- PM2 (for process management)
- Certbot (for SSL certificates)

## Environment Setup

### 1. Update System

```bash
sudo apt update
sudo apt upgrade -y
```

### 2. Install Node.js

```bash
# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version
```

### 3. Install PostgreSQL

```bash
# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verify installation
sudo -u postgres psql --version
```

### 4. Install Redis

```bash
# Install Redis
sudo apt install -y redis-server

# Configure Redis to start on boot
sudo systemctl enable redis-server

# Start Redis
sudo systemctl start redis-server

# Verify installation
redis-cli ping
```

### 5. Install Nginx

```bash
# Install Nginx
sudo apt install -y nginx

# Start Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 6. Install PM2

```bash
# Install PM2 globally
sudo npm install -g pm2

# Configure PM2 to start on boot
pm2 startup systemd
```

## Database Configuration

### 1. Create Production Database

```bash
# Switch to postgres user
sudo -u postgres psql

# Create database
CREATE DATABASE seo_tool_production;

# Create user with strong password
CREATE USER seo_admin WITH ENCRYPTED PASSWORD 'your-strong-password-here';

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE seo_tool_production TO seo_admin;

# Exit psql
\q
```

### 2. Configure PostgreSQL for Production

Edit PostgreSQL configuration:

```bash
sudo nano /etc/postgresql/14/main/postgresql.conf
```

Recommended settings:
```conf
# Connection Settings
max_connections = 100
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 2621kB
min_wal_size = 1GB
max_wal_size = 4GB

# Logging
logging_collector = on
log_directory = 'log'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_rotation_age = 1d
log_rotation_size = 100MB
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
log_timezone = 'UTC'
```

### 3. Configure SSL for PostgreSQL

```bash
# Generate SSL certificate
sudo -u postgres openssl req -new -x509 -days 365 -nodes -text \
  -out /var/lib/postgresql/14/main/server.crt \
  -keyout /var/lib/postgresql/14/main/server.key

# Set permissions
sudo chmod 600 /var/lib/postgresql/14/main/server.key
sudo chown postgres:postgres /var/lib/postgresql/14/main/server.*
```

Edit `postgresql.conf`:
```conf
ssl = on
ssl_cert_file = '/var/lib/postgresql/14/main/server.crt'
ssl_key_file = '/var/lib/postgresql/14/main/server.key'
```

Restart PostgreSQL:
```bash
sudo systemctl restart postgresql
```

### 4. Run Database Migrations

```bash
cd /var/www/seo-saas-platform/apps/backend

# Set DATABASE_URL
export DATABASE_URL="postgresql://seo_admin:your-password@localhost:5432/seo_tool_production"

# Run migrations
npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate
```

## Redis Configuration

### 1. Configure Redis for Production

Edit Redis configuration:

```bash
sudo nano /etc/redis/redis.conf
```

Recommended settings:
```conf
# Bind to localhost only (if on same server)
bind 127.0.0.1

# Set password
requirepass your-strong-redis-password

# Enable persistence
save 900 1
save 300 10
save 60 10000

# Set max memory
maxmemory 512mb
maxmemory-policy allkeys-lru

# Enable AOF persistence
appendonly yes
appendfilename "appendonly.aof"
appendfsync everysec

# Disable dangerous commands
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command CONFIG ""
```

### 2. Restart Redis

```bash
sudo systemctl restart redis-server
```

### 3. Verify Redis Configuration

```bash
redis-cli -a your-strong-redis-password ping
```

## Application Deployment

### 1. Clone Repository

```bash
# Create application directory
sudo mkdir -p /var/www/seo-saas-platform
sudo chown $USER:$USER /var/www/seo-saas-platform

# Clone repository
cd /var/www
git clone <repository-url> seo-saas-platform
cd seo-saas-platform
```

### 2. Install Dependencies

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd apps/backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 3. Configure Environment Variables

Create production environment file:

```bash
cd /var/www/seo-saas-platform/apps/backend
nano .env.production
```

Production environment variables:
```env
# Database Configuration
DATABASE_URL="postgresql://seo_admin:your-password@localhost:5432/seo_tool_production?sslmode=require"

# Redis Configuration
REDIS_URL="redis://:your-redis-password@localhost:6379"

# JWT Configuration (use strong random string)
JWT_SECRET="your-super-secret-jwt-key-minimum-32-characters-long"

# OpenAI Configuration
OPENAI_API_KEY="sk-your-openai-api-key"

# Server Configuration
PORT=3001
NODE_ENV=production

# Logging Configuration
LOG_LEVEL=info
```

**Generate Strong JWT Secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Build Applications

```bash
# Build backend
cd /var/www/seo-saas-platform/apps/backend
npm run build

# Build frontend
cd ../frontend
npm run build
```

### 5. Configure PM2

Create PM2 ecosystem file:

```bash
cd /var/www/seo-saas-platform
nano ecosystem.config.js
```

```javascript
module.exports = {
  apps: [
    {
      name: 'seo-backend',
      cwd: '/var/www/seo-saas-platform/apps/backend',
      script: 'dist/index.js',
      instances: 2,
      exec_mode: 'cluster',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: '/var/log/pm2/seo-backend-error.log',
      out_file: '/var/log/pm2/seo-backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_memory_restart: '500M',
      autorestart: true,
      watch: false
    },
    {
      name: 'seo-frontend',
      cwd: '/var/www/seo-saas-platform/apps/frontend',
      script: 'npm',
      args: 'start',
      instances: 1,
      exec_mode: 'fork',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: '/var/log/pm2/seo-frontend-error.log',
      out_file: '/var/log/pm2/seo-frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_memory_restart: '500M',
      autorestart: true,
      watch: false
    }
  ]
};
```

### 6. Start Applications with PM2

```bash
# Create log directory
sudo mkdir -p /var/log/pm2
sudo chown $USER:$USER /var/log/pm2

# Start applications
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup systemd
```

### 7. Verify Applications

```bash
# Check PM2 status
pm2 status

# View logs
pm2 logs

# Monitor applications
pm2 monit
```

## Reverse Proxy Setup

### Configure Nginx

Create Nginx configuration:

```bash
sudo nano /etc/nginx/sites-available/seo-saas-platform
```

```nginx
# Backend API
upstream backend {
    server 127.0.0.1:3001;
    keepalive 64;
}

# Frontend
upstream frontend {
    server 127.0.0.1:3000;
    keepalive 64;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name api.yourdomain.com yourdomain.com;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# API Server (HTTPS)
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.yourdomain.com;
    
    # SSL Configuration (will be added by Certbot)
    # ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;
    
    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    
    # Logging
    access_log /var/log/nginx/api-access.log;
    error_log /var/log/nginx/api-error.log;
    
    # Proxy to backend
    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Buffer settings
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
        proxy_busy_buffers_size 8k;
    }
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req zone=api_limit burst=20 nodelay;
}

# Frontend Server (HTTPS)
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;
    
    # SSL Configuration (will be added by Certbot)
    # ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    
    # Logging
    access_log /var/log/nginx/frontend-access.log;
    error_log /var/log/nginx/frontend-error.log;
    
    # Proxy to frontend
    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Static files caching
    location /_next/static {
        proxy_pass http://frontend;
        proxy_cache_valid 200 60m;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable the site:

```bash
# Create symlink
sudo ln -s /etc/nginx/sites-available/seo-saas-platform /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

## SSL Configuration

### Install Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### Obtain SSL Certificates

```bash
# For API domain
sudo certbot --nginx -d api.yourdomain.com

# For frontend domain
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### Auto-renewal

Certbot automatically sets up renewal. Verify:

```bash
# Test renewal
sudo certbot renew --dry-run

# Check renewal timer
sudo systemctl status certbot.timer
```

## Monitoring and Logging

### 1. Application Logs

**PM2 Logs:**
```bash
# View all logs
pm2 logs

# View specific app logs
pm2 logs seo-backend
pm2 logs seo-frontend

# Clear logs
pm2 flush
```

**Application Logs:**
```bash
# Backend logs
tail -f /var/www/seo-saas-platform/apps/backend/logs/combined.log
tail -f /var/www/seo-saas-platform/apps/backend/logs/error.log
```

### 2. System Monitoring

**Install monitoring tools:**
```bash
sudo apt install -y htop iotop nethogs
```

**Monitor resources:**
```bash
# CPU and memory
htop

# Disk I/O
sudo iotop

# Network
sudo nethogs

# PM2 monitoring
pm2 monit
```

### 3. Log Rotation

Configure log rotation:

```bash
sudo nano /etc/logrotate.d/seo-saas-platform
```

```conf
/var/www/seo-saas-platform/apps/backend/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}

/var/log/nginx/*-access.log /var/log/nginx/*-error.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        systemctl reload nginx
    endscript
}
```

### 4. Health Checks

Create health check script:

```bash
nano /usr/local/bin/health-check.sh
```

```bash
#!/bin/bash

# Check backend
if ! curl -f http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "Backend is down, restarting..."
    pm2 restart seo-backend
fi

# Check frontend
if ! curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo "Frontend is down, restarting..."
    pm2 restart seo-frontend
fi

# Check PostgreSQL
if ! pg_isready > /dev/null 2>&1; then
    echo "PostgreSQL is down!"
    # Send alert
fi

# Check Redis
if ! redis-cli -a your-redis-password ping > /dev/null 2>&1; then
    echo "Redis is down!"
    # Send alert
fi
```

Make executable and add to cron:

```bash
chmod +x /usr/local/bin/health-check.sh

# Add to crontab (every 5 minutes)
crontab -e
```

```cron
*/5 * * * * /usr/local/bin/health-check.sh >> /var/log/health-check.log 2>&1
```

## Backup and Recovery

### 1. Database Backups

Create backup script:

```bash
sudo nano /usr/local/bin/backup-database.sh
```

```bash
#!/bin/bash

BACKUP_DIR="/var/backups/postgresql"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="seo_tool_production"
DB_USER="seo_admin"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
PGPASSWORD="your-password" pg_dump -U $DB_USER -h localhost $DB_NAME | gzip > $BACKUP_DIR/backup_$DATE.sql.gz

# Keep only last 7 days of backups
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete

echo "Backup completed: backup_$DATE.sql.gz"
```

Make executable and schedule:

```bash
chmod +x /usr/local/bin/backup-database.sh

# Add to crontab (daily at 2 AM)
crontab -e
```

```cron
0 2 * * * /usr/local/bin/backup-database.sh >> /var/log/backup.log 2>&1
```

### 2. Redis Backups

Redis automatically creates RDB snapshots based on configuration. To manually backup:

```bash
# Create backup
redis-cli -a your-redis-password BGSAVE

# Copy RDB file
cp /var/lib/redis/dump.rdb /var/backups/redis/dump_$(date +%Y%m%d).rdb
```

### 3. Application Backups

```bash
# Backup application files
tar -czf /var/backups/app/seo-saas-$(date +%Y%m%d).tar.gz \
  /var/www/seo-saas-platform \
  --exclude=node_modules \
  --exclude=.git
```

### 4. Recovery Procedures

**Restore Database:**
```bash
# Stop application
pm2 stop all

# Drop and recreate database
sudo -u postgres psql -c "DROP DATABASE seo_tool_production;"
sudo -u postgres psql -c "CREATE DATABASE seo_tool_production;"

# Restore from backup
gunzip < /var/backups/postgresql/backup_YYYYMMDD_HHMMSS.sql.gz | \
  PGPASSWORD="your-password" psql -U seo_admin -h localhost seo_tool_production

# Restart application
pm2 start all
```

**Restore Redis:**
```bash
# Stop Redis
sudo systemctl stop redis-server

# Restore RDB file
sudo cp /var/backups/redis/dump_YYYYMMDD.rdb /var/lib/redis/dump.rdb
sudo chown redis:redis /var/lib/redis/dump.rdb

# Start Redis
sudo systemctl start redis-server
```

## Scaling Considerations

### Horizontal Scaling

**Load Balancer Configuration:**

```nginx
upstream backend_cluster {
    least_conn;
    server backend1.internal:3001 max_fails=3 fail_timeout=30s;
    server backend2.internal:3001 max_fails=3 fail_timeout=30s;
    server backend3.internal:3001 max_fails=3 fail_timeout=30s;
    keepalive 64;
}
```

### Database Scaling

**Read Replicas:**
- Configure PostgreSQL streaming replication
- Route read queries to replicas
- Keep writes on primary

**Connection Pooling:**
- Use PgBouncer for connection pooling
- Configure pool size based on load

### Redis Scaling

**Redis Cluster:**
- Set up Redis Cluster for horizontal scaling
- Configure client for cluster mode
- Implement proper key distribution

### CDN Integration

- Use CloudFlare or AWS CloudFront
- Cache static assets
- Enable DDoS protection

## Troubleshooting

### Application Won't Start

```bash
# Check PM2 logs
pm2 logs --err

# Check environment variables
pm2 env 0

# Verify database connection
psql $DATABASE_URL

# Verify Redis connection
redis-cli -a your-password ping
```

### High Memory Usage

```bash
# Check memory usage
pm2 monit

# Restart application
pm2 restart all

# Adjust max memory in ecosystem.config.js
max_memory_restart: '1G'
```

### Database Connection Pool Exhausted

```bash
# Check active connections
SELECT count(*) FROM pg_stat_activity;

# Kill idle connections
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE state = 'idle' 
AND state_change < current_timestamp - INTERVAL '5 minutes';
```

### SSL Certificate Issues

```bash
# Check certificate expiry
sudo certbot certificates

# Force renewal
sudo certbot renew --force-renewal

# Test Nginx configuration
sudo nginx -t
```

---

## Deployment Checklist

- [ ] Server provisioned with required specifications
- [ ] All software dependencies installed
- [ ] PostgreSQL configured with SSL
- [ ] Redis configured with password
- [ ] Strong JWT_SECRET generated
- [ ] All environment variables set
- [ ] Database migrations run
- [ ] Applications built successfully
- [ ] PM2 configured and running
- [ ] Nginx configured as reverse proxy
- [ ] SSL certificates obtained and configured
- [ ] Firewall configured (ports 80, 443 open)
- [ ] Health checks configured
- [ ] Backup scripts configured
- [ ] Log rotation configured
- [ ] Monitoring tools installed
- [ ] All endpoints tested
- [ ] Load testing performed
- [ ] Documentation updated

---

For additional support, contact the DevOps team or refer to the main [README.md](./README.md).
