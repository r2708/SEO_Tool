import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyProjects() {
  try {
    const projects = await prisma.project.findMany({
      select: {
        id: true,
        domain: true,
        name: true,
        ownerEmail: true,
        createdByEmail: true,
        createdAt: true,
        updatedAt: true,
        updatedByEmail: true,
        deletedAt: true,
        deletedByEmail: true,
      },
    });

    console.log('\n=== Current Projects in Database ===\n');
    projects.forEach(p => {
      console.log(`Domain: ${p.domain}`);
      console.log(`Name: ${p.name}`);
      console.log(`Owner Email: ${p.ownerEmail}`);
      console.log(`Created By: ${p.createdByEmail}`);
      console.log(`Created At: ${p.createdAt.toISOString()}`);
      console.log(`Updated At: ${p.updatedAt.toISOString()}`);
      console.log(`Updated By: ${p.updatedByEmail || 'null'}`);
      console.log(`Deleted At: ${p.deletedAt?.toISOString() || 'null'}`);
      console.log(`Deleted By: ${p.deletedByEmail || 'null'}`);
      console.log('---\n');
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyProjects();
