-- Add a globally unique shorthand for communities. Existing rows use the
-- first two characters of the trimmed name; duplicate shorthands receive a
-- deterministic numeric suffix so this migration is safe on populated data.
ALTER TABLE "Community" ADD COLUMN "abbreviation" TEXT;

WITH ranked AS (
  SELECT
    "id",
    CASE
      WHEN char_length(btrim("name")) > 0 THEN left(btrim("name"), 2)
      ELSE '社群'
    END AS base,
    row_number() OVER (
      PARTITION BY CASE
        WHEN char_length(btrim("name")) > 0 THEN left(btrim("name"), 2)
        ELSE '社群'
      END
      ORDER BY "createdAt", "id"
    ) AS occurrence
  FROM "Community"
)
UPDATE "Community" AS community
SET "abbreviation" = CASE
  WHEN ranked.occurrence = 1 THEN ranked.base
  ELSE ranked.base || '-' || ranked.occurrence::text
END
FROM ranked
WHERE community."id" = ranked."id";

ALTER TABLE "Community" ALTER COLUMN "abbreviation" SET NOT NULL;

CREATE UNIQUE INDEX "Community_abbreviation_key"
ON "Community"("abbreviation");
