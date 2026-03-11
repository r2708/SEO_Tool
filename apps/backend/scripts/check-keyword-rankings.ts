import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkKeywordRankings() {
  try {
    console.log('🔍 Checking keyword rankings...\n');
    
    // Get recent keywords with their rankings
    const keywords = await prisma.keyword.findMany({
      orderBy: { lastUpdated: 'desc' },
      take: 10,
      include: {
        project: {
          select: {
            name: true,
            domain: true,
          },
        },
      },
    });

    console.log(`Found ${keywords.length} recent keywords:\n`);

    for (const keyword of keywords) {
      // Get ranking for this keyword
      const ranking = await prisma.ranking.findFirst({
        where: {
          projectId: keyword.projectId,
          keyword: keyword.keyword,
        },
        orderBy: { date: 'desc' },
      });

      console.log(`📊 Keyword: "${keyword.keyword}"`);
      console.log(`   Project: ${keyword.project.name} (${keyword.project.domain})`);
      console.log(`   Search Volume: ${keyword.searchVolume}`);
      console.log(`   Difficulty: ${keyword.difficulty}`);
      console.log(`   CPC: $${keyword.cpc}`);
      console.log(`   Current Rank: ${ranking ? `#${ranking.position}` : 'Not checked yet'}`);
      console.log(`   Last Updated: ${keyword.lastUpdated.toISOString()}`);
      console.log('');
    }

    // Check total rankings
    const totalRankings = await prisma.ranking.count();
    console.log(`\n📈 Total rankings tracked: ${totalRankings}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkKeywordRankings();
