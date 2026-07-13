"""Create a reviewable specialty-labelled NER dataset from the legacy dataset."""

from __future__ import annotations

import json
from pathlib import Path

from specialty_labels import infer_legacy_symptom_code


SOURCE_PATH = Path("data/dataset.json")
OUTPUT_PATH = Path("data/dataset_specialty.json")
REVIEW_LABEL = "REVIEW_REQUIRED"


def corrected_span(text: str, entity_text: str, old_start: int) -> tuple[int, int] | None:
    matches = []
    start = text.find(entity_text)
    while start != -1:
        matches.append(start)
        start = text.find(entity_text, start + 1)
    if not matches:
        return None
    best_start = min(matches, key=lambda candidate: abs(candidate - old_start))
    return best_start, best_start + len(entity_text)


def convert_dataset(samples: list[dict]) -> tuple[list[dict], list[dict]]:
    output_samples = []
    review_items = []

    for sample_index, sample in enumerate(samples):
        converted_entities = []
        for entity in sample["entities"]:
            converted_entity = dict(entity)
            span = corrected_span(sample["text"], entity["text"], entity["start"])
            code = infer_legacy_symptom_code(entity["text"])

            if span:
                converted_entity["start"], converted_entity["end"] = span
            if entity["label"] == "SYMPTOM":
                converted_entity["label"] = code or REVIEW_LABEL

            if not span or converted_entity["label"] == REVIEW_LABEL:
                review_items.append(
                    {
                        "sample_index": sample_index,
                        "text": sample["text"],
                        "entity": converted_entity,
                        "reason": "missing specialty mapping" if not code else "cannot fix offset",
                    }
                )
            converted_entities.append(converted_entity)
        output_samples.append({"text": sample["text"], "entities": converted_entities})

    return output_samples, review_items


if __name__ == "__main__":
    with SOURCE_PATH.open("r", encoding="utf-8") as file:
        source_samples = json.load(file)

    output_samples, items_to_review = convert_dataset(source_samples)
    with OUTPUT_PATH.open("w", encoding="utf-8") as file:
        json.dump(output_samples, file, ensure_ascii=False, indent=2)

    print(f"Da tao: {OUTPUT_PATH} ({len(output_samples)} mau)")
    print(f"Entity can gan nhan/sua thu cong: {len(items_to_review)}")
    for item in items_to_review[:20]:
        print(
            f"  Mau {item['sample_index']}: '{item['entity']['text']}' "
            f"-> {item['entity']['label']} ({item['reason']})"
        )
    if items_to_review:
        print("Hay sua tat ca REVIEW_REQUIRED trong data/dataset_specialty.json truoc khi train.")
