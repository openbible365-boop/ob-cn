-- Rich community feed formats: regular posts, articles, notices, and media.
CREATE TYPE "CommunityPostType" AS ENUM ('POST', 'ARTICLE', 'NOTICE', 'MEDIA');
CREATE TYPE "CommunityPostMediaType" AS ENUM ('IMAGE', 'AUDIO', 'VIDEO');

ALTER TABLE "Post"
ADD COLUMN "postType" "CommunityPostType" NOT NULL DEFAULT 'POST',
ADD COLUMN "title" TEXT,
ADD COLUMN "mediaType" "CommunityPostMediaType",
ADD COLUMN "mediaUrl" TEXT;

CREATE INDEX "Post_communityId_status_createdAt_idx"
ON "Post"("communityId", "status", "createdAt");
