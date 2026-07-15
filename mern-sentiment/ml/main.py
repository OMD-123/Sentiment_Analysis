#!/usr/bin/env python3
"""
Entrypoint wrapper for running the FastAPI Inference Server.
"""

import uvicorn
from api import app

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
