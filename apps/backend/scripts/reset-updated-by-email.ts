import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Reset updatedByEmail to null for all projects
 * This allows a clean slate where updatedByEmail will only be set
 * when projects are actually edited going forward
 */
async function resetUpdatedByEmail() {
  try {
    console.log('Resetting updatedByEmail for all projects...');

    // Get all projects with updatedByEmail set
    const projectsWithUpdatedBy = await prisma.project.findMany({
      where: {
        updatedByEmail: {
          not: null,
        },
      },
      select: {
        id: true,
        domain: true,
        updatedByEmail: true,
      },
    });

    console.log(`Found ${projectsWithUpdatedBy.length} projects with updatedByEmail set`);

    if (projectsWithUpdatedBy.length > 0) {
      console.log('\nProjects to reset:');
      projectsWithUpdatedBy.forEach(p => {
        console.log(`  - ${p.domain} (current updatedByEmail: ${p.updatedByEmail})`);
      });

      // Clear updatedByEmail for all projects
      const result = await prisma.project.updateMany({
        where: {
          updatedByEmail: {
            not: null,
          },
        },
        data: {
          updatedByEmail: null,
        },
      });

      console.log(`\n✓ Reset updatedByEmail to null for ${result.count} projects`);
      console.log('\nGoing forward:');
      console.log('  - New projects will have updatedByEmail = null');
      console.log('  - updatedByEmail will only be set when a project is actually edited');
    } else {
      console.log('No projects to reset');
    }

    console.log('\nDone!');
  } catch (error) {
    console.error('Error resetting updatedByEmail:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

resetUpdatedByEmail();
