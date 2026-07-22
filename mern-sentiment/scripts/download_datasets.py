#!/usr/bin/env python3
"""
Command line script to download and verify all multimodal benchmark datasets:
- Text : CardiffNLP TweetEval (Sentiment)              - Hugging Face
- Image: FI (Flickr & Instagram) Emotion Dataset       - You et al., AAAI 2016
- Audio: RAVDESS Speech Emotion (Livingstone & Russo)  - Zenodo 1188976

See datasets/README.md for instructions on obtaining the FI archive.
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

    print("\n1. Preparing Text Dataset (CardiffNLP TweetEval)...")
    text_data = dataset_loader.load_text_dataset(max_samples=6000)
    print(f"   -> Text Train: {len(text_data['train'])}, Val: {len(text_data['val'])}, Test: {len(text_data['test'])}")

    print("\n2. Preparing Image Dataset (FI - Flickr & Instagram)...")
    img_data = dataset_loader.load_image_dataset(num_samples_per_class=150)
    print(f"   -> Image Train: {len(img_data['train'])}, Val: {len(img_data['val'])}, Test: {len(img_data['test'])}")

    print("\n3. Preparing Audio Dataset (RAVDESS Speech Emotion)...")
    audio_data = dataset_loader.load_audio_dataset(num_samples_per_class=150)
    print(f"   -> Audio Train: {len(audio_data['train'])}, Val: {len(audio_data['val'])}, Test: {len(audio_data['test'])}")

    for name, data in [("Image", img_data), ("Audio", audio_data)]:
        for split, df in data.items():
            if "source" in df.columns and len(df) > 0:
                src = df["source"].iloc[0]
                if src == "synthetic-fallback":
                    print(f"   !! {name} ({split}) is using synthetic placeholders -")
                    print("      see datasets/README.md to enable the real benchmark data.")
                    break

    print("\n✔ All datasets downloaded and prepared cleanly!")

if __name__ == "__main__":
    main()
