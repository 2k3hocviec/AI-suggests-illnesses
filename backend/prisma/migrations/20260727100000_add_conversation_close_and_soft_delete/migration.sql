-- Add soft-delete metadata for AI sessions and per-participant hiding for doctor chats.
ALTER TABLE "chat_sessions"
ADD COLUMN "deleted_at" TIMESTAMP(3);

ALTER TABLE "direct_chat_conversations"
ADD COLUMN "patient_deleted_at" TIMESTAMP(3),
ADD COLUMN "doctor_deleted_at" TIMESTAMP(3);

CREATE INDEX "chat_sessions_user_id_deleted_at_idx"
ON "chat_sessions"("user_id", "deleted_at");

CREATE INDEX "direct_chat_conversations_patient_id_patient_deleted_at_idx"
ON "direct_chat_conversations"("patient_id", "patient_deleted_at");

CREATE INDEX "direct_chat_conversations_doctor_id_doctor_deleted_at_idx"
ON "direct_chat_conversations"("doctor_id", "doctor_deleted_at");
