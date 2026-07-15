CREATE TABLE "provinces" (
    "code" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "division_type" TEXT NOT NULL,
    "codename" TEXT NOT NULL,
    "phone_code" INTEGER,

    CONSTRAINT "provinces_pkey" PRIMARY KEY ("code")
);

CREATE TABLE "districts" (
    "code" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "division_type" TEXT NOT NULL,
    "codename" TEXT NOT NULL,
    "province_code" INTEGER NOT NULL,

    CONSTRAINT "districts_pkey" PRIMARY KEY ("code")
);

CREATE TABLE "wards" (
    "code" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "division_type" TEXT NOT NULL,
    "codename" TEXT NOT NULL,
    "district_code" INTEGER NOT NULL,
    "province_code" INTEGER NOT NULL,

    CONSTRAINT "wards_pkey" PRIMARY KEY ("code")
);

ALTER TABLE "users" ADD COLUMN "province_code" INTEGER,
ADD COLUMN "district_code" INTEGER,
ADD COLUMN "ward_code" INTEGER;

ALTER TABLE "doctors" ADD COLUMN "province_code" INTEGER,
ADD COLUMN "district_code" INTEGER,
ADD COLUMN "ward_code" INTEGER;

CREATE UNIQUE INDEX "provinces_codename_key" ON "provinces"("codename");
CREATE UNIQUE INDEX "districts_codename_key" ON "districts"("codename");
CREATE UNIQUE INDEX "wards_codename_key" ON "wards"("codename");

CREATE INDEX "districts_province_code_idx" ON "districts"("province_code");
CREATE INDEX "wards_district_code_idx" ON "wards"("district_code");
CREATE INDEX "wards_province_code_idx" ON "wards"("province_code");
CREATE INDEX "users_province_code_idx" ON "users"("province_code");
CREATE INDEX "users_district_code_idx" ON "users"("district_code");
CREATE INDEX "users_ward_code_idx" ON "users"("ward_code");
CREATE INDEX "doctors_province_code_idx" ON "doctors"("province_code");
CREATE INDEX "doctors_district_code_idx" ON "doctors"("district_code");
CREATE INDEX "doctors_ward_code_idx" ON "doctors"("ward_code");

ALTER TABLE "districts" ADD CONSTRAINT "districts_province_code_fkey" FOREIGN KEY ("province_code") REFERENCES "provinces"("code") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wards" ADD CONSTRAINT "wards_district_code_fkey" FOREIGN KEY ("district_code") REFERENCES "districts"("code") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wards" ADD CONSTRAINT "wards_province_code_fkey" FOREIGN KEY ("province_code") REFERENCES "provinces"("code") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_province_code_fkey" FOREIGN KEY ("province_code") REFERENCES "provinces"("code") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_district_code_fkey" FOREIGN KEY ("district_code") REFERENCES "districts"("code") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_ward_code_fkey" FOREIGN KEY ("ward_code") REFERENCES "wards"("code") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_province_code_fkey" FOREIGN KEY ("province_code") REFERENCES "provinces"("code") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_district_code_fkey" FOREIGN KEY ("district_code") REFERENCES "districts"("code") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_ward_code_fkey" FOREIGN KEY ("ward_code") REFERENCES "wards"("code") ON DELETE SET NULL ON UPDATE CASCADE;
