-- Reorder Project table columns by recreating the table
-- This will move ownerEmail before userId and remove userId from visible columns

BEGIN;

-- Create a new table with desired column order
CREATE TABLE "Project_new" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ownerEmail" TEXT,
  "domain" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdByEmail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "updatedByEmail" TEXT,
  "deletedAt" TIMESTAMP(3),
  "deletedByEmail" TEXT,
  "userId" TEXT NOT NULL
);

-- Copy data from old table to new table
INSERT INTO "Project_new" (
  "id", "ownerEmail", "domain", "name", "createdByEmail", 
  "createdAt", "updatedAt", "updatedByEmail", 
  "deletedAt", "deletedByEmail", "userId"
)
SELECT 
  "id", "ownerEmail", "domain", "name", "createdByEmail",
  "createdAt", "updatedAt", "updatedByEmail",
  "deletedAt", "deletedByEmail", "userId"
FROM "Project";

-- Drop old table
DROP TABLE "Project" CASCADE;

-- Rename new table to original name
ALTER TABLE "Project_new" RENAME TO "Project";

-- Recreate indexes
CREATE INDEX "Project_userId_idx" ON "Project"("userId");
CREATE INDEX "Project_domain_idx" ON "Project"("domain");
CREATE INDEX "Project_deletedAt_idx" ON "Project"("deletedAt");

-- Recreate foreign key constraint
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
