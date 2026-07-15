#!/usr/bin/env python3
"""
Training script for Multimodal Attention & Gated Late Fusion Model.
"""

import sys
import os
import json
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader
import numpy as np
import pandas as pd
from pathlib import Path
from PIL import Image

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "datasets"))

import dataset_loader
from ml.preprocess import TextTokenizer, get_image_transforms, extract_mel_spectrogram
from ml.fusion import TextFeatureExtractor, ImageFeatureExtractor, AudioFeatureExtractor, MultimodalAttentionFusion

class PrecachedMultimodalDataset(Dataset):
    def __init__(self, text_df: pd.DataFrame, image_df: pd.DataFrame, audio_df: pd.DataFrame, tokenizer: TextTokenizer, image_transform=None, is_train: bool = True, max_samples: int = None):
        self.tokenizer = tokenizer
        self.is_train = is_train
        self.items = []
        
        for label in [0, 1, 2]:
            t_sub = text_df[text_df["label"] == label].reset_index(drop=True)
            i_sub = image_df[image_df["label"] == label].reset_index(drop=True)
            a_sub = audio_df[audio_df["label"] == label].reset_index(drop=True)
            
            n = min(len(t_sub), len(i_sub), len(a_sub)) if not is_train else max(len(t_sub), min(len(i_sub), len(a_sub)))
            if max_samples and n > (max_samples // 3):
                n = max_samples // 3
                
            for idx in range(n):
                t_row = t_sub.iloc[idx % len(t_sub)]
                i_row = i_sub.iloc[idx % len(i_sub)]
                a_row = a_sub.iloc[idx % len(a_sub)]
                
                t_tokens = torch.tensor(tokenizer.encode(str(t_row["text"])), dtype=torch.long)
                
                try:
                    img = Image.open(str(i_row["image_path"])).convert("RGB")
                    if image_transform:
                        img_tensor = image_transform(img)
                    else:
                        img_tensor = torch.zeros((3, 224, 224), dtype=torch.float32)
                except Exception:
                    img_tensor = torch.zeros((3, 224, 224), dtype=torch.float32)
                    
                try:
                    audio_tensor = extract_mel_spectrogram(str(a_row["audio_path"]), sr=16000, n_mels=64, max_len=128)
                except Exception:
                    audio_tensor = torch.zeros((1, 64, 128), dtype=torch.float32)
                    
                self.items.append({
                    "text_tokens": t_tokens,
                    "img_tensor": img_tensor,
                    "audio_tensor": audio_tensor,
                    "label": label
                })
                
        if is_train:
            np.random.seed(42)
            np.random.shuffle(self.items)
            
    def __len__(self):
        return len(self.items)
        
    def __getitem__(self, idx):
        item = self.items[idx]
        label = item["label"]
        
        has_text, has_img, has_audio = True, True, True
        if self.is_train and np.random.rand() < 0.35:
            choice = np.random.choice([1, 2, 3, 4, 5, 6])
            if choice == 1: has_img = False
            elif choice == 2: has_audio = False
            elif choice == 3: has_text = False
            elif choice == 4: has_img = False; has_audio = False
            elif choice == 5: has_text = False; has_audio = False
            elif choice == 6: has_text = False; has_img = False
            
        t_tokens = item["text_tokens"] if has_text else torch.zeros(self.tokenizer.max_len, dtype=torch.long)
        t_mask = torch.tensor(1.0 if has_text else 0.0, dtype=torch.float32)
        
        img_tensor = item["img_tensor"] if has_img else torch.zeros((3, 224, 224), dtype=torch.float32)
        img_mask = torch.tensor(1.0 if has_img else 0.0, dtype=torch.float32)
        
        audio_tensor = item["audio_tensor"] if has_audio else torch.zeros((1, 64, 128), dtype=torch.float32)
        audio_mask = torch.tensor(1.0 if has_audio else 0.0, dtype=torch.float32)
        
        return (
            t_tokens, t_mask,
            img_tensor, img_mask,
            audio_tensor, audio_mask,
            torch.tensor(label, dtype=torch.long)
        )


def train_fusion_model(epochs: int = None, batch_size: int = 64, lr: float = 1e-3):
    print("=" * 60)
    print("TRAINING MULTIMODAL ATTENTION & LATE FUSION MODEL")
    print("=" * 60)
    
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")
    
    if epochs is None:
        epochs = 15 if torch.cuda.is_available() else 4
        
    max_samples = None if torch.cuda.is_available() else 240
    
    text_data = dataset_loader.load_text_dataset()
    img_data = dataset_loader.load_image_dataset()
    audio_data = dataset_loader.load_audio_dataset()
    
    tokenizer = TextTokenizer.load(project_root / "models" / "text_model" / "tokenizer.json")
    
    print("Pre-caching multimodal inputs in memory for lightning-fast training...")
    train_dataset = PrecachedMultimodalDataset(text_data["train"], img_data["train"], audio_data["train"], tokenizer, get_image_transforms(is_training=True), is_train=True, max_samples=max_samples)
    val_dataset = PrecachedMultimodalDataset(text_data["val"], img_data["val"], audio_data["val"], tokenizer, get_image_transforms(is_training=False), is_train=False, max_samples=80)
    test_dataset = PrecachedMultimodalDataset(text_data["test"], img_data["test"], audio_data["test"], tokenizer, get_image_transforms(is_training=False), is_train=False, max_samples=80)
    
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False)
    test_loader = DataLoader(test_dataset, batch_size=batch_size, shuffle=False)
    
    print("Loading pretrained unimodal feature extractors...")
    text_model = TextFeatureExtractor(vocab_size=len(tokenizer.word2idx), embed_dim=256, hidden_dim=512, num_classes=3)
    t_ckpt = torch.load(project_root / "models" / "text_model" / "best_model.pt", map_location=device)
    text_model.load_state_dict(t_ckpt["model_state_dict"])
    text_model.to(device).eval()
    for p in text_model.parameters(): p.requires_grad = False
    
    image_model = ImageFeatureExtractor(num_classes=3)
    i_ckpt = torch.load(project_root / "models" / "image_model" / "best_model.pt", map_location=device)
    image_model.load_state_dict(i_ckpt["model_state_dict"])
    image_model.to(device).eval()
    for p in image_model.parameters(): p.requires_grad = False
    
    audio_model = AudioFeatureExtractor(num_classes=3)
    a_ckpt = torch.load(project_root / "models" / "audio_model" / "best_model.pt", map_location=device)
    audio_model.load_state_dict(a_ckpt["model_state_dict"])
    audio_model.to(device).eval()
    for p in audio_model.parameters(): p.requires_grad = False
    
    fusion_model = MultimodalAttentionFusion(embed_dim=512, hidden_dim=256, num_heads=4, num_classes=3)
    fusion_model.to(device)
    
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.AdamW(fusion_model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)
    
    save_dir = project_root / "models" / "fusion_model"
    save_dir.mkdir(parents=True, exist_ok=True)
    
    best_val_loss = float("inf")
    best_val_acc = 0.0
    history = {"train_loss": [], "val_loss": [], "val_acc": []}
    
    for epoch in range(1, epochs + 1):
        fusion_model.train()
        train_loss = 0.0
        for batch in train_loader:
            t_tokens, t_mask, i_tensors, i_mask, a_tensors, a_mask, batch_y = [x.to(device) for x in batch]
            
            with torch.no_grad():
                t_logits, t_emb = text_model(t_tokens)
                i_logits, i_emb = image_model(i_tensors)
                a_logits, a_emb = audio_model(a_tensors)
                
            t_emb_in = torch.where(t_mask.unsqueeze(-1) > 0.5, t_emb, torch.zeros_like(t_emb))
            i_emb_in = torch.where(i_mask.unsqueeze(-1) > 0.5, i_emb, torch.zeros_like(i_emb))
            a_emb_in = torch.where(a_mask.unsqueeze(-1) > 0.5, a_emb, torch.zeros_like(a_emb))
            
            t_log_in = torch.where(t_mask.unsqueeze(-1) > 0.5, t_logits, torch.zeros_like(t_logits))
            i_log_in = torch.where(i_mask.unsqueeze(-1) > 0.5, i_logits, torch.zeros_like(i_logits))
            a_log_in = torch.where(a_mask.unsqueeze(-1) > 0.5, a_logits, torch.zeros_like(a_logits))
            
            optimizer.zero_grad()
            fused_logits, _, _ = fusion_model(
                text_emb=t_emb_in, image_emb=i_emb_in, audio_emb=a_emb_in,
                text_logits=t_log_in, image_logits=i_log_in, audio_logits=a_log_in
            )
            loss = criterion(fused_logits, batch_y)
            loss.backward()
            optimizer.step()
            train_loss += loss.item() * batch_y.size(0)
            
        train_loss /= len(train_dataset)
        scheduler.step()
        
        fusion_model.eval()
        val_loss = 0.0
        correct = 0
        with torch.no_grad():
            for batch in val_loader:
                t_tokens, t_mask, i_tensors, i_mask, a_tensors, a_mask, batch_y = [x.to(device) for x in batch]
                t_logits, t_emb = text_model(t_tokens)
                i_logits, i_emb = image_model(i_tensors)
                a_logits, a_emb = audio_model(a_tensors)
                
                fused_logits, _, _ = fusion_model(
                    text_emb=t_emb, image_emb=i_emb, audio_emb=a_emb,
                    text_logits=t_logits, image_logits=i_logits, audio_logits=a_logits
                )
                loss = criterion(fused_logits, batch_y)
                val_loss += loss.item() * batch_y.size(0)
                preds = fused_logits.argmax(dim=1)
                correct += (preds == batch_y).sum().item()
                
        val_loss /= len(val_dataset)
        val_acc = correct / len(val_dataset)
        history["train_loss"].append(train_loss)
        history["val_loss"].append(val_loss)
        history["val_acc"].append(val_acc)
        
        print(f"Epoch [{epoch:02d}/{epochs:02d}] | Train Loss: {train_loss:.4f} | Val Loss: {val_loss:.4f} | Val Acc: {val_acc:.4f}")
        
        if val_loss < best_val_loss or val_acc > best_val_acc:
            if val_loss < best_val_loss:
                best_val_loss = val_loss
            if val_acc > best_val_acc:
                best_val_acc = val_acc
            torch.save({
                "model_state_dict": fusion_model.state_dict(),
                "val_acc": best_val_acc,
                "history": history
            }, save_dir / "best_model.pt")
            
    if (save_dir / "best_model.pt").exists():
        checkpoint = torch.load(save_dir / "best_model.pt", map_location=device)
        if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
            fusion_model.load_state_dict(checkpoint["model_state_dict"])
            
    fusion_model.eval()
    test_correct = 0
    with torch.no_grad():
        for batch in test_loader:
            t_tokens, t_mask, i_tensors, i_mask, a_tensors, a_mask, batch_y = [x.to(device) for x in batch]
            t_logits, t_emb = text_model(t_tokens)
            i_logits, i_emb = image_model(i_tensors)
            a_logits, a_emb = audio_model(a_tensors)
            fused_logits, _, _ = fusion_model(
                text_emb=t_emb, image_emb=i_emb, audio_emb=a_emb,
                text_logits=t_logits, image_logits=i_logits, audio_logits=a_logits
            )
            test_correct += (fused_logits.argmax(dim=1) == batch_y).sum().item()
            
    test_acc = test_correct / len(test_dataset)
    print(f"✔ Multimodal Fusion Model Training Complete! Final Test Accuracy: {test_acc:.4f}")
    
    with open(save_dir / "training_history.json", "w") as f:
        json.dump(history, f, indent=2)
        
    return fusion_model, test_acc

if __name__ == "__main__":
    train_fusion_model()
