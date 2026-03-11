const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkData() {
  try {
    // Get keywords with ranking data
    const keywords = await prisma.competitorKeyword.findMany({
      where: {
        searchVolume: { not: null }
      },
      take: 10,
      select: {
        keyword: true,
        position: true,
        searchVolume: true,
        difficulty: true,
        cpc: true,
      },
      orderBy: {
        searchVolume: 'desc'
      }
    });

    console.log('✅ Keywords with ranking data:');
    console.table(keywords);

    const total = await prisma.competitorKeyword.count();
    const withData = await prisma.competitorKeyword.count({
      where: { searchVolume: { not: null } }
    });

    console.log(`\n📊 Total keywords: ${total}`);
    console.log(`📊 Keywords with data: ${withData}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();
