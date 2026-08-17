"""FastAPI service for multi-task medical NER and sentence-intent inference."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Literal

import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("ai-service")

os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

from fastapi import FastAPI, HTTPException  # type: ignore
from fastapi.middleware.cors import CORSMiddleware  # type: ignore
from pydantic import BaseModel, Field  # type: ignore

from dialogue_policy import DialoguePolicyBundle, load_policy_bundle, predict_policy
from inference import InferenceBundle, load_multitask_model, predict
from question_generator import (
    QuestionGeneratorBundle,
    generate_follow_up_question,
    load_question_generator,
)


CLINICAL_MODEL_PATH = Path(__file__).parent / "output" / "medical-clinical-slots-model"
DEFAULT_MODEL_PATH = str(CLINICAL_MODEL_PATH)
MODEL_PATH = os.getenv("MODEL_PATH", DEFAULT_MODEL_PATH)
PORT = int(os.getenv("PORT", "5678"))
POLICY_MODEL_PATH = os.getenv(
    "POLICY_MODEL_PATH",
    str(Path(__file__).parent / "output" / "dialogue-policy"),
)
QUESTION_GENERATOR_PATH = os.getenv(
    "QUESTION_GENERATOR_PATH",
    str(Path(__file__).parent / "output" / "question-generator"),
)

app = FastAPI(title="Medical Multi-task NER and Intent API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

inference_bundle: InferenceBundle | None = None
policy_bundle: DialoguePolicyBundle | None = None
question_generator_bundle: QuestionGeneratorBundle | None = None


# Kiểm tra đường dẫn đến model.
def is_local_model_path(model_path: str) -> bool:
    """Return True for filesystem paths, False for Hugging Face repo ids."""

    return (
        os.path.isabs(model_path)
        or model_path.startswith((".", "\\"))
        or ":" in model_path
    )


# Mô tả dữ liệu mà backend gửi vào API trích xuấy triệu chứng.
class SymptomRequest(BaseModel):
    text: str


# Schema lưu thông tin triệu chứng mà model nhận diện được: "tôi bị đau bụng"
class DetectedSymptom(BaseModel):
    name: str
    confidence: float
    specialty_code: str


# Schema lưu thông tin khi người dùng nhập ngày: "2 ngày trước"
class ClinicalSlot(BaseModel):
    text: str
    value: float | int | None = None
    unit: Literal["HOUR", "DAY", "WEEK", "MONTH", "YEAR"] | None = None
    confidence: float | None = None


# Các thông tin cần thi thập thêm khi người dùng mô tả triệu chứng ví dụ "tôi bị đau bụng"
class ClinicalSlots(BaseModel):
    duration: ClinicalSlot | None = None
    severity: ClinicalSlot | None = None
    age: ClinicalSlot | None = None


# Lưu một vài mẫu dấu hiệu nguy nhiểm EMERGENCY mà model phát hiện được.
class RedFlagSignal(BaseModel):
    code: Literal[
        "BREATHING_DIFFICULTY",
        "CHEST_PAIN",
        "SYNCOPE",
        "FOCAL_WEAKNESS",
        "ABNORMAL_BLEEDING",
    ]
    text: str
    confidence: float


# Định dạng kết quả trả về của API /api/extract-symptoms.
class SymptomResponse(BaseModel):
    symptoms: list[DetectedSymptom]
    specialties: list[str]
    intent: Literal["SYMPTOM", "GREETING", "THANKS", "GOODBYE", "UNKNOWN"]
    action: Literal["FIND_DOCTORS", "REPLY", "CLARIFY"]
    slots: ClinicalSlots
    redFlags: list[RedFlagSignal]


class PolicyHistoryItem(BaseModel):
    role: Literal["USER", "ASSISTANT", "SYSTEM"]
    content: str = Field(min_length=1)


class PolicyRequest(BaseModel):
    history: list[PolicyHistoryItem] = Field(default_factory=list)


CLINICAL_FIELDS = ("duration", "severity", "age")

# Lựa chọn câu trả lời hỏi trường còn thiếu
def _follow_up_question(field: str) -> str | None:
    questions = {
        "duration": (
            "Các triệu chứng xuất hiện từ khi nào? Ví dụ: sáng nay, hôm qua, "
            "2 ngày trước."
        ),
        "severity": (
            "Mức độ đau hoặc khó chịu hiện tại ra sao? Ví dụ: nhẹ, vừa phải, "
            "nặng hoặc dữ dội."
        ),
        "age": "Người bệnh bao nhiêu tuổi?",
    }
    return questions.get(field)


# Sinh câu hỏi bằng mT5
def _generated_follow_up_question(
    field: str,
    analysis: dict,
    history: list[dict[str, str]],
) -> str | None:
    """Use T5 when available; never let a failed generation block the API."""

    fallback = _follow_up_question(field)

    if question_generator_bundle is None:
        logger.info("followup source=TEMPLATE field=%s reason=no_model_loaded", field)
        return fallback

    try:
        generated = generate_follow_up_question(
            field, analysis, history, question_generator_bundle,
        )
    except Exception as error:
        logger.error(
            "followup source=TEMPLATE field=%s reason=exception error=%s: %s",
            field, type(error).__name__, error,
        )
        return fallback

    if generated:
        logger.info("followup source=MODEL field=%s question=%r", field, generated)
        return generated

    logger.info("followup source=TEMPLATE field=%s reason=model_rejected", field)
    return fallback


# Xây dựng lại câu trả lời duy nhất trả về dạng json cho model. 
def _merge_history_analyses(analyses: list[dict]) -> dict:
    if not analyses:
        return {
            "symptoms": [],
            "specialties": [],
            "intent": "UNKNOWN",
            "action": "CLARIFY",
            "slots": {field: None for field in CLINICAL_FIELDS},
            "redFlags": [],
        }

    merged = analyses[0]
    for current in analyses[1:]:
        current_symptoms = current.get("symptoms") or []
        symptoms = current_symptoms or (merged.get("symptoms") or [])

        red_flags: list[dict] = []
        for item in [*(merged.get("redFlags") or []), *(current.get("redFlags") or [])]:
            code = item.get("code") if isinstance(item, dict) else None
            if code and not any(existing.get("code") == code for existing in red_flags):
                red_flags.append(item)

        current_slots = current.get("slots") or {}
        previous_slots = merged.get("slots") or {}
        slots = {
            field: current_slots.get(field) or previous_slots.get(field)
            for field in CLINICAL_FIELDS
        }

        merged = {
            **current,
            "symptoms": symptoms,
            "slots": slots,
            "redFlags": red_flags,
            "intent": "SYMPTOM" if symptoms or red_flags else current.get("intent", "UNKNOWN"),
        }

    symptoms = merged.get("symptoms") or []
    red_flags = merged.get("redFlags") or []
    slots = merged.get("slots") or {field: None for field in CLINICAL_FIELDS}
    specialties = list(
        dict.fromkeys(
            [
                *(item.get("specialty_code") for item in symptoms if isinstance(item, dict)),
                *( ["EMERGENCY"] if red_flags else [] ),
            ]
        )
    )
    has_clinical_evidence = bool(symptoms or red_flags)
    missing_fields = (
        []
        if red_flags
        else [field for field in CLINICAL_FIELDS if slots.get(field) is None]
        if symptoms
        else []
    )

    return {
        "symptoms": symptoms,
        "specialties": specialties,
        "intent": "SYMPTOM" if has_clinical_evidence else merged.get("intent", "UNKNOWN"),
        "action": "CLARIFY" if has_clinical_evidence else merged.get("action", "CLARIFY"),
        "slots": slots,
        "redFlags": red_flags,
        "missingFields": missing_fields,
        "followUpQuestion": _follow_up_question(missing_fields[0]) if missing_fields else None,
        "readyForRecommendation": has_clinical_evidence and not missing_fields,
        "analysisSource": "NER",
    }


# Phân tích lịch sử đoạn chat điều phối toàn bộ quá trình phân tích hội thoại trong AI service.
def _analyze_history(
    history: list[dict[str, str]],
    inference: InferenceBundle,
    policy: DialoguePolicyBundle,
) -> dict:
    user_messages = [
        str(item.get("content", "")).strip()
        for item in history
        if item.get("role") == "USER" and str(item.get("content", "")).strip()
    ]
    if not user_messages:
        raise HTTPException(status_code=400, detail="History phai co tin nhan USER")

    per_message_analyses = [predict(message, inference) for message in user_messages]
    # Lấy lịch sử đoạn chat phân tích.
    analysis = _merge_history_analyses(per_message_analyses)
    # Dùng model dự đoán hành động tiếp theo.
    decision = predict_policy(user_messages[-1], history, analysis, policy)
    next_action = str(decision.get("nextAction", "CLARIFY"))
    field = str(decision.get("field", "NONE"))
    confidence = decision.get("confidence", 0.0)

    # Rào chắn logic (Guardrail) để sửa lỗi dự đoán sai của model
    missing_fields = analysis.get("missingFields", [])
    if next_action == "ASK_FOLLOW_UP" and not missing_fields:
        # Nếu tất cả các trường đã được điền đầy đủ, bắt buộc chuyển sang FIND_DOCTORS
        next_action = "FIND_DOCTORS"
        field = "NONE"
        logger.info("Guardrail override: all fields filled, forcing FIND_DOCTORS")
    elif next_action == "ASK_FOLLOW_UP" and field not in missing_fields:
        # Nếu model muốn hỏi một trường đã có dữ liệu, chuyển sang hỏi trường thực sự còn thiếu
        if missing_fields:
            field = missing_fields[0]
            logger.info("Guardrail override: field %s already filled, redirecting to %s", decision.get("field"), field)
        else:
            next_action = "FIND_DOCTORS"
            field = "NONE"
            logger.info("Guardrail override: forcing FIND_DOCTORS since no fields are missing")

    logger.info(
        "policy decision nextAction=%s field=%s confidence=%.3f (final action=%s field=%s)",
        decision.get("nextAction"), decision.get("field"), confidence, next_action, field
    )

    if next_action == "ASK_FOLLOW_UP":
        analysis["action"] = "CLARIFY"
        analysis["readyForRecommendation"] = False
        analysis["followUpQuestion"] = _generated_follow_up_question(
            field,
            analysis,
            history,
        )
    elif next_action == "FIND_DOCTORS":
        analysis["action"] = "FIND_DOCTORS"
        analysis["readyForRecommendation"] = bool(
            analysis["symptoms"] or analysis["redFlags"]
        )
        analysis["followUpQuestion"] = None
    elif next_action == "REPLY":
        analysis["action"] = "REPLY"
        analysis["readyForRecommendation"] = False
        analysis["followUpQuestion"] = None
    elif next_action == "EMERGENCY":
        analysis["action"] = "FIND_DOCTORS"
        analysis["readyForRecommendation"] = bool(analysis["redFlags"])
        analysis["followUpQuestion"] = None
    else:
        analysis["action"] = "CLARIFY"
        analysis["readyForRecommendation"] = False

    return {
        **analysis,
        "nextAction": next_action,
        "field": field,
        "confidence": decision.get("confidence", 0.0),
        "source": decision.get("source", "MODEL"),
    }


# Khời động toàn bộ model service AI.
@app.on_event("startup")
async def load_model():
    """Load the multi-task checkpoint once when the service starts."""

    global inference_bundle, policy_bundle, question_generator_bundle
    print(f"[AI Service] Loading multi-task model from: {MODEL_PATH}")

    if is_local_model_path(MODEL_PATH) and not os.path.exists(MODEL_PATH):
        parent = os.path.dirname(MODEL_PATH)
        files = os.listdir(parent) if os.path.exists(parent) else "folder not found"
        print(f"[AI Service] Model not found at: {MODEL_PATH}")
        print(f"[AI Service] Current files: {files}")
        return

    try:
        inference_bundle = load_multitask_model(MODEL_PATH)
        print(f"[AI Service] Multi-task model loaded from: {MODEL_PATH}")
    except Exception as error:
        inference_bundle = None
        print(f"[AI Service] Model load error: {type(error).__name__}: {error}")
        import traceback

        traceback.print_exc()

    try:
        policy_bundle = load_policy_bundle(POLICY_MODEL_PATH, MODEL_PATH)
        if policy_bundle:
            print(f"[AI Service] Dialogue policy loaded from: {POLICY_MODEL_PATH}")
        else:
            print(f"[AI Service] Dialogue policy not found at: {POLICY_MODEL_PATH}")
    except Exception as error:
        policy_bundle = None
        print(f"[AI Service] Dialogue policy load error: {type(error).__name__}: {error}")

    try:
        question_generator_bundle = load_question_generator(QUESTION_GENERATOR_PATH)
        if question_generator_bundle:
            print(
                "[AI Service] T5 question generator loaded from: "
                f"{QUESTION_GENERATOR_PATH}"
            )
        else:
            print(
                "[AI Service] T5 question generator not found; "
                "using fixed-question fallback"
            )
    except Exception as error:
        question_generator_bundle = None
        print(f"[AI Service] Question generator load error: {type(error).__name__}: {error}")



# Check model.
@app.get("/health")
async def health_check():
    """Check whether the multi-task model is ready."""

    return {
        "status": "ok" if inference_bundle else "degraded",
        "model_loaded": inference_bundle is not None,
        "model_path": MODEL_PATH,
        "model_source": "local" if is_local_model_path(MODEL_PATH) else "huggingface",
        "model_exists": os.path.exists(MODEL_PATH) if is_local_model_path(MODEL_PATH) else None,
        "policy_model_loaded": policy_bundle is not None,
        "policy_model_path": POLICY_MODEL_PATH,
        "question_generator_loaded": question_generator_bundle is not None,
        "question_generator_path": QUESTION_GENERATOR_PATH,
    }


# Dùng cho admin test kết quả model NER phân tích được
@app.post("/api/extract-symptoms", response_model=SymptomResponse)
async def extract_symptoms(request: SymptomRequest):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text khong duoc trong")
    if inference_bundle is None:
        raise HTTPException(status_code=503, detail="Multi-task model chua load")

    return SymptomResponse(**predict(request.text, inference_bundle))


# API chính dùng toàn bộ đồ án.
# Model nhận tin nhắn và kết hợp toàn bộ lịch sử đoạn:
#   - Phân tích tin nhắn hiện tại và lịch sử đoạn chat thành các trường thông tin:
#   - Vi dụ:
#        + Đầu vào: 
#           {
#               "history": [
#                   {
#                       "role": "USER",
#                       "content": "Tôi bị đau bụng"
#                   },
#                   {
#                       "role": "ASSISTANT",
#                       "content": "Các triệu chứng xuất hiện từ khi nào?"
#                   },
#                   {
#                       "role": "USER",
#                       "content": "Sáng hôm nay"
#                   }
#               ]
#           }
#       + Đầu ra: 
#           {
#               "symptoms": [
#                   {
#                       "name": "đau bụng",
#                       "confidence": 0.999,
#                       "specialty_code": "GASTROENTEROLOGY"
#                   }
#               ],
#               "specialties": [
#                   "GASTROENTEROLOGY"
#               ],
#               "intent": "SYMPTOM",
#               "action": "CLARIFY",
#               "slots": {
#                   "duration": {
#                       "text": "Sáng hôm nay",
#                       "value": 0,
#                       "unit": "DAY",
#                       "confidence": 0.95
#                   },
#                   "severity": null,
#                   "age": null
#               },
#               "redFlags": [],
#               "missingFields": [
#                   "severity",
#                   "age"
#               ],
#               "followUpQuestion": "Mức độ đau hoặc khó chịu hiện tại ra sao?",
#               "readyForRecommendation": false,
#               "nextAction": "ASK_FOLLOW_UP",
#               "field": "severity",
#               "confidence": 0.82,
#               "source": "MODEL",
#               "analysisSource": "NER"
#           }

@app.post("/api/decide-next")
async def decide_next(request: PolicyRequest):
    if inference_bundle is None:
        raise HTTPException(status_code=503, detail="Multi-task model chua load")
    if policy_bundle is None:
        raise HTTPException(status_code=503, detail="Dialogue policy chua load")

    history = [item.model_dump() for item in request.history]
    return _analyze_history(history, inference_bundle, policy_bundle)


if __name__ == "__main__":
    import uvicorn  # type: ignore

    uvicorn.run(app, host="0.0.0.0", port=PORT)
