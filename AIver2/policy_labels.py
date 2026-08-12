"""Labels shared by the dialogue-policy dataset, trainer and API."""
# Nhãn dùng huấn luyện bởi dataset dialogue-policy, train model và API.

from __future__ import annotations

ACTION_CODES = (
    "ASK_FOLLOW_UP", # Hành động hỏi câu hỏi theo luồng. Thiếu thông tin -> Hỏi tiếp.
    "FIND_DOCTORS", # Đủ thông tin -> Tìm bác sĩ.
    "EMERGENCY", # Triệu chứng cấp cứu -> Dừng câu hỏi ->  Đưa lời khuyên.
    "REPLY", # Trả lời 3 loai câu hỏi thông thường: chào hỏi, cảm ơn, tạm biệt; không dùng chuẩn đoán bệnh.
    "CLARIFY", # Chưa hiểu câu hỏi mà người dùng đang nói.
)

FIELD_CODES = ("NONE", "duration", "severity", "age")

ACTION2ID = {value: index for index, value in enumerate(ACTION_CODES)}
ID2ACTION = {index: value for value, index in ACTION2ID.items()}
FIELD2ID = {value: index for index, value in enumerate(FIELD_CODES)}
ID2FIELD = {index: value for value, index in FIELD2ID.items()}


# Kiểm tra action có thuộc danh sách hợp lệ không.
def validate_action(value: str) -> str:
    if value not in ACTION2ID:
        raise ValueError(f"Unknown dialogue action: {value}")
    return value


# Kiểm tra feild có thuộc danh sách cho phép không.
def validate_field(value: str) -> str:
    if value not in FIELD2ID:
        raise ValueError(f"Unknown dialogue field: {value}")
    return value
