"""FastAPI service for extracting symptoms and their specialty labels."""

import os
import re
import unicodedata
from pathlib import Path

from fastapi import FastAPI, HTTPException  # type: ignore
from fastapi.middleware.cors import CORSMiddleware  # type: ignore
from pydantic import BaseModel  # type: ignore
from transformers import pipeline  # type: ignore

from inference import extract_specialty_symptoms


# Sử dụng đường dẫn tuyệt đối để đảm bảo load được model từ bất kỳ đâu
MODEL_PATH = str(Path(__file__).parent / "output" / "medical-ner-model")
PORT = 5678

app = FastAPI(title="Medical Specialty NER API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ner_pipeline = None


class SymptomRequest(BaseModel):
    text: str


class DetectedSymptom(BaseModel):
    name: str
    confidence: float
    specialty_code: str


class SymptomResponse(BaseModel):
    symptoms: list[DetectedSymptom]
    specialties: list[str]
    message: str


def normalize_text(text: str) -> str:
    """Normalize Vietnamese user input for simple conversational intent matching."""
    text_without_accents = "".join(
        char
        for char in unicodedata.normalize("NFD", text.casefold())
        if unicodedata.category(char) != "Mn"
    )
    text_without_accents = text_without_accents.replace("đ", "d")
    return re.sub(r"[^a-z0-9\s]", " ", text_without_accents).strip()


def conversational_reply(text: str) -> str | None:
    """Return replies for small talk only when the full message matches an intent."""
    normalized = " ".join(normalize_text(text).split())
    intent_replies = {
        "greeting": (
            {
                "chao",
                "chao ban",
                "xin chao",
                "xin chao ban",
                "hello",
                "hi",
                "hey",
                "alo",
            },
            "Xin chào! Tôi có thể giúp bạn gợi ý chuyên khoa dựa trên triệu chứng. "
            "Bạn đang gặp triệu chứng gì?",
        ),
        "thanks": (
            {"cam on", "cam on ban", "thank you", "thanks"},
            "Rất vui được hỗ trợ bạn. Khi cần, bạn hãy mô tả triệu chứng để tôi "
            "gợi ý chuyên khoa phù hợp.",
        ),
        "help": (
            {
                "ban lam duoc gi",
                "ban co the lam gi",
                "toi can giup do",
                "huong dan",
                "tro giup",
                "help",
            },
            "Tôi hỗ trợ gợi ý chuyên khoa từ triệu chứng bạn mô tả, ví dụ: "
            "\"Tôi bị đau ngực và khó thở\". Kết quả chỉ mang tính tham khảo, "
            "không thay thế chẩn đoán của bác sĩ.",
        ),
        "goodbye": (
            {"tam biet", "chao tam biet", "bye", "goodbye"},
            "Tạm biệt! Chúc bạn nhiều sức khỏe.",
        ),
    }

    for phrases, reply in intent_replies.values():
        if normalized in phrases:
            return reply
    return None


@app.on_event("startup")
async def load_model():
    """Load the NER model once when the AI service starts."""
    global ner_pipeline

    print(f"[AI Service] Đang load model từ: {MODEL_PATH}")

    if not os.path.exists(MODEL_PATH):
        print(f"[AI Service] ❌ Model không tìm thấy tại: {MODEL_PATH}")
        print(f"[AI Service] Các file hiện tại: {os.listdir(os.path.dirname(MODEL_PATH)) if os.path.exists(os.path.dirname(MODEL_PATH)) else 'Folder không tồn tại'}")
        return

    try:
        ner_pipeline = pipeline(
            "ner",
            model=MODEL_PATH,
            tokenizer=MODEL_PATH,
            aggregation_strategy="simple",
        )
        print(f"[AI Service] ✅ Model đã load thành công từ: {MODEL_PATH}")
    except FileNotFoundError as e:
        print(f"[AI Service] ❌ Lỗi: File không tìm thấy - {e}")
    except Exception as error:
        print(f"[AI Service] ❌ Lỗi load model: {type(error).__name__}: {error}")
        import traceback
        traceback.print_exc()


@app.get("/health")
async def health_check():
    """Check if the service and model are ready."""
    return {
        "status": "ok" if ner_pipeline else "degraded",
        "model_loaded": ner_pipeline is not None,
        "model_path": MODEL_PATH,
        "model_exists": os.path.exists(MODEL_PATH),
    }


@app.post("/api/extract-symptoms", response_model=SymptomResponse)
async def extract_symptoms(request: SymptomRequest):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text khong duoc trong")

    reply = conversational_reply(request.text)
    if reply:
        return SymptomResponse(symptoms=[], specialties=[], message=reply)

    if not ner_pipeline:
        raise HTTPException(status_code=503, detail="Model chua load")

    detected = extract_specialty_symptoms(request.text, ner_pipeline)
    symptoms = [
        DetectedSymptom(
            name=item["name"],
            confidence=item["confidence"],
            specialty_code=item["specialty_code"],
        )
        for item in detected
    ]

    specialty_codes: list[str] = []
    for symptom in symptoms:
        if symptom.specialty_code not in specialty_codes:
            specialty_codes.append(symptom.specialty_code)

    message = (
        f"Tìm thấy {len(symptoms)} triệu chứng và {len(specialty_codes)} chuyên khoa phù hợp."
        if symptoms
        else (
            "Không tìm thấy triệu chứng có độ tin cậy đủ cao. "
            "Bạn hãy mô tả rõ hơn, ví dụ: \"Tôi bị đau đầu và sốt cao\"."
        )
    )
    return SymptomResponse(
        symptoms=symptoms,
        specialties=specialty_codes,
        message=message,
    )


if __name__ == "__main__":
    import uvicorn  # type: ignore

    uvicorn.run(app, host="0.0.0.0", port=PORT)
