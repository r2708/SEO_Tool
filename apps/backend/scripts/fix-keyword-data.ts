import { PrismaClient } from '@prisma/client';
import * as keywordService from '../src/services/keyword/keywordService';

const prisma = new PrismaClient();

/**
 * Script to fix keywords with missing or zero search volume data
 * This will re-fetch metrics from SerpAPI for all keywords with searchVolume = 0
 */
async function fixKeywordData() {
  try {
    console.log('🔍 Finding keywords with missing data...');
    
    // Find all keywords with searchVolume = 0
    const keywordsToFix = await prisma.keyword.findMany({
      where: {
        searchVolume: 0,
      },
      select: {
        id: true,
        keyword: true,
        projectId: true,
        searchVolume: true,
      },
    });

    console.log(`Found ${keywordsToFix.length} keywords with missing data`);

    if (keywordsToFix.length === 0) {
      console.log('✅ No keywords need fixing!');
      return;
    }

    let fixed = 0;
    let failed = 0;

    for (let i = 0; i < keywordsToFix.length; i++) {
      const kw = keywordsToFix[i];
      
      try {
        console.log(`\n[${i + 1}/${keywordsToFix.length}] Fixing "${kw.keyword}"...`);
        
        // Fetch fresh metrics
        const metrics = await keywordService.getKeywordMetrics(kw.keyword);
        
        // Update the keyword
        await prisma.keyword.update({
          where: { id: kw.id },
          data: {
            searchVolume: metrics.searchVolume,
            difficulty: metrics.difficulty,
            cpc: metrics.cpc,
            lastUpdated: new Date(),
          },
        });
        
        console.log(`✅ Updated: volume=${metrics.searchVolume}, difficulty=${metrics.difficulty}, cpc=${metrics.cpc}`);
        fixed++;
        
        // Add delay to avoid rate limiting
        if (i < keywordsToFix.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(`❌ Failed to fix "${kw.keyword}":`, error instanceof Error ? error.message : String(error));
        failed++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Fixed: ${fixed}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Total: ${keywordsToFix.length}`);
    
  } catch (error) {
    console.error('❌ Script failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
fixKeywordData()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
