-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('Free', 'Pro', 'Admin');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'Free',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Keyword" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "searchVolume" INTEGER NOT NULL,
    "difficulty" DECIMAL(5,2) NOT NULL,
    "cpc" DECIMAL(10,2) NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Keyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ranking" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ranking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Competitor" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "lastAnalyzed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Competitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitorKeyword" (
    "id" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,

    CONSTRAINT "CompetitorKeyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SEOScore" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "analysis" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SEOScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "Project_userId_idx" ON "Project"("userId");

-- CreateIndex
CREATE INDEX "Project_domain_idx" ON "Project"("domain");

-- CreateIndex
CREATE INDEX "Keyword_projectId_idx" ON "Keyword"("projectId");

-- CreateIndex
CREATE INDEX "Keyword_keyword_idx" ON "Keyword"("keyword");

-- CreateIndex
CREATE UNIQUE INDEX "Keyword_projectId_keyword_key" ON "Keyword"("projectId", "keyword");

-- CreateIndex
CREATE INDEX "Ranking_projectId_idx" ON "Ranking"("projectId");

-- CreateIndex
CREATE INDEX "Ranking_keyword_idx" ON "Ranking"("keyword");

-- CreateIndex
CREATE INDEX "Ranking_date_idx" ON "Ranking"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Ranking_projectId_keyword_date_key" ON "Ranking"("projectId", "keyword", "date");

-- CreateIndex
CREATE INDEX "Competitor_projectId_idx" ON "Competitor"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Competitor_projectId_domain_key" ON "Competitor"("projectId", "domain");

-- CreateIndex
CREATE INDEX "CompetitorKeyword_competitorId_idx" ON "CompetitorKeyword"("competitorId");

-- CreateIndex
CREATE INDEX "CompetitorKeyword_keyword_idx" ON "CompetitorKeyword"("keyword");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitorKeyword_competitorId_keyword_key" ON "CompetitorKeyword"("competitorId", "keyword");

-- CreateIndex
CREATE INDEX "SEOScore_projectId_idx" ON "SEOScore"("projectId");

-- CreateIndex
CREATE INDEX "SEOScore_createdAt_idx" ON "SEOScore"("createdAt");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Keyword" ADD CONSTRAINT "Keyword_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ranking" ADD CONSTRAINT "Ranking_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Competitor" ADD CONSTRAINT "Competitor_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorKeyword" ADD CONSTRAINT "CompetitorKeyword_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SEOScore" ADD CONSTRAINT "SEOScore_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
