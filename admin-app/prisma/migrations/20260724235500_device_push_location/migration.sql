-- Store the last public IP seen while registering a native push token and its
-- approximate network location. This is not GPS/device location.
ALTER TABLE "DevicePushToken"
ADD COLUMN "ipAddress" TEXT,
ADD COLUMN "country" TEXT,
ADD COLUMN "countryCode" TEXT,
ADD COLUMN "region" TEXT,
ADD COLUMN "city" TEXT;
