CREATE TYPE "ReadingPlanScope" AS ENUM ('PERSONAL', 'COMMUNITY', 'PUBLIC');

CREATE TABLE "ReadingPlan" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT,
    "communityId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "scope" "ReadingPlanScope" NOT NULL DEFAULT 'PERSONAL',
    "totalDays" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReadingPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReadingPlanDay" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "title" TEXT,
    "translation" TEXT NOT NULL DEFAULT 'cuv',
    "book" TEXT NOT NULL,
    "chapter" INTEGER NOT NULL,
    "verseStart" INTEGER NOT NULL,
    "verseEnd" INTEGER NOT NULL,

    CONSTRAINT "ReadingPlanDay_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReadingPlanEnrollment" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "completedDays" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReadAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ReadingPlanEnrollment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReadingPlan_creatorId_scope_idx" ON "ReadingPlan"("creatorId", "scope");
CREATE INDEX "ReadingPlan_communityId_createdAt_idx" ON "ReadingPlan"("communityId", "createdAt");
CREATE UNIQUE INDEX "ReadingPlanDay_planId_dayNumber_key" ON "ReadingPlanDay"("planId", "dayNumber");
CREATE INDEX "ReadingPlanDay_planId_dayNumber_idx" ON "ReadingPlanDay"("planId", "dayNumber");
CREATE UNIQUE INDEX "ReadingPlanEnrollment_planId_userId_key" ON "ReadingPlanEnrollment"("planId", "userId");
CREATE INDEX "ReadingPlanEnrollment_userId_startedAt_idx" ON "ReadingPlanEnrollment"("userId", "startedAt");

ALTER TABLE "ReadingPlan"
ADD CONSTRAINT "ReadingPlan_creatorId_fkey"
FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReadingPlan"
ADD CONSTRAINT "ReadingPlan_communityId_fkey"
FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReadingPlanDay"
ADD CONSTRAINT "ReadingPlanDay_planId_fkey"
FOREIGN KEY ("planId") REFERENCES "ReadingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReadingPlanEnrollment"
ADD CONSTRAINT "ReadingPlanEnrollment_planId_fkey"
FOREIGN KEY ("planId") REFERENCES "ReadingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReadingPlanEnrollment"
ADD CONSTRAINT "ReadingPlanEnrollment_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
