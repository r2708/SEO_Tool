import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clear existing data (development only!)
  if (process.env.NODE_ENV !== 'production') {
    console.log('🗑️  Clearing existing data...');
    await prisma.sEOScore.deleteMany();
    await prisma.competitorKeyword.deleteMany();
    await prisma.competitor.deleteMany();
    await prisma.ranking.deleteMany();
    await prisma.keyword.deleteMany();
    await prisma.project.deleteMany();
    await prisma.user.deleteMany();
  }

  // Create sample users
  console.log('👤 Creating sample users...');
  
  const freeUser = await prisma.user.create({
    data: {
      email: 'free@example.com',
      password: await bcrypt.hash('password123', 10),
      role: UserRole.Free,
    },
  });
  console.log(`✅ Created Free user: ${freeUser.email}`);

  const proUser = await prisma.user.create({
    data: {
      email: 'pro@example.com',
      password: await bcrypt.hash('password123', 10),
      role: UserRole.Pro,
    },
  });
  console.log(`✅ Created Pro user: ${proUser.email}`);

  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      password: await bcrypt.hash('password123', 10),
      role: UserRole.Admin,
    },
  });
  console.log(`✅ Created Admin user: ${adminUser.email}`);

  // Create sample projects
  console.log('📁 Creating sample projects...');
  
  const project1 = await prisma.project.create({
    data: {
      domain: 'example.com',
      name: 'Example Website',
      userId: freeUser.id,
    },
  });
  console.log(`✅ Created project: ${project1.name}`);

  const project2 = await prisma.project.create({
    data: {
      domain: 'myblog.com',
      name: 'My Tech Blog',
      userId: proUser.id,
    },
  });
  console.log(`✅ Created project: ${project2.name}`);

  const project3 = await prisma.project.create({
    data: {
      domain: 'ecommerce-store.com',
      name: 'E-commerce Store',
      userId: proUser.id,
    },
  });
  console.log(`✅ Created project: ${project3.name}`);

  // Create sample keywords
  console.log('🔑 Creating sample keywords...');
  
  const keywords1 = await prisma.keyword.createMany({
    data: [
      {
        projectId: project1.id,
        keyword: 'seo tools',
        searchVolume: 12000,
        difficulty: 65.5,
        cpc: 3.25,
      },
      {
        projectId: project1.id,
        keyword: 'keyword research',
        searchVolume: 8500,
        difficulty: 58.2,
        cpc: 2.80,
      },
      {
        projectId: project1.id,
        keyword: 'rank tracking',
        searchVolume: 5200,
        difficulty: 52.1,
        cpc: 2.15,
      },
      {
        projectId: project1.id,
        keyword: 'seo analysis',
        searchVolume: 9800,
        difficulty: 61.3,
        cpc: 3.10,
      },
      {
        projectId: project1.id,
        keyword: 'competitor analysis',
        searchVolume: 4100,
        difficulty: 48.7,
        cpc: 1.95,
      },
    ],
  });
  console.log(`✅ Created ${keywords1.count} keywords for ${project1.name}`);

  const keywords2 = await prisma.keyword.createMany({
    data: [
      {
        projectId: project2.id,
        keyword: 'javascript tutorial',
        searchVolume: 45000,
        difficulty: 72.3,
        cpc: 1.85,
      },
      {
        projectId: project2.id,
        keyword: 'react hooks',
        searchVolume: 28000,
        difficulty: 68.9,
        cpc: 2.20,
      },
      {
        projectId: project2.id,
        keyword: 'typescript guide',
        searchVolume: 18500,
        difficulty: 64.5,
        cpc: 1.95,
      },
      {
        projectId: project2.id,
        keyword: 'node.js best practices',
        searchVolume: 12300,
        difficulty: 59.8,
        cpc: 2.10,
      },
    ],
  });
  console.log(`✅ Created ${keywords2.count} keywords for ${project2.name}`);

  const keywords3 = await prisma.keyword.createMany({
    data: [
      {
        projectId: project3.id,
        keyword: 'buy running shoes',
        searchVolume: 35000,
        difficulty: 78.5,
        cpc: 4.50,
      },
      {
        projectId: project3.id,
        keyword: 'best sneakers 2024',
        searchVolume: 22000,
        difficulty: 71.2,
        cpc: 3.85,
      },
      {
        projectId: project3.id,
        keyword: 'athletic footwear',
        searchVolume: 15000,
        difficulty: 65.8,
        cpc: 3.20,
      },
    ],
  });
  console.log(`✅ Created ${keywords3.count} keywords for ${project3.name}`);

  // Create sample rankings (30 days of data)
  console.log('📊 Creating sample rankings...');
  
  const today = new Date();
  const rankings = [];

  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    // Simulate ranking improvements over time
    rankings.push(
      {
        projectId: project1.id,
        keyword: 'seo tools',
        position: Math.max(1, 25 - Math.floor(i / 3)),
        date: date,
      },
      {
        projectId: project1.id,
        keyword: 'keyword research',
        position: Math.max(1, 30 - Math.floor(i / 4)),
        date: date,
      },
      {
        projectId: project2.id,
        keyword: 'javascript tutorial',
        position: Math.max(1, 15 - Math.floor(i / 5)),
        date: date,
      },
      {
        projectId: project2.id,
        keyword: 'react hooks',
        position: Math.max(1, 20 - Math.floor(i / 4)),
        date: date,
      },
    );
  }

  await prisma.ranking.createMany({
    data: rankings,
  });
  console.log(`✅ Created ${rankings.length} ranking records`);

  // Create sample competitors
  console.log('🏆 Creating sample competitors...');
  
  const competitor1 = await prisma.competitor.create({
    data: {
      projectId: project1.id,
      domain: 'competitor-seo.com',
    },
  });

  await prisma.competitorKeyword.createMany({
    data: [
      { competitorId: competitor1.id, keyword: 'seo tools' },
      { competitorId: competitor1.id, keyword: 'keyword research' },
      { competitorId: competitor1.id, keyword: 'backlink analysis' },
      { competitorId: competitor1.id, keyword: 'site audit' },
    ],
  });
  console.log(`✅ Created competitor: ${competitor1.domain}`);

  const competitor2 = await prisma.competitor.create({
    data: {
      projectId: project2.id,
      domain: 'tech-blog-competitor.com',
    },
  });

  await prisma.competitorKeyword.createMany({
    data: [
      { competitorId: competitor2.id, keyword: 'javascript tutorial' },
      { competitorId: competitor2.id, keyword: 'web development' },
      { competitorId: competitor2.id, keyword: 'coding tips' },
    ],
  });
  console.log(`✅ Created competitor: ${competitor2.domain}`);

  // Create sample SEO scores
  console.log('📈 Creating sample SEO scores...');
  
  const seoScores = [];
  for (let i = 0; i < 10; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i * 3);
    
    seoScores.push(
      {
        projectId: project1.id,
        url: 'https://example.com',
        score: Math.min(100, 70 + i * 2),
        analysis: {
          title: { content: 'Example Domain', length: 14, optimal: true },
          metaDescription: { content: 'Example meta', length: 12, optimal: false },
          headings: { h1Count: 1, h2Count: 3, structure: ['H1: Main'] },
          images: { total: 5, missingAlt: 1 },
          links: { internal: 10, broken: [] },
        },
        createdAt: date,
      },
      {
        projectId: project2.id,
        url: 'https://myblog.com',
        score: Math.min(100, 75 + i * 2),
        analysis: {
          title: { content: 'My Tech Blog', length: 13, optimal: true },
          metaDescription: { content: 'Tech tutorials', length: 15, optimal: false },
          headings: { h1Count: 1, h2Count: 5, structure: ['H1: Blog'] },
          images: { total: 8, missingAlt: 0 },
          links: { internal: 15, broken: [] },
        },
        createdAt: date,
      },
    );
  }

  await prisma.sEOScore.createMany({
    data: seoScores,
  });
  console.log(`✅ Created ${seoScores.length} SEO score records`);

  console.log('✨ Database seeding completed successfully!');
  console.log('\n📝 Sample Credentials:');
  console.log('Free User:  free@example.com / password123');
  console.log('Pro User:   pro@example.com / password123');
  console.log('Admin User: admin@example.com / password123');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
