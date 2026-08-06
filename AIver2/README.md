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

## Dialogue policy POC

The dialogue-policy model chooses the next safe action and missing clinical
field. It does not diagnose or generate treatment advice.

```bash
python generate_dialogue_policy_dataset.py
python train_dialogue_policy.py
python model_api.py
```

The generated files are stored separately from the PhoBERT dataset:

```text
data/dialogue_policy.json
data/train_dialogue_policy.json
data/val_dialogue_policy.json
data/test_dialogue_policy.json
output/dialogue-policy/policy_model.pt
```

The API exposes `POST /api/decide-next`. If the policy checkpoint is missing,
the endpoint returns `503` and the NestJS backend keeps its existing fallback
behavior.

## Docker

The local Docker service runs the PhoBERT clinical model and dialogue policy
from the local `output/` directory mounted read-only into the container. To
start it:

```bash
docker compose up --build
```

The API is available at `http://localhost:5678`. The dialogue policy uses the
conversation history and structured clinical analysis to return the next safe
action and missing field. It does not generate diagnosis, treatment advice or
follow-up wording.
