import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fix() {
  try {
    // Find the Reys project
    const project = await prisma.project.findFirst({
      where: { domain: 'www.reys.com' },
      include: { user: true }
    });

    if (project) {
      // Set updatedByEmail to the owner's email since they updated it
      await prisma.project.update({
        where: { id: project.id },
        data: { 
          updatedByEmail: project.user.email,
          // Keep the existing updatedAt timestamp
        }
      });
      console.log(`✓ Fixed www.reys.com`);
      console.log(`  updatedByEmail set to: ${project.user.email}`);
    } else {
      console.log('Project not found');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fix();
