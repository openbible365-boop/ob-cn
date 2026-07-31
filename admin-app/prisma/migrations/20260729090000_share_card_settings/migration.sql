CREATE TABLE "ShareCardSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "activeTemplate" TEXT NOT NULL DEFAULT 'warm',
    "autoRotate" BOOLEAN NOT NULL DEFAULT false,
    "rotationDays" INTEGER NOT NULL DEFAULT 7,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShareCardSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ShareCardSettings" ("id", "activeTemplate", "autoRotate", "rotationDays", "updatedAt")
VALUES ('singleton', 'warm', false, 7, CURRENT_TIMESTAMP);
