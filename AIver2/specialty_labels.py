"""Shared specialty labels for the specialty-aware NER model."""
# Nhãn chuyên biệt dùng cho mô hình NER có khả năng nhận diện các thực thể chuyên biệt.

from __future__ import annotations

SPECIALTY_CODES = (
    "GENERAL_MEDICINE", # Thổng quát.
    "CARDIOLOGY", # Tim mạch.
    "RESPIRATORY", # Hô hấp.
    "PEDIATRICS", # Nhi khoa.
    "DERMATOLOGY", # Da Liễu.
    "NEUROLOGY", # Thần kinh.
    "ENT", # Tai mũi họng.
    "OB_GYN", # Sản phụ khoa.
    "ORTHOPEDICS", # Chấn thương chỉnh hình.
    "OPHTHALMOLOGY", # Nhãn khoa.
    "GASTROENTEROLOGY", # Tiêu hóa.
    "DENTISTRY", # Nha khoa.
    "UROLOGY", # Tiết niệu.
    "ENDOCRINOLOGY", # Nội tiết.
    "PSYCHIATRY", # Tâm thần học.
    "ONCOLOGY", # Ung bứu.
    "EMERGENCY", # Triệu chứng cấp cứu.
)

# Dùng để tạp bảng chuyển đổi nhãn NER Chuyên khoa giữa text và số ID.
#   - Trong đó B là bắt đầu, I là kết thức, O là không thuộc triệu chứng.
#   - Dùng để chuyển text thành nhãn với số bắt đầu và kết thúc hỗ trợ model dữ đoán chuyên khoa.
def build_label_maps() -> tuple[dict[str, int], dict[int, str]]:
    labels = ["O"]
    for code in SPECIALTY_CODES:
        labels.extend([f"B-{code}", f"I-{code}"])
    label2id = {label: index for index, label in enumerate(labels)}
    return label2id, {index: label for label, index in label2id.items()}


LABEL2ID, ID2LABEL = build_label_maps()


def validate_specialty_code(code: str) -> str:
    if code not in SPECIALTY_CODES:
        valid = ", ".join(SPECIALTY_CODES)
        raise ValueError(f"Unknown specialty label '{code}'. Use one of: {valid}")
    return code

