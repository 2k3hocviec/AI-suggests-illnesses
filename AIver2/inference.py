"""Inference helpers for a specialty-aware medical NER model."""

from transformers import AutoModelForTokenClassification, AutoTokenizer, pipeline  # type: ignore

from specialty_labels import SPECIALTY_CODES


MODEL_PATH = "./output/medical-ner-model"
MIN_CONFIDENCE = 0.7


def load_ner_pipeline(model_path: str = MODEL_PATH):
    """Load the trained token classification model once at application start."""
    tokenizer = AutoTokenizer.from_pretrained(model_path)
    model = AutoModelForTokenClassification.from_pretrained(model_path)
    return pipeline(
        "ner",
        model=model,
        tokenizer=tokenizer,
        aggregation_strategy="simple",
    )


def _specialty_code(entity_group: str, symptom: str) -> str | None:
    if entity_group in SPECIALTY_CODES:
        return entity_group
    return None


# Lõi kiểm tra các phần tử trong model
def extract_specialty_symptoms(
    text: str, ner_pipeline, minimum_confidence: float = MIN_CONFIDENCE
) -> list[dict]:
    """Return each detected symptom together with the model specialty label."""
    results = []
    for entity in ner_pipeline(text): # Model tìm tất cả entity trong text
        score = float(entity["score"]) # Model tìm tất cả entity trong text
        symptom = entity["word"].strip() # Tên triệu chứng tìm được

        # Tên triệu chứng tìm được
        code = _specialty_code(entity["entity_group"], symptom)
        if code and score >= minimum_confidence:
            results.append(
                {
                    "name": symptom,
                    "confidence": score,
                    "specialty_code": code,
                }
            )
    return results


def extract_symptoms(text: str, ner_pipeline) -> list[str]:
    """Compatibility helper for callers that only need symptom strings."""
    return [item["name"] for item in extract_specialty_symptoms(text, ner_pipeline)]


def predict(user_input: str, ner_pipeline) -> dict:
    detected = extract_specialty_symptoms(user_input, ner_pipeline)
    specialty_codes: list[str] = []

    for item in detected:
        code = item["specialty_code"]
        if code not in specialty_codes:
            specialty_codes.append(code)

    message = (
        f"Tìm thấy {len(detected)} triệu chứng và {len(specialty_codes)} chuyên khoa phù hợp."
        if detected
        else "Không tìm thấy triệu chứng có độ tin cậy đủ cao."
    )
    return {
        "symptoms": detected,
        "specialties": specialty_codes,
        "message": message,
    }


if __name__ == "__main__":
    ner = load_ner_pipeline()
    while True:
        text = input("Nhap van ban cua ban (exit de dung): ").strip()
        if text.lower() in {"exit", "quit", ""}:
            break
        print(predict(text, ner))
