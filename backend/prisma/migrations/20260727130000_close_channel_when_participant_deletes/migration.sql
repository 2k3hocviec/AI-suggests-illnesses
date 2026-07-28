-- Deleting from one side closes the shared channel, while hiding it only from the deleting side.
ALTER TABLE "direct_chat_conversations"
ADD COLUMN "patient_deleted_at" TIMESTAMP(3),
ADD COLUMN "doctor_deleted_at" TIMESTAMP(3);

CREATE INDEX "direct_chat_conversations_patient_id_patient_deleted_at_idx"
ON "direct_chat_conversations"("patient_id", "patient_deleted_at");

CREATE INDEX "direct_chat_conversations_doctor_id_doctor_deleted_at_idx"
ON "direct_chat_conversations"("doctor_id", "doctor_deleted_at");

UPDATE "direct_chat_conversations"
SET
  "status" = 'CLOSED',
  "closed_at" = COALESCE("closed_at", "deleted_at")
WHERE "deleted_at" IS NOT NULL
  AND "status" <> 'CLOSED';
