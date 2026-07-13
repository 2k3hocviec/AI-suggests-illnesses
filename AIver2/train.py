"""
train.py - Fix loi luu checkpoint (iostream stream error)
Giai phap: save_strategy="no", chi luu model sau khi train xong
"""

import json
import os
import numpy as np  # type: ignore
import torch  # type: ignore
from torch.utils.data import Dataset  # type: ignore
from transformers import  ( # type: ignore
    AutoTokenizer,
    AutoModelForTokenClassification,
    TrainingArguments,
    Trainer,
    DataCollatorForTokenClassification,
) 
from seqeval.metrics import f1_score # type: ignore
from specialty_labels import LABEL2ID, ID2LABEL

MODEL_NAME = "vinai/phobert-base"
OUTPUT_DIR = "./output/medical-ner-model"


class NERDataset(Dataset):
    def __init__(self, path):
        with open(path, "r", encoding="utf-8") as f:
            self.data = json.load(f)
    def __len__(self): return len(self.data)
    def __getitem__(self, idx):
        return {k: torch.tensor(v) for k, v in self.data[idx].items()}


def compute_metrics(eval_preds):
    logits, labels = eval_preds
    preds = np.argmax(logits, axis=-1)
    true_labels, true_preds = [], []
    for p_row, l_row in zip(preds, labels):
        true_labels.append([ID2LABEL[l] for l in l_row if l != -100])
        true_preds.append([ID2LABEL[p] for p, l in zip(p_row, l_row) if l != -100])
    return {"f1": f1_score(true_labels, true_preds)}


def train():
    print(f"[1/4] Loading tokenizer & model: {MODEL_NAME}")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    model = AutoModelForTokenClassification.from_pretrained(
        MODEL_NAME,
        num_labels=len(LABEL2ID),
        id2label=ID2LABEL,
        label2id=LABEL2ID,
        ignore_mismatched_sizes=True,
    )

    print("[2/4] Loading datasets...")
    train_dataset = NERDataset("data/train_processed.json")
    val_dataset   = NERDataset("data/val_processed.json")
    print(f"  Train: {len(train_dataset)} | Val: {len(val_dataset)}")

    print("[3/4] Setting up training...")
    training_args = TrainingArguments(
        output_dir=OUTPUT_DIR,
        num_train_epochs=40,
        per_device_train_batch_size=4,
        per_device_eval_batch_size=4,
        learning_rate=2e-5,
        weight_decay=0.01,
        warmup_steps=50,
        eval_strategy="epoch",
        save_strategy="no",            # Tắt lưu checkpoint giữa chừng
        load_best_model_at_end=False,  # Phải False khi save_strategy="no"
        logging_steps=5,
        report_to="none",
        # use_cpu=True,
    )

    import transformers  # type: ignore
    ver = tuple(int(x) for x in transformers.__version__.split(".")[:2])
    trainer_kwargs = dict(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=val_dataset,
        data_collator=DataCollatorForTokenClassification(tokenizer),
        compute_metrics=compute_metrics,
    )
    if ver >= (4, 46):
        trainer_kwargs["processing_class"] = tokenizer
    else:
        trainer_kwargs["tokenizer"] = tokenizer

    trainer = Trainer(**trainer_kwargs)

    print("[4/4] Training... (khoang 5-10 phut tren CPU)\n")
    trainer.train()

    # Luu model sau khi train xong
    print("\nDang luu model...")
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    trainer.save_model(OUTPUT_DIR)
    tokenizer.save_pretrained(OUTPUT_DIR)
    print(f"Done! Model luu tai: {OUTPUT_DIR}")
    print("Tiep theo chay: python inference.py hoac python model_api.py")

if __name__ == "__main__":
    train()
