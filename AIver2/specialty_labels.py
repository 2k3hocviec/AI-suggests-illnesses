"""Shared specialty labels for the specialty-aware NER model."""

from __future__ import annotations

SPECIALTY_CODES = (
    "GENERAL_MEDICINE",
    "CARDIOLOGY",
    "RESPIRATORY",
    "PEDIATRICS",
    "DERMATOLOGY",
    "NEUROLOGY",
    "ENT",
    "OB_GYN",
    "ORTHOPEDICS",
    "OPHTHALMOLOGY",
    "GASTROENTEROLOGY",
    "DENTISTRY",
    "UROLOGY",
    "ENDOCRINOLOGY",
    "PSYCHIATRY",
    "ONCOLOGY",
    "EMERGENCY",
)

def build_label_maps() -> tuple[dict[str, int], dict[int, str]]:
    labels = ["O"]
    for code in SPECIALTY_CODES:
        labels.extend([f"B-{code}", f"I-{code}"])
    label2id = {label: index for index, label in enumerate(labels)}
    return label2id, {index: label for label, index in label2id.items()}


LABEL2ID, ID2LABEL = build_label_maps()


def validate_specialty_code(code: str) -> str:
    if code not in SPECIALTY_CODES:
        valid = ", ".join(SPECIALTY_CODES)
        raise ValueError(f"Unknown specialty label '{code}'. Use one of: {valid}")
    return code

