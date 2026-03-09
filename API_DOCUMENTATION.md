# API Documentation

## Overview

The SEO SaaS Platform API provides comprehensive endpoints for SEO analysis, keyword research, rank tracking, and content optimization. All endpoints return JSON responses and require JWT authentication (except registration and login).

## Base URL

```
Development: http://localhost:3001
Production: https://api.your-domain.com
```

## Authentication

### JWT Token Authentication

All protected endpoints require a JWT token in the Authorization header:

```http
Authorization: Bearer <your-jwt-token>
```

Tokens are valid for 24 hours and must be refreshed after expiration.

### Obtaining a Token

Tokens are obtained through the `/api/auth/register` or `/api/auth/login` endpoints.

## Rate Limiting

API requests are rate-limited based on user role:

| Role | Requests per Hour | Burst Limit |
|------|-------------------|-------------|
| Free | 100 | 10 |
| Pro | 1,000 | 50 |
| Admin | Unlimited | Unlimited |

When rate limit is exceeded:
- HTTP Status: `429 Too Many Requests`
- Header: `Retry-After: <seconds>`
- Response: `{"success": false, "error": "Rate limit exceeded"}`

## Response Format

### Success Response

```json
{
  "success": true,
  "data": {
    // Response data
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error message description"
}
```

## HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Validation error or invalid input |
| 401 | Unauthorized | Missing or invalid authentication token |
| 403 | Forbidden | Insufficient permissions for this resource |
| 404 | Not Found | Resource not found |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error (details not exposed) |
| 502 | Bad Gateway | External service error |

---

## Endpoints


## Authentication Endpoints

### Register User

Create a new user account with Free role by default.

**Endpoint:** `POST /api/auth/register`

**Authentication:** Not required

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Validation Rules:**
- Email: Valid email format (RFC 5322)
- Password: Minimum 8 characters

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "role": "Free",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

**Error Responses:**

400 - Email already registered:
```json
{
  "success": false,
  "error": "Email already registered"
}
```

400 - Invalid email format:
```json
{
  "success": false,
  "error": "Invalid email format"
}
```

**Example:**
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword123"
  }'
```

---

### Login

Authenticate existing user and receive JWT token.

**Endpoint:** `POST /api/auth/login`

**Authentication:** Not required

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "role": "Free"
    }
  }
}
```

**Error Responses:**

401 - Invalid credentials:
```json
{
  "success": false,
  "error": "Invalid credentials"
}
```

**Example:**
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword123"
  }'
```

---

## Project Endpoints

### Create Project

Create a new SEO project for tracking keywords and competitors.

**Endpoint:** `POST /api/projects`

**Authentication:** Required

**Request Body:**
```json
{
  "domain": "example.com",
  "name": "My Website"
}
```

**Validation Rules:**
- Domain: Valid domain format without protocol (e.g., "example.com")
- Name: 1-100 characters (optional, defaults to domain)

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "domain": "example.com",
    "name": "My Website",
    "userId": "user-uuid",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Error Responses:**

400 - Invalid domain format:
```json
{
  "success": false,
  "error": "Invalid domain format"
}
```

**Example:**
```bash
curl -X POST http://localhost:3001/api/projects \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "example.com",
    "name": "My Website"
  }'
```

---

### List Projects

Get all projects owned by the authenticated user.

**Endpoint:** `GET /api/projects`

**Authentication:** Required

**Query Parameters:** None

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "projects": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
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

**Example:**
```bash
curl -X GET http://localhost:3001/api/projects \
  -H "Authorization: Bearer <token>"
```

---

### Update Project

Update project details (domain or name).

**Endpoint:** `PUT /api/projects/:id`

**Authentication:** Required (must be project owner)

**Request Body:**
```json
{
  "domain": "newdomain.com",
  "name": "Updated Name"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "domain": "newdomain.com",
    "name": "Updated Name",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Error Responses:**

403 - Not project owner:
```json
{
  "success": false,
  "error": "Insufficient permissions"
}
```

404 - Project not found:
```json
{
  "success": false,
  "error": "Project not found"
}
```

---

## Keyword Endpoints

### Research Keywords

Research and store keyword data including search volume, difficulty, and CPC.

**Endpoint:** `POST /api/keywords/research`

**Authentication:** Required

**Request Body:**
```json
{
  "projectId": "550e8400-e29b-41d4-a716-446655440000",
  "keywords": ["seo tools", "keyword research", "rank tracking"]
}
```

**Success Response (200):**
```json
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
      },
      {
        "keyword": "keyword research",
        "searchVolume": 8500,
        "difficulty": 58.2,
        "cpc": 2.80,
        "lastUpdated": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

**Cache:** Results cached for 24 hours

**Example:**
```bash
curl -X POST http://localhost:3001/api/keywords/research \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "550e8400-e29b-41d4-a716-446655440000",
    "keywords": ["seo tools", "keyword research"]
  }'
```

---

### Get Project Keywords

Retrieve all keywords for a specific project.

**Endpoint:** `GET /api/keywords/:projectId`

**Authentication:** Required (must be project owner)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "keywords": [
      {
        "id": "keyword-uuid",
        "keyword": "seo tools",
        "searchVolume": 12000,
        "difficulty": 65.5,
        "cpc": 3.25,
        "currentRank": 15,
        "lastUpdated": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

**Cache:** Results cached for 24 hours

---

## Rank Tracking Endpoints

### Track Ranking

Record a keyword ranking position for a specific date.

**Endpoint:** `POST /api/rank/track`

**Authentication:** Required

**Request Body:**
```json
{
  "projectId": "550e8400-e29b-41d4-a716-446655440000",
  "keyword": "seo tools",
  "position": 15
}
```

**Validation Rules:**
- Position: Integer between 1 and 100

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "ranking-uuid",
    "projectId": "550e8400-e29b-41d4-a716-446655440000",
    "keyword": "seo tools",
    "position": 15,
    "date": "2024-01-01"
  }
}
```

**Note:** If a ranking for the same keyword and date exists, it will be updated.

**Example:**
```bash
curl -X POST http://localhost:3001/api/rank/track \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "550e8400-e29b-41d4-a716-446655440000",
    "keyword": "seo tools",
    "position": 15
  }'
```

---

### Get Ranking History

Retrieve historical ranking data for keywords.

**Endpoint:** `GET /api/rank/history/:projectId`

**Authentication:** Required (must be project owner)

**Query Parameters:**
- `keyword` (optional): Filter by specific keyword
- `startDate` (optional): Start date in YYYY-MM-DD format
- `endDate` (optional): End date in YYYY-MM-DD format

**Default:** Last 30 days if no date range specified

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "rankings": [
      {
        "keyword": "seo tools",
        "history": [
          { "date": "2024-01-01", "position": 15 },
          { "date": "2024-01-02", "position": 14 },
          { "date": "2024-01-03", "position": 13 }
        ]
      }
    ]
  }
}
```

**Cache:** Results cached for 1 hour

**Example:**
```bash
curl -X GET "http://localhost:3001/api/rank/history/550e8400-e29b-41d4-a716-446655440000?keyword=seo+tools&startDate=2024-01-01&endDate=2024-01-31" \
  -H "Authorization: Bearer <token>"
```

---

## SEO Audit Endpoints

### Audit URL

Analyze on-page SEO elements of a URL.

**Endpoint:** `POST /api/audit`

**Authentication:** Required

**Request Body:**
```json
{
  "url": "https://example.com",
  "projectId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Note:** `projectId` is optional. If provided, the score will be stored in history.

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "url": "https://example.com",
    "score": 85,
    "analysis": {
      "title": {
        "content": "Example Domain - SEO Tools",
        "length": 28,
        "optimal": true
      },
      "metaDescription": {
        "content": "Comprehensive SEO tools for keyword research and rank tracking",
        "length": 62,
        "optimal": false
      },
      "headings": {
        "h1Count": 1,
        "h2Count": 3,
        "structure": [
          "H1: Welcome to Example Domain",
          "H2: Features",
          "H2: Pricing"
        ]
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

**Scoring Algorithm:**
- Title optimal (50-60 chars): +15 points
- Meta description optimal (150-160 chars): +15 points
- Single H1 tag: +10 points
- Multiple H2 tags: +10 points
- All images have alt text: +15 points
- No broken links: +15 points
- 3+ internal links: +10 points
- Base score: 10 points

**Timeout:** 30 seconds for page load

**Example:**
```bash
curl -X POST http://localhost:3001/api/audit \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "projectId": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

---

## Competitor Analysis Endpoints

### Analyze Competitor

Extract and analyze competitor keywords.

**Endpoint:** `POST /api/competitors/analyze`

**Authentication:** Required

**Request Body:**
```json
{
  "projectId": "550e8400-e29b-41d4-a716-446655440000",
  "competitorDomain": "competitor.com"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "competitor": "competitor.com",
    "keywords": ["keyword1", "keyword2", "keyword3"],
    "overlap": {
      "shared": ["keyword1"],
      "competitorOnly": ["keyword2", "keyword3"],
      "userOnly": ["keyword4", "keyword5"]
    },
    "lastAnalyzed": "2024-01-01T00:00:00.000Z"
  }
}
```

**Cache:** Results cached for 12 hours

**Example:**
```bash
curl -X POST http://localhost:3001/api/competitors/analyze \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "550e8400-e29b-41d4-a716-446655440000",
    "competitorDomain": "competitor.com"
  }'
```

---

### List Competitors

Get all competitors for a project.

**Endpoint:** `GET /api/competitors/:projectId`

**Authentication:** Required (must be project owner)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "competitors": [
      {
        "id": "competitor-uuid",
        "domain": "competitor.com",
        "keywordCount": 25,
        "lastAnalyzed": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

---

## Content Optimization Endpoints

### Score Content

AI-powered content analysis and optimization suggestions.

**Endpoint:** `POST /api/content/score`

**Authentication:** Required

**Role Required:** Pro or Admin

**Request Body:**
```json
{
  "content": "Your blog post content here. This should be the full text of your article or page content that you want to optimize for SEO...",
  "targetKeyword": "seo optimization"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "score": 78,
    "missingKeywords": [
      "keyword density",
      "meta tags",
      "search engine"
    ],
    "suggestedHeadings": [
      "How to Optimize SEO",
      "Best Practices for SEO",
      "Common SEO Mistakes"
    ],
    "analysis": {
      "keywordDensity": 2.5,
      "readabilityScore": 65,
      "contentLength": 1200,
      "recommendedLength": 1500
    }
  }
}
```

**Process:**
1. Fetches top 10 SERP results for target keyword
2. Extracts keywords and headings from SERP results
3. Analyzes user content with OpenAI API
4. Compares against top-ranking content
5. Returns score and suggestions

**Cache:** SERP results cached for 24 hours

**Error Responses:**

403 - Insufficient role:
```json
{
  "success": false,
  "error": "This feature requires Pro or Admin role"
}
```

502 - OpenAI API error:
```json
{
  "success": false,
  "error": "Content analysis temporarily unavailable"
}
```

**Example:**
```bash
curl -X POST http://localhost:3001/api/content/score \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Your blog post content...",
    "targetKeyword": "seo optimization"
  }'
```

---

## Dashboard Endpoints

### Get Dashboard Metrics

Retrieve aggregated SEO metrics across all user projects.

**Endpoint:** `GET /api/dashboard`

**Authentication:** Required

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "totalKeywords": 25,
    "averageRank": 18.5,
    "rankChange": 5.2,
    "totalProjects": 3,
    "recentScores": [
      {
        "projectId": "550e8400-e29b-41d4-a716-446655440000",
        "projectName": "My Website",
        "score": 85,
        "date": "2024-01-01T00:00:00.000Z"
      },
      {
        "projectId": "another-project-uuid",
        "projectName": "Another Site",
        "score": 78,
        "date": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

**Metrics Explanation:**
- `totalKeywords`: Total number of tracked keywords across all projects
- `averageRank`: Mean ranking position of all tracked keywords
- `rankChange`: Percentage change in average rank vs previous 30-day period
- `totalProjects`: Number of projects owned by user
- `recentScores`: Most recent SEO audit score for each project

**Cache:** Results cached for 5 minutes

**Performance:** Must complete within 500ms

**Example:**
```bash
curl -X GET http://localhost:3001/api/dashboard \
  -H "Authorization: Bearer <token>"
```

---

## Code Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

const API_BASE_URL = 'http://localhost:3001';
let authToken = null;

// Register user
async function register(email, password) {
  const response = await axios.post(`${API_BASE_URL}/api/auth/register`, {
    email,
    password
  });
  authToken = response.data.data.token;
  return response.data;
}

// Login
async function login(email, password) {
  const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
    email,
    password
  });
  authToken = response.data.data.token;
  return response.data;
}

// Create project
async function createProject(domain, name) {
  const response = await axios.post(
    `${API_BASE_URL}/api/projects`,
    { domain, name },
    { headers: { Authorization: `Bearer ${authToken}` } }
  );
  return response.data;
}

// Research keywords
async function researchKeywords(projectId, keywords) {
  const response = await axios.post(
    `${API_BASE_URL}/api/keywords/research`,
    { projectId, keywords },
    { headers: { Authorization: `Bearer ${authToken}` } }
  );
  return response.data;
}

// Track ranking
async function trackRanking(projectId, keyword, position) {
  const response = await axios.post(
    `${API_BASE_URL}/api/rank/track`,
    { projectId, keyword, position },
    { headers: { Authorization: `Bearer ${authToken}` } }
  );
  return response.data;
}

// Audit URL
async function auditUrl(url, projectId) {
  const response = await axios.post(
    `${API_BASE_URL}/api/audit`,
    { url, projectId },
    { headers: { Authorization: `Bearer ${authToken}` } }
  );
  return response.data;
}

// Get dashboard
async function getDashboard() {
  const response = await axios.get(
    `${API_BASE_URL}/api/dashboard`,
    { headers: { Authorization: `Bearer ${authToken}` } }
  );
  return response.data;
}
```

### Python

```python
import requests

API_BASE_URL = 'http://localhost:3001'
auth_token = None

def register(email, password):
    global auth_token
    response = requests.post(
        f'{API_BASE_URL}/api/auth/register',
        json={'email': email, 'password': password}
    )
    data = response.json()
    auth_token = data['data']['token']
    return data

def login(email, password):
    global auth_token
    response = requests.post(
        f'{API_BASE_URL}/api/auth/login',
        json={'email': email, 'password': password}
    )
    data = response.json()
    auth_token = data['data']['token']
    return data

def create_project(domain, name):
    response = requests.post(
        f'{API_BASE_URL}/api/projects',
        json={'domain': domain, 'name': name},
        headers={'Authorization': f'Bearer {auth_token}'}
    )
    return response.json()

def research_keywords(project_id, keywords):
    response = requests.post(
        f'{API_BASE_URL}/api/keywords/research',
        json={'projectId': project_id, 'keywords': keywords},
        headers={'Authorization': f'Bearer {auth_token}'}
    )
    return response.json()

def track_ranking(project_id, keyword, position):
    response = requests.post(
        f'{API_BASE_URL}/api/rank/track',
        json={'projectId': project_id, 'keyword': keyword, 'position': position},
        headers={'Authorization': f'Bearer {auth_token}'}
    )
    return response.json()

def audit_url(url, project_id=None):
    response = requests.post(
        f'{API_BASE_URL}/api/audit',
        json={'url': url, 'projectId': project_id},
        headers={'Authorization': f'Bearer {auth_token}'}
    )
    return response.json()

def get_dashboard():
    response = requests.get(
        f'{API_BASE_URL}/api/dashboard',
        headers={'Authorization': f'Bearer {auth_token}'}
    )
    return response.json()
```

---

## Webhooks (Future Feature)

Webhooks are planned for future releases to notify external systems of events:

- Ranking changes
- SEO score updates
- Competitor keyword changes
- Rate limit warnings

---

## API Versioning

Current version: **v1** (implicit in all endpoints)

Future versions will be prefixed: `/api/v2/...`

---

## Support

For API support:
- Email: api-support@example.com
- Documentation: https://docs.example.com
- Status Page: https://status.example.com
