"""Create supervised T5 question-generation data from dialogue-policy splits."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Any

from question_generator import QUESTION_FIELDS, serialize_question_input


ROOT = Path(__file__).parent
SPLITS = ("train", "val", "test")


def _analysis_from_facts(facts: dict[str, Any]) -> dict[str, Any]:
    return {
        "symptoms": facts.get("symptoms", []) or [],
        "slots": {field: facts.get(field) for field in QUESTION_FIELDS},
    }


def _first_symptom(analysis: dict[str, Any]) -> str:
    symptoms = analysis.get("symptoms", [])
    if symptoms:
        value = str(symptoms[0]).strip()
        if value:
            return value
    return "triệu chứng này"


def _target_question(field: str, analysis: dict[str, Any], record_id: str) -> str:
    symptom = _first_symptom(analysis)
    templates = {
        "duration": (
            f"{symptom.capitalize()} xuất hiện từ khi nào?",
            f"Bạn bắt đầu gặp {symptom} từ lúc nào?",
            f"{symptom.capitalize()} đã kéo dài được bao lâu?",
        ),
        "severity": (
            f"Mức độ {symptom} hiện tại như thế nào?",
            f"Bạn cảm thấy {symptom} nhẹ, vừa hay nặng?",
            f"Hiện tại {symptom} ở mức độ nào?",
        ),
        "age": (
            "Người bệnh hiện bao nhiêu tuổi?",
            "Bạn có thể cho biết người bệnh bao nhiêu tuổi không?",
            "Người đang có triệu chứng này mấy tuổi?",
        ),
    }
    index = int(hashlib.sha256(record_id.encode("utf-8")).hexdigest(), 16)
    return templates[field][index % len(templates[field])]


def build_split(source: Path, destination: Path) -> int:
    with source.open("r", encoding="utf-8-sig") as file:
        records = json.load(file)

    examples = []
    for record in records:
        if record.get("nextAction") != "ASK_FOLLOW_UP":
            continue
        field = str(record.get("field", ""))
        if field not in QUESTION_FIELDS:
            continue
        analysis = _analysis_from_facts(record.get("facts") or {})
        record_id = str(record.get("id", len(examples)))
        examples.append(
            {
                "id": record_id,
                "field": field,
                "input": serialize_question_input(
                    field,
                    analysis,
                    record.get("history") or [],
                ),
                "target": _target_question(field, analysis, record_id),
            }
        )

    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("w", encoding="utf-8") as file:
        json.dump(examples, file, ensure_ascii=False, indent=2)
    return len(examples)


def main() -> None:
    output_dir = Path(os.getenv("QUESTION_DATA_DIR", str(ROOT / "data")))
    for split in SPLITS:
        source = ROOT / "data" / f"{split}_dialogue_policy.json"
        destination = output_dir / f"{split}_question_generation.json"
        if not source.exists():
            raise FileNotFoundError(f"Missing policy data: {source}")
        count = build_split(source, destination)
        print(f"{split}: {count} examples -> {destination}")


if __name__ == "__main__":
    main()
