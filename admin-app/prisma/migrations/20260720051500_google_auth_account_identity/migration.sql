-- A Google/Apple provider identity may belong to only one OpenBible user.
-- PostgreSQL permits multiple NULL values in this composite unique index,
-- which keeps the existing seeded provider rows valid.
CREATE UNIQUE INDEX "AuthAccount_provider_providerAccountId_key"
ON "AuthAccount"("provider", "providerAccountId");
