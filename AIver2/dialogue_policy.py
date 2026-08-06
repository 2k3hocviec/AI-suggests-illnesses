"""Local dialogue-policy model and inference helpers.

The policy model chooses a safe next action and a missing clinical field.
It does not generate diagnoses, medical advice or hidden chain-of-thought.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import torch
from torch import nn
from transformers import AutoTokenizer  # type: ignore

from multitask_model import MultiTaskRobertaForTokenAndIntentClassification
from policy_labels import ACTION_CODES, FIELD_CODES, ID2ACTION, ID2FIELD


MAX_LENGTH = 256


class DialoguePolicyModel(nn.Module):
    """PhoBERT encoder with action and missing-field classification heads."""

    def __init__(self, encoder: nn.Module, hidden_size: int):
        super().__init__()
        self.encoder = encoder
        self.dropout = nn.Dropout(0.1)
        self.action_classifier = nn.Linear(hidden_size, len(ACTION_CODES))
        self.field_classifier = nn.Linear(hidden_size, len(FIELD_CODES))

    def forward(
        self,
        input_ids: torch.Tensor,
        attention_mask: torch.Tensor,
    ) -> tuple[torch.Tensor, torch.Tensor]:
        outputs = self.encoder(
            input_ids=input_ids,
            attention_mask=attention_mask,
            return_dict=True,
        )
        pooled = self.dropout(outputs.last_hidden_state[:, 0, :])
        return self.action_classifier(pooled), self.field_classifier(pooled)


@dataclass
class DialoguePolicyBundle:
    tokenizer: Any
    model: DialoguePolicyModel
    device: torch.device


def _slot_present(slots: dict[str, Any], field: str) -> bool:
    value = slots.get(field)
    if value is None:
        return False
    if isinstance(value, dict):
        return bool(str(value.get("text", "")).strip())
    return bool(str(value).strip())


def _compact_analysis(analysis: dict[str, Any]) -> dict[str, Any]:
    slots = analysis.get("slots")
    if isinstance(slots, dict):
        normalized_slots = slots
    else:
        normalized_slots = {
            field: analysis.get(field)
            for field in ("duration", "severity", "age")
        }
    symptoms = analysis.get("symptoms")
    symptoms = symptoms if isinstance(symptoms, list) else []
    red_flags = analysis.get("redFlags")
    red_flags = red_flags if isinstance(red_flags, list) else []
    missing_fields = analysis.get("missingFields")
    missing_fields = missing_fields if isinstance(missing_fields, list) else []

    return {
        "intent": analysis.get("intent", "UNKNOWN"),
        "action": analysis.get("action", "CLARIFY"),
        "symptoms": [
            item.get("name", "") if isinstance(item, dict) else str(item)
            for item in symptoms
            if (item.get("name") if isinstance(item, dict) else str(item)).strip()
        ],
        "specialties": analysis.get("specialties", []),
        "slotsPresent": {
            field: _slot_present(normalized_slots, field)
            for field in ("duration", "severity", "age")
        },
        "redFlags": [
            item.get("code", "") if isinstance(item, dict) else str(item)
            for item in red_flags
            if (item.get("code") if isinstance(item, dict) else str(item)).strip()
        ],
        "missingFields": [str(field) for field in missing_fields],
        "readyForRecommendation": bool(
            analysis.get("readyForRecommendation", False)
        ),
    }


def serialize_policy_input(
    message: str,
    history: list[dict[str, str]] | None,
    analysis: dict[str, Any],
) -> str:
    """Create the bounded text input shared by training and serving."""

    # Do not discard the conversation at an arbitrary six-message boundary.
    # The complete history is passed in by the backend. The tokenizer still
    # enforces PhoBERT's finite context window, while the structured FACTS
    # block remains authoritative for the latest clinical state.
    full_history = history or []
    lines = ["NHIỆM VỤ: chọn bước tiếp theo cho hội thoại tư vấn sức khỏe."]
    lines.append("Không chẩn đoán bệnh, không đưa hướng dẫn điều trị.")
    lines.append("LỊCH SỬ:")
    for item in full_history:
        role = str(item.get("role", "USER")).upper()
        content = str(item.get("content", "")).strip()[:500]
        if content:
            lines.append(f"{role}: {content}")
    if not full_history or full_history[-1].get("content") != message:
        lines.append(f"USER: {message.strip()[:500]}")
    lines.append(
        "FACTS: "
        + json.dumps(_compact_analysis(analysis), ensure_ascii=False, sort_keys=True)
    )
    return "\n".join(lines)


def load_policy_bundle(
    policy_path: str | Path,
    base_model_path: str | Path,
) -> DialoguePolicyBundle | None:
    policy_dir = Path(policy_path)
    checkpoint_path = policy_dir / "policy_model.pt"
    if not checkpoint_path.exists():
        return None

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    base = MultiTaskRobertaForTokenAndIntentClassification.from_pretrained(
        str(base_model_path)
    )
    model = DialoguePolicyModel(base.roberta, int(base.config.hidden_size))
    checkpoint = torch.load(checkpoint_path, map_location=device)
    state_dict = checkpoint.get("model", checkpoint) if isinstance(checkpoint, dict) else checkpoint
    model.load_state_dict(state_dict)
    model.to(device)
    model.eval()

    tokenizer_path = policy_dir if (policy_dir / "tokenizer_config.json").exists() else Path(base_model_path)
    tokenizer = AutoTokenizer.from_pretrained(str(tokenizer_path))
    return DialoguePolicyBundle(tokenizer=tokenizer, model=model, device=device)


def predict_policy(
    message: str,
    history: list[dict[str, str]],
    analysis: dict[str, Any],
    bundle: DialoguePolicyBundle,
) -> dict[str, Any]:
    # Emergency handling remains deterministic and authoritative at the API
    # boundary as an additional safeguard.
    compact = _compact_analysis(analysis)
    if compact["redFlags"]:
        return {
            "nextAction": "EMERGENCY",
            "field": "NONE",
            "confidence": 1.0,
            "source": "RULE",
        }

    # The clinical readiness gate is authoritative.  The classifier may help
    # with ordinary conversation, but it must not suppress a required clinical
    # follow-up question when a symptom is present and a field is missing.
    missing_fields = [
        field
        for field in compact["missingFields"]
        if field in {"duration", "severity", "age"}
    ]
    if compact["symptoms"] and missing_fields:
        field = missing_fields[0]
        return {
            "nextAction": "ASK_FOLLOW_UP",
            "field": field,
            "confidence": 1.0,
            "source": "RULE",
        }

    # Once the backend has validated that the latest clinical snapshot is
    # complete, do not let a long history or an uncertain classifier suppress
    # the doctor-recommendation step.
    if compact["symptoms"] and compact["readyForRecommendation"]:
        return {
            "nextAction": "FIND_DOCTORS",
            "field": "NONE",
            "confidence": 1.0,
            "source": "RULE",
        }

    encoded = bundle.tokenizer(
        serialize_policy_input(message, history, analysis),
        return_tensors="pt",
        truncation=True,
        max_length=MAX_LENGTH,
    )
    encoded = {key: value.to(bundle.device) for key, value in encoded.items()}

    with torch.no_grad():
        action_logits, field_logits = bundle.model(
            input_ids=encoded["input_ids"],
            attention_mask=encoded["attention_mask"],
        )

    action_probabilities = torch.softmax(action_logits[0], dim=-1)
    field_probabilities = torch.softmax(field_logits[0], dim=-1)
    action_id = int(torch.argmax(action_probabilities).item())
    field_id = int(torch.argmax(field_probabilities).item())
    action = ID2ACTION[action_id]
    field = ID2FIELD[field_id] if action == "ASK_FOLLOW_UP" else "NONE"
    confidence = min(
        float(action_probabilities[action_id].item()),
        float(field_probabilities[field_id].item())
        if action == "ASK_FOLLOW_UP"
        else 1.0,
    )
    return {
        "nextAction": action,
        "field": field,
        "confidence": max(0.0, min(1.0, confidence)),
        "source": "MODEL",
    }
