"""Prepare joint NER and sentence-intent data for the multi-task model."""

from __future__ import annotations

import json
import os
import random
import re
from collections import defaultdict

from transformers import AutoTokenizer  # type: ignore

from intent_labels import INTENT2ID, validate_intent
from specialty_labels import LABEL2ID, validate_specialty_code


TOKENIZER_NAME = "vinai/phobert-base"
DATASET_PATH = os.getenv("NER_DATASET_PATH", "data/dataset_specialty.json")
MAX_LEN = 128


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
        if text[start:end] != entity["text"]:
            raise ValueError(
                f"Offset sai cho '{entity['text']}': text[{start}:{end}] = '{text[start:end]}'"
            )
        for index in range(start, min(end, len(text))):
            char_labels[index] = f"B-{label}" if index == start else f"I-{label}"

    words_with_spans = [
        (match.group(), match.start()) for match in re.finditer(r"\S+", text)
    ]
    word_labels = [
        char_labels[start] if start < len(char_labels) else "O"
        for _, start in words_with_spans
    ]

    cls_id = tokenizer.cls_token_id
    sep_id = tokenizer.sep_token_id
    pad_id = tokenizer.pad_token_id
    if cls_id is None or sep_id is None or pad_id is None:
        raise ValueError("Tokenizer must provide CLS, SEP and PAD token ids")

    input_ids = [cls_id]
    labels = [-100]
    for (word_text, _), word_label in zip(words_with_spans, word_labels):
        sub_ids = tokenizer.encode(word_text, add_special_tokens=False)
        if not sub_ids:
            continue

        label_id = LABEL2ID[word_label]
        for sub_index, sub_id in enumerate(sub_ids):
            input_ids.append(sub_id)
            if sub_index == 0:
                labels.append(label_id)
            else:
                continuation = (
                    f"I-{word_label[2:]}"
                    if word_label.startswith("B-")
                    else word_label
                )
                labels.append(LABEL2ID[continuation])

    input_ids.append(sep_id)
    labels.append(-100)
    input_ids = input_ids[:MAX_LEN]
    labels = labels[:MAX_LEN]

    pad_len = MAX_LEN - len(input_ids)
    attention_mask = [1] * len(input_ids) + [0] * pad_len
    input_ids += [pad_id] * pad_len
    labels += [-100] * pad_len

    return {
        "input_ids": input_ids,
        "attention_mask": attention_mask,
        "labels": labels,
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
    return normalized_samples


def prepare_dataset(samples: list[dict], tokenizer) -> list[dict]:
    processed = []
    for index, sample in enumerate(samples):
        try:
            processed.append(tokenize_and_label(sample, tokenizer))
        except Exception as error:
            raise ValueError(f"Invalid dataset sample {index}: {error}") from error
    return processed


def stratified_split(dataset: list[dict], seed: int = 42) -> tuple[list[dict], list[dict]]:
    groups: dict[int, list[dict]] = defaultdict(list)
    for sample in dataset:
        groups[sample["intent_labels"]].append(sample)

    rng = random.Random(seed)
    train_data, val_data = [], []
    for group in groups.values():
        rng.shuffle(group)
        validation_size = max(1, int(round(len(group) * 0.2))) if len(group) > 1 else 0
        val_data.extend(group[:validation_size])
        train_data.extend(group[validation_size:])

    rng.shuffle(train_data)
    rng.shuffle(val_data)
    return train_data, val_data


if __name__ == "__main__":
    print(f"[1/3] Tai tokenizer: {TOKENIZER_NAME}")
    tokenizer = AutoTokenizer.from_pretrained(TOKENIZER_NAME)

    print("[2/3] Xu ly dataset multi-task...")
    print(f"  NER dataset: {DATASET_PATH}")
    samples = load_samples(DATASET_PATH)
    dataset = prepare_dataset(samples, tokenizer)
    train_data, val_data = stratified_split(dataset)

    os.makedirs("data", exist_ok=True)
    with open("data/train_multitask.json", "w", encoding="utf-8") as file:
        json.dump(train_data, file, ensure_ascii=False)
    with open("data/val_multitask.json", "w", encoding="utf-8") as file:
        json.dump(val_data, file, ensure_ascii=False)

    print(f"  Total: {len(dataset)}")
    print(f"  Train: {len(train_data)}")
    print(f"  Val:   {len(val_data)}")
