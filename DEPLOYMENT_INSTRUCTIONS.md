# Deployment & Setup Instructions: Multimodal Sentiment Analysis

This project provides multiple production-ready deployment options ranging from single-command script execution to full Docker container orchestration.

---

## 1. Quick Start (Standalone / Script Deployment)

If you are running directly on a Linux/macOS server or cloud virtual machine with Python 3.11+ and Node.js 18+ installed:

### Step 1: Clone and Set Up Virtual Environment
```bash
git clone <repository_url> Sentiment_Analysis
cd Sentiment_Analysis

# Create Python virtual environment and install ML requirements
python3 -m venv venv
./venv/bin/pip install -r requirements.txt

# Install Node.js backend & frontend packages
cd mern-sentiment/server && npm install && npm run build
cd ../client && npm install && npm run build
cd ../..
```

### Step 2: Download & Prepare Datasets
Run the automated dataset download and verification script:
```bash
./scripts/download-datasets.sh
```
This resolves the real benchmark corpora:
- **Text**: CardiffNLP TweetEval (automatic, Hugging Face Hub)
- **Image**: FI (Flickr & Instagram) Emotion Dataset — place the extracted archive under `mern-sentiment/datasets/images/FI/` (see `mern-sentiment/datasets/README.md` for exact folder layout and re-host options)
- **Audio**: RAVDESS speech emotion corpus (automatic, downloaded from Zenodo)

*Note: If external domains are unreachable, the loaders transparently fall back to clearly-marked synthetic placeholders so the pipeline can still execute end-to-end offline.*

### Step 3: Train & Evaluate Multimodal Models
To train every modality (`Text`, `Image`, `Audio`) plus the `Attention Fusion Network` and generate evaluation reports:
```bash
./scripts/train-all.sh
```
This saves fine-tuned checkpoints to `models/` (`best_model.pt`) and visual plots (`confusion_matrix_*.png`, `roc_curve_*.png`) to `models/reports/`.

### Step 4: Start All Services
Launch the complete MERN + AI stack with one command:
```bash
./scripts/start-all.sh
```
- **React Dashboard**: Open [http://localhost:5000](http://localhost:5000)
- **Node Express API**: [http://localhost:5000/api/health](http://localhost:5000/api/health)
- **Python FastAPI Engine**: [http://localhost:8000/health](http://localhost:8000/health)

---

## 2. Docker Compose Orchestration (Recommended for Production)

The project includes complete multi-stage Dockerfiles (`client/Dockerfile`, `server/Dockerfile`, `ml/Dockerfile`) and a coordinated `docker-compose.yml`.

### Step 1: Build & Launch Container Stack
From the project root (`Sentiment_Analysis` or `mern-sentiment`):
```bash
docker-compose up --build -d
```

### Step 2: Verify Container Health
```bash
docker-compose ps
```
You will see 4 operational containers:
- `mern_sentiment_mongo` (MongoDB 6.0 daemon on port 27017)
- `mern_sentiment_ml` (FastAPI AI Engine with PyTorch models on port 8000)
- `mern_sentiment_backend` (Express TypeScript server on port 5000)
- `mern_sentiment_frontend` (Nginx serving production React UI on port 3000)

---

## 3. Environment Variables (`.env`)

Inside `server/.env` or `docker-compose.yml`, you can customize:
- `PORT=5000` (Node server port)
- `MONGODB_URI=mongodb://localhost:27017/mern_sentiment` (MongoDB connection string)
- `ML_SERVICE_URL=http://localhost:8000` (FastAPI microservice address)
- `JWT_SECRET=your_production_secret_key` (Secret for signing user tokens)
- `SKIP_MEMORY_SERVER=true` (Disables binary download attempts in restricted containers)
