## Medical NER Chatbot — Hướng dẫn sử dụng

Hệ thống tư vấn y tế tự động gồm 2 bước:
1. **NER** — Trích xuất triệu chứng từ câu người dùng
2. **Mapping** — Ánh xạ triệu chứng → chuyên khoa bác sĩ phù hợp

---

## Cấu trúc thư mục

```
medical_ner/
├── data/
│   ├── dataset.json          ← Dataset gốc tiếng Việt
│   ├── dataset_specialty.json ← Nhãn NER theo chuyên khoa để train
│   ├── train_processed.json  ← Sau khi chạy prepare_data.py
│   └── val_processed.json
├── output/
│   └── medical-ner-model/    ← Model sau khi train xong
├── symptom_mapping.py        ← Logic ánh xạ triệu chứng → bác sĩ
├── prepare_data.py           ← Tiền xử lý data
├── train.py                  ← Training script
├── inference.py              ← Dùng model để predict
└── README.md
```

---

## Cài đặt

```bash
pip install transformers torch datasets seqeval fastapi uvicorn
# Nếu dùng PhoBERT (khuyên dùng cho tiếng Việt):
pip install transformers[sentencepiece]
```

---

## Chạy theo thứ tự

### Bước 0 — Tạo nhãn chuyên khoa cho NER

Model mới học trực tiếp entity theo chuyên khoa, ví dụ `CARDIOLOGY`,
`RESPIRATORY`, `NEUROLOGY`, thay vì nhãn chung `SYMPTOM`.

```bash
python label_dataset_specialties.py
```

Script tạo `data/dataset_specialty.json`, tự sửa các offset tìm được và suy ra
nhãn ban đầu từ mapping cũ. Trước khi train, tìm và sửa mọi nhãn
`REVIEW_REQUIRED` trong file này; `suggested_label`, nếu có, là khoa gợi ý
cho entity đang sai offset. Một entity phải có đúng một chuyên khoa chính;
các cảnh báo cấp cứu vẫn nên xử lý bằng rule riêng.

### Bước 1 — Chuẩn bị data
```bash
python prepare_data.py
```
> Chuyển `data/dataset_specialty.json` → `train_processed.json` + `val_processed.json`

### Bước 2 — Train model
```bash
python train.py
```
> Model lưu vào `output/medical-ner-model/`  
> Với 20 mẫu: train nhanh (~2–5 phút CPU). Nên bổ sung thêm data để model tốt hơn.

### Bước 3 — Test inference
```bash
python inference.py
```

---

## Tích hợp vào Chatbot

```python
from inference import load_ner_pipeline, predict

# Khởi tạo 1 lần khi server start
ner_pipeline = load_ner_pipeline()

# Gọi mỗi khi nhận tin nhắn từ user
def handle_user_message(user_text: str) -> str:
    result = predict(user_text, ner_pipeline)
    return result["message"]

# Ví dụ:
response = handle_user_message("Tôi bị đau đầu và sốt cao")
print(response)
```

### Response API cho backend đặt lịch

`POST /api/extract-symptoms` chỉ trả về mã chuyên khoa model dự đoán.
Frontend tự ánh xạ mã này sang tên hoặc nội dung hiển thị:

```json
{
  "symptoms": [
    {
      "name": "đau ngực",
      "confidence": 0.91,
      "specialty_code": "CARDIOLOGY"
    }
  ],
  "specialties": ["CARDIOLOGY"],
  "message": "Tìm thấy 1 triệu chứng và 1 chuyên khoa phù hợp."
}
```

### Thêm chào hỏi mà không train lại model

`model_api.py` xử lý các tin nhắn xã giao đơn giản trước khi gọi NER:

| Ý định | Ví dụ tin nhắn |
|-------|----------------|
| Chào hỏi | `Xin chào`, `Hello`, `Chào bạn` |
| Cảm ơn | `Cảm ơn`, `Thanks` |
| Trợ giúp | `Bạn làm được gì?`, `Hướng dẫn` |
| Tạm biệt | `Tạm biệt`, `Bye` |

Với các tin nhắn này, API vẫn giữ đúng contract hiện tại để backend không cần
đổi cấu trúc response:

```json
{
  "symptoms": [],
  "specialties": [],
  "message": "Xin chào! Tôi có thể giúp bạn gợi ý chuyên khoa dựa trên triệu chứng. Bạn đang gặp triệu chứng gì?"
}
```

Chỉ tin nhắn khớp hoàn toàn với ý định xã giao mới nhận phản hồi cố định.
Tin nhắn có nội dung sức khỏe như `Xin chào, tôi bị đau ngực` vẫn được đưa
qua model NER để không bỏ sót triệu chứng.

### Chạy và kiểm tra API

Khởi động service Python:

```bash
python model_api.py
```

Service mặc định lắng nghe tại `http://localhost:5678`. Thử lời chào bằng
PowerShell:

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://localhost:5678/api/extract-symptoms `
  -ContentType "application/json" `
  -Body '{"text":"Xin chào"}'
```

Thử câu có triệu chứng:

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://localhost:5678/api/extract-symptoms `
  -ContentType "application/json" `
  -Body '{"text":"Xin chào, tôi bị đau ngực"}'
```

Khi gọi qua NestJS, đặt `PYTHON_API_URL=http://localhost:5678` và
`PYTHON_API_ENDPOINT=/api/extract-symptoms`. DTO NestJS hiện yêu cầu tối thiểu
3 ký tự, vì vậy dùng `Xin chào` thay cho tin nhắn hai ký tự như `Hi`.

### Tự thêm câu xã giao mới

Không cần sửa dataset hoặc chạy lại `train.py`. Mở hàm
`conversational_reply()` trong `model_api.py` và thêm cụm từ đã chuẩn hóa vào
nhóm tương ứng:

```python
"greeting": (
    {"chao", "xin chao", "xin chao bac si"},
    "Xin chào! ...",
)
```

Hàm `normalize_text()` tự chuyển chữ hoa, dấu câu và dấu tiếng Việt trước khi
so khớp, vì vậy `Xin chào bác sĩ!` sẽ khớp với `xin chao bac si`. Sau khi thay
đổi, khởi động lại `python model_api.py` và thử lại request PowerShell phía
trên.

---

## Mở rộng dataset

Dataset hiện tại vẫn ở quy mô demo; nên bổ sung thêm mẫu sau khi đã làm sạch
offset và nhãn chuyên khoa. Khuyến nghị tối thiểu **200–500 mẫu** để đánh giá
một prototype có ý nghĩa hơn.

### Cách thêm data vào `data/dataset.json`:

```json
{
  "text": "Tôi bị đau bụng và sốt nhẹ",
  "entities": [
    {"start": 7, "end": 15, "label": "GASTROENTEROLOGY", "text": "đau bụng"},
    {"start": 19, "end": 26, "label": "GENERAL_MEDICINE", "text": "sốt nhẹ"}
  ]
}
```

> **Lưu ý `start`/`end`**: đây là chỉ số ký tự trong chuỗi `text`.  
> Dùng Python để kiểm tra: `text[start:end]` phải bằng đúng triệu chứng.

---

## Model được dùng

| Model | Ngôn ngữ | Ghi chú |
|-------|----------|---------|
| `vinai/phobert-base` | Tiếng Việt | **Khuyên dùng** — được train trên corpus VN |
| `bert-base-multilingual-cased` | Đa ngôn ngữ | Dự phòng nếu không cài được PhoBERT |

---

## Lưu ý quan trọng

- Hệ thống này **chỉ mang tính tham khảo**, không thay thế bác sĩ.
- Luôn hiển thị cảnh báo này cho người dùng khi deploy.
- Không lưu trữ thông tin y tế của người dùng khi không có sự đồng ý.


## LEGACY_SPECIALTY_HINTS:
    ("Cấp cứu", "EMERGENCY"),
    ("Ung bướu", "ONCOLOGY"),
    ("Sản phụ khoa", "OB_GYN"),
    ("Nhi khoa", "PEDIATRICS"),
    ("Tâm thần", "PSYCHIATRY"),
    ("Tim mạch", "CARDIOLOGY"),
    ("Hô hấp", "RESPIRATORY"),
    ("Thần kinh", "NEUROLOGY"),
    ("Nội tiết", "ENDOCRINOLOGY"),
    ("Tiết niệu", "UROLOGY"),
    ("Cơ xương khớp", "ORTHOPEDICS"),
    ("Da liễu", "DERMATOLOGY"),
    ("Nhãn khoa", "OPHTHALMOLOGY"),
    ("Răng", "DENTISTRY"),
    ("Tai Mũi Họng", "ENT"),
    ("Tiêu hóa", "GASTROENTEROLOGY"),
    ("Nội khoa", "GENERAL_MEDICINE"),
    ("Đa khoa", "GENERAL_MEDICINE"),

## Tính điểm score
- Mô hình  token classification. Với mỗi token đầu vào, model xuất ra điểm thô logits cho các nhãn:
  O
  B-GENERAL_MEDICINE
  I-GENERAL_MEDICINE
  B-CARDIOLOGY
  I-CARDIOLOGY
  ...
- Pipeline áp dụng softmax:
  O                    0.01
  B-GENERAL_MEDICINE   0.93
  B-CARDIOLOGY         0.02
  B-RESPIRATORY        0.04
- Model chọn:
  {
    "word": "sốt",
    "entity_group": "GENERAL_MEDICINE",
    "score": 0.93
  }
  => Lúc này model nguyên mạnh về "GENERAL_MEDICINE",

** Trong một câu có thể có nhiều ngưỡng ví dụ:
  CARDIOLOGY: 0.91  -> giữ lại
  NEUROLOGY: 0.73   -> giữ lại
  PEDIATRICS: 0.52  -> bỏ qua
  => Trường hợp này nó sẽ lấy duy nhất cái cao nhất
