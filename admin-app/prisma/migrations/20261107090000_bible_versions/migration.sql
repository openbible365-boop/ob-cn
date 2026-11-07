-- CreateTable
CREATE TABLE "BibleVersion" (
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "defaultOn" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BibleVersion_pkey" PRIMARY KEY ("code")
);
