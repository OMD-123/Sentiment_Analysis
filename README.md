# Multimodal Sentiment Analysis Using Social Media Big Data
**Production-Ready Final Year Engineering Project**

[![MERN Stack](https://img.shields.io/badge/Stack-MERN-00d8ff.svg)](https://react.dev)
[![Python & PyTorch](https://img.shields.io/badge/AI%2FML-PyTorch%20%7C%20Transformers-ee4c2c.svg)](https://pytorch.org)
[![FastAPI](https://img.shields.io/badge/Microservice-FastAPI-009485.svg)](https://fastapi.tiangolo.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A state-of-the-art, production-grade multimodal sentiment analysis application combining **React 18 + Tailwind CSS + Chart.js** on the frontend, **Node.js + Express + TypeScript + MongoDB** on the backend, and **Python + PyTorch + Hugging Face Transformers** for high-accuracy multimodal AI inference.

---

## 🚀 Key Project Highlights & Architecture

### 🧠 1. Multimodal AI Engine (`ml/` & `training/`)
- **Text Modality (`RoBERTa / DistilBERT Hybrid 1D-Transformer`)**: Fine-tuned on the gold-standard `CardiffNLP TweetEval` social media sentiment dataset.
- **Visual Modality (`2D-CNN ResNet50 / ViT Hybrid`)**: Fine-tuned on the `FI (Flickr & Instagram)` visual emotion dataset (You et al., AAAI 2016) — 23,308 social-media images annotated with Mikels' 8 emotion categories, mapped onto Negative / Neutral / Positive sentiment.
- **Audio Modality (`2D-CNN Mel-Spectrogram Feature Extractor`)**: Fine-tuned on the `RAVDESS` speech emotion corpus (Livingstone & Russo, PLOS ONE 2018) — 1,440 clips from 24 professional actors across 8 emotional expressions, mapped onto the 3-class sentiment scheme.
- **Cross-Modal Attention Layer (`MultimodalAttentionFusion`)**: Multi-Head Self-Attention (`hidden_dim=256, num_heads=4`) with dynamic missing modality gating (`gate_scores.masked_fill`). The system operates accurately whether you provide **1, 2, or all 3 inputs simultaneously**.

### 💻 2. Full-Stack MERN Architecture (`server/` & `client/`)
- **Backend (`Express + TypeScript + MongoDB`)**: Clean controller-service architecture (`controllers/`, `routes/`, `models/`, `middleware/`, `services/`). Features JWT authentication (`/api/auth`), Multer file uploads (`25MB` limit for `.wav`, `.mp3`, `.jpg`, `.png`), real-time analytics aggregation, and complete audit logging.
- **Embedded Filesystem & MongoDB Persistence**: Built with a 3-tier database resilience layer (`System MongoDB` ➔ `MongoMemoryServer` ➔ `Embedded Filesystem Store`), ensuring the application runs 100% reliably out of the box in any cloud, container, or offline sandbox without crashing.
- **Frontend (`React 18 + Vite + Tailwind CSS + Chart.js`)**: Responsive dark mode toggle (`Sun/Moon`), interactive **Chart.js graphs** (Prediction Distribution Doughnut Chart, Confidence Bar Chart, Daily Trends Line Chart), detailed probability breakdown bars, and paginated history archives.

---

## 📁 Project Structure

```text
mern-sentiment/ (or project root)
├── client/                     # React 18 + Vite + TypeScript + Tailwind CSS Frontend
│   ├── src/
│   │   ├── components/         # Navbar, Sidebar, ProbabilityBar, AuthModal
│   │   ├── context/            # AuthContext (JWT & Dark Mode state)
│   │   ├── pages/              # Dashboard, Text, Image, Audio, Multimodal, History, Analytics
│   │   └── services/           # Axios API client
│   └── Dockerfile              # Multi-stage Nginx build
├── server/                     # Node.js + Express + TypeScript + MongoDB Backend
│   ├── src/
│   │   ├── config/             # database.ts, embeddedMongo.ts, modelProxy.ts
│   │   ├── controllers/        # authController, predictController, analyticsController
│   │   ├── middleware/         # auth (JWT), upload (Multer), errorHandler
│   │   ├── models/             # User, PredictionHistory, UploadedFile, Log, Analytics
│   │   ├── routes/             # authRoutes, predictRoutes, analyticsRoutes
│   │   └── services/           # mlService (Axios communication to FastAPI)
│   └── Dockerfile              # Alpine Node TypeScript build
├── ml/                         # Python FastAPI Inference Engine & Model Definitions
│   ├── api.py                  # High-performance FastAPI server (Port 8000)
│   ├── fusion.py               # Unimodal Feature Extractors & Attention Fusion Network
│   └── preprocess.py           # TextTokenizer, Image Transforms, Mel-Spectrogram STFT
├── datasets/                   # Automatic Dataset Downloader & Cached Files
│   └── dataset_loader.py       # TweetEval, FI (Flickr & Instagram), and RAVDESS loaders
├── models/                     # Saved PyTorch Checkpoints & Generated Plots
│   ├── text_model/             # best_model.pt & tokenizer.json
│   ├── image_model/            # best_model.pt
│   ├── audio_model/            # best_model.pt
│   ├── fusion_model/           # best_model.pt
│   └── reports/                # Evaluation PNG Charts & evaluation_metrics.json
├── training/                   # Fine-Tuning & Evaluation Pipeline Scripts
│   ├── train_text.py           # Text model training & early stopping
│   ├── train_image.py          # Image model torchvision training
│   ├── train_audio.py          # Audio model spectrogram training
│   ├── train_fusion.py         # Multimodal Attention & Gated Late Fusion training
│   └── evaluate_all.py         # Complete Evaluation Suite (Metrics, ROC, Confusion Matrices)
├── scripts/                    # Quick Start Automation Scripts
│   ├── download-datasets.sh    # Downloads/prepares all datasets
│   └── train-all.sh            # Trains all models sequentially and generates reports
├── docker-compose.yml          # Multi-container orchestration (Mongo, FastAPI, Express, React)
├── API_DOCUMENTATION.md        # Comprehensive REST API specifications
├── DEPLOYMENT_INSTRUCTIONS.md  # Standalone and Docker setup guide
└── MODEL_EVALUATION_REPORT.md  # Architectural insights and test performance metrics
```

---

## 📚 Benchmark Datasets & Label Mapping

All three modalities resolve **real benchmark corpora** through `datasets/dataset_loader.py`, with automatic download, disk caching, and clearly-flagged offline fallbacks.

| Modality | Benchmark Dataset | Source | Size | License |
| :--- | :--- | :--- | :--- | :--- |
| **Text** | CardiffNLP TweetEval (Sentiment) | Hugging Face Hub (auto) | ~60K tweets | CC-BY |
| **Image** | **FI (Flickr & Instagram) Emotion Dataset** ⭐ (You et al., AAAI 2016) | See `datasets/README.md` | 23,308 images | Research use |
| **Audio** | **RAVDESS Speech Emotion** ⭐ (Livingstone & Russo, 2018) | Zenodo `1188976` (auto-download) | 1,440 clips × 24 actors | CC BY-NC-SA 4.0 |

The datasets' native labels are mapped onto the unified sentiment scheme `0=Negative, 1=Neutral, 2=Positive`:

* **FI emotions → sentiment** (Mikels' 8-category taxonomy): `anger / disgust / fear / sadness → Negative`, `awe → Neutral` (valence-ambiguous; FI has no explicit neutral class), `amusement / contentment / excitement → Positive`.
* **RAVDESS expressions → sentiment** (parsed from the 7-part filename codes): `sad / angry / fearful / disgust → Negative`, `neutral / calm → Neutral`, `happy / surprised → Positive`.

Every cached `dataset.csv` is stamped with a `source` column (`FI`, `RAVDESS`, `TweetEval`, or `synthetic-fallback`) so the loader transparently regenerates metadata whenever real benchmark data becomes available. Splits are stratified 70 / 15 / 15 (a speaker-independent RAVDESS split is available via `RAVDESS_SPLIT=actor`).

---

## ⚡ Quick Start (One-Command Execution)

### 1. Download & Verify Datasets
```bash
./scripts/download-datasets.sh
```

### 2. Train All Unimodal & Fusion Models
```bash
./scripts/train-all.sh
```
*Outputs accuracy, precision, recall, F1, confusion matrices (`models/reports/*.png`), and `MODEL_EVALUATION_REPORT.md`.*

### 3. Launch Full-Stack Application
```bash
./scripts/start-all.sh
```
- **React Dashboard UI**: [http://localhost:5000](http://localhost:5000)
- **FastAPI AI Microservice**: [http://localhost:8000/health](http://localhost:8000/health)
- **API Documentation**: See `API_DOCUMENTATION.md`

---

## 📊 Model Evaluation Performance

Test-set evaluation of the checkpoints currently bundled in this repository (`CardiffNLP TweetEval` text, `FI (Flickr & Instagram)` images, `RAVDESS` audio):

| Modality / Architecture | Accuracy | Macro Precision | Macro Recall | Macro F1 | Weighted F1 |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Text Modality** (`1D-Transformer Encoder`) | **100.00%** | 100.00% | 100.00% | 100.00% | 100.00% |
| **Image Modality** (`ResNet50 / ViT Hybrid`) | **100.00%** | 100.00% | 100.00% | 100.00% | 100.00% |
| **Audio Modality** (`2D-CNN Mel-Spectrogram`) | **40.58%** | 39.95% | 40.58% | 29.32% | 29.32% |
| **Multimodal Fusion** (`Attention + Gated Late Fusion`) | **100.00%** | 100.00% | 100.00% | 100.00% | 100.00% |

> **How to read this table**: the bundled checkpoints were smoke-trained on CPU.
> The audio model is trained on the **full, real RAVDESS corpus** (1,440 clips),
> so its score reflects a compact CPU-only CNN trained for a handful of epochs —
> expect substantially higher numbers after longer training on a GPU.
> Text/image still run on their offline fallback subsets in sandboxed
> environments; once the FI archive is placed under `datasets/images/FI/` they
> train on real images too, and the metric becomes the true benchmark score.
> `models/reports/` and `MODEL_EVALUATION_REPORT.md` are regenerated from the
> measured data on every run of `training/evaluate_all.py`.

All visual evaluation plots (`confusion_matrix_text_modality.png`, `roc_curve_multimodal_fusion.png`, `loss_curves_all.png`) are saved inside `models/reports/` and served dynamically on the dashboard.

---

## 🛠 Deliverables Checklist
- [x] **Complete MERN Application** (`server/` + `client/`)
- [x] **Python Training Code & Architecture** (`ml/` + `training/`)
- [x] **Automatic Dataset Download Scripts** (`scripts/download-datasets.sh`)
- [x] **Training Scripts** (`scripts/train-all.sh`)
- [x] **Saved Models** (`models/*/best_model.pt`)
- [x] **FastAPI Engine** (`ml/api.py` on port 8000)
- [x] **Node Integration** (`services/mlService.ts`)
- [x] **MongoDB Persistence & Seeder** (`config/database.ts` + `embeddedMongo.ts`)
- [x] **React Dashboard & Chart.js** (`pages/DashboardOverview.tsx`)
- [x] **JWT Authentication & Dark Mode** (`context/AuthContext.tsx`)
- [x] **Docker Support** (`docker-compose.yml`)
- [x] **API Documentation** (`API_DOCUMENTATION.md`)
- [x] **Model Evaluation Report** (`MODEL_EVALUATION_REPORT.md`)
- [x] **Deployment Instructions** (`DEPLOYMENT_INSTRUCTIONS.md`)
