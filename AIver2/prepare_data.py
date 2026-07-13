"""
prepare_data.py - Fix cho PhoBERT (slow tokenizer, không có word_ids())
Dùng cách thủ công: tokenize từng từ rồi ghép nhãn lại
"""

import json
import os
import random
from transformers import AutoTokenizer # type: ignore
from specialty_labels import LABEL2ID, validate_specialty_code

TOKENIZER_NAME = "vinai/phobert-base"
DATASET_PATH = os.getenv("NER_DATASET_PATH", "data/dataset_specialty.json")


def tokenize_and_label(sample, tokenizer):
    import re
    text = sample["text"]
    entities = sample["entities"]

    # Buoc 1: Tao nhan ky tu theo chuyen khoa.
    char_labels = ["O"] * len(text)
    for ent in entities:
        s, e = ent["start"], ent["end"]
        label = ent["label"]
        if label == "SYMPTOM":
            raise ValueError(
                "Dataset van dung label SYMPTOM. Hay chay label_dataset_specialties.py "
                "va ra soat cac entity REVIEW_REQUIRED truoc khi train."
            )
        validate_specialty_code(label)
        if text[s:e] != ent["text"]:
            raise ValueError(
                f"Offset sai cho '{ent['text']}': text[{s}:{e}] = '{text[s:e]}'"
            )
        for i in range(s, min(e, len(text))):
            char_labels[i] = f"B-{label}" if i == s else f"I-{label}"

    # Bước 2: Tách từ ĐÚNG + gán nhãn cho từng từ
    # Dùng regex để tìm vị trí từ chính xác (không dùng .split())
    words_with_spans = []
    for match in re.finditer(r'\S+', text):
        words_with_spans.append((match.group(), match.start()))
    
    word_labels = []
    for word_text, start_pos in words_with_spans:
        # Gán nhãn dựa trên vị trí ký tự thực tế, không guess
        w_label = char_labels[start_pos] if start_pos < len(text) else "O"
        word_labels.append(w_label)

    # Bước 3: Tokenize từng từ thủ công
    cls_id = tokenizer.cls_token_id
    sep_id = tokenizer.sep_token_id
    pad_id = tokenizer.pad_token_id

    all_input_ids = [cls_id]
    all_labels = [-100]

    for (word_text, _), w_label in zip(words_with_spans, word_labels):
        sub_ids = tokenizer.encode(word_text, add_special_tokens=False)
        if not sub_ids:
            continue
        
        label_id = LABEL2ID.get(w_label, 0)
        for j, sid in enumerate(sub_ids):
            all_input_ids.append(sid)
            if j == 0:
                all_labels.append(label_id)
            else:
                continuation = f"I-{w_label[2:]}" if w_label.startswith("B-") else w_label
                all_labels.append(LABEL2ID[continuation])

    # Token SEP ở cuối
    all_input_ids.append(sep_id)
    all_labels.append(-100)

    # Truncate nếu quá dài
    MAX_LEN = 128
    all_input_ids = all_input_ids[:MAX_LEN]
    all_labels = all_labels[:MAX_LEN]

    # Padding
    pad_len = MAX_LEN - len(all_input_ids)
    attention_mask = [1] * len(all_input_ids) + [0] * pad_len
    all_input_ids = all_input_ids + [pad_id] * pad_len
    all_labels = all_labels + [-100] * pad_len

    return {
        "input_ids": all_input_ids,
        "attention_mask": attention_mask,
        "labels": all_labels,
    }


def prepare_dataset(json_path, tokenizer):
    with open(json_path, "r", encoding="utf-8") as f:
        raw_data = json.load(f)

    processed, errors = [], 0
    for i, sample in enumerate(raw_data):
        try:
            processed.append(tokenize_and_label(sample, tokenizer))
        except Exception as e:
            print(f"  Bo qua mau {i}: {e}")
            errors += 1

    print(f"  Thanh cong: {len(processed)}/{len(raw_data)} (loi: {errors})")
    if errors:
        raise ValueError(
            "Dataset con loi nhan hoac offset. Sua data/dataset_specialty.json "
            "truoc khi tao train/validation."
        )
    return processed


if __name__ == "__main__":
    print(f"[1/3] Tai tokenizer: {TOKENIZER_NAME}")
    print("      (Lan dau download ~400MB, vui long cho...)")
    tokenizer = AutoTokenizer.from_pretrained(TOKENIZER_NAME)
    print("  OK\n")

    print("[2/3] Xu ly dataset...")
    print(f"      Nguon: {DATASET_PATH}")
    dataset = prepare_dataset(DATASET_PATH, tokenizer)

    if len(dataset) == 0:
        print("LOI: Khong co mau nao duoc xu ly! Kiem tra lai dataset.json")
        exit(1)

    print("\n[3/3] Luu file...")
    os.makedirs("data", exist_ok=True)
    random.Random(42).shuffle(dataset)
    split = int(len(dataset) * 0.8)
    train_data, val_data = dataset[:split], dataset[split:]

    # Neu val rong thi lay 1 mau tu train
    if len(val_data) == 0:
        val_data = train_data[:1]

    with open("data/train_processed.json", "w", encoding="utf-8") as f:
        json.dump(train_data, f, ensure_ascii=False)
    with open("data/val_processed.json", "w", encoding="utf-8") as f:
        json.dump(val_data, f, ensure_ascii=False)

    print(f"  Train: {len(train_data)} mau -> data/train_processed.json")
    print(f"  Val:   {len(val_data)} mau -> data/val_processed.json")
    print("\nXong! Tiep theo chay: python train.py")
