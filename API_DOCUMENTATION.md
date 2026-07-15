# API Documentation: Multimodal Sentiment Analysis

This document describes the REST API endpoints provided by the **Express TypeScript Backend (Port 5000)** and the **FastAPI Python AI Service (Port 8000)**.

---

## 1. Node Express Backend API (`http://localhost:5000/api`)

### Authentication (`/api/auth`)

#### `POST /api/auth/register`
Creates a new user account and returns a JWT Bearer token.
- **Request Body (JSON)**:
  ```json
  {
    "name": "Alex Engineer",
    "email": "alex@engineering.edu",
    "password": "secretPassword123",
    "role": "user"
  }
  ```
- **Response (`201 Created`)**:
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "user": {
      "id": "60b8d295f1...",
      "name": "Alex Engineer",
      "email": "alex@engineering.edu",
      "role": "user"
    }
  }
  ```

#### `POST /api/auth/login`
Authenticates existing user credentials.
- **Request Body (JSON)**:
  ```json
  {
    "email": "alex@engineering.edu",
    "password": "secretPassword123"
  }
  ```
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "user": { ... }
  }
  ```

#### `GET /api/auth/me`
Retrieves profile details for the currently authenticated user.
- **Headers**: `Authorization: Bearer <token>`

---

### AI Predictions & Inference (`/api/predict`)

#### `POST /api/predict/text`
Analyzes social media text or tweets using the fine-tuned 1D-Transformer text model.
- **Request Body (JSON)**:
  ```json
  {
    "text": "I absolutely love this new update! The UI is incredibly smooth and responsive."
  }
  ```
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "prediction": {
      "id": "651a2b...",
      "sentiment": "Positive",
      "confidence": 0.998,
      "probabilityScores": {
        "Negative": 0.001,
        "Neutral": 0.001,
        "Positive": 0.998
      },
      "createdAt": "2026-07-15T08:20:00.000Z"
    }
  }
  ```

#### `POST /api/predict/image`
Analyzes visual sentiment from uploaded image files using the fine-tuned 2D-CNN feature extractor.
- **Content-Type**: `multipart/form-data`
- **Form Parameters**: `file` (File binary: `.jpg`, `.png`, `.webp`)
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "prediction": {
      "id": "651a2c...",
      "sentiment": "Positive",
      "confidence": 0.941,
      "probabilityScores": { "Negative": 0.02, "Neutral": 0.039, "Positive": 0.941 },
      "createdAt": "2026-07-15T08:21:00.000Z"
    }
  }
  ```

#### `POST /api/predict/audio`
Analyzes acoustic emotion dynamics from speech waveform files (`.wav`, `.mp3`, `.ogg`, `.flac`) via Mel-Spectrogram extraction.
- **Content-Type**: `multipart/form-data`
- **Form Parameters**: `file` (File binary)
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "prediction": {
      "id": "651a2d...",
      "sentiment": "Neutral",
      "confidence": 0.892,
      "probabilityScores": { "Negative": 0.06, "Neutral": 0.892, "Positive": 0.048 },
      "createdAt": "2026-07-15T08:22:00.000Z"
    }
  }
  ```

#### `POST /api/predict/multimodal`
Executes Multi-Head Attention Fusion across any combination of Text, Vision, and Audio.
- **Content-Type**: `multipart/form-data`
- **Form Parameters**:
  - `text` (String, optional)
  - `image` (File binary, optional)
  - `audio` (File binary, optional)
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "prediction": {
      "id": "651a2e...",
      "sentiment": "Positive",
      "confidence": 0.985,
      "probabilityScores": { "Negative": 0.005, "Neutral": 0.010, "Positive": 0.985 },
      "modalityScores": {
        "text": { "sentiment": "Positive", "confidence": 0.99, "probability_scores": { ... } }
      },
      "attentionWeights": {
        "text": 0.45,
        "image": 0.30,
        "audio": 0.25
      },
      "createdAt": "2026-07-15T08:23:00.000Z"
    }
  }
  ```

#### `GET /api/predict/history?limit=50`
Returns paginated prediction history archives.

#### `DELETE /api/predict/history/:id`
Deletes a specific prediction history record (requires JWT authentication).

---

### System Analytics (`/api/analytics`)

#### `GET /api/analytics/summary`
Returns comprehensive dashboard metrics, distribution breakdowns, Chart.js trend data, and real-time health checks.
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "summary": {
      "totalPredictions": 142,
      "sentimentDistribution": { "Positive": 85, "Negative": 22, "Neutral": 35 },
      "modalityDistribution": { "text": 60, "image": 30, "audio": 20, "multimodal": 32 },
      "avgConfidence": 95.8,
      "totalUsers": 12,
      "dailyTrends": [ ... ],
      "systemHealth": { "node": "online", "mongodb": "online", "fastapi": { "status": "online" } },
      "recentLogs": [ ... ]
    }
  }
  ```

---

## 2. Python FastAPI AI Microservice (`http://localhost:8000`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Returns active PyTorch device (`cpu`/`cuda`) and loaded models list |
| `GET` | `/model/info` | Returns model architecture specifications and test evaluation metrics |
| `POST` | `/predict/text` | Direct text sentiment inference (`{"text": "..."}`) |
| `POST` | `/predict/image` | Direct image sentiment inference (multipart `file`) |
| `POST` | `/predict/audio` | Direct speech emotion recognition (multipart `file`) |
| `POST` | `/predict/multimodal` | Direct cross-modal attention fusion inference |
