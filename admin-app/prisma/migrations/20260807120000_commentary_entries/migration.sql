-- CreateTable
CREATE TABLE "CommentaryEntry" (
    "id" TEXT NOT NULL,
    "bookOrder" INTEGER NOT NULL,
    "chapter" INTEGER NOT NULL,
    "entryType" TEXT NOT NULL,
    "verses" TEXT NOT NULL,
    "rangeStart" INTEGER NOT NULL,
    "rangeEnd" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentaryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommentaryRevision" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "beforeText" TEXT NOT NULL,
    "afterText" TEXT NOT NULL,
    "operatorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentaryRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommentaryEntry_bookOrder_chapter_idx" ON "CommentaryEntry"("bookOrder", "chapter");

-- CreateIndex
CREATE INDEX "CommentaryEntry_status_idx" ON "CommentaryEntry"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CommentaryEntry_bookOrder_chapter_sortOrder_key" ON "CommentaryEntry"("bookOrder", "chapter", "sortOrder");

-- CreateIndex
CREATE INDEX "CommentaryRevision_entryId_createdAt_idx" ON "CommentaryRevision"("entryId", "createdAt");

-- AddForeignKey
ALTER TABLE "CommentaryRevision" ADD CONSTRAINT "CommentaryRevision_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "CommentaryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentaryRevision" ADD CONSTRAINT "CommentaryRevision_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

