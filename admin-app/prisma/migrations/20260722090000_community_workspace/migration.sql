-- Community workspace: real posts/comments, richer events, resources and
-- end-user management audit logs.
ALTER TABLE "Post" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Event"
ADD COLUMN "description" TEXT,
ADD COLUMN "location" TEXT,
ADD COLUMN "capacity" INTEGER,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Community" ADD COLUMN "aiTokenUsageDate" DATE;

-- Membership catalog uses RMB fen consistently across mobile and admin UI.
UPDATE "Community"
SET "tierPriceCents" = CASE
  WHEN "tier" = 'MID' THEN 3000
  WHEN "tier" = 'HIGH' THEN 9800
  ELSE 0
END;

CREATE TABLE "PostComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PostComment_pkey" PRIMARY KEY ("id")
);

CREATE TYPE "CommunityResourceType" AS ENUM ('LINK', 'DOCUMENT', 'AUDIO', 'VIDEO', 'IMAGE');
CREATE TYPE "CommunityResourceVisibility" AS ENUM ('MEMBERS', 'ADMINS');
CREATE TYPE "CommunityResourceStatus" AS ENUM ('ACTIVE', 'HIDDEN', 'DELETED');

CREATE TABLE "CommunityResource" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "CommunityResourceType" NOT NULL DEFAULT 'LINK',
    "url" TEXT NOT NULL,
    "visibility" "CommunityResourceVisibility" NOT NULL DEFAULT 'MEMBERS',
    "status" "CommunityResourceStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunityResource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunityAuditLog" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunityAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PostComment_postId_createdAt_idx" ON "PostComment"("postId", "createdAt");
CREATE INDEX "CommunityResource_communityId_status_createdAt_idx" ON "CommunityResource"("communityId", "status", "createdAt");
CREATE INDEX "CommunityAuditLog_communityId_createdAt_idx" ON "CommunityAuditLog"("communityId", "createdAt");

ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityResource" ADD CONSTRAINT "CommunityResource_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityResource" ADD CONSTRAINT "CommunityResource_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityAuditLog" ADD CONSTRAINT "CommunityAuditLog_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityAuditLog" ADD CONSTRAINT "CommunityAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
