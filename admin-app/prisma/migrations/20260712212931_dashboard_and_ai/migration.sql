-- CreateEnum
CREATE TYPE "AiModelRole" AS ENUM ('PRIMARY', 'BACKUP');

-- CreateEnum
CREATE TYPE "AiModelStatus" AS ENUM ('NORMAL', 'STANDBY', 'DEGRADED');

-- CreateEnum
CREATE TYPE "PromptVersionStatus" AS ENUM ('CANARY', 'GA', 'ARCHIVED');

-- AlterTable
ALTER TABLE "Community" ADD COLUMN     "aiTokenDailyLimit" INTEGER,
ADD COLUMN     "aiTokensToday" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "DailyMetric" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "dau" INTEGER NOT NULL,
    "mau" INTEGER NOT NULL,
    "retentionD1Pct" DOUBLE PRECISION NOT NULL,
    "retentionD7Pct" DOUBLE PRECISION NOT NULL,
    "retentionD30Pct" DOUBLE PRECISION NOT NULL,
    "huiduPenetrationPct" DOUBLE PRECISION NOT NULL,
    "avgRoundsPerSession" DOUBLE PRECISION NOT NULL,
    "bibleReadingPct" INTEGER NOT NULL,
    "huiduPct" INTEGER NOT NULL,
    "communityPct" INTEGER NOT NULL,
    "annotationPct" INTEGER NOT NULL,
    "aiCallCount" INTEGER NOT NULL,
    "aiTokenCount" INTEGER NOT NULL,
    "aiAvgFirstTokenMs" INTEGER NOT NULL,
    "aiLikeRatePct" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "DailyMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotTopic" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "label" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,

    CONSTRAINT "HotTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "autoFallbackEnabled" BOOLEAN NOT NULL DEFAULT true,
    "rateLimited" BOOLEAN NOT NULL DEFAULT false,
    "monthLabel" TEXT NOT NULL,
    "monthlyBudgetCents" INTEGER NOT NULL,
    "monthSpendCents" INTEGER NOT NULL,

    CONSTRAINT "AiSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiModel" (
    "id" TEXT NOT NULL,
    "role" "AiModelRole" NOT NULL,
    "provider" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL,
    "status" "AiModelStatus" NOT NULL DEFAULT 'NORMAL',
    "apiKeyLast4" TEXT,
    "apiKeyUpdatedAt" TIMESTAMP(3),

    CONSTRAINT "AiModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptVersion" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "PromptVersionStatus" NOT NULL DEFAULT 'CANARY',
    "rolloutPercent" INTEGER NOT NULL DEFAULT 10,
    "likeRatePct" DOUBLE PRECISION,
    "dislikeRatePct" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyMetric_date_key" ON "DailyMetric"("date");

-- CreateIndex
CREATE UNIQUE INDEX "AiModel_role_key" ON "AiModel"("role");

-- CreateIndex
CREATE UNIQUE INDEX "PromptVersion_version_key" ON "PromptVersion"("version");
