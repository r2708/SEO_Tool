import { UserRole } from '@prisma/client';
import { getPrismaClient } from './test-db';
import bcrypt from 'bcrypt';

const prisma = getPrismaClient();

/**
 * Test user fixtures
 */
export const testUsers = {
  free: {
    email: 'free@test.com',
    password: 'password123',
    role: 'Free' as UserRole,
  },
  pro: {
    email: 'pro@test.com',
    password: 'password123',
    role: 'Pro' as UserRole,
  },
  admin: {
    email: 'admin@test.com',
    password: 'password123',
    role: 'Admin' as UserRole,
  },
};

/**
 * Create a test user in the database
 */
export async function createTestUser(userData: {
  email: string;
  password: string;
  role: UserRole;
}) {
  const hashedPassword = await bcrypt.hash(userData.password, 10);
  return prisma.user.create({
    data: {
      email: userData.email,
      password: hashedPassword,
      role: userData.role,
    },
  });
}

/**
 * Create a test project
 */
export async function createTestProject(userId: string, domain: string = 'example.com') {
  return prisma.project.create({
    data: {
      domain,
      name: `Test Project - ${domain}`,
      userId,
    },
  });
}

/**
 * Create test keywords for a project
 */
export async function createTestKeywords(projectId: string, keywords: string[]) {
  const keywordData = keywords.map((keyword, index) => ({
    projectId,
    keyword,
    searchVolume: 1000 + index * 100,
    difficulty: 50 + index,
    cpc: 1.5 + index * 0.5,
  }));

  return prisma.keyword.createMany({
    data: keywordData,
  });
}

/**
 * Create test rankings for a project
 */
export async function createTestRankings(
  projectId: string,
  keyword: string,
  positions: { date: Date; position: number }[]
) {
  const rankingData = positions.map((pos) => ({
    projectId,
    keyword,
    position: pos.position,
    date: pos.date,
  }));

  return prisma.ranking.createMany({
    data: rankingData,
  });
}

/**
 * Create a test competitor
 */
export async function createTestCompetitor(
  projectId: string,
  domain: string,
  keywords: string[] = []
) {
  const competitor = await prisma.competitor.create({
    data: {
      projectId,
      domain,
    },
  });

  if (keywords.length > 0) {
    await prisma.competitorKeyword.createMany({
      data: keywords.map((keyword) => ({
        competitorId: competitor.id,
        keyword,
      })),
    });
  }

  return competitor;
}

/**
 * Create a test SEO score
 */
export async function createTestSEOScore(
  projectId: string,
  url: string,
  score: number = 75
) {
  return prisma.sEOScore.create({
    data: {
      projectId,
      url,
      score,
      analysis: {
        title: { content: 'Test Title', length: 10, optimal: true },
        metaDescription: { content: 'Test Description', length: 150, optimal: true },
        headings: { h1Count: 1, h2Count: 3, structure: ['H1', 'H2', 'H2', 'H2'] },
        images: { total: 5, missingAlt: 0 },
        links: { internal: 10, broken: [] },
      },
    },
  });
}

/**
 * Generate a date range for testing
 */
export function generateDateRange(days: number): Date[] {
  const dates: Date[] = [];
  const today = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    dates.push(date);
  }
  
  return dates;
}
