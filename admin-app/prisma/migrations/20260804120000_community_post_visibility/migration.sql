CREATE TYPE "CommunityPostVisibility" AS ENUM ('PUBLIC', 'MEMBERS', 'ADMINS');

ALTER TABLE "Post"
ADD COLUMN "visibility" "CommunityPostVisibility" NOT NULL DEFAULT 'MEMBERS';

UPDATE "Post"
SET "visibility" = 'PUBLIC'
WHERE "communityId" IN (
  SELECT "id" FROM "Community" WHERE "isOfficial" = TRUE
);

CREATE INDEX "Post_communityId_visibility_status_createdAt_idx"
ON "Post"("communityId", "visibility", "status", "createdAt");
