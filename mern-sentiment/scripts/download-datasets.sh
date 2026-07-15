#!/usr/bin/env bash
set -e
echo "=========================================================="
echo "Running Automatic Dataset Download & Preprocessing Script"
echo "=========================================================="
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_PYTHON="/home/user/venv/bin/python3"

if [ -f "$VENV_PYTHON" ]; then
    "$VENV_PYTHON" "$SCRIPT_DIR/download_datasets.py"
else
    python3 "$SCRIPT_DIR/download_datasets.py"
fi
