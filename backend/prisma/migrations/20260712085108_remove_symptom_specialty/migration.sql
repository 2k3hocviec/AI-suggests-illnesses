/*
  Warnings:

  - You are about to drop the `symptom_specialty` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "symptom_specialty" DROP CONSTRAINT "symptom_specialty_specialty_id_fkey";

-- DropForeignKey
ALTER TABLE "symptom_specialty" DROP CONSTRAINT "symptom_specialty_symptom_id_fkey";

-- DropTable
DROP TABLE "symptom_specialty";
