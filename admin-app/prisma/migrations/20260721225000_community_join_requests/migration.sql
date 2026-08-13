CREATE TYPE "CommunityJoinPolicy" AS ENUM ('OPEN', 'APPROVAL', 'INVITE_ONLY');
CREATE TYPE "CommunityJoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

ALTER TABLE "Community"
ADD COLUMN "joinPolicy" "CommunityJoinPolicy" NOT NULL DEFAULT 'APPROVAL';

CREATE TABLE "CommunityJoinRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "communityId" TEXT NOT NULL,
  "status" "CommunityJoinRequestStatus" NOT NULL DEFAULT 'PENDING',
  "message" TEXT,
  "reviewerId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommunityJoinRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommunityJoinRequest_userId_communityId_key"
ON "CommunityJoinRequest"("userId", "communityId");

CREATE INDEX "CommunityJoinRequest_communityId_status_idx"
ON "CommunityJoinRequest"("communityId", "status");

CREATE INDEX "CommunityJoinRequest_userId_status_idx"
ON "CommunityJoinRequest"("userId", "status");

ALTER TABLE "CommunityJoinRequest"
ADD CONSTRAINT "CommunityJoinRequest_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommunityJoinRequest"
ADD CONSTRAINT "CommunityJoinRequest_communityId_fkey"
FOREIGN KEY ("communityId") REFERENCES "Community"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommunityJoinRequest"
ADD CONSTRAINT "CommunityJoinRequest_reviewerId_fkey"
FOREIGN KEY ("reviewerId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
