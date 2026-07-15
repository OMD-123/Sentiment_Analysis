#!/usr/bin/env bash
set -e
echo "=========================================================="
echo "Starting Multimodal Sentiment Analysis System"
echo "=========================================================="
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
VENV_PYTHON="/home/user/venv/bin/python3"
PYTHON_CMD="python3"
if [ -f "$VENV_PYTHON" ]; then
    PYTHON_CMD="$VENV_PYTHON"
fi

echo "[1/3] Starting Python FastAPI Inference Service on port 8000..."
"$PYTHON_CMD" "$PROJECT_ROOT/ml/api.py" > "$PROJECT_ROOT/fastapi.log" 2>&1 &
FASTAPI_PID=$!

echo "[2/3] Waiting for AI Models to load into memory..."
sleep 4

echo "[3/3] Starting Node Express + TypeScript Server on port 5000..."
cd "$PROJECT_ROOT/server"
SKIP_MEMORY_SERVER=true node dist/index.js > "$PROJECT_ROOT/express.log" 2>&1 &
EXPRESS_PID=$!

echo "=========================================================="
echo "✔ Multimodal Sentiment Analysis Services are Live!"
echo "✔ FastAPI Inference Engine: http://localhost:8000/health"
echo "✔ Express Backend & React Dashboard: http://localhost:5000"
echo "=========================================================="
echo "Press Ctrl+C to shut down all services."

trap "echo 'Shutting down services...'; kill -9 $FASTAPI_PID $EXPRESS_PID 2>/dev/null || true; exit 0" INT TERM
wait
