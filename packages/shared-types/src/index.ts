// User types
export type UserRole = 'Free' | 'Pro' | 'Admin';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface AuthResult {
  token: string;
  user: User;
}

// Project types
export interface Project {
  id: string;
  domain: string;
  name: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectWithStats extends Project {
  keywordCount: number;
  competitorCount: number;
  lastAuditScore?: number;
}

// Keyword types
export interface KeywordData {
  id?: string;
  keyword: string;
  searchVolume: number;
  difficulty: number;
  cpc: number;
  currentRank?: number;
  lastUpdated: string;
}

// Ranking types
export interface RankRecord {
  id: string;
  projectId: string;
  keyword: string;
  position: number;
  date: string;
}

export interface RankHistory {
  keyword: string;
  history: Array<{
    date: string;
    position: number;
  }>;
}

// SEO Analysis types
export interface TitleAnalysis {
  content: string;
  length: number;
  optimal: boolean;
}

export interface MetaAnalysis {
  content: string;
  length: number;
  optimal: boolean;
}

export interface HeadingAnalysis {
  h1Count: number;
  h2Count: number;
  structure: string[];
}

export interface ImageAnalysis {
  total: number;
  missingAlt: number;
}

export interface LinkAnalysis {
  internal: number;
  broken: string[];
}

export interface SEOAnalysis {
  url: string;
  score: number;
  analysis: {
    title: TitleAnalysis;
    metaDescription: MetaAnalysis;
    headings: HeadingAnalysis;
    images: ImageAnalysis;
    links: LinkAnalysis;
  };
  recommendations: string[];
  analyzedAt: string;
}

export interface ScoreHistory {
  projectId: string;
  projectName: string;
  score: number;
  date: string;
}

// Competitor types
export interface Competitor {
  id: string;
  domain: string;
  keywordCount: number;
  lastAnalyzed: string;
}

export interface KeywordOverlap {
  shared: string[];
  competitorOnly: string[];
  userOnly: string[];
}

export interface CompetitorAnalysis {
  competitor: string;
  keywords: string[];
  overlap: KeywordOverlap;
  lastAnalyzed: string;
}

// Content Optimization types
export interface ContentScore {
  score: number;
  missingKeywords: string[];
  suggestedHeadings: string[];
  analysis: {
    keywordDensity: number;
    readabilityScore: number;
    contentLength: number;
    recommendedLength: number;
  };
}

// Dashboard types
export interface DashboardMetrics {
  totalKeywords: number;
  averageRank: number;
  rankChange: number;
  totalProjects: number;
  recentScores: ScoreHistory[];
}

// API Response types
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginationMetadata {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMetadata;
}
