-- CreateEnum
CREATE TYPE "UserGender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DoctorStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ConsultationType" AS ENUM ('OFFLINE', 'ONLINE');

-- CreateEnum
CREATE TYPE "UrgencyLevel" AS ENUM ('NORMAL', 'URGENT', 'EMERGENCY');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "full_name" TEXT NOT NULL,
    "date_of_birth" DATE,
    "gender" "UserGender" NOT NULL DEFAULT 'UNKNOWN',
    "email" TEXT NOT NULL,
    "password" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "symptoms" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "symptoms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "specialties" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "specialties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "symptom_specialty" (
    "symptom_id" INTEGER NOT NULL,
    "specialty_id" INTEGER NOT NULL,
    "weight" DECIMAL(4,3) NOT NULL DEFAULT 1.0,

    CONSTRAINT "symptom_specialty_pkey" PRIMARY KEY ("symptom_id","specialty_id")
);

-- CreateTable
CREATE TABLE "doctors" (
    "id" SERIAL NOT NULL,
    "full_name" TEXT NOT NULL,
    "academic_title" TEXT,
    "specialty_id" INTEGER NOT NULL,
    "experience_years" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "phone_number" TEXT,
    "email" TEXT,
    "workplace" TEXT,
    "address" TEXT,
    "city" TEXT,
    "working_time" TEXT,
    "consultation_type" "ConsultationType"[] DEFAULT ARRAY[]::"ConsultationType"[],
    "image_url" TEXT,
    "rating" DECIMAL(3,2),
    "status" "DoctorStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_expertise" (
    "doctor_id" INTEGER NOT NULL,
    "symptom_id" INTEGER NOT NULL,
    "expertise_score" DECIMAL(4,3) NOT NULL DEFAULT 1.0,

    CONSTRAINT "doctor_expertise_pkey" PRIMARY KEY ("doctor_id","symptom_id")
);

-- CreateTable
CREATE TABLE "consultation_history" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "original_message" TEXT NOT NULL,
    "extracted_symptoms" JSONB NOT NULL,
    "recommended_specialty_id" INTEGER,
    "emergency" BOOLEAN NOT NULL DEFAULT false,
    "emergency_level" "UrgencyLevel" NOT NULL DEFAULT 'NORMAL',
    "emergency_reasons" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultation_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "symptoms_name_key" ON "symptoms"("name");

-- CreateIndex
CREATE UNIQUE INDEX "symptoms_normalized_name_key" ON "symptoms"("normalized_name");

-- CreateIndex
CREATE UNIQUE INDEX "specialties_code_key" ON "specialties"("code");

-- CreateIndex
CREATE INDEX "doctors_specialty_id_idx" ON "doctors"("specialty_id");

-- CreateIndex
CREATE INDEX "doctors_city_idx" ON "doctors"("city");

-- CreateIndex
CREATE INDEX "consultation_history_user_id_idx" ON "consultation_history"("user_id");

-- CreateIndex
CREATE INDEX "consultation_history_recommended_specialty_id_idx" ON "consultation_history"("recommended_specialty_id");

-- AddForeignKey
ALTER TABLE "symptom_specialty" ADD CONSTRAINT "symptom_specialty_symptom_id_fkey" FOREIGN KEY ("symptom_id") REFERENCES "symptoms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "symptom_specialty" ADD CONSTRAINT "symptom_specialty_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "specialties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "specialties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_expertise" ADD CONSTRAINT "doctor_expertise_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_expertise" ADD CONSTRAINT "doctor_expertise_symptom_id_fkey" FOREIGN KEY ("symptom_id") REFERENCES "symptoms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_history" ADD CONSTRAINT "consultation_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_history" ADD CONSTRAINT "consultation_history_recommended_specialty_id_fkey" FOREIGN KEY ("recommended_specialty_id") REFERENCES "specialties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
