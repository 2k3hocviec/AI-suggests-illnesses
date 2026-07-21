"""FastAPI service for multi-task medical NER and sentence-intent inference."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Literal

os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

from fastapi import FastAPI, HTTPException  # type: ignore
from fastapi.middleware.cors import CORSMiddleware  # type: ignore
from pydantic import BaseModel  # type: ignore

from inference import InferenceBundle, load_multitask_model, predict


DEFAULT_MODEL_PATH = str(Path(__file__).parent / "output" / "medical-multitask-model")
MODEL_PATH = os.getenv("MODEL_PATH", DEFAULT_MODEL_PATH)
PORT = int(os.getenv("PORT", "5678"))

app = FastAPI(title="Medical Multi-task NER and Intent API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

inference_bundle: InferenceBundle | None = None


def is_local_model_path(model_path: str) -> bool:
    """Return True for filesystem paths, False for Hugging Face repo ids."""

    return (
        os.path.isabs(model_path)
        or model_path.startswith((".", "\\"))
        or ":" in model_path
    )


class SymptomRequest(BaseModel):
    text: str


class DetectedSymptom(BaseModel):
    name: str
    confidence: float
    specialty_code: str


class SymptomResponse(BaseModel):
    symptoms: list[DetectedSymptom]
    specialties: list[str]
    intent: Literal["SYMPTOM", "GREETING", "THANKS", "GOODBYE", "UNKNOWN"]
    action: Literal["FIND_DOCTORS", "REPLY", "CLARIFY"]


@app.on_event("startup")
async def load_model():
    """Load the multi-task checkpoint once when the service starts."""

    global inference_bundle
    print(f"[AI Service] Loading multi-task model from: {MODEL_PATH}")

    if is_local_model_path(MODEL_PATH) and not os.path.exists(MODEL_PATH):
        parent = os.path.dirname(MODEL_PATH)
        files = os.listdir(parent) if os.path.exists(parent) else "folder not found"
        print(f"[AI Service] Model not found at: {MODEL_PATH}")
        print(f"[AI Service] Current files: {files}")
        return

    try:
        inference_bundle = load_multitask_model(MODEL_PATH)
        print(f"[AI Service] Multi-task model loaded from: {MODEL_PATH}")
    except Exception as error:
        inference_bundle = None
        print(f"[AI Service] Model load error: {type(error).__name__}: {error}")
        import traceback

        traceback.print_exc()


@app.get("/health")
async def health_check():
    """Check whether the multi-task model is ready."""

    return {
        "status": "ok" if inference_bundle else "degraded",
        "model_loaded": inference_bundle is not None,
        "model_path": MODEL_PATH,
        "model_source": "local" if is_local_model_path(MODEL_PATH) else "huggingface",
        "model_exists": os.path.exists(MODEL_PATH) if is_local_model_path(MODEL_PATH) else None,
    }


@app.post("/api/extract-symptoms", response_model=SymptomResponse)
async def extract_symptoms(request: SymptomRequest):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text khong duoc trong")
    if inference_bundle is None:
        raise HTTPException(status_code=503, detail="Multi-task model chua load")

    return SymptomResponse(**predict(request.text, inference_bundle))


if __name__ == "__main__":
    import uvicorn  # type: ignore

    uvicorn.run(app, host="0.0.0.0", port=PORT)
