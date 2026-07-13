/*
  Warnings:

  - You are about to drop the `doctor_expertise` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "doctor_expertise" DROP CONSTRAINT "doctor_expertise_doctor_id_fkey";

-- DropForeignKey
ALTER TABLE "doctor_expertise" DROP CONSTRAINT "doctor_expertise_symptom_id_fkey";

-- DropTable
DROP TABLE "doctor_expertise";
