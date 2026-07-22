"""
Automatic Dataset Loader & Preprocessing for Multimodal Sentiment Analysis.

Benchmark datasets
-------------------
  * Text  : CardiffNLP TweetEval (sentiment) - Hugging Face
  * Image : FI (Flickr & Instagram) Visual Emotion Dataset - You et al., AAAI 2016
            23,308 images labelled with Mikels' 8 emotion categories
            (amusement, awe, contentment, excitement, anger, disgust, fear, sadness).
  * Audio : RAVDESS - Ryerson Audio-Visual Database of Emotional Speech & Song
            (Livingstone & Russo, PLOS ONE 2018), speech subset:
            1,440 clips x 24 actors x 8 emotions, 16-bit 48 kHz WAV.

Label mapping to the unified 3-class sentiment scheme
-----------------------------------------------------
  0 = Negative | 1 = Neutral | 2 = Positive

  FI emotions   -> Negative : anger, disgust, fear, sadness
                -> Neutral  : awe   (valence-ambiguous in affective science,
                               FI provides no explicit neutral class)
                -> Positive : amusement, contentment, excitement

  RAVDESS       -> Negative : sad, angry, fearful, disgust
                -> Neutral  : neutral, calm
                -> Positive : happy, surprised

Source resolution order (first success wins)
--------------------------------------------
  Image : 1. cached metadata CSV stamped source="FI"
          2. local FI folder scan (emotion sub-folders under datasets/images/FI
             or the path in the FI_DATASET_DIR env var)
          3. archive download from FI_DATASET_URLS (comma separated) -> extract -> scan
          4. Hugging Face mirror in FI_HF_DATASET (optional)
          5. synthetic offline fallback (clearly logged)
  Audio : 1. cached metadata CSV stamped source="RAVDESS"
          2. local zip (datasets/audio/Audio_Speech_Actors_01-24.zip or RAVDESS_ZIP_PATH)
          3. official Zenodo archive (https://zenodo.org/records/1188976)
          4. Hugging Face mirror snapshot (optional, guarded)
          5. synthetic offline fallback (clearly logged)
"""

import os
import re
import io
import json
import hashlib
import logging
import zipfile
import shutil
import tarfile
import urllib.request
from pathlib import Path
from typing import Dict, List, Tuple, Any, Optional

import pandas as pd
import numpy as np

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("DatasetLoader")

DATASETS_DIR = Path(__file__).parent.parent / "datasets"
DATASETS_DIR.mkdir(parents=True, exist_ok=True)

LABEL_MAP = {
    0: "Negative",
    1: "Neutral",
    2: "Positive"
}

# ---------------------------------------------------------------------------
# Canonical label mappings
# ---------------------------------------------------------------------------

# FI (Flickr & Instagram) - Mikels' 8 emotion categories -> 3-class sentiment.
# Polarity follows the FI paper / EmoSet-2 convention (amusement, awe,
# contentment, excitement are positive; anger, disgust, fear, sadness are
# negative). "awe" is valence-ambiguous (Keltner & Haidt, 2003; Gordon et al.,
# 2017) and carries the Neutral slot because FI defines no neutral category.
FI_EMOTION_TO_LABEL = {
    "anger": 0,
    "disgust": 0,
    "fear": 0,
    "sadness": 0,
    "awe": 1,
    "neutral": 1,
    "amusement": 2,
    "contentment": 2,
    "excitement": 2,
}

# Accepted folder-name aliases for the FI emotion taxonomy.
FI_EMOTION_ALIASES = {
    "amusement": "amusement", "amused": "amusement",
    "anger": "anger", "angry": "anger",
    "awe": "awe",
    "contentment": "contentment", "contented": "contentment", "content": "contentment",
    "disgust": "disgust", "disgusted": "disgust",
    "excitement": "excitement", "excited": "excitement", "exciting": "excitement",
    "fear": "fear", "fearful": "fear",
    "sadness": "sadness", "sad": "sadness",
    "neutral": "neutral",
}

# RAVDESS filename emotion code (3rd field) -> (emotion name, sentiment label).
RAVDESS_EMOTION_MAP = {
    "01": ("neutral", 1),
    "02": ("calm", 1),
    "03": ("happy", 2),
    "04": ("sad", 0),
    "05": ("angry", 0),
    "06": ("fearful", 0),
    "07": ("disgust", 0),
    "08": ("surprised", 2),
}

RAVDESS_ZENODO_URLS = [
    "https://zenodo.org/records/1188976/files/Audio_Speech_Actors_01-24.zip",
    "https://zenodo.org/record/1188976/files/Audio_Speech_Actors_01-24.zip",
]
RAVDESS_ZIP_MD5 = "bc696df654c87fed845eb13823edef8a"

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------

def _stratified_split(df: pd.DataFrame, seed: int = 42,
                      train_ratio: float = 0.70, val_ratio: float = 0.15) -> pd.Series:
    """Return a 'train'/'val'/'test' Series, stratified on df['label']."""
    split = pd.Series(index=df.index, dtype=object)
    for label in sorted(df["label"].unique()):
        idx = df.index[df["label"] == label].to_numpy().copy()
        rng = np.random.default_rng(seed)
        rng.shuffle(idx)
        n = len(idx)
        n_train = int(n * train_ratio)
        n_val = int(n * val_ratio)
        split[idx[:n_train]] = "train"
        split[idx[n_train:n_train + n_val]] = "val"
        split[idx[n_train + n_val:]] = "test"
    return split


def _download_file(url: str, dest: Path, timeout: int = 60) -> Path:
    """Stream-download `url` to `dest` using requests (preferred) or urllib."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    logger.info(f"Downloading {url} -> {dest.name} ...")
    try:
        import requests
        with requests.get(url, stream=True, timeout=timeout,
                          headers={"User-Agent": "Mozilla/5.0"}) as r:
            r.raise_for_status()
            total = int(r.headers.get("content-length", 0))
            downloaded = 0
            chunk = 1 << 20  # 1 MiB
            with open(dest, "wb") as f:
                for data in r.iter_content(chunk_size=chunk):
                    if not data:
                        continue
                    f.write(data)
                    downloaded += len(data)
                    if total:
                        pct = downloaded * 100.0 / total
                        print(f"\r   {dest.name}: {downloaded/1e6:,.1f}/{total/1e6:,.1f} MB ({pct:5.1f}%)", end="", flush=True)
        print("")
    except ImportError:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=timeout) as resp, open(dest, "wb") as f:
            shutil.copyfileobj(resp, f, length=1 << 20)
    if not dest.exists() or dest.stat().st_size == 0:
        raise IOError(f"Download produced an empty file: {dest}")
    logger.info(f"Download complete: {dest.name} ({dest.stat().st_size / 1e6:.1f} MB)")
    return dest


def _extract_archive(archive: Path, dest_dir: Path) -> Path:
    """Extract .zip / .tar(.gz/.bz2) into dest_dir (idempotent)."""
    dest_dir.mkdir(parents=True, exist_ok=True)
    logger.info(f"Extracting {archive.name} -> {dest_dir} ...")
    if zipfile.is_zipfile(archive):
        with zipfile.ZipFile(archive, "r") as zf:
            zf.extractall(dest_dir)
    elif tarfile.is_tarfile(archive):
        with tarfile.open(archive, "r:*") as tf:
            tf.extractall(dest_dir)
    else:
        raise ValueError(f"Unsupported archive format: {archive}")
    logger.info("Extraction complete.")
    return dest_dir


def _md5(path: Path) -> str:
    h = hashlib.md5()
    with open(path, "rb") as f:
        for blk in iter(lambda: f.read(1 << 20), b""):
            h.update(blk)
    return h.hexdigest()


def _read_cached_metadata(csv_path: Path, expected_source: str) -> Optional[Dict[str, pd.DataFrame]]:
    """Load a cached dataset.csv if it was produced for `expected_source`."""
    if not csv_path.exists():
        return None
    try:
        df = pd.read_csv(csv_path)
    except Exception as e:
        logger.warning(f"Could not read cached metadata {csv_path} ({e}); regenerating.")
        return None
    if "source" in df.columns:
        sources = set(df["source"].astype(str).unique())
    else:
        sources = {"synthetic-fallback"}
    if expected_source not in sources and not ({"synthetic-fallback"} == sources and expected_source == "synthetic-fallback"):
        logger.info(
            f"Cached metadata at {csv_path.name} is stamped as {sorted(sources)}; "
            f"'{expected_source}' required -> regenerating from the real dataset."
        )
        return None
    logger.info(f"Found cached {expected_source} metadata ({len(df)} rows).")
    return {
        "train": df[df["split"] == "train"].reset_index(drop=True),
        "val": df[df["split"] == "val"].reset_index(drop=True),
        "test": df[df["split"] == "test"].reset_index(drop=True),
    }


def _prune_legacy_class_dirs(base_dir: Path) -> None:
    """Remove synthetic class_<k> folders once a real dataset is in place."""
    for child in sorted(base_dir.glob("class_*")):
        if child.is_dir():
            try:
                shutil.rmtree(child)
                logger.info(f"Removed legacy synthetic folder {child}")
            except Exception as e:
                logger.warning(f"Could not remove legacy folder {child}: {e}")


# ---------------------------------------------------------------------------
# TEXT - CardiffNLP TweetEval (unchanged behaviour)
# ---------------------------------------------------------------------------

def load_text_dataset(max_samples: int = 5000) -> Dict[str, pd.DataFrame]:
    """
    Downloads and prepares the TweetEval (sentiment) dataset from Hugging Face Datasets.
    If unavailable or offline, uses local cache or generates a robust benchmark subset.
    """
    logger.info("Loading Text Dataset: CardiffNLP TweetEval (Sentiment)...")
    text_dir = DATASETS_DIR / "text"
    text_dir.mkdir(parents=True, exist_ok=True)

    train_path = text_dir / "train.csv"
    val_path = text_dir / "val.csv"
    test_path = text_dir / "test.csv"

    if train_path.exists() and val_path.exists() and test_path.exists():
        logger.info("Found cached text datasets locally.")
        return {
            "train": pd.read_csv(train_path),
            "val": pd.read_csv(val_path),
            "test": pd.read_csv(test_path)
        }

    try:
        from datasets import load_dataset
        logger.info("Fetching from Hugging Face: `tweet_eval` (sentiment subset)...")
        ds = load_dataset("cardiffnlp/tweet_eval", "sentiment")

        train_df = pd.DataFrame(ds["train"]).rename(columns={"label": "label", "text": "text"})
        val_df = pd.DataFrame(ds["validation"]).rename(columns={"label": "label", "text": "text"})
        test_df = pd.DataFrame(ds["test"]).rename(columns={"label": "label", "text": "text"})

        train_df["text"] = train_df["text"].str.strip()
        val_df["text"] = val_df["text"].str.strip()
        test_df["text"] = test_df["text"].str.strip()

        if max_samples and len(train_df) > max_samples:
            train_df = train_df.groupby("label", group_keys=False).apply(
                lambda x: x.sample(min(len(x), int(max_samples / 3)), random_state=42)
            ).reset_index(drop=True)

        train_df.to_csv(train_path, index=False)
        val_df.to_csv(val_path, index=False)
        test_df.to_csv(test_path, index=False)
        logger.info(f"Successfully downloaded and cached text dataset: {len(train_df)} train, {len(val_df)} val, {len(test_df)} test.")
        return {"train": train_df, "val": val_df, "test": test_df}

    except Exception as e:
        logger.warning(f"Could not download online text dataset ({e}). Generating standard high-quality social media sentiment fallback dataset.")

        positive_texts = [
            "I absolutely love this new update! The UI is incredibly smooth and responsive. Best experience ever!",
            "Had a fantastic time celebrating with friends today. Life is wonderful!",
            "The customer service was top notch and solved my problem within minutes. Thank you!",
            "Super excited for the weekend launch! We are going to crush our goals this quarter.",
            "Such a beautiful sunny morning in the city. Feeling energized and blessed!",
            "This product exceeded all my expectations. Worth every single penny!",
            "Congratulations to the engineering team on deploying the new multimodal architecture!",
            "Best meal I've had all year. The flavors were extraordinary and the ambiance was perfect.",
            "Really impressed with the speed and accuracy of this AI model. Phenomenal work!",
            "Grateful for all the support from our amazing community. You guys rock!"
        ] * 150

        neutral_texts = [
            "The package arrived on Tuesday at 3 PM as scheduled via courier service.",
            "The application requires Node.js version 18 or above and MongoDB running locally.",
            "Just finished reading the documentation for the new API parameters and status codes.",
            "Meeting scheduled for tomorrow morning at 10:30 AM in Conference Room B.",
            "The weather forecast predicts mild temperatures with a slight chance of clouds later today.",
            "Here are the quarterly financial statements and benchmark comparisons for Q2.",
            "We have updated our privacy policy and terms of service effective next Monday.",
            "The train departs from Platform 4 at exactly 14:15. Please have your tickets ready.",
            "The conference schedule has been posted on the main website under the agenda tab.",
            "Checking out the new features listed in the release notes for version 2.4."
        ] * 150

        negative_texts = [
            "I am completely disappointed with the customer support. Nobody answers the phone after waiting an hour!",
            "Terrible app update. It crashes every time I try to upload an image or save my progress.",
            "The quality of this item is appalling and broke within two days of normal use. Avoid!",
            "Frustrated beyond belief with these constant network outages right before our deadline.",
            "Why is this website so painfully slow? Worst user experience I have encountered in months.",
            "Our order was delayed twice without any explanation or refund offer. Unacceptable service.",
            "I regret buying this subscription. The features do not work as advertised at all.",
            "Horrible experience at the restaurant last night. Cold food and rude staff members.",
            "Another critical bug in production caused our database queries to fail miserably.",
            "So stressed out and exhausted from dealing with these endless system failures today."
        ] * 150

        data = []
        for t in positive_texts:
            data.append({"text": t, "label": 2})
        for t in neutral_texts:
            data.append({"text": t, "label": 1})
        for t in negative_texts:
            data.append({"text": t, "label": 0})

        df = pd.DataFrame(data).sample(frac=1.0, random_state=42).reset_index(drop=True)
        n = len(df)
        train_df = df.iloc[:int(n * 0.7)]
        val_df = df.iloc[int(n * 0.7):int(n * 0.85)]
        test_df = df.iloc[int(n * 0.85):]

        train_df.to_csv(train_path, index=False)
        val_df.to_csv(val_path, index=False)
        test_df.to_csv(test_path, index=False)
        logger.info(f"Cached fallback text dataset: {len(train_df)} train, {len(val_df)} val, {len(test_df)} test.")
        return {"train": train_df, "val": val_df, "test": test_df}


# ---------------------------------------------------------------------------
# IMAGE - FI (Flickr & Instagram) Visual Emotion Dataset
# ---------------------------------------------------------------------------

def _fi_scan_roots(img_dir: Path) -> List[Path]:
    """Candidate roots that may hold an extracted FI archive."""
    roots: List[Path] = []
    env_dir = os.environ.get("FI_DATASET_DIR")
    if env_dir:
        roots.append(Path(env_dir))
    roots += [
        img_dir / "FI",
        img_dir / "fi",
        img_dir / "FI_dataset",
        img_dir,
    ]
    seen, uniq = set(), []
    for r in roots:
        rp = r.resolve() if r.exists() else r
        if str(rp) not in seen:
            seen.add(str(rp))
            uniq.append(r)
    return [r for r in uniq if r.exists() and r.is_dir()]


def _scan_fi_emotion_folders(roots: List[Path], max_depth: int = 5) -> Dict[str, List[Path]]:
    """
    Recursively look (up to `max_depth`) for directories whose name matches an
    FI emotion alias and collect the image files underneath them.
    """
    found: Dict[str, List[Path]] = {}
    for root in roots:
        root = root.resolve()
        for dirpath, dirnames, _filenames in os.walk(root):
            try:
                depth = len(Path(dirpath).relative_to(root).parts)
            except ValueError:
                continue
            if depth > max_depth:
                dirnames[:] = []
                continue
            name = Path(dirpath).name.strip().lower()
            canonical = FI_EMOTION_ALIASES.get(name)
            if not canonical:
                continue
            imgs = [Path(dirpath) / f for f in _filenames
                    if Path(f).suffix.lower() in IMAGE_EXTS]
            if imgs:
                logger.info(f"FI scan: {canonical:<12} <- {dirpath} ({len(imgs)} images)")
                found.setdefault(canonical, []).extend(imgs)
                dirnames[:] = []  # do not descend into an emotion folder
    return found


def _fi_try_archive_urls(img_dir: Path) -> Optional[Path]:
    """
    Download archives listed in FI_DATASET_URLS (comma separated), extract them
    under datasets/images/FI and return the extraction root.
    """
    urls = [u.strip() for u in os.environ.get("FI_DATASET_URLS", "").split(",") if u.strip()]
    if not urls:
        return None
    archive_dir = img_dir / "archives"
    extract_root = img_dir / "FI"
    for i, url in enumerate(urls):
        name = url.split("?")[0].rstrip("/").split("/")[-1] or f"fi_archive_{i}.zip"
        if not Path(name).suffix:
            name += ".zip"
        archive_path = archive_dir / name
        try:
            if not archive_path.exists():
                _download_file(url, archive_path)
            _extract_archive(archive_path, extract_root)
        except Exception as e:
            logger.warning(f"Failed to fetch FI archive from {url}: {e}")
    return extract_root if extract_root.exists() else None


def _fi_try_huggingface(img_dir: Path) -> bool:
    """
    Optional Hugging Face mirror (FI_HF_DATASET env var). Expects rows with an
    `image` column and a string/int `label` column in the Mikels' 8 taxonomy.
    Materialises images under datasets/images/FI/<emotion>/.
    """
    repo = os.environ.get("FI_HF_DATASET")
    if not repo:
        return False
    try:
        from datasets import load_dataset
        from datasets import ClassLabel
    except Exception as e:
        logger.warning(f"`datasets` library unavailable ({e}); skipping HF FI mirror.")
        return False
    try:
        logger.info(f"Fetching FI mirror from Hugging Face: {repo} ...")
        ds = load_dataset(repo)
        split = ds["train"] if "train" in ds else ds[list(ds.keys())[0]]
        label_feat = split.features.get("label")
        names = label_feat.names if isinstance(label_feat, ClassLabel) else None
        out_root = img_dir / "FI"
        saved = 0
        for row in split:
            lab = row["label"] if names is None else names[int(row["label"])]
            lab = str(lab).strip().lower()
            canonical = FI_EMOTION_ALIASES.get(lab)
            if canonical is None:
                continue
            img = row["image"]
            cls_dir = out_root / canonical
            cls_dir.mkdir(parents=True, exist_ok=True)
            out_path = cls_dir / f"{canonical}_{saved:06d}.jpg"
            if not out_path.exists():
                img.convert("RGB").save(out_path, "JPEG", quality=92)
            saved += 1
        logger.info(f"Materialised {saved} FI images from Hugging Face mirror {repo}.")
        return saved > 0
    except Exception as e:
        logger.warning(f"Could not load FI mirror {repo} from Hugging Face: {e}")
        return False


def _build_fi_metadata(img_dir: Path, emotion_files: Dict[str, List[Path]],
                       max_per_sentiment: int = 0) -> pd.DataFrame:
    """Map FI emotion folders to 3-class sentiment and write the metadata CSV."""
    rows = []
    for emotion, files in sorted(emotion_files.items()):
        label = FI_EMOTION_TO_LABEL.get(emotion)
        if label is None:
            continue
        for f in files:
            path_str = str(f.resolve())
            lower = path_str.lower()
            platform = "instagram" if "instagram" in lower else ("flickr" if "flickr" in lower else "unknown")
            rows.append({
                "image_path": path_str,
                "label": label,
                "emotion": emotion,
                "platform": platform,
                "source": "FI",
            })
    if not rows:
        return pd.DataFrame()
    df = pd.DataFrame(rows).drop_duplicates(subset="image_path").reset_index(drop=True)
    if max_per_sentiment and max_per_sentiment > 0:
        df = df.groupby("label", group_keys=False).apply(
            lambda x: x.sample(min(len(x), max_per_sentiment), random_state=42)
        ).reset_index(drop=True)
    df["split"] = _stratified_split(df).values
    df = df[[c for c in ["image_path", "label", "split", "emotion", "platform", "source"] if c in df.columns]]
    df.to_csv(img_dir / "dataset.csv", index=False)
    counts = df.groupby(["split", "label"]).size().unstack(fill_value=0)
    logger.info(f"FI (Flickr & Instagram) dataset prepared: {len(df)} images.\n{counts}")
    return df


def _load_synthetic_image_fallback(img_dir: Path, num_samples_per_class: int) -> Dict[str, pd.DataFrame]:
    """Offline placeholder used only when the real FI dataset is unreachable."""
    logger.warning(
        "Falling back to SYNTHETIC image placeholders (offline sandbox mode). "
        "Place the extracted FI archive under datasets/images/FI/ to train on real data."
    )
    from PIL import Image, ImageDraw
    data = []

    for cls_idx, (label, color_base, desc) in enumerate([
        (0, (60, 20, 20), "Dark stormy negative pattern"),
        (1, (140, 145, 150), "Balanced neutral structural grid"),
        (2, (250, 210, 80), "Warm bright positive sunshine")
    ]):
        cls_dir = img_dir / f"class_{cls_idx}"
        cls_dir.mkdir(parents=True, exist_ok=True)

        for i in range(num_samples_per_class):
            img_path = cls_dir / f"sample_{i}.jpg"
            if not img_path.exists():
                img = Image.new("RGB", (224, 224), color=color_base)
                draw = ImageDraw.Draw(img)
                np.random.seed(cls_idx * 1000 + i)
                if cls_idx == 0:
                    for _ in range(15):
                        x1, y1 = np.random.randint(0, 224, 2), np.random.randint(0, 224, 2)
                        draw.line([x1[0], y1[0], x1[1], y1[1]], fill=(180, 0, 0), width=4)
                elif cls_idx == 1:
                    for g in range(0, 224, 32):
                        draw.line([g, 0, g, 224], fill=(180, 180, 180), width=1)
                        draw.line([0, g, 224, g], fill=(180, 180, 180), width=1)
                else:
                    for _ in range(8):
                        cx, cy = np.random.randint(40, 184), np.random.randint(40, 184)
                        r = np.random.randint(20, 60)
                        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, np.random.randint(180, 250), 100))

                img.save(img_path, "JPEG", quality=90)

            split = "train" if i < int(num_samples_per_class * 0.7) else ("val" if i < int(num_samples_per_class * 0.85) else "test")
            data.append({
                "image_path": str(img_path.resolve()),
                "label": cls_idx,
                "split": split,
                "source": "synthetic-fallback",
            })

    df = pd.DataFrame(data)
    df.to_csv(img_dir / "dataset.csv", index=False)
    logger.info(f"Created/verified synthetic image placeholder set: {len(df)} images.")
    return {
        "train": df[df["split"] == "train"].reset_index(drop=True),
        "val": df[df["split"] == "val"].reset_index(drop=True),
        "test": df[df["split"] == "test"].reset_index(drop=True),
    }


def load_image_dataset(num_samples_per_class: int = 150) -> Dict[str, pd.DataFrame]:
    """
    Load the FI (Flickr & Instagram) Visual Emotion Dataset and map its 8
    emotion categories onto the unified 3-class sentiment scheme.
    """
    logger.info("Loading Image Dataset: FI (Flickr & Instagram) Visual Emotion Dataset (You et al., AAAI 2016)...")
    img_dir = DATASETS_DIR / "images"
    img_dir.mkdir(parents=True, exist_ok=True)
    csv_path = img_dir / "dataset.csv"

    # 1) Cached metadata ------------------------------------------------------
    cached = _read_cached_metadata(csv_path, "FI")
    if cached is not None:
        return cached
    cached_synth = _read_cached_metadata(csv_path, "synthetic-fallback")

    max_per_sentiment = 0
    try:
        max_per_sentiment = int(os.environ.get("FI_MAX_IMAGES_PER_SENTIMENT", "0"))
    except ValueError:
        pass

    # 2) Local FI folder scan -------------------------------------------------
    emotion_files = _scan_fi_emotion_folders(_fi_scan_roots(img_dir))

    # 3) Archive URLs (optional manual re-host of the official train/test zips)
    if len(emotion_files) < 4:
        root = _fi_try_archive_urls(img_dir)
        if root is not None:
            emotion_files = _scan_fi_emotion_folders([root])

    # 4) Optional Hugging Face mirror ----------------------------------------
    if len(emotion_files) < 4 and _fi_try_huggingface(img_dir):
        emotion_files = _scan_fi_emotion_folders([img_dir / "FI"])

    if len(emotion_files) >= 2:
        df = _build_fi_metadata(img_dir, emotion_files, max_per_sentiment)
        if len(df) > 0:
            _prune_legacy_class_dirs(img_dir)
            return {
                "train": df[df["split"] == "train"].reset_index(drop=True),
                "val": df[df["split"] == "val"].reset_index(drop=True),
                "test": df[df["split"] == "test"].reset_index(drop=True),
            }

    # 5) Synthetic fallback ---------------------------------------------------
    if cached_synth is not None and not emotion_files:
        logger.warning("No FI files found; re-using cached synthetic placeholders.")
        return cached_synth
    return _load_synthetic_image_fallback(img_dir, num_samples_per_class)


# ---------------------------------------------------------------------------
# AUDIO - RAVDESS Speech Emotion
# ---------------------------------------------------------------------------

def _ravdess_local_zip(audio_dir: Path) -> Optional[Path]:
    """Locate a previously downloaded / manually placed RAVDESS zip."""
    env_zip = os.environ.get("RAVDESS_ZIP_PATH")
    candidates = []
    if env_zip:
        candidates.append(Path(env_zip))
    candidates.append(audio_dir / "Audio_Speech_Actors_01-24.zip")
    candidates += sorted(audio_dir.glob("*.zip"))
    for c in candidates:
        if c.exists() and zipfile.is_zipfile(c):
            return c
    return None


def _ravdess_download(audio_dir: Path) -> Optional[Path]:
    """Fetch the official RAVDESS speech archive from Zenodo."""
    dest = audio_dir / "Audio_Speech_Actors_01-24.zip"
    for url in RAVDESS_ZENODO_URLS:
        try:
            _download_file(url, dest)
            try:
                if _md5(dest) != RAVDESS_ZIP_MD5:
                    logger.warning("MD5 mismatch for RAVDESS archive (continuing; archive will still be validated during extraction).")
            except Exception:
                pass
            if zipfile.is_zipfile(dest):
                return dest
            dest.unlink(missing_ok=True)
        except Exception as e:
            logger.warning(f"Zenodo download failed ({url}): {e}")
    return None


def _ravdess_try_huggingface() -> Optional[List[Path]]:
    """Optional Hugging Face snapshot mirror (guarded)."""
    try:
        from huggingface_hub import snapshot_download
    except Exception:
        return None
    for repo in ["MahiA/RAVDESS"]:
        try:
            logger.info(f"Trying RAVDESS Hugging Face mirror: {repo} ...")
            snap = snapshot_download(repo_id=repo, repo_type="dataset", allow_patterns=["*.wav"])
            wavs = sorted(Path(snap).rglob("*.wav"))
            if wavs:
                logger.info(f"Found {len(wavs)} wav files in HF mirror {repo}.")
                return wavs
        except Exception as e:
            logger.warning(f"HF mirror {repo} unavailable: {e}")
    return None


def _parse_ravdess_filename(path: Path) -> Optional[Dict[str, Any]]:
    """Parse the 7-part RAVDESS identifier, e.g. 03-01-06-01-02-01-12.wav."""
    parts = path.stem.split("-")
    if len(parts) != 7:
        return None
    modality, vocal, emotion_code, intensity, statement, repetition, actor = parts
    if emotion_code not in RAVDESS_EMOTION_MAP:
        return None
    if vocal != "01":  # speech channel only
        return None
    emotion, label = RAVDESS_EMOTION_MAP[emotion_code]
    return {
        "audio_path": str(path.resolve()),
        "label": label,
        "emotion": emotion,
        "emotion_code": emotion_code,
        "intensity": int(intensity),
        "statement": int(statement),
        "repetition": int(repetition),
        "actor": int(actor),
        "source": "RAVDESS",
    }


def _build_ravdess_metadata(audio_dir: Path, wav_files: List[Path]) -> pd.DataFrame:
    rows = [r for r in (_parse_ravdess_filename(p) for p in wav_files) if r is not None]
    if not rows:
        return pd.DataFrame()
    df = pd.DataFrame(rows).drop_duplicates(subset="audio_path").reset_index(drop=True)

    splits: pd.Series
    if os.environ.get("RAVDESS_SPLIT", "stratified").lower() == "actor":
        # Speaker-independent protocol (no actor leakage across splits):
        # train actors 01-16, val 17-20, test 21-24.
        def actor_split(a: int) -> str:
            return "train" if a <= 16 else ("val" if a <= 20 else "test")
        splits = df["actor"].map(actor_split)
    else:
        splits = _stratified_split(df)
    df["split"] = splits.values

    max_per_class = 0
    try:
        max_per_class = int(os.environ.get("RAVDESS_MAX_CLIPS_PER_CLASS", "0"))
    except ValueError:
        pass
    if max_per_class > 0:
        df = df.groupby(["split", "label"], group_keys=False).apply(
            lambda x: x.sample(min(len(x), max_per_class), random_state=42)
        ).reset_index(drop=True)

    df = df[["audio_path", "label", "split", "emotion", "actor", "intensity", "source"]]
    df.to_csv(audio_dir / "dataset.csv", index=False)
    counts = df.groupby(["split", "label"]).size().unstack(fill_value=0)
    logger.info(f"RAVDESS dataset prepared: {len(df)} clips from {df['actor'].nunique()} actors.\n{counts}")
    return df


def _load_synthetic_audio_fallback(audio_dir: Path, num_samples_per_class: int) -> Dict[str, pd.DataFrame]:
    """Offline placeholder used only when the real RAVDESS dataset is unreachable."""
    logger.warning(
        "Falling back to SYNTHETIC audio placeholders (offline sandbox mode). "
        "Real RAVDESS clips will be used automatically once the archive is reachable."
    )
    import soundfile as sf
    sr = 16000
    duration = 2.0
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)

    data = []
    for cls_idx in range(3):
        cls_dir = audio_dir / f"class_{cls_idx}"
        cls_dir.mkdir(parents=True, exist_ok=True)

        for i in range(num_samples_per_class):
            wav_path = cls_dir / f"sample_{i}.wav"
            if not wav_path.exists():
                np.random.seed(cls_idx * 2000 + i)
                if cls_idx == 0:
                    freq1 = np.random.uniform(200, 350)
                    freq2 = np.random.uniform(900, 1400)
                    waveform = 0.5 * np.sin(2 * np.pi * freq1 * t) + 0.4 * np.sin(2 * np.pi * freq2 * t + np.random.randn(*t.shape) * 0.5)
                elif cls_idx == 1:
                    freq = np.random.uniform(300, 500)
                    envelope = np.exp(-0.5 * ((t - 1.0) / 0.8) ** 2)
                    waveform = 0.6 * np.sin(2 * np.pi * freq * t) * envelope
                else:
                    f_base = np.random.choice([523.25, 587.33, 659.25])
                    waveform = (0.35 * np.sin(2 * np.pi * f_base * t) +
                                0.35 * np.sin(2 * np.pi * (f_base * 1.25) * t) +
                                0.30 * np.sin(2 * np.pi * (f_base * 1.5) * t))

                waveform = np.clip(waveform, -1.0, 1.0)
                sf.write(str(wav_path), waveform, sr)

            split = "train" if i < int(num_samples_per_class * 0.7) else ("val" if i < int(num_samples_per_class * 0.85) else "test")
            data.append({
                "audio_path": str(wav_path.resolve()),
                "label": cls_idx,
                "split": split,
                "source": "synthetic-fallback",
            })

    df = pd.DataFrame(data)
    df.to_csv(audio_dir / "dataset.csv", index=False)
    logger.info(f"Created/verified synthetic audio placeholder set: {len(df)} clips.")
    return {
        "train": df[df["split"] == "train"].reset_index(drop=True),
        "val": df[df["split"] == "val"].reset_index(drop=True),
        "test": df[df["split"] == "test"].reset_index(drop=True),
    }


def load_audio_dataset(num_samples_per_class: int = 150) -> Dict[str, pd.DataFrame]:
    """
    Load the RAVDESS speech-emotion corpus (audio-only speech subset) and map
    its 8 emotional expressions onto the unified 3-class sentiment scheme.
    """
    logger.info("Loading Audio Dataset: RAVDESS Speech Emotion (Livingstone & Russo, 2018; Zenodo 1188976)...")
    audio_dir = DATASETS_DIR / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    csv_path = audio_dir / "dataset.csv"

    # 1) Cached metadata ------------------------------------------------------
    cached = _read_cached_metadata(csv_path, "RAVDESS")
    if cached is not None:
        return cached
    cached_synth = _read_cached_metadata(csv_path, "synthetic-fallback")

    extract_root = audio_dir / "RAVDESS"
    wav_files: List[Path] = []

    # Already extracted on a previous run?
    if extract_root.exists():
        wav_files = sorted(extract_root.rglob("*.wav"))

    # 2) Local zip ------------------------------------------------------------
    if not wav_files:
        zip_path = _ravdess_local_zip(audio_dir)
        if zip_path is not None:
            logger.info(f"Using local RAVDESS archive: {zip_path}")
            try:
                _extract_archive(zip_path, extract_root)
                wav_files = sorted(extract_root.rglob("*.wav"))
            except Exception as e:
                logger.warning(f"Could not extract {zip_path}: {e}")

    # 3) Official Zenodo download ---------------------------------------------
    if not wav_files:
        zip_path = _ravdess_download(audio_dir)
        if zip_path is not None:
            try:
                _extract_archive(zip_path, extract_root)
                wav_files = sorted(extract_root.rglob("*.wav"))
            except Exception as e:
                logger.warning(f"Could not extract downloaded archive: {e}")

    # 4) Hugging Face mirror (optional) ---------------------------------------
    if not wav_files:
        hf_wavs = _ravdess_try_huggingface()
        if hf_wavs:
            wav_files = hf_wavs

    if wav_files:
        parsed_count = len(wav_files)
        logger.info(f"Discovered {parsed_count} RAVDESS speech wav files.")
        df = _build_ravdess_metadata(audio_dir, wav_files)
        if len(df) > 0:
            _prune_legacy_class_dirs(audio_dir)
            return {
                "train": df[df["split"] == "train"].reset_index(drop=True),
                "val": df[df["split"] == "val"].reset_index(drop=True),
                "test": df[df["split"] == "test"].reset_index(drop=True),
            }

    # 5) Synthetic fallback ---------------------------------------------------
    if cached_synth is not None:
        logger.warning("RAVDESS unavailable; re-using cached synthetic placeholders.")
        return cached_synth
    return _load_synthetic_audio_fallback(audio_dir, num_samples_per_class)


if __name__ == "__main__":
    load_text_dataset()
    load_image_dataset()
    load_audio_dataset()
