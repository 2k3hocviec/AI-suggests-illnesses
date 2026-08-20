"""Prepare specialty NER, clinical slots, risk and intent data."""

from __future__ import annotations

import json
import os
import random
import re
from copy import deepcopy
from collections import defaultdict

from transformers import AutoTokenizer  # type: ignore

from intent_labels import INTENT2ID, validate_intent
from specialty_labels import LABEL2ID, validate_specialty_code
from slot_labels import RED_FLAG2ID, SLOT2ID, validate_red_flag_code, validate_slot_label


TOKENIZER_NAME = os.getenv("TOKENIZER_NAME", "vinai/phobert-base")
DATASET_PATH = os.getenv("NER_DATASET_PATH", "data/dataset_training_all.json")
MAX_LEN = 128

# Generate qualitative forms during preparation so the slot head sees the
# vocabulary users naturally use in conversation.

# Một mức độ có thể được người dùng diễn đạt bằng nhiều cách khác nhau.
# Model cần tạo các cách diễn đạt định tính ngya trong bước chuẩn bị dữ liệu, để model có thể nhận diện được đa dạng lời nói mà người dùng hỏi.


QUALITATIVE_SEVERITY_VARIANTS = (
    "một chút",
    "một ít",
    "rất nhẹ",
    "nhẹ",
    "nhẹ nhẹ",
    "vừa",
    "vừa phải",
    "trung bình",
    "khá nặng",
    "nặng",
    "rất nặng",
    "dữ dội",
    "âm ỉ",
    "nhói",
    "nhiều",
    "không chịu nổi",
)


# Dùng ghép lại câu mô tả mức độ soa cho tự nhiên dựa theo cụm ban đầu.
def _severity_variant_text(original: str, level_text: str) -> str:
    lowered = original.strip().lower()
    if lowered.startswith("mức độ"):
        return f"mức độ {level_text}"
    if lowered.startswith("đau"):
        return f"đau {level_text}"
    if lowered.startswith("khó chịu"):
        return f"khó chịu {level_text}"
    return level_text


# Tạo một biến thể của mẫu dữ liệu bằng cách đổi giá trị cả một slot ("nhẹ -> nặng"), dữ nguyên tọa độ của toàn bộ entity/slot trong câu.
def _replace_slot_span(sample: dict, slot_index: int, replacement: str) -> dict:
    source_slot = sample["slots"][slot_index]
    source_start = int(source_slot["start"])
    source_end = int(source_slot["end"])
    if sample["text"][source_start:source_end] != source_slot["text"]:
        raise ValueError(f"Invalid SEVERITY offset: {source_slot['text']}")

    variant = deepcopy(sample)
    variant["text"] = (
        sample["text"][:source_start]
        + replacement
        + sample["text"][source_end:]
    )
    delta = len(replacement) - (source_end - source_start)
    for collection_name in ("entities", "slots"):
        for index, item in enumerate(variant.get(collection_name, []) or []):
            item_start = int(item["start"])
            item_end = int(item["end"])
            if collection_name == "slots" and index == slot_index:
                item["start"] = source_start
                item["end"] = source_start + len(replacement)
                item["text"] = replacement
            elif item_start >= source_end:
                item["start"] = item_start + delta
                item["end"] = item_end + delta
    return variant


# Mở rộng dữ liệu mẫu theo các mức độ severity khác nhau, công việc cụ thể:
#   - Duyệt từng sample, tìm slot có nhãn "SERVERITY".
#   - Nếu mỗi câu chỉ có đúng một slot SEVERITY, hàm sẽ tạo thêm nhiều câu mới bằng các mức trong QUALITATIVE_SEVERITY_VARIANTS.
def _expand_qualitative_severity_samples(samples: list[dict]) -> list[dict]:
    expanded = list(samples)
    for sample in samples:
        severity_indexes = [
            index
            for index, slot in enumerate(sample.get("slots", []) or [])
            if slot.get("label") == "SEVERITY"
        ]
        if len(severity_indexes) != 1:
            continue

        severity_index = severity_indexes[0]
        source_slot = sample["slots"][severity_index]

        for level_text in QUALITATIVE_SEVERITY_VARIANTS:
            replacement = _severity_variant_text(source_slot["text"], level_text)
            expanded.append(
                _replace_slot_span(sample, severity_index, replacement)
            )
    return expanded


# DÙng để chuyển các entity trong câu thành nhãn BIO cho từng ký tự.
def _char_bio_labels(text: str, entities: list[dict], label_validator) -> list[str]:
    char_labels = ["O"] * len(text)
    for entity in entities:
        start, end = int(entity["start"]), int(entity["end"])
        label = entity["label"]
        label_validator(label)
        if text[start:end] != entity["text"]:
            raise ValueError(
                f"Offset sai cho '{entity['text']}': text[{start}:{end}] = '{text[start:end]}'"
            )
        for index in range(start, min(end, len(text))):
            char_labels[index] = f"B-{label}" if index == start else f"I-{label}"
    return char_labels


# Chuyển nhãn mức kí tự sang mức từ.
def _word_labels(text: str, char_labels: list[str]) -> list[tuple[str, str]]:
    words_with_spans = [
        (match.group(), match.start()) for match in re.finditer(r"\S+", text)
    ]
    return [
        (word_text, char_labels[start] if start < len(char_labels) else "O")
        for word_text, start in words_with_spans
    ]


# Chuyển một sample dạng text sang dữ liệu số để đưa vào mô hình học.
#   - Cụ thể tạo ra:
#       + input_ids: mã số token cảu câu, do tokenizer chuyển đổi.
#       + labels: nhãn entity/ chuyên khoa cho từng token.
#       + slot_labels: nhãn slot như SEVERITY, ... cho từng token.
#       + attention_mask: đánh đấu token thật (1) và phần đệm (0).
#       + risk_labels: các nhãn red flag dạng 0/1.
#       + intent_labels: mã số của intent.
def tokenize_and_label(sample: dict, tokenizer) -> dict:
    text = sample["text"]
    entities = sample.get("entities", [])
    intent = validate_intent(sample.get("intent", "SYMPTOM"))

    char_labels = ["O"] * len(text)
    for entity in entities:
        start, end = entity["start"], entity["end"]
        label = entity["label"]
        if label == "SYMPTOM":
            raise ValueError(
                "Dataset van dung label SYMPTOM. Hay chuyen entity sang ma chuyen khoa."
            )
        validate_specialty_code(label)
        
        # Kiểm tra label có phải mã chuyên khoa hợp lệ không.
        if text[start:end] != entity["text"]:
            raise ValueError(
                f"Offset sai cho '{entity['text']}': text[{start}:{end}] = '{text[start:end]}'"
            )
            
        # Kiểm tra vị trí strat:end có trỏ đúng vào text của entity không.
        for index in range(start, min(end, len(text))):
            char_labels[index] = f"B-{label}" if index == start else f"I-{label}"

    # Gán nhãn BIO.
    slot_entities = sample.get("slots", []) or []
    slot_char_labels = _char_bio_labels(text, slot_entities, validate_slot_label)
    words_with_spans = _word_labels(text, char_labels)
    slot_words_with_labels = _word_labels(text, slot_char_labels)

    cls_id = tokenizer.cls_token_id
    sep_id = tokenizer.sep_token_id
    pad_id = tokenizer.pad_token_id
    if cls_id is None or sep_id is None or pad_id is None:
        raise ValueError("Tokenizer must provide CLS, SEP and PAD token ids")

    input_ids = [cls_id]
    labels = [-100]
    slot_labels = [-100]
    for (word_text, word_label), (_, slot_word_label) in zip(
        words_with_spans, slot_words_with_labels
    ):
        sub_ids = tokenizer.encode(word_text, add_special_tokens=False)
        if not sub_ids:
            continue

        label_id = LABEL2ID[word_label]
        for sub_index, sub_id in enumerate(sub_ids):
            input_ids.append(sub_id)
            if sub_index == 0:
                labels.append(label_id)
                slot_labels.append(SLOT2ID[slot_word_label])
            else:
                continuation = (
                    f"I-{word_label[2:]}"
                    if word_label.startswith("B-")
                    else word_label
                )
                labels.append(LABEL2ID[continuation])
                slot_continuation = (
                    f"I-{slot_word_label[2:]}"
                    if slot_word_label.startswith("B-")
                    else slot_word_label
                )
                slot_labels.append(SLOT2ID[slot_continuation])

    input_ids.append(sep_id)
    labels.append(-100)
    slot_labels.append(-100)
    input_ids = input_ids[:MAX_LEN]
    labels = labels[:MAX_LEN]
    slot_labels = slot_labels[:MAX_LEN]

    pad_len = MAX_LEN - len(input_ids)
    attention_mask = [1] * len(input_ids) + [0] * pad_len
    input_ids += [pad_id] * pad_len
    labels += [-100] * pad_len
    slot_labels += [-100] * pad_len

    risk_labels = [0.0] * len(RED_FLAG2ID)
    for code in sample.get("red_flags", []) or []:
        validate_red_flag_code(code)
        risk_labels[RED_FLAG2ID[code]] = 1.0

    # Trả về một từ điển chứa dữ liệu đã được chuyển sang dạng số để đưa vào mô hình AI.
    return {
        "input_ids": input_ids,
        "attention_mask": attention_mask,
        "labels": labels,
        "slot_labels": slot_labels,
        "risk_labels": risk_labels,
        "intent_labels": INTENT2ID[intent],
    }


def load_samples(dataset_path: str) -> list[dict]:
    with open(dataset_path, "r", encoding="utf-8-sig") as file:
        samples = json.load(file)

    normalized_samples = []
    for sample in samples:
        normalized = dict(sample)
        # Existing medical records do not need to be edited manually; records
        # without an intent are treated as SYMPTOM for backward compatibility.
        normalized.setdefault("intent", "SYMPTOM")
        normalized_samples.append(normalized)
    return _expand_qualitative_severity_samples(normalized_samples)


def prepare_dataset(samples: list[dict], tokenizer) -> list[dict]:
    processed = []
    for index, sample in enumerate(samples):
        try:
            processed.append(tokenize_and_label(sample, tokenizer))
        except Exception as error:
            raise ValueError(f"Invalid dataset sample {index}: {error}") from error
    return processed


def stratified_split(
    dataset: list[dict], seed: int = 42
) -> tuple[list[dict], list[dict], list[dict]]:
    groups: dict[int, list[dict]] = defaultdict(list)
    for sample in dataset:
        groups[sample["intent_labels"]].append(sample)

    rng = random.Random(seed)
    train_data, val_data, test_data = [], [], []
    for group in groups.values():
        rng.shuffle(group)
        if len(group) < 3:
            test_size = 0
            validation_size = 0
        else:
            test_size = max(1, round(len(group) * 0.125))
            validation_size = max(1, round(len(group) * 0.125))
        test_data.extend(group[:test_size])
        val_data.extend(group[test_size : test_size + validation_size])
        train_data.extend(group[test_size + validation_size :])

    rng.shuffle(train_data)
    rng.shuffle(val_data)
    rng.shuffle(test_data)
    return train_data, val_data, test_data


if __name__ == "__main__":
    print(f"[1/3] Tai tokenizer: {TOKENIZER_NAME}")
    tokenizer = AutoTokenizer.from_pretrained(TOKENIZER_NAME)

    print("[2/3] Xu ly dataset multi-task...")
    print(f"  NER dataset: {DATASET_PATH}")
    samples = load_samples(DATASET_PATH)
    dataset = prepare_dataset(samples, tokenizer)
    train_data, val_data, test_data = stratified_split(dataset)

    os.makedirs("data", exist_ok=True)
    with open("data/train_multitask.json", "w", encoding="utf-8") as file:
        json.dump(train_data, file, ensure_ascii=False)
    with open("data/val_multitask.json", "w", encoding="utf-8") as file:
        json.dump(val_data, file, ensure_ascii=False)
    with open("data/test_multitask.json", "w", encoding="utf-8") as file:
        json.dump(test_data, file, ensure_ascii=False)

    print(f"  Total: {len(dataset)}")
    print(f"  Train: {len(train_data)}")
    print(f"  Val:   {len(val_data)}")
    print(f"  Test:  {len(test_data)}")
