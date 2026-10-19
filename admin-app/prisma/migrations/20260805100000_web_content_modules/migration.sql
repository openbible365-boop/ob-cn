-- CreateEnum
CREATE TYPE "EncyclopediaEntryType" AS ENUM ('DICTIONARY', 'ARTICLE', 'DEVOTIONAL');

-- CreateEnum
CREATE TYPE "MediaItemType" AS ENUM ('VIDEO', 'AUDIO');

-- CreateTable
CREATE TABLE "EncyclopediaEntry" (
    "id" TEXT NOT NULL,
    "entryType" "EncyclopediaEntryType" NOT NULL,
    "category" TEXT,
    "indexLetter" TEXT,
    "coverStyle" TEXT,
    "author" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "titleZh" TEXT,
    "titleEn" TEXT,
    "titleKo" TEXT,
    "summaryZh" TEXT,
    "summaryEn" TEXT,
    "summaryKo" TEXT,
    "contentZh" TEXT,
    "contentEn" TEXT,
    "contentKo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EncyclopediaEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaItem" (
    "id" TEXT NOT NULL,
    "mediaType" "MediaItemType" NOT NULL,
    "title" TEXT NOT NULL,
    "series" TEXT,
    "category" TEXT NOT NULL,
    "duration" TEXT,
    "teacher" TEXT,
    "description" TEXT,
    "coverStyle" TEXT,
    "url" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpiritualStage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpiritualStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpiritualQuestion" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpiritualQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyNote" (
    "id" TEXT NOT NULL,
    "verseRef" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "nameKo" TEXT,
    "priceMonthly" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priceOnce" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "badge" TEXT,
    "badgeEn" TEXT,
    "badgeKo" TEXT,
    "features" TEXT NOT NULL,
    "featuresEn" TEXT,
    "featuresKo" TEXT,
    "dialogueLimit" INTEGER NOT NULL DEFAULT 20,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EncyclopediaEntry_entryType_isActive_sortOrder_idx" ON "EncyclopediaEntry"("entryType", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "EncyclopediaEntry_indexLetter_idx" ON "EncyclopediaEntry"("indexLetter");

-- CreateIndex
CREATE INDEX "MediaItem_mediaType_isActive_sortOrder_idx" ON "MediaItem"("mediaType", "isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "SpiritualStage_name_key" ON "SpiritualStage"("name");

-- CreateIndex
CREATE INDEX "SpiritualQuestion_stageId_isActive_sortOrder_idx" ON "SpiritualQuestion"("stageId", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "SpiritualQuestion_category_idx" ON "SpiritualQuestion"("category");

-- CreateIndex
CREATE UNIQUE INDEX "StudyNote_verseRef_key" ON "StudyNote"("verseRef");

-- CreateIndex
CREATE INDEX "StudyNote_verseRef_idx" ON "StudyNote"("verseRef");

-- CreateIndex
CREATE INDEX "SupportPlan_isActive_sortOrder_idx" ON "SupportPlan"("isActive", "sortOrder");

-- AddForeignKey
ALTER TABLE "SpiritualQuestion" ADD CONSTRAINT "SpiritualQuestion_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "SpiritualStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

