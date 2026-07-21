"""Intent labels shared by the multi-task training and inference code."""

from __future__ import annotations

INTENT_CODES = (
    "SYMPTOM",
    "GREETING",
    "THANKS",
    "GOODBYE",
    "UNKNOWN",
)

INTENT2ID = {label: index for index, label in enumerate(INTENT_CODES)}
ID2INTENT = {index: label for label, index in INTENT2ID.items()}

CONVERSATION_INTENTS = frozenset({"GREETING", "THANKS", "GOODBYE"})


def validate_intent(intent: str) -> str:
    if intent not in INTENT2ID:
        valid = ", ".join(INTENT_CODES)
        raise ValueError(f"Unknown intent '{intent}'. Use one of: {valid}")
    return intent
