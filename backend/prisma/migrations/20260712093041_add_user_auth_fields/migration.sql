/*
  Warnings:

  - Added the required column `updated_at` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "password_reset_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "password_reset_expires" TIMESTAMP(3),
ADD COLUMN     "password_reset_otp_hash" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;
