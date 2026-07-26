ALTER TYPE "UserRole" ADD VALUE 'DOCTOR';

CREATE TYPE "DirectChatStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED', 'CLOSED');

ALTER TABLE "doctors"
ADD COLUMN "user_id" INTEGER;

CREATE TABLE "direct_chat_conversations" (
    "id" SERIAL NOT NULL,
    "patient_id" INTEGER NOT NULL,
    "doctor_id" INTEGER NOT NULL,
    "status" "DirectChatStatus" NOT NULL DEFAULT 'PENDING',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "direct_chat_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "direct_chat_messages" (
    "id" SERIAL NOT NULL,
    "conversation_id" INTEGER NOT NULL,
    "sender_id" INTEGER NOT NULL,
    "client_message_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(3),

    CONSTRAINT "direct_chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "doctors_user_id_key" ON "doctors"("user_id");
CREATE UNIQUE INDEX "direct_chat_messages_client_message_id_key" ON "direct_chat_messages"("client_message_id");
CREATE INDEX "direct_chat_conversations_patient_id_status_idx" ON "direct_chat_conversations"("patient_id", "status");
CREATE INDEX "direct_chat_conversations_doctor_id_status_idx" ON "direct_chat_conversations"("doctor_id", "status");
CREATE INDEX "direct_chat_conversations_updated_at_idx" ON "direct_chat_conversations"("updated_at");
CREATE INDEX "direct_chat_messages_conversation_id_created_at_idx" ON "direct_chat_messages"("conversation_id", "created_at");
CREATE INDEX "direct_chat_messages_sender_id_idx" ON "direct_chat_messages"("sender_id");
CREATE INDEX "direct_chat_messages_read_at_idx" ON "direct_chat_messages"("read_at");

ALTER TABLE "doctors"
ADD CONSTRAINT "doctors_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "direct_chat_conversations"
ADD CONSTRAINT "direct_chat_conversations_patient_id_fkey"
FOREIGN KEY ("patient_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "direct_chat_conversations"
ADD CONSTRAINT "direct_chat_conversations_doctor_id_fkey"
FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "direct_chat_messages"
ADD CONSTRAINT "direct_chat_messages_conversation_id_fkey"
FOREIGN KEY ("conversation_id") REFERENCES "direct_chat_conversations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "direct_chat_messages"
ADD CONSTRAINT "direct_chat_messages_sender_id_fkey"
FOREIGN KEY ("sender_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
