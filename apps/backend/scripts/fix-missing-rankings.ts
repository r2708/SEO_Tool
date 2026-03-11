import { PrismaClient } from '@prisma/client';
import { track } from '../src/services/rank/rankTrackerService';
import { getSerpApiRank } from '../src/services/rank/serpApiRankTracker';

const prisma = new PrismaClient();

async function fixMissingRankings() {
  try {
    console.log('🔍 Finding keywords without rankings...\n');
    
    // Get all keywords
    const keywords = await prisma.keyword.findMany({
      include: {
        project: {
          select: {
            name: true,
            domain: true,
          },
        },
      },
    });

    console.log(`Found ${keywords.length} total keywords\n`);

    for (const keyword of keywords) {
      // Check if ranking exists
      const ranking = await prisma.ranking.findFirst({
        where: {
          projectId: keyword.projectId,
          keyword: keyword.keyword,
        },
        orderBy: { date: 'desc' },
      });

      if (!ranking && keyword.project.domain) {
        console.log(`📊 Checking ranking for: "${keyword.keyword}"`);
        console.log(`   Project: ${keyword.project.name} (${keyword.project.domain})`);
        
        try {
          // Add delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const position = await getSerpApiRank(keyword.keyword, keyword.project.domain);
          
          // Track the result (0 = not ranked)
          await track(keyword.projectId, keyword.keyword, position || 0);
          
          if (position !== null) {
            console.log(`   ✓ Ranked at position #${position}\n`);
          } else {
            console.log(`   ✓ Not ranked in top 100\n`);
          }
        } catch (error) {
          console.error(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}\n`);
        }
      } else if (ranking) {
        console.log(`✓ "${keyword.keyword}" already has ranking: #${ranking.position}`);
      } else {
        console.log(`⚠️  "${keyword.keyword}" - no domain configured, skipping`);
      }
    }

    console.log('\n✅ Done!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixMissingRankings();
