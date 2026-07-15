#!/usr/bin/env python3
"""
Command line script to download and verify all multimodal datasets:
- Text: CardiffNLP TweetEval (Sentiment)
- Image: MVSA-Single / Image Sentiment
- Audio: Speech Emotion Recognition (RAVDESS / CREMA-D)
"""

import sys
import os
from pathlib import Path

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root / "datasets"))
import dataset_loader

def main():
    print("=" * 60)
    print("AUTOMATIC DATASET DOWNLOAD & PREPROCESSING")
    print("=" * 60)
    
    print("\n1. Preparing Text Dataset...")
    text_data = dataset_loader.load_text_dataset(max_samples=6000)
    print(f"   -> Text Train: {len(text_data['train'])}, Val: {len(text_data['val'])}, Test: {len(text_data['test'])}")
    
    print("\n2. Preparing Image Dataset...")
    img_data = dataset_loader.load_image_dataset(num_samples_per_class=150)
    print(f"   -> Image Train: {len(img_data['train'])}, Val: {len(img_data['val'])}, Test: {len(img_data['test'])}")
    
    print("\n3. Preparing Audio Dataset...")
    audio_data = dataset_loader.load_audio_dataset(num_samples_per_class=150)
    print(f"   -> Audio Train: {len(audio_data['train'])}, Val: {len(audio_data['val'])}, Test: {len(audio_data['test'])}")
    
    print("\n✔ All datasets downloaded and prepared cleanly!")

if __name__ == "__main__":
    main()
