#!/usr/bin/env bash
set -e
echo "=========================================================="
echo "Running Multimodal Sentiment Models Training Pipeline"
echo "=========================================================="
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
VENV_PYTHON="/home/user/venv/bin/python3"
PYTHON_CMD="python3"
if [ -f "$VENV_PYTHON" ]; then
    PYTHON_CMD="$VENV_PYTHON"
fi

echo "[1/4] Training Text Modality Model..."
"$PYTHON_CMD" "$PROJECT_ROOT/training/train_text.py"

echo "[2/4] Training Image Modality Model..."
"$PYTHON_CMD" "$PROJECT_ROOT/training/train_image.py"

echo "[3/4] Training Audio Modality Model..."
"$PYTHON_CMD" "$PROJECT_ROOT/training/train_audio.py"

echo "[4/4] Training Multimodal Attention Fusion Model..."
"$PYTHON_CMD" "$PROJECT_ROOT/training/train_fusion.py"

echo "[Evaluation] Generating Model Evaluation Metrics and Plots..."
"$PYTHON_CMD" "$PROJECT_ROOT/training/evaluate_all.py"

echo "✔ Complete Multimodal Training Pipeline Finished Successfully!"
