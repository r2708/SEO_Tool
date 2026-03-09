import { getPrismaClient } from '../src/utils/db';

// Use test database URL if available
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

const prisma = getPrismaClient();

// Clean up Prisma connection after all tests
afterAll(async () => {
  await prisma.$disconnect();
});
