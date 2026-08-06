"""Labels shared by the dialogue-policy dataset, trainer and API."""

from __future__ import annotations

ACTION_CODES = (
    "ASK_FOLLOW_UP",
    "FIND_DOCTORS",
    "EMERGENCY",
    "REPLY",
    "CLARIFY",
)

FIELD_CODES = ("NONE", "duration", "severity", "age")

ACTION2ID = {value: index for index, value in enumerate(ACTION_CODES)}
ID2ACTION = {index: value for value, index in ACTION2ID.items()}
FIELD2ID = {value: index for index, value in enumerate(FIELD_CODES)}
ID2FIELD = {index: value for value, index in FIELD2ID.items()}


def validate_action(value: str) -> str:
    if value not in ACTION2ID:
        raise ValueError(f"Unknown dialogue action: {value}")
    return value


def validate_field(value: str) -> str:
    if value not in FIELD2ID:
        raise ValueError(f"Unknown dialogue field: {value}")
    return value
