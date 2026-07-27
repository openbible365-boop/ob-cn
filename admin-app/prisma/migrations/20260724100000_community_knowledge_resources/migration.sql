ALTER TYPE "CommunityResourceType" ADD VALUE 'TEXT';
ALTER TYPE "CommunityResourceType" ADD VALUE 'OTHER';

ALTER TABLE "CommunityResource"
  ALTER COLUMN "url" DROP NOT NULL,
  ADD COLUMN "contentText" TEXT,
  ADD COLUMN "fileName" TEXT,
  ADD COLUMN "mimeType" TEXT,
  ADD COLUMN "fileSize" INTEGER,
  ADD COLUMN "storageKey" TEXT,
  ADD COLUMN "indexedAt" TIMESTAMP(3);
