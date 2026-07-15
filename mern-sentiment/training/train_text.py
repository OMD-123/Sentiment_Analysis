#!/usr/bin/env python3
"""
Training script for Text Modality Sentiment Analysis.
"""

import sys
import os
import json
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
import numpy as np
import pandas as pd
from pathlib import Path

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "datasets"))

import dataset_loader
from ml.preprocess import TextTokenizer
from ml.fusion import TextFeatureExtractor

class TextSentimentDataset(Dataset):
    def __init__(self, df: pd.DataFrame, tokenizer: TextTokenizer):
        self.df = df.reset_index(drop=True)
        self.tokenizer = tokenizer
        
    def __len__(self):
        return len(self.df)
        
    def __getitem__(self, idx):
        row = self.df.iloc[idx]
        text = str(row["text"])
        label = int(row["label"])
        tokens = torch.tensor(self.tokenizer.encode(text), dtype=torch.long)
        return tokens, torch.tensor(label, dtype=torch.long)


def train_text_model(epochs: int = None, batch_size: int = 64, lr: float = 2e-3, patience: int = 2):
    print("=" * 60)
    print("TRAINING TEXT MODEL (RoBERTa/DistilBERT Hybrid Architecture)")
    print("=" * 60)
    
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")
    
    if epochs is None:
        epochs = 15 if torch.cuda.is_available() else 5
        
    data = dataset_loader.load_text_dataset()
    train_df, val_df, test_df = data["train"], data["val"], data["test"]
    
    tokenizer = TextTokenizer(max_vocab_size=15000, max_len=64)
    tokenizer.build_vocab(train_df["text"].tolist())
    
    save_dir = project_root / "models" / "text_model"
    save_dir.mkdir(parents=True, exist_ok=True)
    tokenizer.save(save_dir / "tokenizer.json")
    
    train_dataset = TextSentimentDataset(train_df, tokenizer)
    val_dataset = TextSentimentDataset(val_df, tokenizer)
    test_dataset = TextSentimentDataset(test_df, tokenizer)
    
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False)
    test_loader = DataLoader(test_dataset, batch_size=batch_size, shuffle=False)
    
    model = TextFeatureExtractor(vocab_size=len(tokenizer.word2idx), embed_dim=256, hidden_dim=512, num_classes=3)
    model.to(device)
    
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)
    
    best_val_loss = float("inf")
    best_val_acc = 0.0
    epochs_without_improvement = 0
    history = {"train_loss": [], "val_loss": [], "val_acc": []}
    
    for epoch in range(1, epochs + 1):
        model.train()
        train_loss = 0.0
        for batch_x, batch_y in train_loader:
            batch_x, batch_y = batch_x.to(device), batch_y.to(device)
            optimizer.zero_grad()
            logits, _ = model(batch_x)
            loss = criterion(logits, batch_y)
            loss.backward()
            optimizer.step()
            train_loss += loss.item() * batch_x.size(0)
            
        train_loss /= len(train_dataset)
        scheduler.step()
        
        model.eval()
        val_loss = 0.0
        correct = 0
        with torch.no_grad():
            for batch_x, batch_y in val_loader:
                batch_x, batch_y = batch_x.to(device), batch_y.to(device)
                logits, _ = model(batch_x)
                loss = criterion(logits, batch_y)
                val_loss += loss.item() * batch_x.size(0)
                preds = logits.argmax(dim=1)
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
            epochs_without_improvement = 0
            torch.save({
                "model_state_dict": model.state_dict(),
                "vocab_size": len(tokenizer.word2idx),
                "val_acc": best_val_acc,
                "history": history
            }, save_dir / "best_model.pt")
        else:
            epochs_without_improvement += 1
            if epochs_without_improvement >= patience:
                print(f"Early stopping triggered after {epoch} epochs (patience={patience}).")
                break
                
    if (save_dir / "best_model.pt").exists():
        checkpoint = torch.load(save_dir / "best_model.pt", map_location=device)
        if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
            model.load_state_dict(checkpoint["model_state_dict"])
        
    model.eval()
    test_correct = 0
    with torch.no_grad():
        for batch_x, batch_y in test_loader:
            batch_x, batch_y = batch_x.to(device), batch_y.to(device)
            logits, _ = model(batch_x)
            test_correct += (logits.argmax(dim=1) == batch_y).sum().item()
            
    test_acc = test_correct / len(test_dataset)
    print(f"✔ Text Model Training Complete! Final Test Accuracy: {test_acc:.4f}")
    
    with open(save_dir / "training_history.json", "w") as f:
        json.dump(history, f, indent=2)
        
    return model, test_acc

if __name__ == "__main__":
    train_text_model()
