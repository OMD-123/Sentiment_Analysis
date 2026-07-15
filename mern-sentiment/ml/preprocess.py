"""
Preprocessing and Tokenization utilities for Multimodal Sentiment Analysis.
Handles Text Tokenization, Image Transforms, and Audio Mel-Spectrogram extraction.
Includes disk-caching of extracted spectrograms for instant loading.
"""

import os
import json
import re
import torch
import torch.nn.functional as F
import numpy as np
from pathlib import Path
from typing import Dict, List, Tuple, Union, Optional
from torchvision import transforms
import torchaudio

MODELS_DIR = Path(__file__).parent.parent / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

_MEL_TRANSFORM_CACHE = {}

class TextTokenizer:
    def __init__(self, max_vocab_size: int = 15000, max_len: int = 64):
        self.max_vocab_size = max_vocab_size
        self.max_len = max_len
        self.word2idx = {"<PAD>": 0, "<UNK>": 1}
        self.idx2word = {0: "<PAD>", 1: "<UNK>"}
        
    def clean_text(self, text: str) -> str:
        text = text.lower()
        text = re.sub(r"http\S+|www\S+|https\S+", "<URL>", text, flags=re.MULTILINE)
        text = re.sub(r"@\w+", "<USER>", text)
        text = re.sub(r"[^\w\s\?\!\.]", " ", text)
        return text.strip()
        
    def build_vocab(self, texts: List[str]) -> None:
        word_counts = {}
        for text in texts:
            cleaned = self.clean_text(text)
            for word in cleaned.split():
                word_counts[word] = word_counts.get(word, 0) + 1
                
        sorted_words = sorted(word_counts.items(), key=lambda x: x[1], reverse=True)
        for word, count in sorted_words[:self.max_vocab_size - 2]:
            if word not in self.word2idx:
                idx = len(self.word2idx)
                self.word2idx[word] = idx
                self.idx2word[idx] = word
                
    def encode(self, text: str) -> List[int]:
        cleaned = self.clean_text(text)
        tokens = [self.word2idx.get(w, 1) for w in cleaned.split()][:self.max_len]
        if len(tokens) < self.max_len:
            tokens += [0] * (self.max_len - len(tokens))
        return tokens
        
    def batch_encode(self, texts: List[str]) -> torch.Tensor:
        return torch.tensor([self.encode(t) for t in texts], dtype=torch.long)
        
    def save(self, filepath: Union[str, Path]) -> None:
        data = {
            "max_vocab_size": self.max_vocab_size,
            "max_len": self.max_len,
            "word2idx": self.word2idx
        }
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            
    @classmethod
    def load(cls, filepath: Union[str, Path]) -> "TextTokenizer":
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        tokenizer = cls(max_vocab_size=data["max_vocab_size"], max_len=data["max_len"])
        tokenizer.word2idx = data["word2idx"]
        tokenizer.idx2word = {int(v): k for k, v in data["word2idx"].items()}
        return tokenizer


def get_image_transforms(is_training: bool = False) -> transforms.Compose:
    if is_training:
        return transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.RandomHorizontalFlip(p=0.5),
            transforms.RandomRotation(15),
            transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])
    else:
        return transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])


def extract_mel_spectrogram(audio_path: Union[str, Path], sr: int = 16000, n_mels: int = 64, max_len: int = 128) -> torch.Tensor:
    audio_path = Path(audio_path)
    cache_path = audio_path.with_suffix(".mel.npy") if audio_path.exists() else None
    
    if cache_path and cache_path.exists():
        try:
            arr = np.load(cache_path)
            return torch.tensor(arr, dtype=torch.float32)
        except Exception:
            pass
            
    try:
        waveform, sample_rate = torchaudio.load(str(audio_path))
        if sample_rate != sr:
            resampler = torchaudio.transforms.Resample(orig_freq=sample_rate, new_freq=sr)
            waveform = resampler(waveform)
        if waveform.size(0) > 1:
            waveform = torch.mean(waveform, dim=0, keepdim=True)
    except Exception:
        import soundfile as sf
        try:
            data, sample_rate = sf.read(str(audio_path))
            if data.ndim > 1:
                data = np.mean(data, axis=1)
            waveform = torch.tensor(data, dtype=torch.float32).unsqueeze(0)
        except Exception:
            waveform = torch.zeros((1, sr * 2), dtype=torch.float32)
            
    global _MEL_TRANSFORM_CACHE
    key = (sr, n_mels)
    if key not in _MEL_TRANSFORM_CACHE:
        _MEL_TRANSFORM_CACHE[key] = torchaudio.transforms.MelSpectrogram(
            sample_rate=sr,
            n_fft=1024,
            hop_length=256,
            n_mels=n_mels
        )
    mel_transform = _MEL_TRANSFORM_CACHE[key]
    mel_spec = mel_transform(waveform)
    
    mel_spec = torch.log(mel_spec + 1e-9)
    mean = mel_spec.mean()
    std = mel_spec.std() + 1e-8
    mel_spec = (mel_spec - mean) / std
    
    time_steps = mel_spec.size(-1)
    if time_steps < max_len:
        pad_width = max_len - time_steps
        mel_spec = F.pad(mel_spec, (0, pad_width))
    else:
        mel_spec = mel_spec[:, :, :max_len]
        
    if cache_path and audio_path.exists():
        try:
            np.save(cache_path, mel_spec.numpy())
        except Exception:
            pass
            
    return mel_spec
