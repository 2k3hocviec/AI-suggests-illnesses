"""Train the local dialogue-policy heads on the generated dataset."""
# Huấn luyện các đầu ra của model quyết định lồng đi của đoạn hội thoại bằng bộ dữ liệu đã được tạo.

from __future__ import annotations

import json
import os
from pathlib import Path

import torch # type: ignore
from torch.utils.data import DataLoader, Dataset # type: ignore
from transformers import AutoTokenizer  # type: ignore

from dialogue_policy import DialoguePolicyModel, MAX_LENGTH, serialize_policy_input
from multitask_model import MultiTaskRobertaForTokenAndIntentClassification
from policy_labels import ACTION2ID, FIELD2ID, ID2ACTION


ROOT = Path(__file__).parent
BASE_MODEL_PATH = Path(os.getenv("BASE_MODEL_PATH", str(ROOT / "output" / "medical-clinical-slots-model")))
TRAIN_PATH = Path(os.getenv("POLICY_TRAIN_PATH", str(ROOT / "data" / "train_dialogue_policy.json")))
VAL_PATH = Path(os.getenv("POLICY_VAL_PATH", str(ROOT / "data" / "val_dialogue_policy.json")))
TEST_PATH = Path(os.getenv("POLICY_TEST_PATH", str(ROOT / "data" / "test_dialogue_policy.json")))
OUTPUT_DIR = Path(os.getenv("POLICY_OUTPUT_DIR", str(ROOT / "output" / "dialogue-policy")))
EPOCHS = int(os.getenv("POLICY_EPOCHS", "3"))
BATCH_SIZE = int(os.getenv("POLICY_BATCH_SIZE", "2"))
LEARNING_RATE = float(os.getenv("POLICY_LEARNING_RATE", "2e-5"))
MAX_STEPS = int(os.getenv("POLICY_MAX_STEPS", "-1"))
SKIP_EVAL = os.getenv("POLICY_SKIP_EVAL", "false").lower() == "true"


class PolicyDataset(Dataset):
    def __init__(self, path: Path, tokenizer):
        with path.open("r", encoding="utf-8-sig") as file:
            self.records = json.load(file)
        self.tokenizer = tokenizer

    def __len__(self):
        return len(self.records)

    def __getitem__(self, index):
        record = self.records[index]
        encoded = self.tokenizer(
            serialize_policy_input(
                record["history"][-1]["content"],
                record["history"],
                record["facts"],
            ),
            truncation=True,
            max_length=MAX_LENGTH,
            padding="max_length",
            return_tensors="pt",
        )
        return {
            "input_ids": encoded["input_ids"].squeeze(0),
            "attention_mask": encoded["attention_mask"].squeeze(0),
            "action_labels": torch.tensor(ACTION2ID[record["nextAction"]]),
            "field_labels": torch.tensor(FIELD2ID[record["field"]]),
        }


def _metrics(model, dataset, device) -> dict[str, float]:
    loader = DataLoader(dataset, batch_size=BATCH_SIZE)
    action_true, action_pred, field_true, field_pred = [], [], [], []
    model.eval()
    with torch.no_grad():
        for batch in loader:
            action_logits, field_logits = model(
                batch["input_ids"].to(device), batch["attention_mask"].to(device)
            )
            action_true.extend(batch["action_labels"].tolist())
            field_true.extend(batch["field_labels"].tolist())
            action_pred.extend(action_logits.argmax(dim=-1).cpu().tolist())
            field_pred.extend(field_logits.argmax(dim=-1).cpu().tolist())

    def accuracy(true, pred):
        return sum(left == right for left, right in zip(true, pred)) / max(len(true), 1)

    def macro_f1(true, pred, class_count):
        scores = []
        for class_id in range(class_count):
            tp = sum(a == class_id and b == class_id for a, b in zip(true, pred))
            fp = sum(a != class_id and b == class_id for a, b in zip(true, pred))
            fn = sum(a == class_id and b != class_id for a, b in zip(true, pred))
            denominator = 2 * tp + fp + fn
            scores.append(2 * tp / denominator if denominator else 0.0)
        return sum(scores) / len(scores)

    emergency_id = ACTION2ID["EMERGENCY"]
    emergency_true = sum(value == emergency_id for value in action_true)
    emergency_hit = sum(
        actual == emergency_id and predicted == emergency_id
        for actual, predicted in zip(action_true, action_pred)
    )
    return {
        "action_accuracy": accuracy(action_true, action_pred),
        "action_macro_f1": macro_f1(action_true, action_pred, len(ACTION2ID)),
        "field_accuracy": accuracy(field_true, field_pred),
        "emergency_recall": emergency_hit / max(emergency_true, 1),
    }


def main() -> None:
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")
    tokenizer = AutoTokenizer.from_pretrained(str(BASE_MODEL_PATH))
    train_dataset = PolicyDataset(TRAIN_PATH, tokenizer)
    val_dataset = PolicyDataset(VAL_PATH, tokenizer)
    test_dataset = PolicyDataset(TEST_PATH, tokenizer)

    base = MultiTaskRobertaForTokenAndIntentClassification.from_pretrained(
        str(BASE_MODEL_PATH)
    )
    model = DialoguePolicyModel(base.roberta, int(base.config.hidden_size)).to(device)
    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)
    optimizer = torch.optim.AdamW(model.parameters(), lr=LEARNING_RATE, weight_decay=0.01)
    action_loss = torch.nn.CrossEntropyLoss()
    field_loss = torch.nn.CrossEntropyLoss()
    step = 0

    for epoch in range(EPOCHS):
        model.train()
        for batch in train_loader:
            optimizer.zero_grad()
            action_logits, field_logits = model(
                batch["input_ids"].to(device), batch["attention_mask"].to(device)
            )
            loss = action_loss(action_logits, batch["action_labels"].to(device))
            loss = loss + field_loss(field_logits, batch["field_labels"].to(device))
            loss.backward()
            optimizer.step()
            step += 1
            if step % 50 == 0:
                print(f"epoch={epoch + 1} step={step} loss={loss.item():.4f}")
            if MAX_STEPS > 0 and step >= MAX_STEPS:
                break
        if not SKIP_EVAL:
            print("Validation:", json.dumps(_metrics(model, val_dataset, device)))
        if MAX_STEPS > 0 and step >= MAX_STEPS:
            break

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    torch.save({"model": model.state_dict()}, OUTPUT_DIR / "policy_model.pt")
    tokenizer.save_pretrained(str(OUTPUT_DIR))
    with (OUTPUT_DIR / "policy_config.json").open("w", encoding="utf-8") as file:
        json.dump(
            {
                "actions": list(ACTION2ID),
                "fields": list(FIELD2ID),
                "baseModelPath": str(BASE_MODEL_PATH),
                "maxLength": MAX_LENGTH,
            },
            file,
            ensure_ascii=False,
            indent=2,
        )
    if not SKIP_EVAL:
        print("Test:", json.dumps(_metrics(model, test_dataset, device)))
    print(f"Saved policy model to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
