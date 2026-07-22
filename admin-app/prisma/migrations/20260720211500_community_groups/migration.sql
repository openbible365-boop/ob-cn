-- A row without parent_id is a top-level community. A row with parent_id is
-- a smaller group belonging to that community.
ALTER TABLE "Community" ADD COLUMN "parent_id" TEXT;

CREATE INDEX "Community_parent_id_idx" ON "Community"("parent_id");

ALTER TABLE "Community"
ADD CONSTRAINT "Community_parent_id_fkey"
FOREIGN KEY ("parent_id") REFERENCES "Community"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
