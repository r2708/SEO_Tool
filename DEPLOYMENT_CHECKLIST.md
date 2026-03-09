# Deployment Checklist

## Pre-Deployment

### Code Preparation
- [ ] All features implemented and tested
- [ ] All tests passing (`npm test`)
- [ ] Code reviewed and approved
- [ ] Documentation updated
- [ ] Version number updated in package.json
- [ ] CHANGELOG.md updated

### Environment Setup
- [ ] Production server provisioned
- [ ] Domain name configured
- [ ] DNS records set up
- [ ] SSL certificates obtained
- [ ] Firewall rules configured

### Database Setup
- [ ] PostgreSQL installed and configured
- [ ] Production database created
- [ ] Database user created with strong password
- [ ] SSL enabled for database connections
- [ ] Database backups configured
- [ ] Connection pooling configured

### Redis Setup
- [ ] Redis installed and configured
- [ ] Redis password set
- [ ] Persistence (AOF) enabled
- [ ] Memory limits configured
- [ ] Redis backups configured

### Application Configuration
- [ ] Environment variables configured (see ENVIRONMENT_VARIABLES.md)
- [ ] Strong JWT_SECRET generated (32+ characters)
- [ ] OpenAI API key configured
- [ ] Database connection string with SSL
- [ ] Redis connection string with password
- [ ] NODE_ENV set to 'production'
- [ ] LOG_LEVEL set appropriately
- [ ] SHOW_STACK_TRACES set to false

### Security
- [ ] All passwords are strong and unique
- [ ] Secrets rotated from development
- [ ] .env files not committed to git
- [ ] Database access restricted to app servers
- [ ] Redis access restricted to app servers
- [ ] Firewall allows only necessary ports (80, 443)
- [ ] SSH key-based authentication enabled
- [ ] Root login disabled
- [ ] Fail2ban or similar installed

## Deployment

### Build Application
- [ ] Dependencies installed (`npm install`)
- [ ] Backend built (`cd apps/backend && npm run build`)
- [ ] Frontend built (`cd apps/frontend && npm run build`)
- [ ] Build artifacts verified

### Database Migration
- [ ] Backup existing database (if applicable)
- [ ] Run migrations (`npx prisma migrate deploy`)
- [ ] Verify schema matches expectations
- [ ] Seed initial data if needed (`npm run db:seed`)

### Application Deployment
- [ ] Application files uploaded to server
- [ ] PM2 ecosystem file configured
- [ ] Applications started with PM2
- [ ] PM2 startup script configured
- [ ] PM2 save executed

### Reverse Proxy
- [ ] Nginx installed and configured
- [ ] SSL certificates installed
- [ ] HTTP to HTTPS redirect configured
- [ ] Proxy headers configured
- [ ] Rate limiting configured
- [ ] Nginx configuration tested (`nginx -t`)
- [ ] Nginx reloaded

### Monitoring
- [ ] Health checks configured
- [ ] Log rotation configured
- [ ] Monitoring tools installed (htop, iotop, etc.)
- [ ] Application logs accessible
- [ ] Error alerting configured
- [ ] Uptime monitoring configured

## Post-Deployment

### Verification
- [ ] Backend health endpoint responding (`/health`)
- [ ] Frontend loading correctly
- [ ] User registration working
- [ ] User login working
- [ ] All API endpoints responding
- [ ] Database queries executing
- [ ] Redis caching working
- [ ] OpenAI integration working (if applicable)

### Testing
- [ ] Smoke tests passed
- [ ] Critical user flows tested
- [ ] Performance acceptable (response times < 500ms)
- [ ] No errors in logs
- [ ] SSL certificate valid
- [ ] HTTPS working correctly

### Documentation
- [ ] Deployment documented
- [ ] Credentials stored securely
- [ ] Runbook created for common operations
- [ ] Team notified of deployment
- [ ] Rollback plan documented

### Monitoring
- [ ] Application metrics being collected
- [ ] Error rates normal
- [ ] Response times acceptable
- [ ] Resource usage within limits
- [ ] No memory leaks detected
- [ ] Database connections stable

## Rollback Plan

### If Deployment Fails
1. [ ] Stop new application
2. [ ] Restore previous application version
3. [ ] Restore database from backup (if schema changed)
4. [ ] Verify old version working
5. [ ] Investigate and fix issues
6. [ ] Plan re-deployment

### Rollback Commands
```bash
# Stop current version
pm2 stop all

# Restore previous version
cd /var/www/seo-saas-platform
git checkout <previous-tag>
npm install
cd apps/backend && npm run build
cd ../frontend && npm run build

# Restore database (if needed)
gunzip < /var/backups/postgresql/backup_YYYYMMDD.sql.gz | \
  psql -U seo_admin -d seo_tool_production

# Start application
pm2 start all
```

## Maintenance

### Daily
- [ ] Check application logs for errors
- [ ] Monitor resource usage
- [ ] Verify backups completed

### Weekly
- [ ] Review error rates and trends
- [ ] Check disk space
- [ ] Review security logs
- [ ] Update dependencies (if needed)

### Monthly
- [ ] Review and rotate logs
- [ ] Test backup restoration
- [ ] Review and update documentation
- [ ] Security audit
- [ ] Performance review

### Quarterly
- [ ] Rotate secrets (JWT_SECRET, passwords)
- [ ] Update SSL certificates (if needed)
- [ ] Review and update dependencies
- [ ] Disaster recovery drill
- [ ] Capacity planning review

## Emergency Contacts

### Team
- DevOps Lead: [Name] - [Email] - [Phone]
- Backend Lead: [Name] - [Email] - [Phone]
- Frontend Lead: [Name] - [Email] - [Phone]
- Database Admin: [Name] - [Email] - [Phone]

### Services
- Hosting Provider: [Support URL] - [Phone]
- Domain Registrar: [Support URL] - [Phone]
- SSL Provider: [Support URL] - [Phone]
- OpenAI Support: https://help.openai.com

## Common Operations

### Restart Application
```bash
pm2 restart all
```

### View Logs
```bash
pm2 logs
tail -f /var/www/seo-saas-platform/apps/backend/logs/combined.log
```

### Database Backup
```bash
/usr/local/bin/backup-database.sh
```

### Update Application
```bash
cd /var/www/seo-saas-platform
git pull
npm install
cd apps/backend && npm run build
cd ../frontend && npm run build
pm2 restart all
```

### Run Migrations
```bash
cd /var/www/seo-saas-platform/apps/backend
npx prisma migrate deploy
```

## Resources

- [README.md](./README.md) - Main documentation
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Detailed deployment guide
- [DOCKER.md](./DOCKER.md) - Docker deployment guide
- [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) - API reference
- [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) - Environment configuration

---

**Last Updated:** [Date]
**Deployed By:** [Name]
**Deployment Version:** [Version]
