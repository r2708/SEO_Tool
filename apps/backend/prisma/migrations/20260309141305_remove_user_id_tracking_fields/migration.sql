/*
  Warnings:

  - You are about to drop the column `createdBy` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `deletedBy` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `updatedBy` on the `Project` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Project" DROP COLUMN "createdBy",
DROP COLUMN "deletedBy",
DROP COLUMN "updatedBy";
