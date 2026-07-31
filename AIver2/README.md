# AIver2 medical slots

PhoBERT multi-task model for Vietnamese symptom extraction, clinical slots and emergency red flags.

## Dataset and training

The canonical dataset is `data/dataset_training_all.json`. It contains specialty entities, intents, clinical slots and `red_flags`. Severity examples include `đau nhẹ`, `nhẹ nhẹ`, `vừa phải`, `nặng`, `đau dữ dội`, `âm ỉ` and `không chịu nổi`; relative durations include `sáng hôm nay`, `chiều hôm qua`, `2 ngày trước`, `1 tuần trước`, `1 tháng trước` and `1 năm trước`.

Prepare the training files, train the model, then start the API:

```bash
python prepare_data.py
python train.py
python model_api.py
```

Generated data files:

```text
data/train_multitask.json
data/val_multitask.json
data/test_multitask.json
```

The trained checkpoint is saved to:

```text
output/medical-clinical-slots-model/
```

## Main modules

- `prepare_data.py`: validates, tokenizes and splits the dataset.
- `train.py`: trains the specialty NER, intent, clinical-slot and red-flag heads.
- `model_api.py`: FastAPI service.
- `inference.py`: model loading and response decoding.
- `clinical_normalization.py`: qualitative severity and duration/age normalization.
- `specialty_labels.py`, `intent_labels.py`, `slot_labels.py`: label definitions.
- `multitask_model.py`: shared PhoBERT model architecture.

## API

```text
POST http://localhost:5678/api/extract-symptoms
```

Example request:

```json
{"text":"Tôi bị đau đầu rất nhẹ từ sáng nay"}
```

The response includes `symptoms`, `specialties`, `intent`, `action`, `slots` and `redFlags`.

The service loads `output/medical-clinical-slots-model` by default. Set `MODEL_PATH` to use another local checkpoint.
