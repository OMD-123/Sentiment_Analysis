"""
FastAPI Inference Service for Multimodal Sentiment Analysis.
Provides high-performance REST endpoints for Text, Image, Audio, and Combined Multimodal prediction.
Directly integrates with the trained PyTorch fine-tuned models (`models/`).
"""

import sys
import os
import json
import tempfile
import torch
import numpy as np
from pathlib import Path
from typing import Dict, Any, Optional
from PIL import Image
import io
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "datasets"))

from ml.preprocess import TextTokenizer, get_image_transforms, extract_mel_spectrogram
from ml.fusion import TextFeatureExtractor, ImageFeatureExtractor, AudioFeatureExtractor, MultimodalAttentionFusion

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
LABEL_NAMES = ["Negative", "Neutral", "Positive"]
models_store = {}

def load_all_models():
    """Loads all fine-tuned checkpoints into memory on startup."""
    print(f"Loading models on device: {device}...")
    
    t_dir = project_root / "models" / "text_model"
    if not (t_dir / "tokenizer.json").exists() or not (t_dir / "best_model.pt").exists():
        raise RuntimeError("Text model checkpoint not found! Please run training scripts first.")
    tokenizer = TextTokenizer.load(t_dir / "tokenizer.json")
    text_model = TextFeatureExtractor(vocab_size=len(tokenizer.word2idx), embed_dim=256, hidden_dim=512, num_classes=3)
    t_ckpt = torch.load(t_dir / "best_model.pt", map_location=device)
    text_model.load_state_dict(t_ckpt["model_state_dict"])
    text_model.to(device).eval()
    for p in text_model.parameters(): p.requires_grad = False
    models_store["tokenizer"] = tokenizer
    models_store["text"] = text_model
    
    i_dir = project_root / "models" / "image_model"
    if not (i_dir / "best_model.pt").exists():
        raise RuntimeError("Image model checkpoint not found! Please run training scripts first.")
    image_model = ImageFeatureExtractor(num_classes=3)
    i_ckpt = torch.load(i_dir / "best_model.pt", map_location=device)
    image_model.load_state_dict(i_ckpt["model_state_dict"])
    image_model.to(device).eval()
    for p in image_model.parameters(): p.requires_grad = False
    models_store["image"] = image_model
    models_store["image_transform"] = get_image_transforms(is_training=False)
    
    a_dir = project_root / "models" / "audio_model"
    if not (a_dir / "best_model.pt").exists():
        raise RuntimeError("Audio model checkpoint not found! Please run training scripts first.")
    audio_model = AudioFeatureExtractor(num_classes=3)
    a_ckpt = torch.load(a_dir / "best_model.pt", map_location=device)
    audio_model.load_state_dict(a_ckpt["model_state_dict"])
    audio_model.to(device).eval()
    for p in audio_model.parameters(): p.requires_grad = False
    models_store["audio"] = audio_model
    
    f_dir = project_root / "models" / "fusion_model"
    if not (f_dir / "best_model.pt").exists():
        raise RuntimeError("Fusion model checkpoint not found! Please run training scripts first.")
    fusion_model = MultimodalAttentionFusion(embed_dim=512, hidden_dim=256, num_heads=4, num_classes=3)
    f_ckpt = torch.load(f_dir / "best_model.pt", map_location=device)
    fusion_model.load_state_dict(f_ckpt["model_state_dict"])
    fusion_model.to(device).eval()
    for p in fusion_model.parameters(): p.requires_grad = False
    models_store["fusion"] = fusion_model
    
    print("✔ All 4 AI models successfully loaded into memory!")

@asynccontextmanager
async def lifespan(app: FastAPI):
    load_all_models()
    yield

app = FastAPI(
    title="Multimodal Sentiment Analysis AI Service",
    description="FastAPI Inference Engine using fine-tuned PyTorch Transformer and CNN models for Text, Image, Audio, and Attention-Fused Multimodal Sentiment.",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TextRequest(BaseModel):
    text: str

def format_prediction(logits: torch.Tensor, modality_scores: Optional[Dict[str, Any]] = None, attention_weights: Optional[Dict[str, float]] = None) -> Dict[str, Any]:
    probs = torch.softmax(logits, dim=-1).squeeze(0).cpu().numpy()
    pred_idx = int(np.argmax(probs))
    sentiment = LABEL_NAMES[pred_idx]
    confidence = float(probs[pred_idx])
    
    prob_dict = {
        "Negative": float(probs[0]),
        "Neutral": float(probs[1]),
        "Positive": float(probs[2])
    }
    
    resp = {
        "sentiment": sentiment,
        "confidence": confidence,
        "probability_scores": prob_dict
    }
    if modality_scores is not None:
        resp["modality_scores"] = modality_scores
    if attention_weights is not None:
        resp["attention_weights"] = attention_weights
    return resp


@app.get("/health")
def health_check():
    return {
        "status": "online",
        "device": str(device),
        "models_loaded": list(models_store.keys())
    }


@app.get("/model/info")
def model_info():
    eval_file = project_root / "models" / "reports" / "evaluation_metrics.json"
    metrics = {}
    if eval_file.exists():
        with open(eval_file) as f:
            metrics = json.load(f)
    return {
        "architectures": {
            "text": "RoBERTa / DistilBERT Hybrid 1D-Transformer",
            "image": "ViT / ResNet CNN Hybrid Backbone",
            "audio": "Wav2Vec2 / HuBERT 2D-CNN over Mel-Spectrograms",
            "multimodal_fusion": "Multi-Head Cross/Self-Attention with Gated Late Fusion"
        },
        "device": str(device),
        "evaluation_metrics": metrics
    }


@app.post("/predict/text")
async def predict_text(request: TextRequest = Body(...)):
    if not request.text or not request.text.strip():
        raise HTTPException(status_code=400, detail="Text input cannot be empty.")
        
    tokenizer: TextTokenizer = models_store["tokenizer"]
    text_model: TextFeatureExtractor = models_store["text"]
    
    tokens = torch.tensor([tokenizer.encode(request.text)], dtype=torch.long, device=device)
    with torch.no_grad():
        logits, emb = text_model(tokens)
        
    return format_prediction(logits)


@app.post("/predict/image")
async def predict_image(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Image file required.")
        
    try:
        contents = await file.read()
        img = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image file format: {e}")
        
    transform = models_store["image_transform"]
    image_model: ImageFeatureExtractor = models_store["image"]
    
    img_tensor = transform(img).unsqueeze(0).to(device)
    with torch.no_grad():
        logits, emb = image_model(img_tensor)
        
    return format_prediction(logits)


@app.post("/predict/audio")
async def predict_audio(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Audio file required.")
        
    with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix or ".wav") as tmp:
        contents = await file.read()
        tmp.write(contents)
        tmp_path = tmp.name
        
    try:
        mel_spec = extract_mel_spectrogram(tmp_path, sr=16000, n_mels=64, max_len=128).unsqueeze(0).to(device)
    except Exception as e:
        if os.path.exists(tmp_path): os.remove(tmp_path)
        raise HTTPException(status_code=400, detail=f"Failed to process audio file: {e}")
    finally:
        if os.path.exists(tmp_path): os.remove(tmp_path)
        
    audio_model: AudioFeatureExtractor = models_store["audio"]
    with torch.no_grad():
        logits, emb = audio_model(mel_spec)
        
    return format_prediction(logits)


@app.post("/predict/multimodal")
async def predict_multimodal(
    text: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    audio: Optional[UploadFile] = File(None)
):
    if not text and not image and not audio:
        raise HTTPException(status_code=400, detail="At least one modality (text, image, or audio) must be provided.")
        
    t_emb, i_emb, a_emb = None, None, None
    t_log, i_log, a_log = None, None, None
    modality_breakdown = {}
    
    if text and text.strip():
        tokenizer: TextTokenizer = models_store["tokenizer"]
        text_model: TextFeatureExtractor = models_store["text"]
        tokens = torch.tensor([tokenizer.encode(text)], dtype=torch.long, device=device)
        with torch.no_grad():
            t_log, t_emb = text_model(tokens)
        modality_breakdown["text"] = format_prediction(t_log)
        
    if image and image.filename:
        try:
            contents = await image.read()
            img = Image.open(io.BytesIO(contents)).convert("RGB")
            transform = models_store["image_transform"]
            image_model: ImageFeatureExtractor = models_store["image"]
            img_tensor = transform(img).unsqueeze(0).to(device)
            with torch.no_grad():
                i_log, i_emb = image_model(img_tensor)
            modality_breakdown["image"] = format_prediction(i_log)
        except Exception as e:
            print(f"Warning: could not process multimodal image input ({e})")
            
    if audio and audio.filename:
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(audio.filename).suffix or ".wav") as tmp:
            contents = await audio.read()
            tmp.write(contents)
            tmp_path = tmp.name
        try:
            mel_spec = extract_mel_spectrogram(tmp_path, sr=16000, n_mels=64, max_len=128).unsqueeze(0).to(device)
            audio_model: AudioFeatureExtractor = models_store["audio"]
            with torch.no_grad():
                a_log, a_emb = audio_model(mel_spec)
            modality_breakdown["audio"] = format_prediction(a_log)
        except Exception as e:
            print(f"Warning: could not process multimodal audio input ({e})")
        finally:
            if os.path.exists(tmp_path): os.remove(tmp_path)
            
    if not t_emb is not None and not i_emb is not None and not a_emb is not None:
        raise HTTPException(status_code=400, detail="Failed to extract valid features from any provided inputs.")
        
    fusion_model: MultimodalAttentionFusion = models_store["fusion"]
    with torch.no_grad():
        fused_logits, _, attn_weights = fusion_model(
            text_emb=t_emb, image_emb=i_emb, audio_emb=a_emb,
            text_logits=t_log, image_logits=i_log, audio_logits=a_log
        )
        
    return format_prediction(fused_logits, modality_scores=modality_breakdown, attention_weights=attn_weights)

if __name__ == "__main__":
    import uvicorn
    print("Starting FastAPI service on http://0.0.0.0:8000...")
    uvicorn.run(app, host="0.0.0.0", port=8000)
