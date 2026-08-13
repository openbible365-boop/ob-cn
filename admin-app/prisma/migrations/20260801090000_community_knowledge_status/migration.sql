CREATE TYPE "CommunityKnowledgeStatus" AS ENUM ('PARSING', 'INDEXED', 'FAILED', 'REINDEX_REQUIRED');

ALTER TABLE "CommunityResource"
ADD COLUMN "knowledgeStatus" "CommunityKnowledgeStatus" NOT NULL DEFAULT 'PARSING',
ADD COLUMN "indexError" TEXT;

UPDATE "CommunityResource"
SET "knowledgeStatus" = CASE
  WHEN "indexedAt" IS NOT NULL THEN 'INDEXED'::"CommunityKnowledgeStatus"
  ELSE 'REINDEX_REQUIRED'::"CommunityKnowledgeStatus"
END;
