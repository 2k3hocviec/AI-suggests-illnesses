# Medical multi-task NER chatbot

Service Python dùng một backbone PhoBERT với hai head:

1. NER: trích xuất triệu chứng và mã chuyên khoa.
2. Intent classification: nhận diện `SYMPTOM`, `GREETING`, `THANKS`, `GOODBYE`, `UNKNOWN`.

Python chỉ trả dữ liệu máy đọc được. NestJS tạo `message`, quyết định có truy vấn bác sĩ hay không.

## Cấu trúc chính

```text
data/dataset_specialty.json   toàn bộ dữ liệu y tế và intent hội thoại
prepare_data.py               tokenize và chia train/validation
multitask_model.py            backbone + NER head + intent head
train.py                      huấn luyện model multi-task
inference.py                  load model và tạo JSON inference
model_api.py                  FastAPI service
```

## Cài đặt

```bash
pip install -r requirements.txt
```

## Chuẩn bị dữ liệu và train

```bash
python prepare_data.py
python train.py
```

Mọi mẫu dữ liệu, bao gồm `GREETING`, `THANKS`, `GOODBYE`, `UNKNOWN` và các
câu kết hợp có triệu chứng, đều nằm trong `data/dataset_specialty.json`.

Checkpoint được lưu tại:

```text
output/medical-multitask-model/
```

Model multi-task khởi tạo NER từ `output/medical-ner-model/` nếu checkpoint cũ tồn tại.

## Response contract

`POST /api/extract-symptoms` chỉ trả bốn trường:

```json
{
  "symptoms": [],
  "specialties": ["GREETING"],
  "intent": "GREETING",
  "action": "REPLY"
}
```

Ví dụ câu cảm ơn:

```json
{
  "symptoms": [],
  "specialties": ["THANKS"],
  "intent": "THANKS",
  "action": "REPLY"
}
```

Ví dụ câu có triệu chứng:

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
  "intent": "SYMPTOM",
  "action": "FIND_DOCTORS"
}
```

Câu `Xin chào, tôi bị đau ngực` ưu tiên `SYMPTOM` nếu NER phát hiện entity đủ confidence.

Các action:

| Intent/action | NestJS xử lý |
|---|---|
| `GREETING/REPLY` | Tạo câu chào |
| `THANKS/REPLY` | Tạo câu cảm ơn |
| `GOODBYE/REPLY` | Tạo câu tạm biệt |
| `SYMPTOM/FIND_DOCTORS` | Truy vấn bác sĩ theo `specialties` |
| `UNKNOWN/CLARIFY` | Yêu cầu người dùng mô tả rõ hơn |

Python không trả về `message`.

## Chạy API

```bash
python model_api.py
```

Mặc định service chạy tại `http://localhost:5678`.

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://localhost:5678/api/extract-symptoms `
  -ContentType "application/json" `
  -Body '{"text":"Xin chào"}'
```

Biến môi trường:

```text
MODEL_PATH              đường dẫn checkpoint, mặc định output/medical-multitask-model
NER_MIN_CONFIDENCE     mặc định 0.7
INTENT_MIN_CONFIDENCE  mặc định 0.6
PORT                    mặc định 5678
```

## Tích hợp NestJS

NestJS nên chỉ truy vấn bác sĩ khi `action === "FIND_DOCTORS"`:

```ts
if (result.action === 'REPLY') {
  return conversationService.createReply(result.intent);
}

if (result.action === 'FIND_DOCTORS') {
  const doctors = await doctorService.findBySpecialties(result.specialties);
  return medicalResponseService.createResponse(result, doctors);
}

return clarificationService.createResponse(result);
```

## Lưu ý

- Hệ thống chỉ mang tính tham khảo, không thay thế chẩn đoán của bác sĩ.
- Cần đánh giá riêng intent macro-F1 và NER F1 trước khi deploy.
- Không lưu thông tin y tế nếu chưa có sự đồng ý của người dùng.
