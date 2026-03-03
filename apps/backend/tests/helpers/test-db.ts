import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient;

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });
  }
  return prisma;
}

export async function cleanupDatabase() {
  const prisma = getPrismaClient();
  
  // Delete in order to respect foreign key constraints
  await prisma.sEOScore.deleteMany();
  await prisma.competitorKeyword.deleteMany();
  await prisma.competitor.deleteMany();
  await prisma.ranking.deleteMany();
  await prisma.keyword.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();
}

export async function disconnectDatabase() {
  if (prisma) {
    await prisma.$disconnect();
  }
}
