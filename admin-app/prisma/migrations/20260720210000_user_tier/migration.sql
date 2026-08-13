-- User subscriptions are independent from the tiers of communities they join.
CREATE TYPE "UserTier" AS ENUM ('BASIC_FREE', 'MID', 'HIGH');

ALTER TABLE "User"
ADD COLUMN "tier" "UserTier" NOT NULL DEFAULT 'BASIC_FREE',
ADD COLUMN "tierPriceCents" INTEGER NOT NULL DEFAULT 0;
