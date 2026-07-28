-- A deleted direct-chat channel is hidden and unavailable to both participants.
DROP INDEX IF EXISTS "direct_chat_conversations_patient_id_patient_deleted_at_idx";
DROP INDEX IF EXISTS "direct_chat_conversations_doctor_id_doctor_deleted_at_idx";

ALTER TABLE "direct_chat_conversations"
ADD COLUMN "deleted_at" TIMESTAMP(3);

ALTER TABLE "direct_chat_conversations"
DROP COLUMN "patient_deleted_at",
DROP COLUMN "doctor_deleted_at";

CREATE INDEX "direct_chat_conversations_deleted_at_idx"
ON "direct_chat_conversations"("deleted_at");
