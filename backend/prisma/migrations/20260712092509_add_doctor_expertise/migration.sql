-- CreateTable
CREATE TABLE "doctor_expertise" (
    "doctor_id" INTEGER NOT NULL,
    "symptom_id" INTEGER NOT NULL,
    "expertise_score" DECIMAL(4,3) NOT NULL DEFAULT 1.0,

    CONSTRAINT "doctor_expertise_pkey" PRIMARY KEY ("doctor_id","symptom_id")
);

-- AddForeignKey
ALTER TABLE "doctor_expertise" ADD CONSTRAINT "doctor_expertise_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_expertise" ADD CONSTRAINT "doctor_expertise_symptom_id_fkey" FOREIGN KEY ("symptom_id") REFERENCES "symptoms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
