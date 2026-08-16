from transformers import AutoModelForSeq2SeqLM, AutoTokenizer # type: ignore
import torch # type: ignore

path = "output/question-generator"  # đổi đúng path thật của bạn
tok = AutoTokenizer.from_pretrained(path)
model = AutoModelForSeq2SeqLM.from_pretrained(path)

prompt = (
    "NHIỆM VỤ: tạo đúng một câu hỏi ngắn bằng tiếng Việt.\n"
    "Chỉ hỏi trường field_to_ask. Không chẩn đoán, điều trị hoặc kê đơn.\n"
    'THÔNG TIN: {"age": "", "duration": "", "field_to_ask": "severity", "severity": "", "symptoms": "đau bụng"}'
)
enc = tok(prompt, return_tensors="pt")
out = model.generate(**enc, max_new_tokens=64, num_beams=4)
print(repr(tok.decode(out[0], skip_special_tokens=True)))
print(repr(tok.decode(out[0], skip_special_tokens=False)))  # xem cả special token