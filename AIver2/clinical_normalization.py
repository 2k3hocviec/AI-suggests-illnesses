"""Deterministic normalization for model slots and emergency signals.

The normalizer keeps the original qualitative severity phrase instead of
inventing a numeric score or severity category.
"""

from __future__ import annotations

import re
import unicodedata
from typing import Any

from slot_labels import RED_FLAG_CODES


def normalize_text(value: str) -> str:
    value = unicodedata.normalize("NFD", value)
    value = "".join(char for char in value if unicodedata.category(char) != "Mn")
    return value.replace("đ", "d").replace("Đ", "D").lower()


def _normalized_with_map(value: str) -> tuple[str, list[int]]:
    normalized_chars: list[str] = []
    original_indexes: list[int] = []
    for index, character in enumerate(value):
        normalized_character = normalize_text(character)
        normalized_chars.extend(normalized_character)
        original_indexes.extend([index] * len(normalized_character))
    return "".join(normalized_chars), original_indexes


def _first_normalized_match(text: str, patterns: tuple[str, ...]) -> str | None:
    """Return the original-text span for the first accent-insensitive match."""

    normalized, original_indexes = _normalized_with_map(text)
    for pattern in patterns:
        match = re.search(pattern, normalized, flags=re.IGNORECASE)
        if not match:
            continue
        if not original_indexes:
            return None
        start = original_indexes[match.start()]
        end = original_indexes[match.end() - 1] + 1
        return text[start:end].strip()
    return None


# Keep the longest phrases first: ``sáng hôm nay`` should be returned instead
# of only ``hôm nay`` when a user sends a short follow-up answer.
DURATION_PATTERNS: tuple[str, ...] = (
    r"\b(?:tu\s+)?(?:sang|trua|chieu|toi|dem)\s+hom\s+qua\b",
    r"\btu\s+(?:sang|trua|chieu|toi|dem)\s+qua\b",
    r"\b(?:tu\s+)?(?:sang|trua|chieu|toi|dem)(?:\s+hom)?\s+nay\b",
    r"\b(?:tu\s+)?hom\s+kia\b",
    r"\b(?:tu\s+)?hom\s+qua\b",
    r"\b(?:tu\s+)?hom\s+nay\b",
    r"\b(?:tu\s+)?\d+(?:[.,]\d+)?\s*(?:gio|h|hom|ngay|tuan|thang|nam)(?:\s+(?:truoc|nay))?\b",
    r"\b(?:tu\s+)?(?:tuan|thang|nam)\s+(?:truoc|nay)\b",
    r"\b(?:tu\s+)?nam\s+ngoai\b",
    r"\b(?:vai|may)\s+(?:ngay|hom)\s+(?:truoc|nay)\b",
    r"\b(?:moi\s+bat\s+dau|vua\s+moi)\b",
)


SEVERITY_PATTERNS: tuple[str, ...] = (
    r"\bkhong\s+the\s+chiu\s+noi\b",
    r"\bkhong\s+chiu\s+noi\b",
    r"\bcuc\s+ky\s+nhieu\b",
    r"\brat\s+nhe\s+nhe\b",
    r"\bnhe\s+nhe\b",
    r"\bmot\s+chut\b",
    r"\bmot\s+it\b",
    r"\brat\s+nhe\b",
    r"\bvua\s+phai\b",
    r"\btrung\s+binh\b",
    r"\bkha\s+nang\b",
    r"\brat\s+nang\b",
    r"\bdu\s+doi\b",
    r"\bam\s+i\b",
    r"\bnhe\b",
    r"\bvua\b",
    r"\bnang\b",
    r"\bnhoi\b",
    r"\bnhieu\b",
)


def extract_duration_text(text: str) -> str | None:
    return _first_normalized_match(text, DURATION_PATTERNS)


def extract_severity_text(text: str) -> str | None:
    """Extract severity whether it is contextual (``đau nhẹ``) or bare."""

    normalized, original_indexes = _normalized_with_map(text)
    contextual_patterns = (
        r"\b(?:muc\s+do|dau|kho\s+chiu)(?:\s+\w+){0,4}\s+"
        r"(?:khong\s+the\s+chiu\s+noi|khong\s+chiu\s+noi|"
        r"cuc\s+ky\s+nhieu|rat\s+nhe\s+nhe|nhe\s+nhe|mot\s+chut|"
        r"mot\s+it|rat\s+nhe|vua\s+phai|vua|trung\s+binh|"
        r"kha\s+nang|rat\s+nang|nang|du\s+doi|am\s+i|nhe|nhoi|nhieu)\b",
    )
    match = re.search(contextual_patterns[0], normalized, flags=re.IGNORECASE)
    if match and original_indexes:
        start = original_indexes[match.start()]
        end = original_indexes[match.end() - 1] + 1
        return text[start:end].strip()
    return _first_normalized_match(text, SEVERITY_PATTERNS)


def normalize_duration(text: str) -> dict[str, Any] | None:
    normalized = normalize_text(text).strip()
    if re.search(
        r"\b(?:tu\s+)?(?:sang|trua|chieu|toi|dem)\s+hom\s+qua\b|"
        r"\btu\s+(?:sang|trua|chieu|toi|dem)\s+qua\b|"
        r"\b(?:tu\s+)?hom\s+qua\b",
        normalized,
    ):
        return {"text": text.strip(), "value": 1, "unit": "DAY"}
    if re.search(r"\b(?:tu\s+)?hom\s+kia\b", normalized):
        return {"text": text.strip(), "value": 2, "unit": "DAY"}
    if re.search(
        r"\b(?:tu\s+)?(?:sang|trua|chieu|toi|dem)(?:\s+hom)?\s+nay\b|"
        r"\b(?:tu\s+)?hom\s+nay\b|\b(?:moi\s+bat\s+dau|vua\s+moi)\b",
        normalized,
    ):
        return {"text": text.strip(), "value": 0, "unit": "DAY"}
    if re.search(r"\b(?:tu\s+)?nam\s+ngoai\b", normalized):
        return {"text": text.strip(), "value": 1, "unit": "YEAR"}
    unit_before_match = re.search(
        r"\b(?:tu\s+)?(tuan|thang|nam)\s+truoc\b", normalized
    )
    if unit_before_match:
        unit_map = {"tuan": "WEEK", "thang": "MONTH", "nam": "YEAR"}
        return {
            "text": text.strip(),
            "value": 1,
            "unit": unit_map[unit_before_match.group(1)],
        }
    match = re.search(
        r"(?:tu\s+)?(\d+(?:[.,]\d+)?)\s*(gio|h|hom|ngay|tuan|thang|nam)"
        r"(?:\s+(?:truoc|nay))?",
        normalized,
        flags=re.IGNORECASE,
    )
    if not match:
        return {"text": text.strip()} if text.strip() else None

    value = float(match.group(1).replace(",", "."))
    if value.is_integer():
        value = int(value)
    unit_map = {
        "gio": "HOUR",
        "h": "HOUR",
        "hom": "DAY",
        "ngay": "DAY",
        "tuan": "WEEK",
        "thang": "MONTH",
        "nam": "YEAR",
    }
    return {
        "text": text.strip(),
        "value": value,
        "unit": unit_map[match.group(2).lower()],
    }


def normalize_severity(text: str) -> dict[str, Any] | None:
    normalized = normalize_text(text)
    qualitative = re.search(
        r"\b(?:khong\s+(?:the\s+)?chiu\s+noi|cuc\s+ky\s+nhieu|"
        r"mot\s+(?:chut|it)|rat\s+nhe(?:\s+nhe)?|nhe(?:\s+nhe)?|"
        r"vua\s+phai|vua|trung\s+binh|kha\s+nang|rat\s+nang|"
        r"nang|du\s+doi|am\s+i|nhoi|nhieu|nhoi)",
        normalized,
    )
    return {"text": text.strip()} if qualitative else None


def normalize_age(text: str) -> dict[str, Any] | None:
    match = re.search(
        r"\b(\d{1,3})\s*(tuổi|tuoi|tháng tuổi|thang tuoi|tháng|thang|năm|nam)\b",
        text,
        flags=re.IGNORECASE,
    )
    if not match:
        return {"text": text.strip()} if text.strip() else None
    unit_text = normalize_text(match.group(2))
    unit = "MONTH" if "thang" in unit_text else "YEAR"
    return {"text": text.strip(), "value": int(match.group(1)), "unit": unit}


RED_FLAG_PATTERNS: list[tuple[str, tuple[str, ...]]] = [
    ("BREATHING_DIFFICULTY", ("kho tho nang", "khong tho duoc", "tho khong ra hoi", "tim tai")),
    ("CHEST_PAIN", ("dau nguc du doi", "dau nguc lan tay", "dau nguc lan len ham")),
    ("SYNCOPE", ("ngat", "bat tinh", "lim di", "roi loan y thuc")),
    ("FOCAL_WEAKNESS", ("yeu liet", "liet nua nguoi", "meo mieng", "noi kho dot ngot")),
    ("ABNORMAL_BLEEDING", ("chay mau nhieu", "bang huyet", "non ra mau", "di ngoai ra mau nhieu")),
]


def detect_red_flags(text: str) -> list[dict[str, Any]]:
    normalized, original_indexes = _normalized_with_map(text)
    results: list[dict[str, Any]] = []
    for code, keywords in RED_FLAG_PATTERNS:
        matched = None
        for keyword in keywords:
            index = normalized.find(keyword)
            if index < 0:
                continue
            prefix = normalized[:index]
            if re.search(r"\bkhong(?:\s+\w+){0,3}\s*$", prefix):
                continue
            original_start = original_indexes[index]
            original_end = original_indexes[index + len(keyword) - 1] + 1
            matched = text[original_start:original_end]
            break
        if matched:
            results.append({"code": code, "text": matched, "confidence": 1.0})
    return results


def empty_slots() -> dict[str, Any]:
    return {"duration": None, "severity": None, "age": None}


def ensure_red_flag_codes(values: list[str]) -> list[str]:
    return [value for value in values if value in RED_FLAG_CODES]
