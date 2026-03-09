import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Fix updatedByEmail for all projects:
 * - Clear updatedByEmail for projects where updatedAt equals createdAt (never edited)
 * - This ensures only actually edited projects show updatedByEmail
 */
async function fixUpdatedByEmail() {
  try {
    console.log('Checking all projects...');

    // Get all projects
    const allProjects = await prisma.project.findMany({
      select: {
        id: true,
        domain: true,
        createdAt: true,
        updatedAt: true,
        updatedByEmail: true,
      },
    });

    console.log(`Total projects: ${allProjects.length}`);

    // Find projects where updatedAt is essentially the same as createdAt
    const neverEditedProjects = allProjects.filter(project => {
      const timeDiff = Math.abs(
        project.updatedAt.getTime() - project.createdAt.getTime()
      );
      // If difference is less than 2 seconds, consider it never edited
      return timeDiff < 2000;
    });

    console.log(`\nProjects that have never been edited: ${neverEditedProjects.length}`);
    
    if (neverEditedProjects.length > 0) {
      console.log('\nClearing updatedByEmail for these projects:');
      neverEditedProjects.forEach(p => {
        console.log(`  - ${p.domain} (updatedByEmail: ${p.updatedByEmail})`);
      });

      // Clear updatedByEmail for these projects
      const result = await prisma.project.updateMany({
        where: {
          id: {
            in: neverEditedProjects.map(p => p.id),
          },
        },
        data: {
          updatedByEmail: null,
        },
      });

      console.log(`\n✓ Cleared updatedByEmail for ${result.count} projects`);
    }

    // Show projects that have been edited
    const editedProjects = allProjects.filter(project => {
      const timeDiff = Math.abs(
        project.updatedAt.getTime() - project.createdAt.getTime()
      );
      return timeDiff >= 2000;
    });

    if (editedProjects.length > 0) {
      console.log(`\nProjects that have been edited (keeping updatedByEmail): ${editedProjects.length}`);
      editedProjects.forEach(p => {
        console.log(`  - ${p.domain} (updatedByEmail: ${p.updatedByEmail})`);
      });
    }

    console.log('\nDone!');
  } catch (error) {
    console.error('Error fixing updatedByEmail:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixUpdatedByEmail();
