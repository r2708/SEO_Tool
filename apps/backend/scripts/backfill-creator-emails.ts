import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfillCreatorEmails() {
  console.log('Starting backfill of all email fields...');

  // Get all projects (including soft-deleted ones)
  const projects = await prisma.project.findMany({
    include: {
      user: true, // Include user to get email
    },
  });

  console.log(`Found ${projects.length} projects to check`);

  let updated = 0;
  for (const project of projects) {
    try {
      const updateData: any = {};

      // Set ownerEmail if null
      if (!project.ownerEmail) {
        updateData.ownerEmail = project.user.email;
      }

      // Set createdByEmail if null
      if (!project.createdByEmail) {
        updateData.createdByEmail = project.user.email;
      }

      // DO NOT set updatedByEmail - it should only be set when project is actually edited
      // updatedByEmail should remain null for newly created projects

      // Set deletedByEmail if project is deleted but email is null
      if (project.deletedAt && !project.deletedByEmail) {
        updateData.deletedByEmail = project.user.email;
      }

      // Only update if there's something to update
      if (Object.keys(updateData).length > 0) {
        await prisma.project.update({
          where: { id: project.id },
          data: updateData,
        });
        updated++;
        console.log(`Updated project ${project.id} - ${project.name} (${Object.keys(updateData).join(', ')})`);
      }
    } catch (error) {
      console.error(`Failed to update project ${project.id}:`, error);
    }
  }

  console.log(`\nBackfill complete! Updated ${updated} out of ${projects.length} projects`);
  
  await prisma.$disconnect();
}

backfillCreatorEmails()
  .catch((error) => {
    console.error('Backfill failed:', error);
    process.exit(1);
  });
