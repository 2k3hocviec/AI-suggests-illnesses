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


TEMPLATES: dict[str, tuple[str, ...]] = {
    "duration": (
        "{symptom} xuất hiện từ khi nào?",
        "Bạn bắt đầu gặp {symptom} từ lúc nào?",
        "{symptom} đã kéo dài được bao lâu?",
        "Bạn bị {symptom} từ khi nào vậy?",
        "{symptom} bắt đầu từ lúc nào?",
        "Tình trạng {symptom} kéo dài được bao lâu rồi?",
        "Cho mình hỏi {symptom} xuất hiện từ bao giờ?",
        "{symptom} đã diễn ra được bao lâu rồi?",
        "Bạn gặp {symptom} từ khi nào?",
        "{symptom} bắt đầu cách đây bao lâu?",
        "Bạn có {symptom} từ bao giờ?",
        "Bạn bị {symptom} bao lâu rồi?",
        "{symptom} đã xảy ra từ khi nào?",
        "Tình trạng {symptom} bắt đầu từ lúc nào vậy?",
        "Bạn gặp tình trạng {symptom} từ bao giờ?",
        "{symptom} này bắt đầu từ khi nào?",
        "Bạn bị {symptom} được bao lâu rồi?",
        "Triệu chứng {symptom} xuất hiện từ lúc nào?",
        "{symptom} kéo dài bao lâu rồi?",
        "Cho hỏi bạn bị {symptom} từ khi nào?",
    ),
    "severity": (
        "Mức độ {symptom} hiện tại như thế nào?",
        "Bạn cảm thấy {symptom} nhẹ, vừa hay nặng?",
        "Hiện tại {symptom} ở mức độ nào?",
        "Mức độ {symptom} của bạn ra sao?",
        "{symptom} ở mức nhẹ, vừa hay nặng?",
        "Bạn đánh giá mức độ {symptom} hiện tại thế nào?",
        "Tình trạng {symptom} nặng hay nhẹ?",
        "Cho mình hỏi mức độ {symptom} bạn đang gặp?",
        "{symptom} có dữ dội không hay chỉ nhẹ thôi?",
        "Mức độ {symptom} bạn đang gặp nghiêm trọng không?",
        "Bạn thấy {symptom} ở mức độ nào?",
        "{symptom} có nặng không?",
        "Mức độ {symptom} ra sao?",
        "Bạn có thể mô tả mức độ {symptom} không?",
        "{symptom} nhẹ hay nặng?",
        "Tình trạng {symptom} bạn đang gặp ở mức nào?",
        "Bạn cảm nhận {symptom} ở mức độ thế nào?",
        "{symptom} có dữ dội lắm không?",
        "Cho mình biết mức độ {symptom} của bạn?",
        "Hiện tại bạn thấy {symptom} nhẹ hay nặng?",
    ),
    "age": (
        "Người bệnh hiện bao nhiêu tuổi?",
        "Bạn có thể cho biết người bệnh bao nhiêu tuổi không?",
        "Người đang có triệu chứng này mấy tuổi?",
        "Cho mình biết bạn bao nhiêu tuổi?",
        "Bệnh nhân năm nay bao nhiêu tuổi?",
        "Người bệnh năm nay mấy tuổi?",
        "Bạn cho mình biết tuổi của người bệnh được không?",
        "Năm nay người bệnh bao nhiêu tuổi rồi?",
        "Mình cần biết tuổi của bạn, bạn bao nhiêu tuổi?",
        "Bạn có thể cho biết tuổi không?",
        "Bạn bao nhiêu tuổi?",
        "Năm nay bạn mấy tuổi?",
        "Cho mình hỏi bạn bao nhiêu tuổi?",
        "Tuổi của người bệnh là bao nhiêu?",
        "Người bệnh hiện tại mấy tuổi?",
        "Bạn cho biết tuổi của bạn nhé?",
        "Mình cần biết tuổi người bệnh, bạn cho biết được không?",
        "Xin cho biết bạn bao nhiêu tuổi?",
        "Người bệnh được bao nhiêu tuổi rồi?",
        "Cho hỏi tuổi của bệnh nhân?",
    ),
}

# Mỗi record tạo nhiều variant bằng cách cắt history khác nhau.
# Mỗi variant có INPUT khác nhau → TARGET khác nhau → không conflict.
HISTORY_SLICES: list[int | None] = [
    None,   # Full history (giữ nguyên)
    -3,     # 3 tin nhắn cuối
    -1,     # 1 tin nhắn cuối
    0,      # Không có history
]


def _target_question(field: str, analysis: dict[str, Any], record_id: str) -> str:
    symptom = _first_symptom(analysis)
    field_templates = TEMPLATES[field]
    index = int(hashlib.sha256(record_id.encode("utf-8")).hexdigest(), 16)
    template = field_templates[index % len(field_templates)]
    return template.format(symptom=symptom)


def _build_examples(
    records: list[dict[str, Any]],
    augment: bool = False,
) -> list[dict[str, Any]]:
    examples = []
    for record in records:
        if record.get("nextAction") != "ASK_FOLLOW_UP":
            continue
        field = str(record.get("field", ""))
        if field not in QUESTION_FIELDS:
            continue
        analysis = _analysis_from_facts(record.get("facts") or {})
        record_id = str(record.get("id", len(examples)))
        history = record.get("history") or []

        slices = HISTORY_SLICES if augment else [None]
        seen_inputs: set[str] = set()

        for variant_idx, slice_val in enumerate(slices):
            if slice_val is None:
                variant_history = history
            elif slice_val == 0:
                variant_history = []
            else:
                variant_history = history[slice_val:]

            input_text = serialize_question_input(field, analysis, variant_history)

            # Bỏ qua nếu input giống hệt variant trước (history quá ngắn)
            if input_text in seen_inputs:
                continue
            seen_inputs.add(input_text)

            variant_id = f"{record_id}_h{variant_idx}" if variant_idx else record_id
            examples.append(
                {
                    "id": variant_id,
                    "field": field,
                    "input": input_text,
                    "target": _target_question(field, analysis, variant_id),
                }
            )
    return examples


def build_split(source: Path, destination: Path, augment: bool = False) -> int:
    with source.open("r", encoding="utf-8-sig") as file:
        records = json.load(file)

    examples = _build_examples(records, augment=augment)

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
        count = build_split(source, destination, augment=(split == "train"))
        print(f"{split}: {count} examples -> {destination}")


if __name__ == "__main__":
    main()
