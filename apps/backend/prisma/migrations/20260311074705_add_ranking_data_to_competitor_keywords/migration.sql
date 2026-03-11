-- AlterTable
ALTER TABLE "CompetitorKeyword" ADD COLUMN     "cpc" DECIMAL(10,2),
ADD COLUMN     "difficulty" DECIMAL(5,2),
ADD COLUMN     "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "position" INTEGER,
ADD COLUMN     "searchVolume" INTEGER;
