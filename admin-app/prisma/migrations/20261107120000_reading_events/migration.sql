-- CreateEnum
CREATE TYPE "ReadingKind" AS ENUM ('BIBLE', 'COMMENTARY');

-- CreateTable
CREATE TABLE "ReadingEvent" (
    "id" TEXT NOT NULL,
    "kind" "ReadingKind" NOT NULL,
    "userId" TEXT,
    "deviceId" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '',
    "book" TEXT NOT NULL,
    "chapter" INTEGER NOT NULL,
    "platform" TEXT NOT NULL DEFAULT '',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReadingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReadingEvent_kind_occurredAt_idx" ON "ReadingEvent"("kind", "occurredAt");

-- CreateIndex
CREATE INDEX "ReadingEvent_userId_occurredAt_idx" ON "ReadingEvent"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "ReadingEvent_deviceId_occurredAt_idx" ON "ReadingEvent"("deviceId", "occurredAt");

-- AddForeignKey
ALTER TABLE "ReadingEvent" ADD CONSTRAINT "ReadingEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
