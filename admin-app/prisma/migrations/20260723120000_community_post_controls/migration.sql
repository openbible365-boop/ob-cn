ALTER TABLE "Post"
ADD COLUMN "pinnedAt" TIMESTAMP(3);

ALTER TABLE "Report"
ADD COLUMN "reporterId" TEXT;

CREATE TABLE "PostBookmark" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PostBookmark_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PostBookmark_postId_userId_key"
ON "PostBookmark"("postId", "userId");

CREATE INDEX "PostBookmark_userId_createdAt_idx"
ON "PostBookmark"("userId", "createdAt");

CREATE INDEX "Post_communityId_status_pinnedAt_createdAt_idx"
ON "Post"("communityId", "status", "pinnedAt", "createdAt");

CREATE INDEX "Report_reporterId_createdAt_idx"
ON "Report"("reporterId", "createdAt");

CREATE INDEX "Report_postId_status_idx"
ON "Report"("postId", "status");

ALTER TABLE "PostBookmark"
ADD CONSTRAINT "PostBookmark_postId_fkey"
FOREIGN KEY ("postId") REFERENCES "Post"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PostBookmark"
ADD CONSTRAINT "PostBookmark_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Report"
ADD CONSTRAINT "Report_reporterId_fkey"
FOREIGN KEY ("reporterId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
