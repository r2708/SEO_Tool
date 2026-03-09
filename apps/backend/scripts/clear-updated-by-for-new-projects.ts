import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Clear updatedByEmail for projects that have never been edited
 * A project has never been edited if updatedAt equals createdAt (within 1 second tolerance)
 */
async function clearUpdatedByForNewProjects() {
  try {
    console.log('Finding projects that have never been edited...');

    // Get all projects
    const allProjects = await prisma.project.findMany({
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        updatedByEmail: true,
      },
    });

    // Filter projects where updatedAt is essentially the same as createdAt
    const neverEditedProjects = allProjects.filter(project => {
      const timeDiff = Math.abs(
        project.updatedAt.getTime() - project.createdAt.getTime()
      );
      // If difference is less than 1 second, consider it never edited
      return timeDiff < 1000 && project.updatedByEmail !== null;
    });

    console.log(`Found ${neverEditedProjects.length} projects that have never been edited`);

    if (neverEditedProjects.length === 0) {
      console.log('No projects to update');
      return;
    }

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

    console.log(`✓ Cleared updatedByEmail for ${result.count} projects`);
    console.log('Done!');
  } catch (error) {
    console.error('Error clearing updatedByEmail:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

clearUpdatedByForNewProjects();
