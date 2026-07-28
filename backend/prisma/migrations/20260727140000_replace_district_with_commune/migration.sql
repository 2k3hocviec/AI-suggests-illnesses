-- The new administrative tree contains only province and commune-level units.
-- Rename the legacy ward storage to commune storage while preserving location codes.

ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_district_code_fkey";
ALTER TABLE "doctors" DROP CONSTRAINT IF EXISTS "doctors_district_code_fkey";
ALTER TABLE "wards" DROP CONSTRAINT IF EXISTS "wards_district_code_fkey";

DROP INDEX IF EXISTS "users_district_code_idx";
DROP INDEX IF EXISTS "doctors_district_code_idx";
DROP INDEX IF EXISTS "wards_district_code_idx";

ALTER TABLE "users" DROP COLUMN IF EXISTS "district_code";
ALTER TABLE "doctors" DROP COLUMN IF EXISTS "district_code";
ALTER TABLE "wards" DROP COLUMN IF EXISTS "district_code";

DROP TABLE IF EXISTS "districts";

ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_ward_code_fkey";
ALTER TABLE "doctors" DROP CONSTRAINT IF EXISTS "doctors_ward_code_fkey";
DROP INDEX IF EXISTS "users_ward_code_idx";
DROP INDEX IF EXISTS "doctors_ward_code_idx";

ALTER TABLE "users" RENAME COLUMN "ward_code" TO "commune_code";
ALTER TABLE "doctors" RENAME COLUMN "ward_code" TO "commune_code";
ALTER TABLE "wards" RENAME TO "communes";

CREATE INDEX "users_commune_code_idx" ON "users"("commune_code");
CREATE INDEX "doctors_commune_code_idx" ON "doctors"("commune_code");

ALTER TABLE "users" ADD CONSTRAINT "users_commune_code_fkey" FOREIGN KEY ("commune_code") REFERENCES "communes"("code") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_commune_code_fkey" FOREIGN KEY ("commune_code") REFERENCES "communes"("code") ON DELETE SET NULL ON UPDATE CASCADE;
