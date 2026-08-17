"""T5-based rendering of safe follow-up questions for clinical fields."""
# Dùng T5 để diễn đạt các câu hỏi hỏi thêm an toàn dựa trên các trường thông tin y tế.

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("ai-service")

import torch #type: ignore
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer  # type: ignore


QUESTION_FIELDS = ("duration", "severity", "age")
MAX_INPUT_LENGTH = 256
MAX_NEW_TOKENS = 64


@dataclass
class QuestionGeneratorBundle:
    tokenizer: Any
    model: Any
    device: torch.device


def _slot_text(value: Any) -> str:
    if isinstance(value, dict):
        value = value.get("text", "")
    return str(value or "").strip()


def _symptom_text(analysis: dict[str, Any]) -> str:
    values: list[str] = []
    for item in analysis.get("symptoms", []) or []:
        if isinstance(item, dict):
            value = item.get("name") or item.get("text") or ""
        else:
            value = str(item)
        value = str(value).strip()
        if value:
            values.append(value)
    return ", ".join(values[:2]) or "triệu chứng này"


# Xây dựng một prompt có cấu trúc từ những dữ liệu hội thoại và thông tin đã trích xuất.
# Ví dụ:
#   Nhận:
#       field = "severity"
#
#       analysis = {
#           "symptoms": [{"name": "đau đầu"}],
#           "slots": {
#               "duration": {"text": "2 ngày"},
#               "severity": None,
#               "age": None
#           }
#       }
#       history = [
#           {
#               "role": "USER",
#               "content": "Tôi bị đau đầu 2 ngày nay"
#           }
#       ] 
#
#   Trả:
#       NHIỆM VỤ: tạo đúng một câu hỏi ngắn bằng tiếng Việt.
#       Chỉ hỏi trường field_to_ask. Không chẩn đoán, điều trị hoặc kê đơn.
#       THÔNG TIN: {
#           "field_to_ask": "severity",
#           "symptoms": "đau đầu",
#           "duration": "2 ngày",
#           "severity": "",
#           "age": ""
#       }
#       LỊCH SỬ:
#       USER: Tôi bị đau đầu 2 ngày nay
def serialize_question_input(
    field: str,
    analysis: dict[str, Any],
    history: list[dict[str, str]] | None = None,
) -> str:
    """Build the bounded structured prompt shared by training and serving."""

    if field not in QUESTION_FIELDS:
        raise ValueError(f"Unsupported follow-up field: {field}")

    slots = analysis.get("slots") or {}
    if not isinstance(slots, dict):
        slots = {}
    recent_history = history or []
    history_lines = []
    for item in recent_history[-4:]:
        role = str(item.get("role", "USER")).upper()
        content = str(item.get("content", "")).strip()
        if content:
            history_lines.append(f"{role}: {content[:240]}")

    facts = {
        "field_to_ask": field,
        "symptoms": _symptom_text(analysis),
        "duration": _slot_text(slots.get("duration")),
        "severity": _slot_text(slots.get("severity")),
        "age": _slot_text(slots.get("age")),
    }
    lines = [
        "NHIỆM VỤ: tạo đúng một câu hỏi ngắn bằng tiếng Việt.",
        "Chỉ hỏi trường field_to_ask. Không chẩn đoán, điều trị hoặc kê đơn.",
        "THÔNG TIN: " + json.dumps(facts, ensure_ascii=False, sort_keys=True),
    ]
    if history_lines:
        lines.append("LỊCH SỬ:")
        lines.extend(history_lines)
    return "\n".join(lines)


# Load một checkpoint T5 đã fine-tune sẵn từ local 
def load_question_generator(path: str | Path) -> QuestionGeneratorBundle | None:
    """Load a trained local T5 checkpoint, or return None when it is absent."""

    model_dir = Path(path)
    if not (model_dir / "config.json").exists():
        return None

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    tokenizer = AutoTokenizer.from_pretrained(str(model_dir), use_fast=False)
    model = AutoModelForSeq2SeqLM.from_pretrained(str(model_dir))
    model.to(device)
    model.eval()
    return QuestionGeneratorBundle(tokenizer=tokenizer, model=model, device=device)


# Kiểm tra câu hỏi mT5 sinh ra có an toàn không và đúng với field mà policy model yêu cầu không.
# Lớp kiểm tra câu hỏi mT5 sinh ra.
def _is_safe_question(question: str, field: str) -> bool:
    if not question or len(question) > 240:
        return False
    blocked = (
        "chẩn đoán",
        "điều trị",
        "kê đơn",
        "uống thuốc",
        "dùng thuốc",
        "bệnh của bạn",
    )
    if any(value in question.lower() for value in blocked):
        return False
    expected_terms = {
        "duration": (
            "khi nào", "bao lâu", "từ lúc", "từ khi", "được bao lâu",
            "bao giờ", "cách đây", "kéo dài", "bắt đầu", "diễn ra",
            "xảy ra", "triệu chứng",
        ),
        "severity": (
            "mức độ", "nhẹ", "vừa", "nặng", "dữ dội",
            "nghiêm trọng", "đánh giá", "mô tả", "cảm nhận",
        ),
        "age": ("bao nhiêu tuổi", "mấy tuổi", "tuổi"),
    }
    return any(term in question.lower() for term in expected_terms[field])


def generate_follow_up_question(
    field: str,
    analysis: dict[str, Any],
    history: list[dict[str, str]],
    bundle: QuestionGeneratorBundle,
) -> str | None:
    """Generate one validated question. Invalid generations are rejected."""
    # Tạo câu hỏi các câu hỏi tạo ra không hợp lệ sẽ bị loại bỏ
    
    # Tạo prompt, dùng tokennizer đổi prompt thành token số.
    encoded = bundle.tokenizer(
        serialize_question_input(field, analysis, history),
        return_tensors="pt",
        truncation=True,
        max_length=MAX_INPUT_LENGTH,
    )
    
    # Lịch sử đoạn hội thoại quá dài -> cắt bớt không vượt quá giới hạn model
    encoded = {key: value.to(bundle.device) for key, value in encoded.items()}
    with torch.no_grad():
        generated = bundle.model.generate(
            **encoded,
            max_new_tokens=MAX_NEW_TOKENS,
            num_beams=4,
            do_sample=False,
            early_stopping=True,
        )
    # Chuyển token số model sinh ra thành chuỗi tiếng Việt
    question = bundle.tokenizer.decode(generated[0], skip_special_tokens=True)
    # Loại bỏ sentinel tokens mT5 (<extra_id_0>, <extra_id_1>, ...)
    question = re.sub(r"<extra_id_\d+>", "", question)
    question = re.sub(r"\s+", " ", question).strip()
    if question and not question.endswith("?"):
        question += "?"
    is_safe = _is_safe_question(question, field)
    if not is_safe:
        logger.warning("qgen REJECTED field=%s raw=%r", field, question)  # đã có ở lần trước, giữ nguyên
    return question if _is_safe_question(question, field) else None
