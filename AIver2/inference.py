"""Inference for the shared PhoBERT NER and sentence-intent model."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path

import torch
from transformers import AutoTokenizer  # type: ignore

from intent_labels import CONVERSATION_INTENTS, ID2INTENT
from multitask_model import MultiTaskRobertaForTokenAndIntentClassification
from specialty_labels import ID2LABEL, SPECIALTY_CODES


DEFAULT_MODEL_PATH = str(Path(__file__).parent / "output" / "medical-multitask-model")
MODEL_PATH = os.getenv("MODEL_PATH", DEFAULT_MODEL_PATH)
NER_MIN_CONFIDENCE = float(os.getenv("NER_MIN_CONFIDENCE", "0.7"))
INTENT_MIN_CONFIDENCE = float(os.getenv("INTENT_MIN_CONFIDENCE", "0.6"))
MAX_LENGTH = 128


@dataclass
class InferenceBundle:
    tokenizer: object
    model: MultiTaskRobertaForTokenAndIntentClassification
    device: torch.device


def load_multitask_model(model_path: str = MODEL_PATH) -> InferenceBundle:
    """Load the multi-task checkpoint once at service startup."""

    device = torch.device(os.getenv("DEVICE", "cpu"))
    tokenizer = AutoTokenizer.from_pretrained(model_path)
    model = MultiTaskRobertaForTokenAndIntentClassification.from_pretrained(model_path)
    model.to(device)
    model.eval()
    return InferenceBundle(tokenizer=tokenizer, model=model, device=device)


def _specialty_code(entity_group: str) -> str | None:
    return entity_group if entity_group in SPECIALTY_CODES else None


def _finish_entity(current: dict | None, results: list[dict], tokenizer) -> None:
    if not current:
        return
    name = tokenizer.convert_tokens_to_string(current["tokens"]).strip()
    code = _specialty_code(current["label"])
    if not name or not code:
        return
    results.append(
        {
            "name": name,
            "confidence": float(sum(current["scores"]) / len(current["scores"])),
            "specialty_code": code,
        }
    )


def _decode_entities(
    input_ids: torch.Tensor,
    attention_mask: torch.Tensor,
    ner_logits: torch.Tensor,
    tokenizer,
    minimum_confidence: float,
) -> list[dict]:
    """Decode B-/I- token predictions into the existing symptom contract."""

    token_ids = input_ids[0].tolist()
    active_tokens = attention_mask[0].tolist()
    token_values = tokenizer.convert_ids_to_tokens(token_ids)
    probabilities = torch.softmax(ner_logits[0], dim=-1)
    labels = torch.argmax(probabilities, dim=-1).tolist()
    special_ids = {
        token_id
        for token_id in (
            tokenizer.cls_token_id,
            tokenizer.sep_token_id,
            tokenizer.pad_token_id,
        )
        if token_id is not None
    }

    results: list[dict] = []
    current: dict | None = None
    for index, (token_id, token, active, label_id) in enumerate(
        zip(token_ids, token_values, active_tokens, labels)
    ):
        if not active or token_id in special_ids:
            _finish_entity(current, results, tokenizer)
            current = None
            continue

        label = ID2LABEL.get(int(label_id), "O")
        token_score = float(probabilities[index, label_id].item())
        if label.startswith("B-"):
            _finish_entity(current, results, tokenizer)
            current = {
                "label": label[2:],
                "tokens": [token],
                "scores": [token_score],
            }
        elif label.startswith("I-"):
            group = label[2:]
            if current and current["label"] == group:
                current["tokens"].append(token)
                current["scores"].append(token_score)
            else:
                _finish_entity(current, results, tokenizer)
                current = {"label": group, "tokens": [token], "scores": [token_score]}
        else:
            _finish_entity(current, results, tokenizer)
            current = None

    _finish_entity(current, results, tokenizer)
    return [item for item in results if item["confidence"] >= minimum_confidence]


def _empty_response(intent: str, action: str) -> dict:
    specialties = [intent] if intent in CONVERSATION_INTENTS else []
    return {
        "symptoms": [],
        "specialties": specialties,
        "intent": intent,
        "action": action,
    }


def predict(
    user_input: str,
    bundle: InferenceBundle,
    ner_min_confidence: float = NER_MIN_CONFIDENCE,
    intent_min_confidence: float = INTENT_MIN_CONFIDENCE,
) -> dict:
    """Return exactly symptoms, specialties, intent and action."""

    encoded = bundle.tokenizer(
        user_input,
        return_tensors="pt",
        truncation=True,
        max_length=MAX_LENGTH,
    )
    encoded = {key: value.to(bundle.device) for key, value in encoded.items()}

    with torch.no_grad():
        outputs = bundle.model(**encoded)

    detected = _decode_entities(
        encoded["input_ids"],
        encoded["attention_mask"],
        outputs.logits,
        bundle.tokenizer,
        ner_min_confidence,
    )

    intent_probabilities = torch.softmax(outputs.intent_logits[0], dim=-1)
    intent_id = int(torch.argmax(intent_probabilities).item())
    intent_confidence = float(intent_probabilities[intent_id].item())
    predicted_intent = ID2INTENT[intent_id]

    # A confident medical entity takes precedence over greetings embedded in
    # the same sentence, e.g. "Xin chào, tôi bị đau ngực".
    if detected:
        specialty_codes: list[str] = []
        for item in detected:
            code = item["specialty_code"]
            if code not in specialty_codes:
                specialty_codes.append(code)
        return {
            "symptoms": detected,
            "specialties": specialty_codes,
            "intent": "SYMPTOM",
            "action": "FIND_DOCTORS",
        }

    if intent_confidence >= intent_min_confidence and predicted_intent in CONVERSATION_INTENTS:
        return _empty_response(predicted_intent, "REPLY")

    return _empty_response("UNKNOWN", "CLARIFY")


def extract_symptoms(user_input: str, bundle: InferenceBundle) -> list[str]:
    """Compatibility helper for callers that only need symptom names."""

    return [item["name"] for item in predict(user_input, bundle)["symptoms"]]


if __name__ == "__main__":
    inference_bundle = load_multitask_model()
    while True:
        text = input("Nhap van ban cua ban (exit de dung): ").strip()
        if text.lower() in {"exit", "quit", ""}:
            break
        print(json.dumps(predict(text, inference_bundle), ensure_ascii=False, indent=2))
