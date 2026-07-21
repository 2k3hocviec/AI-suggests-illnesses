"""Train the shared PhoBERT NER + sentence-intent model."""

from __future__ import annotations

import json
import os
from collections import Counter

import numpy as np  # type: ignore
import torch
from seqeval.metrics import f1_score  # type: ignore
from torch.utils.data import Dataset
from transformers import (  # type: ignore
    AutoConfig,
    AutoTokenizer,
    DataCollatorForTokenClassification,
    RobertaModel,
    Trainer,
    TrainingArguments,
)

from intent_labels import ID2INTENT, INTENT2ID
from multitask_model import MultiTaskRobertaForTokenAndIntentClassification
from specialty_labels import ID2LABEL, LABEL2ID


MODEL_NAME = "vinai/phobert-base"
OLD_MODEL_PATH = os.getenv("OLD_MODEL_PATH", "./output/medical-ner-model")
OUTPUT_DIR = os.getenv("OUTPUT_DIR", "./output/medical-multitask-model")
TRAIN_DATA_PATH = os.getenv("TRAIN_DATA_PATH", "data/train_multitask.json")
VAL_DATA_PATH = os.getenv("VAL_DATA_PATH", "data/val_multitask.json")
NUM_EPOCHS = float(os.getenv("NUM_EPOCHS", "10"))
MAX_STEPS = int(os.getenv("MAX_STEPS", "-1"))


class MultiTaskDataset(Dataset):
    def __init__(self, path: str):
        with open(path, "r", encoding="utf-8-sig") as file:
            self.data = json.load(file)

    def __len__(self):
        return len(self.data)

    def __getitem__(self, index):
        return {
            key: torch.tensor(value)
            for key, value in self.data[index].items()
        }


class MultiTaskDataCollator:
    def __init__(self, tokenizer):
        self.ner_collator = DataCollatorForTokenClassification(tokenizer)

    def __call__(self, features):
        intent_labels = torch.tensor(
            [int(feature["intent_labels"]) for feature in features],
            dtype=torch.long,
        )
        ner_features = [
            {key: value for key, value in feature.items() if key != "intent_labels"}
            for feature in features
        ]
        batch = self.ner_collator(ner_features)
        batch["intent_labels"] = intent_labels
        return batch


def _prediction_arrays(eval_preds):
    predictions = eval_preds.predictions
    labels = eval_preds.label_ids
    if not isinstance(predictions, tuple):
        predictions = tuple(predictions)
    if not isinstance(labels, tuple):
        labels = tuple(labels)
    return predictions[0], predictions[1], labels[0], labels[1]


def _macro_f1(predictions: np.ndarray, labels: np.ndarray, class_count: int) -> float:
    scores = []
    for class_id in range(class_count):
        true_positive = np.sum((predictions == class_id) & (labels == class_id))
        false_positive = np.sum((predictions == class_id) & (labels != class_id))
        false_negative = np.sum((predictions != class_id) & (labels == class_id))
        denominator = 2 * true_positive + false_positive + false_negative
        scores.append(float(2 * true_positive / denominator) if denominator else 0.0)
    return float(np.mean(scores))


def compute_metrics(eval_preds):
    ner_logits, intent_logits, ner_labels, intent_labels = _prediction_arrays(eval_preds)
    ner_predictions = np.argmax(ner_logits, axis=-1)
    intent_predictions = np.argmax(intent_logits, axis=-1)

    true_labels, predicted_labels = [], []
    for pred_row, label_row in zip(ner_predictions, ner_labels):
        true_labels.append([ID2LABEL[int(label)] for label in label_row if label != -100])
        predicted_labels.append(
            [
                ID2LABEL[int(pred)]
                for pred, label in zip(pred_row, label_row)
                if label != -100
            ]
        )

    return {
        "ner_f1": f1_score(true_labels, predicted_labels),
        "intent_accuracy": float(np.mean(intent_predictions == intent_labels)),
        "intent_macro_f1": _macro_f1(
            intent_predictions,
            intent_labels,
            class_count=len(INTENT2ID),
        ),
    }


def intent_class_weights(dataset: MultiTaskDataset) -> list[float]:
    counts = Counter(int(sample["intent_labels"]) for sample in dataset.data)
    total = sum(counts.values())
    class_count = len(INTENT2ID)
    return [
        total / (class_count * max(counts.get(class_id, 0), 1))
        for class_id in range(class_count)
    ]


def create_model(tokenizer, weights: list[float]):
    if os.path.exists(OLD_MODEL_PATH):
        return MultiTaskRobertaForTokenAndIntentClassification.from_ner_checkpoint(
            OLD_MODEL_PATH,
            intent_num_labels=len(INTENT2ID),
            intent_label2id=INTENT2ID,
            intent_id2label=ID2INTENT,
            intent_class_weights=weights,
        )

    config = AutoConfig.from_pretrained(MODEL_NAME)
    config.num_labels = len(LABEL2ID)
    config.id2label = ID2LABEL
    config.label2id = LABEL2ID
    config.intent_num_labels = len(INTENT2ID)
    config.intent_label2id = INTENT2ID
    config.intent_id2label = ID2INTENT
    config.intent_class_weights = weights
    model = MultiTaskRobertaForTokenAndIntentClassification(config)
    base = RobertaModel.from_pretrained(MODEL_NAME, config=config)
    model.roberta.load_state_dict(base.state_dict())
    return model


def train():
    print("[1/5] Loading tokenizer and datasets")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    train_dataset = MultiTaskDataset(TRAIN_DATA_PATH)
    val_dataset = MultiTaskDataset(VAL_DATA_PATH)
    print(f"  Train: {len(train_dataset)} | Val: {len(val_dataset)}")

    print("[2/5] Initializing shared NER + intent model")
    model = create_model(tokenizer, intent_class_weights(train_dataset))

    print("[3/5] Configuring Trainer")
    training_args = TrainingArguments(
        output_dir=OUTPUT_DIR,
        num_train_epochs=NUM_EPOCHS,
        per_device_train_batch_size=4,
        per_device_eval_batch_size=4,
        learning_rate=2e-5,
        weight_decay=0.01,
        warmup_steps=100,
        eval_strategy="epoch",
        save_strategy="no",
        load_best_model_at_end=False,
        logging_steps=25,
        report_to="none",
        remove_unused_columns=False,
        label_names=["labels", "intent_labels"],
        max_steps=MAX_STEPS,
    )

    trainer_kwargs = dict(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=val_dataset,
        data_collator=MultiTaskDataCollator(tokenizer),
        compute_metrics=compute_metrics,
    )
    import transformers  # type: ignore

    version = tuple(int(part) for part in transformers.__version__.split(".")[:2])
    if version >= (4, 46):
        trainer_kwargs["processing_class"] = tokenizer
    else:
        trainer_kwargs["tokenizer"] = tokenizer

    trainer = Trainer(**trainer_kwargs)

    print("[4/5] Training...")
    trainer.train()

    print("[5/5] Saving model and tokenizer")
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    trainer.save_model(OUTPUT_DIR)
    tokenizer.save_pretrained(OUTPUT_DIR)
    print(f"Saved multi-task model to {OUTPUT_DIR}")
    print(json.dumps(trainer.evaluate(), indent=2))


if __name__ == "__main__":
    train()
