"""Fine-tune mT5 to render a safe follow-up question selected by the policy model."""
# Huấn luận lại mT5 để tạo ra một câu hỏi hỏi thêm an toàn, dựa trên câu hỏi/ trường thông tin mà polcy model đã chọn.

from __future__ import annotations

import json
import os
from pathlib import Path

import torch # type: ignore
from torch.utils.data import Dataset # type: ignore
from transformers import (  # type: ignore
    AutoModelForSeq2SeqLM,
    DataCollatorForSeq2Seq,
    Seq2SeqTrainer,
    Seq2SeqTrainingArguments,
)

from question_generator import MAX_INPUT_LENGTH, MAX_NEW_TOKENS


ROOT = Path(__file__).parent
MODEL_NAME = os.getenv("QUESTION_GENERATOR_BASE_MODEL", "VietAI/vit5-base")
TRAIN_PATH = Path(os.getenv("QUESTION_TRAIN_PATH", str(ROOT / "data" / "train_question_generation.json")))
VAL_PATH = Path(os.getenv("QUESTION_VAL_PATH", str(ROOT / "data" / "val_question_generation.json")))
TEST_PATH = Path(os.getenv("QUESTION_TEST_PATH", str(ROOT / "data" / "test_question_generation.json")))
OUTPUT_DIR = Path(os.getenv("QUESTION_GENERATOR_OUTPUT", str(ROOT / "output" / "question-generator")))
SPIECE_PATH = Path(os.getenv("QUESTION_GENERATOR_SPIECE", str(ROOT / "spiece.model")))
EPOCHS = float(os.getenv("QUESTION_EPOCHS", "15"))
MAX_STEPS = int(os.getenv("QUESTION_MAX_STEPS", "-1"))


class QuestionDataset(Dataset):
    def __init__(self, path: Path, tokenizer):
        with path.open("r", encoding="utf-8-sig") as file:
            self.records = json.load(file)
        self.tokenizer = tokenizer

    def __len__(self):
        return len(self.records)

    def __getitem__(self, index):
        record = self.records[index]
        encoded = self.tokenizer(
            record["input"],
            truncation=True,
            max_length=MAX_INPUT_LENGTH,
        )
        target = self.tokenizer(
            text_target=record["target"],
            truncation=True,
            max_length=MAX_NEW_TOKENS,
        )
        encoded["labels"] = target["input_ids"]
        return encoded


def load_training_tokenizer(path: Path):
    """Load ViT5 SentencePiece across old and new Transformers versions."""

    if not path.exists():
        raise FileNotFoundError(
            f"Missing SentencePiece vocabulary: {path}. "
            "Upload spiece.model with the training files."
        )

    import inspect
    from sentencepiece import SentencePieceProcessor
    from transformers import T5Tokenizer

    # Transformers 5.x expects the vocabulary as (piece, score) pairs.
    if "vocab" in inspect.signature(T5Tokenizer).parameters:
        processor = SentencePieceProcessor(model_file=str(path))
        vocabulary = [
            (processor.id_to_piece(index), processor.get_score(index))
            for index in range(processor.get_piece_size())
        ]
        return T5Tokenizer(vocab=vocabulary)

    # Transformers 4.x still accepts the SentencePiece path directly.
    return T5Tokenizer(vocab_file=str(path))


def main() -> None:
    for path in (TRAIN_PATH, VAL_PATH):
        if not path.exists():
            raise FileNotFoundError(
                f"Missing {path}. Run generate_question_generator_dataset.py first."
            )

    tokenizer = load_training_tokenizer(SPIECE_PATH)
    # Tải model.
    model = AutoModelForSeq2SeqLM.from_pretrained(MODEL_NAME)
    train_dataset = QuestionDataset(TRAIN_PATH, tokenizer)
    val_dataset = QuestionDataset(VAL_PATH, tokenizer)

    # Tạo các cấu hình train cho Hugging Face Trainer.
    arguments = Seq2SeqTrainingArguments(
        output_dir=str(OUTPUT_DIR),
        num_train_epochs=EPOCHS,
        per_device_train_batch_size=1,
        per_device_eval_batch_size=1,
        gradient_accumulation_steps=4,
        fp16=False,
        bf16=False,

        learning_rate=1e-5,
        weight_decay=0.01,
        max_grad_norm=1.0,
        optim="adamw_torch",
        warmup_ratio=0.1,
        lr_scheduler_type="cosine",

        eval_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        greater_is_better=False,
        save_total_limit=3,
        logging_first_step=True,
        logging_steps=10,
        report_to="none",
        predict_with_generate=True,
        generation_max_length=MAX_NEW_TOKENS,
        max_steps=MAX_STEPS,
    )
    trainer = Seq2SeqTrainer(
        model=model,
        args=arguments,
        train_dataset=train_dataset,
        eval_dataset=val_dataset,
        data_collator=DataCollatorForSeq2Seq(tokenizer=tokenizer, model=model),
    )
    print(f"Train: {len(train_dataset)} | Validation: {len(val_dataset)}")
    trainer.train()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    trainer.save_model(str(OUTPUT_DIR))
    tokenizer.save_pretrained(str(OUTPUT_DIR))
    print(f"Saved T5 question generator to {OUTPUT_DIR}")

    if TEST_PATH.exists():
        test_dataset = QuestionDataset(TEST_PATH, tokenizer)
        print("Test:", trainer.evaluate(test_dataset, metric_key_prefix="test"))


if __name__ == "__main__":
    main()
