import { getPrismaClient } from '../src/utils/db';

const prisma = getPrismaClient();

// Clean up Prisma connection after all tests
afterAll(async () => {
  await prisma.$disconnect();
});
