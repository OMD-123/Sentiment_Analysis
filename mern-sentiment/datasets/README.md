# Benchmark Datasets

This project trains and evaluates on three real benchmark corpora, wired
through `dataset_loader.py`:

| Modality | Dataset | Size | Access |
| :--- | :--- | :--- | :--- |
| Text | CardiffNLP TweetEval (Sentiment) | ~60K tweets | Automatic (Hugging Face Hub) |
| Image | **FI (Flickr & Instagram) Emotion Dataset** ⭐⭐⭐⭐⭐ | 23,308 images | Manual placement / re-hosted archive |
| Audio | **RAVDESS Speech Emotion** ⭐⭐⭐⭐⭐ | 1,440 clips (24 actors × 60 trials) | Automatic (Zenodo) |

Labels are unified to `0 = Negative, 1 = Neutral, 2 = Positive`.

---

## 1. Audio — RAVDESS (automatic) 🎙️

The Ryerson Audio-Visual Database of Emotional Speech and Song
(Livingstone & Russo, PLOS ONE 2018, DOI: 10.1371/journal.pone.0196391).

The speech subset (`Audio_Speech_Actors_01-24.zip`, ~215 MB) is downloaded
automatically from the official Zenodo record on the first run of:

```bash
./scripts/download-datasets.sh
```

Files land in `datasets/audio/RAVDESS/Actor_XX/*.wav` and labels are parsed
from the 7-part filename identifier:

```
03-01-06-01-02-01-12.wav
 |  |  |  |  |  |  └─ Actor (01–24; even = female, odd = male)
 |  |  |  |  |  └──── Repetition (01, 02)
 |  |  |  |  └─────── Statement (01 = "Kids are talking by the door", 02 = "Dogs...")
 |  |  |  └────────── Intensity (01 = normal, 02 = strong)
 |  |  └───────────── Emotion (01 neutral … 08 surprised)
 |  └──────────────── Vocal channel (01 = speech, 02 = song)
 └─────────────────── Modality (03 = audio-only)
```

**Emotion → sentiment mapping**

| RAVDESS emotion | Sentiment class |
| :--- | :--- |
| sad, angry, fearful, disgust | 0 – Negative |
| neutral, calm | 1 – Neutral |
| happy, surprised | 2 – Positive |

**Options (environment variables)**

| Variable | Effect |
| :--- | :--- |
| `RAVDESS_SPLIT=actor` | Speaker-independent protocol: train actors 01–16, val 17–20, test 21–24 (default is a stratified 70/15/15 split). |
| `RAVDESS_ZIP_PATH=<path>` | Use a previously downloaded `Audio_Speech_Actors_01-24.zip` instead of re-downloading. |
| `RAVDESS_MAX_CLIPS_PER_CLASS=<n>` | Cap clips per class (quick smoke tests). |

> **License**: CC BY-NC-SA 4.0 — research / non-commercial use. Cite Livingstone & Russo (2018).

---

## 2. Image — FI (Flickr & Instagram) 🖼️

The FI dataset (You, Luo, Jin & Yang — *"Building a Large Scale Dataset for
Image Emotion Recognition: The Fine Print and The Benchmark"*, AAAI 2016)
contains 23,308 images collected from Flickr & Instagram and annotated by
Amazon Mechanical Turk workers into Mikels' 8 emotion categories:

```
amusement, awe, contentment, excitement, anger, disgust, fear, sadness
```

The original project page no longer serves the archive, so the loader works
with any standard copy of FI. **Pick one option:**

### Option A — recommended: place an extracted copy locally

Put the extracted FI images anywhere under `mern-sentiment/datasets/images/FI/`
(any nesting depth is fine). The loader auto-detects emotion folders by name:

```
datasets/images/FI/
├── amusement/      (or "amused")
├── anger/          (or "angry")
├── awe/
├── contentment/    (or "content")
├── disgust/
├── excitement/     (or "excited")
├── fear/           (or "fearful")
└── sadness/        (or "sad")
```

Well-known sources for a copy of FI:

* Kaggle mirror — search Kaggle Datasets for **"FI image emotion"** and download the archive (a Kaggle account is required), then extract it into `datasets/images/FI/`.
* The authors' original `train.zip` / `test.zip` archives re-hosted in many university course drives and GitHub release attachments.
* Your own previously downloaded copy.

Re-run `./scripts/download-datasets.sh` afterwards — the loader rescan occurs automatically (delete `datasets/images/dataset.csv` first only if you previously generated data without FI present).

### Option B — archive URLs

```bash
export FI_DATASET_URLS="https://<your-host>/train.zip,https://<your-host>/test.zip"
./scripts/download-datasets.sh
```

### Option C — Hugging Face mirror

```bash
export FI_HF_DATASET="<owner>/<repo>"   # rows: image + label in Mikels' 8 taxonomy
./scripts/download-datasets.sh
```

### Extra options

| Variable | Effect |
| :--- | :--- |
| `FI_DATASET_DIR=<path>` | Scan this directory first for the FI emotion folders. |
| `FI_MAX_IMAGES_PER_SENTIMENT=<n>` | Cap images per sentiment class (fast CPU smoke tests). |

**Emotion → sentiment mapping** (polarity per the FI paper / EmoSet-2):

| FI emotion | Sentiment class |
| :--- | :--- |
| anger, disgust, fear, sadness | 0 – Negative |
| awe | 1 – Neutral* |
| amusement, contentment, excitement | 2 – Positive |

\* FI defines no neutral category; *awe* is valence-ambiguous in affective
science (Keltner & Haidt 2003; Gordon et al. 2017) and therefore carries the
Neutral slot. Prefer strict 2-class polarity? Edit `FI_EMOTION_TO_LABEL` in
`dataset_loader.py` (map `awe → 2`); the fusion code skips absent classes
safely.

> **License**: the FI images were collected from public social platforms for
> research use by You et al. Use for academic / research purposes and cite the
> AAAI 2016 paper.

---

## 3. Text — TweetEval (unchanged)

`cardiffnlp/tweet_eval` (sentiment subset) downloads automatically via the
Hugging Face `datasets` library and is cached to `datasets/text/*.csv`.

---

## Caching & provenance

Each loader writes a `dataset.csv` manifest with absolute file paths, class
labels, split assignments, and a `source` stamp (`FI` / `RAVDESS` /
`TweetEval` / `synthetic-fallback`). Delete the manifest to force a
re-resolution. Extracted corpus folders (`images/FI/`, `audio/RAVDESS/`) and
downloaded archives are ignored by Git (see `.gitignore`).
