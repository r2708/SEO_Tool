# Implementation Plan: SEO SaaS Platform

## Overview

This implementation plan breaks down the SEO SaaS platform into discrete, sequential coding tasks. The platform is a full-stack TypeScript application with Next.js frontend, Express backend, PostgreSQL database (via Prisma ORM), and Redis caching. Each task builds incrementally, ensuring all components are integrated and no code is orphaned.

The implementation follows a bottom-up approach: infrastructure → data layer → services → API → frontend → testing → deployment preparation.

## Tasks

- [x] 1. Project setup and infrastructure
  - [x] 1.1 Initialize monorepo structure with backend and frontend workspaces
    - Create root package.json with workspaces for backend and frontend
    - Initialize TypeScript configuration for both workspaces
    - Set up shared types package for API contracts
    - _Requirements: 18.1, 18.7_

  - [x] 1.2 Configure backend dependencies and environment
    - Install Express, Prisma, bcrypt, jsonwebtoken, Redis client, Winston logger
    - Install Puppeteer for web scraping
    - Install OpenAI SDK for content optimization
    - Create .env.example with required variables (DATABASE_URL, REDIS_URL, JWT_SECRET, OPENAI_API_KEY)
    - Implement environment validation that fails startup if required variables are missing
    - _Requirements: 18.2, 18.3, 18.4, 18.5, 18.6_

  - [x] 1.3 Write property test for environment validation
    - Property 60: Environment Variable Validation
    - Validates: Requirements 18.6

  - [x] 1.4 Configure frontend dependencies
    - Initialize Next.js 14 with App Router and TypeScript
    - Install Tailwind CSS for styling
    - Install chart library for ranking visualization (e.g., recharts)
    - Install API client library (axios or fetch wrapper)
    - _Requirements: N/A (Frontend setup)_


- [x] 2. Database schema and migrations
  - [x] 2.1 Create Prisma schema with all models
    - Define User model with email, password, role, timestamps
    - Define Project model with domain, name, userId, timestamps
    - Define Keyword model with projectId, keyword, searchVolume, difficulty, cpc, lastUpdated
    - Define Ranking model with projectId, keyword, position, date
    - Define Competitor model with projectId, domain, lastAnalyzed
    - Define CompetitorKeyword model with competitorId, keyword
    - Define SEOScore model with projectId, url, score, analysis (JSON), createdAt
    - Add all foreign key relationships with cascade delete
    - Add unique constraints (email, projectId+keyword, projectId+keyword+date, projectId+domain, competitorId+keyword)
    - Add indexes on frequently queried fields (userId, projectId, keyword, date, createdAt)
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7_

  - [x] 2.2 Write property tests for database constraints
    - Property 56: Foreign Key Constraint Enforcement
    - Property 57: Cascade Delete Behavior
    - Property 59: Unique Constraint Enforcement
    - Validates: Requirements 17.3, 17.5, 17.7

  - [x] 2.3 Generate Prisma client and run initial migration
    - Run prisma generate to create TypeScript client
    - Run prisma migrate dev to create initial migration
    - Verify all tables, indexes, and constraints are created
    - _Requirements: 17.2_

- [x] 3. Core utilities and error handling
  - [x] 3.1 Implement error classes and global error handler
    - Create AppError base class with statusCode and isOperational flag
    - Create ValidationError (400), AuthenticationError (401), AuthorizationError (403), NotFoundError (404), RateLimitError (429), ExternalServiceError (502)
    - Implement global error handler middleware that logs errors and returns consistent JSON responses
    - Ensure 500 errors don't expose internal details
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8_

  - [x] 3.2 Write property tests for error handling
    - Property 46: Error Logging Completeness
    - Property 47: HTTP Status Code Mapping
    - Property 48: Internal Error Security
    - Property 49: External API Error Handling
    - Validates: Requirements 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8

  - [x] 3.3 Implement structured logging with Winston
    - Configure Winston with JSON format, timestamps, and error stack traces
    - Create separate log files for errors and combined logs
    - Add console transport for development
    - Export logger instance for use across services
    - _Requirements: 14.7_

  - [x] 3.4 Implement Redis cache service
    - Create CacheService interface with get, set, del, delPattern methods
    - Implement RedisCache class with connection pooling
    - Define cache key patterns and TTL constants
    - Implement graceful degradation when cache fails
    - _Requirements: 15.6, 15.7_

  - [x] 3.5 Write property tests for cache operations
    - Property 39: Cache TTL Configuration
    - Property 50: Cache Invalidation on Update
    - Property 51: Cache Failure Graceful Degradation
    - Validates: Requirements 15.1, 15.2, 15.3, 15.4, 15.5, 15.7


- [x] 4. Authentication service implementation
  - [x] 4.1 Implement password hashing utilities
    - Create hashPassword function using bcrypt with salt rounds >= 10
    - Create comparePassword function for password verification
    - _Requirements: 1.3, 2.1_

  - [x] 4.2 Write property test for password hashing
    - Property 3: Password Hashing Security
    - Validates: Requirements 1.3

  - [x] 4.3 Implement JWT token generation and validation
    - Create generateToken function that signs JWT with HS256, includes userId and role, sets 24h expiration
    - Create validateToken function that verifies signature and checks expiration
    - _Requirements: 1.6, 2.3, 2.4, 2.5, 3.1, 3.2_

  - [x] 4.4 Write property tests for JWT operations
    - Property 6: JWT Token Expiration
    - Property 8: JWT Token Structure
    - Property 10: JWT Signature Validation
    - Property 11: Role Extraction from Token
    - Validates: Requirements 1.6, 2.3, 2.4, 2.5, 3.1, 3.3

  - [x] 4.5 Implement user registration service
    - Create register function that validates email format, checks for duplicates, hashes password, creates user with Free role, generates JWT token
    - Return token and user profile data
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 4.6 Write property tests for registration
    - Property 1: Email Format Validation
    - Property 2: Duplicate Email Detection
    - Property 4: Default Role Assignment
    - Property 5: Registration Round-Trip
    - Validates: Requirements 1.1, 1.2, 1.4, 1.5

  - [x] 4.7 Implement user login service
    - Create login function that finds user by email, compares password hash, generates JWT token
    - Return token and user profile data
    - Ensure response time < 200ms for invalid credentials
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 4.8 Write property tests for login
    - Property 7: Login Credential Validation
    - Property 9: Authentication Response Completeness
    - Validates: Requirements 2.1, 2.6

- [x] 5. API Gateway and middleware
  - [x] 5.1 Implement JWT authentication middleware
    - Extract token from Authorization header
    - Validate token signature and expiration
    - Attach user data (id, role) to request object
    - Return 401 for invalid/expired tokens
    - _Requirements: 3.1, 3.2_

  - [x] 5.2 Implement role-based authorization middleware
    - Create requireRole middleware that checks user role against required role
    - Return 403 for insufficient permissions
    - Support Free, Pro, Admin role hierarchy
    - _Requirements: 3.3, 3.4, 3.5, 3.6_

  - [ ]5.3 Write property test for authorization
    - Property 12: Role-Based Access Control
    - Validates: Requirements 3.4, 3.5, 3.6

  - [x] 5.4 Implement rate limiting middleware
    - Track request count per user in Redis with 1-hour TTL
    - Enforce limits: Free (100/hour), Pro (1000/hour), Admin (unlimited)
    - Return 429 with Retry-After header when limit exceeded
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7_

  - [x] 5.5 Write property tests for rate limiting
    - Property 43: Rate Limit Tracking
    - Property 44: Rate Limit Response
    - Property 45: Rate Limit Cache Storage
    - Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7

  - [x] 5.6 Implement response formatting middleware
    - Wrap successful responses in {success: true, data: {...}}
    - Set Content-Type to application/json
    - Ensure consistent format across all endpoints
    - _Requirements: 19.1, 19.2, 19.5_

  - [x] 5.7 Write property test for API response format
    - Property 61: API Response Format Consistency
    - Validates: Requirements 19.1, 19.2, 19.3, 19.4, 19.5


- [x] 6. Project service implementation
  - [x] 6.1 Implement project CRUD operations
    - Create project creation function with domain validation (valid domain format without protocol)
    - Create findByUser function that returns only projects owned by the user
    - Create findById function with ownership verification
    - Create update function with ownership verification
    - Create delete function with ownership verification and cascade delete
    - Initialize empty keywords and competitors collections on creation
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 6.2 Write property tests for project operations
    - Property 13: Domain Format Validation
    - Property 14: Project Storage Round-Trip
    - Property 15: Multiple Projects Per User
    - Property 16: New Project Initialization
    - Property 17: Project Data Isolation
    - Property 18: Project Ownership Verification
    - Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6

  - [x] 6.3 Implement project API routes
    - POST /api/projects - create project (requires auth)
    - GET /api/projects - list user's projects (requires auth)
    - GET /api/projects/:id - get project details (requires auth + ownership)
    - PUT /api/projects/:id - update project (requires auth + ownership)
    - DELETE /api/projects/:id - delete project (requires auth + ownership)
    - Return enriched data with keyword count, competitor count, last audit score
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [x] 7. Keyword service implementation
  - [x] 7.1 Implement keyword research and storage
    - Create research function that accepts projectId and keyword array
    - Implement upsert logic for existing keywords (update instead of duplicate)
    - Store keyword, searchVolume (integer), difficulty (0-100 decimal), cpc (decimal), lastUpdated (current timestamp)
    - Implement batch processing for multiple keywords
    - Mock external keyword API or integrate real API for metrics
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [x] 7.2 Write property tests for keyword operations
    - Property 19: Keyword Data Round-Trip
    - Property 20: Keyword  
    - Property 21: Keyword Data Type Constraints
    - Property 22: Keyword Timestamp Generation
    - Validates: Requirements 5.2, 5.3, 5.4, 5.5, 5.6, 5.7

  - [x] 7.3 Implement keyword caching with read-through pattern
    - Cache keyword data for 24 hours
    - Invalidate cache on keyword updates
    - Implement fallback to database on cache failure
    - _Requirements: 15.1, 15.5, 15.7_

  - [x] 7.4 Implement keyword API routes
    - POST /api/keywords/research - research and store keywords (requires auth)
    - GET /api/keywords/:projectId - list project keywords (requires auth + ownership)
    - Return keywords with current rank if available
    - _Requirements: 5.1, 5.2_

- [x] 8. Rank tracking service implementation
  - [x] 8.1 Implement ranking storage and retrieval
    - Create track function that stores projectId, keyword, position (1-100), date (YYYY-MM-DD)
    - Implement upsert logic for same keyword + date
    - Create getHistory function with optional keyword, startDate, endDate filters
    - Default date range to last 30 days if not specified
    - Return rankings ordered by date descending
    - Calculate rank change vs previous period
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [x] 8.2 Write property tests for ranking operations
    - Property 23: Ranking Data Round-Trip
    - Property 24: Ranking Position Constraints
    - Property 25: Ranking Upsert Behavior
    - Property 26: Ranking History Sort Order
    - Property 27: Date Range Filtering
    - Property 28: Ranking Date Format
    - Validates: Requirements 6.2, 6.3, 6.4, 6.5, 6.6, 6.7

  - [x] 8.3 Implement ranking caching and API routes
    - Cache ranking history for 1 hour
    - Invalidate cache on new ranking data
    - POST /api/rank/track - record ranking (requires auth)
    - GET /api/rank/history/:projectId - get ranking history with filters (requires auth + ownership)
    - Format response as array of keywords with history arrays
    - _Requirements: 6.1, 6.5, 15.2, 15.5_

  - [x] 8.4 Write property test for ranking history format
    - Property 40: Ranking History Response Format
    - Validates: Requirements 11.5


- [x] 9. Web scraping infrastructure
  - [x] 9.1 Implement Puppeteer scraping service
    - Create scrapePage function that launches browser, navigates to URL with 30s timeout
    - Wait for JavaScript execution to complete (networkidle0)
    - Extract HTML content after rendering
    - Close browser instance in finally block to ensure cleanup
    - Handle timeout errors with user-friendly message
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

  - [x] 9.2 Write property tests for scraping
    - Property 52: Scraping Timeout Enforcement
    - Property 53: JavaScript Rendering Completion
    - Property 54: Browser Resource Cleanup
    - Validates: Requirements 16.2, 16.4, 16.5

  - [x] 9.3 Implement scraping queue with concurrency control
    - Create queue system that limits concurrent scraping to 5 operations
    - Queue additional requests when limit reached
    - Process queued requests as slots become available
    - _Requirements: 16.6, 16.7_

  - [x] 9.4 Write property test for scraping concurrency
    - Property 55: Scraping Concurrency Limit
    - Validates: Requirements 16.6, 16.7

- [x] 10. SEO analyzer service implementation
  - [x] 10.1 Implement HTML parsing and element extraction
    - Extract title tag content and length
    - Extract meta description content and length
    - Count H1 and H2 tags, extract heading structure
    - Count total images and images missing alt attributes
    - Count internal links
    - Identify broken links by checking HTTP response codes
    - _Requirements: 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [x] 10.2 Write property test for SEO element extraction
    - Property 29: SEO Analysis Element Extraction
    - Validates: Requirements 7.2, 7.3, 7.4, 7.5, 7.6, 7.7

  - [x] 10.3 Implement SEO scoring algorithm
    - Title optimal (50-60 chars): +15 points
    - Meta description optimal (150-160 chars): +15 points
    - Single H1: +10 points
    - Multiple H2s: +10 points
    - All images have alt: +15 points
    - No broken links: +15 points
    - Internal links > 3: +10 points
    - Base score: 10 points
    - Ensure final score is 0-100
    - _Requirements: 7.8_

  - [x] 10.4 Write property tests for SEO scoring
    - Property 30: SEO Score Range
    - Property 31: SEO Analysis Response Completeness
    - Validates: Requirements 7.8, 7.9

  - [x] 10.5 Implement SEO score history storage and retrieval
    - Store SEO score with projectId, url, score, full analysis JSON, timestamp
    - Retrieve score history ordered by timestamp descending
    - Support date range filtering
    - Calculate score change percentage vs previous audit
    - Return null for score change if no previous audit exists
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [x] 10.6 Write property tests for score history
    - Property 41: SEO Score Storage Round-Trip
    - Property 42: Score Change Calculation
    - Validates: Requirements 12.1, 12.4

  - [x] 10.7 Implement SEO audit API route
    - POST /api/audit - analyze URL and optionally store score (requires auth)
    - Accept url and optional projectId
    - Return score, full analysis, recommendations, analyzedAt timestamp
    - Store score in history if projectId provided
    - _Requirements: 7.1, 7.8, 7.9_


- [x] 11. Competitor analysis service implementation
  - [x] 11.1 Implement competitor keyword extraction
    - Scrape competitor domain using Puppeteer
    - Extract keywords from meta tags, headings, and content
    - Store competitor with domain and lastAnalyzed timestamp
    - Store competitor-keyword associations
    - _Requirements: 8.1, 8.2, 8.3, 8.6_

  - [x] 11.2 Write property tests for competitor operations
    - Property 32: Competitor Keyword Extraction
    - Property 34: Competitor Data Round-Trip
    - Validates: Requirements 8.2, 8.3, 8.6, 8.7

  - [x] 11.3 Implement keyword overlap calculation
    - Fetch user's project keywords
    - Fetch competitor keywords
    - Calculate shared keywords (intersection)
    - Calculate competitor-only keywords (difference)
    - Calculate user-only keywords (difference)
    - _Requirements: 8.4, 8.5_

  - [x] 11.4 Write property test for keyword overlap
    - Property 33: Keyword Overlap Calculation
    - Validates: Requirements 8.4, 8.5

  - [x] 11.5 Implement competitor caching and API routes
    - Cache competitor analysis for 12 hours
    - POST /api/competitors/analyze - analyze competitor (requires auth)
    - GET /api/competitors/:projectId - list competitors (requires auth + ownership)
    - Return competitor domain, keyword count, overlap data, lastAnalyzed
    - _Requirements: 8.1, 8.7, 15.3_

- [x] 12. Content optimizer service implementation (Pro feature)
  - [x] 12.1 Implement SERP results fetching
    - Fetch top 10 SERP results for target keyword
    - Use Puppeteer to scrape each result URL
    - Extract keywords and headings from each page
    - Cache SERP results for 24 hours
    - _Requirements: 9.2, 9.3_

  - [x] 12.2 Write property test for SERP retrieval
    - Property 35: SERP Results Retrieval
    - Validates: Requirements 9.2, 9.3

  - [x] 12.3 Implement OpenAI content analysis
    - Create prompt comparing user content against SERP results
    - Call OpenAI API with content and SERP summary
    - Parse response for score, missing keywords, suggested headings
    - Handle API errors gracefully with user-friendly messages
    - _Requirements: 9.4, 9.5, 9.6, 9.7, 9.8_

  - [x] 12.4 Write property test for content optimization
    - Property 36: Content Optimization Response Structure
    - Validates: Requirements 9.6, 9.7, 9.8

  - [x] 12.5 Implement content scoring API route
    - POST /api/content/score - score content (requires auth + Pro role)
    - Accept content and targetKeyword
    - Return score, missing keywords, suggested headings, analysis metrics
    - _Requirements: 9.1, 9.5, 9.6, 9.7, 9.8_

- [x] 13. Dashboard service implementation
  - [x] 13.1 Implement dashboard metrics aggregation
    - Calculate total keywords across all user projects
    - Calculate average ranking position across all tracked keywords
    - Calculate rank change percentage vs previous 30-day period
    - Count total projects for user
    - Fetch most recent SEO score for each project
    - Ensure calculation completes within 500ms
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [x] 13.2 Write property tests for dashboard metrics
    - Property 37: Dashboard Metrics Aggregation
    - Property 38: Dashboard Recent Scores
    - Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5

  - [x] 13.3 Implement dashboard caching and API route
    - Cache dashboard metrics for 5 minutes
    - GET /api/dashboard - get dashboard data (requires auth)
    - Return all metrics in single response
    - _Requirements: 10.7_


- [x] 14. Express server setup and integration
  - [x] 14.1 Create Express application with middleware stack
    - Initialize Express app
    - Add body parser for JSON
    - Add CORS middleware
    - Add authentication middleware
    - Add rate limiting middleware
    - Add response formatting middleware
    - Add global error handler (must be last)
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

  - [x] 14.2 Wire all API routes to Express app
    - Mount auth routes at /api/auth
    - Mount project routes at /api/projects
    - Mount keyword routes at /api/keywords
    - Mount ranking routes at /api/rank
    - Mount audit routes at /api/audit
    - Mount competitor routes at /api/competitors
    - Mount content routes at /api/content
    - Mount dashboard routes at /api/dashboard
    - _Requirements: All API requirements_

  - [x] 14.3 Implement database connection with pooling
    - Configure Prisma client with connection pool (min: 5, max: 20)
    - Implement connection health check
    - Handle connection errors gracefully
    - _Requirements: 20.1_

  - [x] 14.4 Write property test for database connection pooling
    - Property 62: Batch Processing Size Limit
    - Property 64: Transaction Atomicity
    - Validates: Requirements 20.3, 20.6

  - [x] 14.5 Implement graceful shutdown
    - Listen for SIGTERM and SIGINT signals
    - Stop accepting new requests
    - Wait for in-flight requests to complete
    - Close database connections
    - Close Redis connections
    - Exit process
    - _Requirements: 20.7_

  - [x] 14.6 Write property test for graceful shutdown
    - Property 65: Graceful Shutdown
    - Validates: Requirements 20.7

  - [x] 14.7 Add server startup script
    - Validate environment variables
    - Connect to database
    - Connect to Redis
    - Start Express server on configured port
    - Log startup success with port number
    - _Requirements: 18.6_

- [x] 15. Checkpoint - Backend validation
  - Ensure all backend tests pass
  - Verify all API endpoints are accessible
  - Test authentication and authorization flows
  - Verify database migrations are applied
  - Test cache operations
  - Ask the user if questions arise


- [x] 16. Frontend API client and authentication
  - [x] 16.1 Implement API client with JWT handling
    - Create APIClient class with baseURL configuration
    - Implement request method that adds Authorization header
    - Store JWT token in localStorage
    - Handle token refresh on 401 responses
    - Parse and throw errors from API responses
    - _Requirements: 2.3, 3.1_

  - [x] 16.2 Implement authentication context and hooks
    - Create AuthContext with user state and auth methods
    - Implement useAuth hook for accessing auth state
    - Implement login function that calls API and stores token
    - Implement logout function that clears token and user state
    - Implement register function that calls API and stores token
    - Load user from token on app initialization
    - _Requirements: 1.1, 1.2, 2.1, 2.6_

  - [x] 16.3 Create login and registration pages
    - Create /login page with email and password form
    - Create /register page with email and password form
    - Add form validation (email format, password length)
    - Display error messages from API
    - Redirect to dashboard on success
    - _Requirements: 1.1, 2.1_

  - [x] 16.4 Implement protected route middleware
    - Create middleware that checks for valid token
    - Redirect to /login if no token or expired
    - Allow access to dashboard routes only when authenticated
    - _Requirements: 3.1, 3.2_

- [x] 17. Frontend dashboard implementation
  - [x] 17.1 Create dashboard layout with navigation
    - Create dashboard layout component with sidebar
    - Add navigation links to Projects, Audit, Content Optimizer
    - Display user email and role in header
    - Add logout button
    - _Requirements: N/A (UI structure)_

  - [x] 17.2 Implement dashboard home page with metrics
    - Fetch dashboard data from /api/dashboard
    - Display total keywords, average rank, rank change percentage
    - Display total projects count
    - Show recent SEO scores for each project
    - Add loading states and error handling
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 17.3 Create ranking chart component
    - Fetch ranking history from /api/rank/history
    - Display line chart with date on X-axis and position on Y-axis
    - Support filtering by keyword and date range
    - Invert Y-axis (position 1 at top)
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [-] 18. Frontend project management
  - [x] 18.1 Create projects list page
    - Fetch projects from /api/projects
    - Display project cards with domain, keyword count, competitor count
    - Add "Create Project" button
    - Link to project detail pages
    - _Requirements: 4.5_

  - [x] 18.2 Create project creation form
    - Create /projects/new page with domain and name inputs
    - Validate domain format
    - Submit to POST /api/projects
    - Redirect to project detail on success
    - _Requirements: 4.1, 4.2_

  - [x] 18.3 Create project detail page
    - Fetch project data from /api/projects/:id
    - Display project info (domain, name, created date)
    - Show tabs for Keywords, Rankings, Competitors
    - Add edit and delete buttons
    - _Requirements: 4.5, 4.6_

  - [x] 18.4 Implement keyword management interface
    - Create keyword research form with keyword input (comma-separated)
    - Submit to POST /api/keywords/research
    - Display keyword table with search volume, difficulty, CPC, current rank
    - Add sorting and filtering
    - _Requirements: 5.1, 5.2_

  - [x] 18.5 Implement ranking history visualization
    - Fetch ranking history for project keywords
    - Display ranking chart component
    - Add date range picker for filtering
    - Show ranking change indicators (up/down arrows)
    - _Requirements: 6.5, 6.6, 11.1, 11.2, 11.3_


- [x] 19. Frontend SEO audit tool
  - [x] 19.1 Create SEO audit page
    - Create /audit page with URL input form
    - Add project selector (optional) to store score in history
    - Submit to POST /api/audit
    - Display loading state during analysis
    - _Requirements: 7.1_

  - [x] 19.2 Create audit results display component
    - Display overall SEO score with visual indicator (0-100)
    - Show title analysis (content, length, optimal status)
    - Show meta description analysis (content, length, optimal status)
    - Show heading structure (H1/H2 counts, hierarchy)
    - Show image analysis (total, missing alt count)
    - Show link analysis (internal count, broken links list)
    - Display recommendations list
    - _Requirements: 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9_

  - [x] 19.3 Create SEO score history chart
    - Fetch score history for selected project
    - Display line chart showing score over time
    - Show score change percentage
    - Support date range filtering
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [x] 20. Frontend competitor analysis
  - [x] 20.1 Create competitor analysis page
    - Create /projects/:id/competitors page
    - Add competitor domain input form
    - Submit to POST /api/competitors/analyze
    - Display loading state during analysis
    - _Requirements: 8.1_

  - [x] 20.2 Display competitor analysis results
    - Show competitor domain and last analyzed date
    - Display keyword overlap visualization (Venn diagram or lists)
    - Show shared keywords list
    - Show competitor-only keywords (opportunities)
    - Show user-only keywords
    - Display keyword counts for each category
    - _Requirements: 8.4, 8.5, 8.7_

  - [x] 20.3 Create competitors list component
    - Fetch competitors from /api/competitors/:projectId
    - Display competitor cards with domain, keyword count, last analyzed
    - Add "Analyze" button to refresh analysis
    - _Requirements: 8.7_

- [x] 21. Frontend content optimizer (Pro feature)
  - [x] 21.1 Create content optimizer page with role check
    - Create /content page (Pro/Admin only)
    - Show upgrade prompt for Free users
    - Add content textarea and target keyword input
    - Submit to POST /api/content/score
    - Display loading state during analysis
    - _Requirements: 9.1, 3.4_

  - [x] 21.2 Display content optimization results
    - Show content score with visual indicator (0-100)
    - Display missing keywords list with importance indicators
    - Show suggested headings with structure
    - Display analysis metrics (keyword density, readability, content length, recommended length)
    - Provide actionable recommendations
    - _Requirements: 9.5, 9.6, 9.7, 9.8_


- [x] 22. Pagination and performance optimization
  - [x] 22.1 Implement pagination for list endpoints
    - Add pagination to GET /api/projects (default: 50, max: 100)
    - Add pagination to GET /api/keywords/:projectId
    - Add pagination to GET /api/rank/history/:projectId
    - Add pagination to GET /api/competitors/:projectId
    - Include metadata (total count, page number, page size) in responses
    - _Requirements: 20.4, 20.5_

  - [x] 22.2 Write property test for pagination
    - Property 63: Pagination Configuration
    - Validates: Requirements 20.4, 20.5

  - [x] 22.3 Implement frontend pagination components
    - Create reusable Pagination component
    - Add page navigation controls (prev, next, page numbers)
    - Update API calls to include page and pageSize parameters
    - Display total count and current page info
    - _Requirements: 20.4, 20.5_

  - [x] 22.4 Add loading states and error boundaries
    - Create LoadingSpinner component
    - Create ErrorBoundary component for error handling
    - Add loading states to all data fetching operations
    - Display user-friendly error messages
    - _Requirements: 14.8_

- [x] 23. Testing and quality assurance
  - [x] 23.1 Set up testing infrastructure
    - Configure Vitest for backend unit and property tests
    - Configure Jest/React Testing Library for frontend tests
    - Set up test database with separate DATABASE_URL
    - Set up test Redis instance
    - Create test fixtures and helpers
    - _Requirements: N/A (Testing setup)_

  - [x] 23.2 Run all property-based tests
    - Execute all property tests (Properties 1-65)
    - Verify 100+ iterations per property
    - Fix any failing properties
    - Document any edge cases discovered
    - _Requirements: All requirements_

  - [x] 23.3 Write integration tests for critical flows
    - Test complete user registration and login flow
    - Test project creation and keyword research flow
    - Test ranking tracking and history retrieval
    - Test SEO audit end-to-end
    - Test competitor analysis flow
    - Test content optimization flow (Pro feature)
    - _Requirements: All requirements_

  - [x] 23.4 Write frontend component tests
    - Test authentication forms (login, register)
    - Test dashboard metrics display
    - Test project management components
    - Test keyword table and filtering
    - Test ranking chart rendering
    - Test audit results display
    - _Requirements: N/A (Frontend testing)_

- [x] 24. Checkpoint - Full system validation
  - Run all backend tests (unit, property, integration)
  - Run all frontend tests
  - Test complete user flows manually
  - Verify all API endpoints work correctly
  - Check error handling and logging
  - Verify caching behavior
  - Test rate limiting
  - Ensure all tests pass
  - Ask the user if questions arise


- [x] 25. Documentation and deployment preparation
  - [x] 25.1 Create comprehensive README
    - Document project structure and architecture
    - List all environment variables with descriptions
    - Provide setup instructions (install, database, Redis)
    - Document API endpoints with examples
    - Add development workflow guide
    - Include testing instructions
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5_

  - [x] 25.2 Create API documentation
    - Document all endpoints with request/response examples
    - Include authentication requirements
    - Document rate limits per role
    - Provide error response examples
    - Add code examples for common operations
    - _Requirements: All API requirements_

  - [x] 25.3 Create deployment guide
    - Document production environment setup
    - Provide database migration instructions
    - Document Redis configuration
    - Include environment variable checklist
    - Add monitoring and logging recommendations
    - Document backup and recovery procedures
    - _Requirements: 18.7, 20.1, 20.2_

  - [x] 25.4 Create Docker configuration (optional)
    - Create Dockerfile for backend
    - Create Dockerfile for frontend
    - Create docker-compose.yml with all services (app, database, Redis)
    - Document Docker deployment process
    - _Requirements: N/A (Optional deployment)_

  - [x] 25.5 Add database seeding scripts
    - Create seed script for development data
    - Add sample users (Free, Pro, Admin)
    - Add sample projects with keywords
    - Add sample rankings and SEO scores
    - Document seeding process
    - _Requirements: N/A (Development tooling)_

  - [x] 25.6 Create environment configuration templates
    - Create .env.development template
    - Create .env.production template
    - Create .env.test template
    - Document all required and optional variables
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6_

- [ ] 26. Final checkpoint and handoff
  - Verify all tasks are complete
  - Run full test suite (backend + frontend)
  - Perform manual testing of all features
  - Review documentation completeness
  - Verify deployment readiness
  - Ensure all environment variables are documented
  - Confirm all requirements are met
  - Ask the user if questions arise

## Notes

- Each task references specific requirements for traceability
- Property-based tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The implementation follows a bottom-up approach: infrastructure → services → API → frontend
- All components are integrated incrementally with no orphaned code
- Checkpoints ensure validation at key milestones
- The platform uses TypeScript throughout for type safety
- Redis caching is critical for performance - implement early
- Web scraping with Puppeteer requires careful resource management
- OpenAI integration is only for Pro/Admin users (content optimizer)
- Rate limiting is enforced at the API Gateway level
- All timestamps are stored in UTC
- Database uses Prisma ORM with connection pooling
- Frontend uses Next.js 14 with App Router
- Authentication uses JWT tokens with 24-hour expiration
- All API responses follow consistent format: {success, data/error}

