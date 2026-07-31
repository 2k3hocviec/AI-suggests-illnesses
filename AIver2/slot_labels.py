"""Labels for clinical slot extraction and emergency-risk classification."""

from __future__ import annotations

SLOT_LABELS = [
    "O",
    "B-DURATION",
    "I-DURATION",
    "B-SEVERITY",
    "I-SEVERITY",
    "B-AGE",
    "I-AGE",
]

SLOT2ID = {label: index for index, label in enumerate(SLOT_LABELS)}
ID2SLOT = {index: label for label, index in SLOT2ID.items()}

RED_FLAG_CODES = [
    "BREATHING_DIFFICULTY",
    "CHEST_PAIN",
    "SYNCOPE",
    "FOCAL_WEAKNESS",
    "ABNORMAL_BLEEDING",
]

RED_FLAG2ID = {code: index for index, code in enumerate(RED_FLAG_CODES)}
ID2RED_FLAG = {index: code for code, index in RED_FLAG2ID.items()}


def validate_slot_label(label: str) -> None:
    if label not in {"DURATION", "SEVERITY", "AGE"} and label not in SLOT2ID:
        raise ValueError(f"Unknown slot label: {label}")


def validate_red_flag_code(code: str) -> None:
    if code not in RED_FLAG2ID:
        raise ValueError(f"Unknown red flag code: {code}")
