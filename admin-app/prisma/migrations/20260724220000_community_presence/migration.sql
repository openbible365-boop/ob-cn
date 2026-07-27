CREATE TABLE "CommunityPresence" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "communityId" TEXT NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CommunityPresence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommunityPresence_userId_communityId_key"
  ON "CommunityPresence"("userId", "communityId");

CREATE INDEX "CommunityPresence_communityId_lastSeenAt_idx"
  ON "CommunityPresence"("communityId", "lastSeenAt");

ALTER TABLE "CommunityPresence"
  ADD CONSTRAINT "CommunityPresence_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommunityPresence"
  ADD CONSTRAINT "CommunityPresence_communityId_fkey"
  FOREIGN KEY ("communityId") REFERENCES "Community"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
