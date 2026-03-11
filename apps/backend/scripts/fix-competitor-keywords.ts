import { PrismaClient } from '@prisma/client';
import * as keywordService from '../src/services/keyword/keywordService';
import { getSerpApiRank } from '../src/services/rank/serpApiRankTracker';

const prisma = new PrismaClient();

/**
 * Script to fix competitor keywords with missing data
 * This will re-fetch metrics from SerpAPI for all competitor keywords with null values
 */
async function fixCompetitorKeywords() {
  try {
    console.log('🔍 Finding competitor keywords with missing data...');
    
    // Find all competitor keywords with null searchVolume
    const keywordsToFix = await prisma.competitorKeyword.findMany({
      where: {
        searchVolume: null,
      },
      include: {
        competitor: true,
      },
      take: 50, // Limit to 50 to avoid overwhelming the API
    });

    console.log(`Found ${keywordsToFix.length} competitor keywords with missing data`);

    if (keywordsToFix.length === 0) {
      console.log('✅ No competitor keywords need fixing!');
      return;
    }

    let fixed = 0;
    let failed = 0;

    for (let i = 0; i < keywordsToFix.length; i++) {
      const kw = keywordsToFix[i];
      
      try {
        console.log(`\n[${i + 1}/${keywordsToFix.length}] Fixing "${kw.keyword}" for ${kw.competitor.domain}...`);
        
        // Fetch fresh metrics and ranking
        const [metrics, position] = await Promise.all([
          keywordService.getKeywordMetrics(kw.keyword),
          getSerpApiRank(kw.keyword, kw.competitor.domain),
        ]);
        
        // Update the competitor keyword
        await prisma.competitorKeyword.update({
          where: { id: kw.id },
          data: {
            position,
            searchVolume: metrics.searchVolume,
            difficulty: metrics.difficulty,
            cpc: metrics.cpc,
            lastUpdated: new Date(),
          },
        });
        
        console.log(`✅ Updated: position=${position || 'Not ranked'}, volume=${metrics.searchVolume}, difficulty=${metrics.difficulty}, cpc=${metrics.cpc}`);
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
fixCompetitorKeywords()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
