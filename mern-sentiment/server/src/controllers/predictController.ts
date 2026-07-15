import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import PredictionHistory from "../models/PredictionHistory";
import UploadedFile from "../models/UploadedFile";
import Log from "../models/Log";
import Analytics from "../models/Analytics";
import { MLService, PredictionResult } from "../services/mlService";

const updateAnalytics = async (modality: "text" | "image" | "audio" | "multimodal", sentiment: string, confidence: number) => {
  const today = new Date().toISOString().split("T")[0];
  let analytics = await Analytics.findOne({ date: today });
  if (!analytics) {
    analytics = await Analytics.create({
      date: today,
      totalPredictions: 0,
      positiveCount: 0,
      negativeCount: 0,
      neutralCount: 0,
      modalityCounts: { text: 0, image: 0, audio: 0, multimodal: 0 },
      avgConfidence: 0
    });
  }

  const oldTotal = analytics.totalPredictions || 0;
  const newTotal = oldTotal + 1;
  analytics.avgConfidence = ((analytics.avgConfidence * oldTotal) + confidence) / newTotal;
  analytics.totalPredictions = newTotal;

  if (sentiment === "Positive") analytics.positiveCount += 1;
  else if (sentiment === "Negative") analytics.negativeCount += 1;
  else if (sentiment === "Neutral") analytics.neutralCount += 1;

  if (modality === "text") analytics.modalityCounts.text += 1;
  else if (modality === "image") analytics.modalityCounts.image += 1;
  else if (modality === "audio") analytics.modalityCounts.audio += 1;
  else if (modality === "multimodal") analytics.modalityCounts.multimodal += 1;

  await analytics.save();
};

export const predictText = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      res.status(400).json({ success: false, message: "Text input required." });
      return;
    }

    const result: PredictionResult = await MLService.predictText(text);

    const history = await PredictionHistory.create({
      userId: req.user?.id || undefined,
      modality: "text",
      inputs: { text },
      sentiment: result.sentiment,
      confidence: result.confidence,
      probabilityScores: result.probability_scores,
      modalityScores: result.modality_scores,
      attentionWeights: result.attention_weights
    });

    await updateAnalytics("text", result.sentiment, result.confidence);
    await Log.create({
      level: "info",
      action: "PREDICT_TEXT",
      message: `Analyzed text with ${result.sentiment} sentiment (${(result.confidence * 100).toFixed(1)}%)`,
      meta: { historyId: history._id, userId: req.user?.id }
    });

    res.status(200).json({
      success: true,
      prediction: {
        id: history._id,
        sentiment: result.sentiment,
        confidence: result.confidence,
        probabilityScores: result.probability_scores,
        modalityScores: result.modality_scores,
        attentionWeights: result.attention_weights,
        createdAt: history.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

export const predictImage = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: "Image file required." });
      return;
    }

    const fileRecord = await UploadedFile.create({
      userId: req.user?.id || undefined,
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
      modality: "image"
    });

    const result: PredictionResult = await MLService.predictImage(req.file.path);

    const history = await PredictionHistory.create({
      userId: req.user?.id || undefined,
      modality: "image",
      inputs: { imagePath: req.file.path },
      sentiment: result.sentiment,
      confidence: result.confidence,
      probabilityScores: result.probability_scores,
      modalityScores: result.modality_scores,
      attentionWeights: result.attention_weights
    });

    await updateAnalytics("image", result.sentiment, result.confidence);
    await Log.create({
      level: "info",
      action: "PREDICT_IMAGE",
      message: `Analyzed image (${req.file.originalname}) with ${result.sentiment} sentiment`,
      meta: { historyId: history._id, fileId: fileRecord._id }
    });

    res.status(200).json({
      success: true,
      prediction: {
        id: history._id,
        sentiment: result.sentiment,
        confidence: result.confidence,
        probabilityScores: result.probability_scores,
        modalityScores: result.modality_scores,
        attentionWeights: result.attention_weights,
        createdAt: history.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

export const predictAudio = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: "Audio file required." });
      return;
    }

    const fileRecord = await UploadedFile.create({
      userId: req.user?.id || undefined,
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
      modality: "audio"
    });

    const result: PredictionResult = await MLService.predictAudio(req.file.path);

    const history = await PredictionHistory.create({
      userId: req.user?.id || undefined,
      modality: "audio",
      inputs: { audioPath: req.file.path },
      sentiment: result.sentiment,
      confidence: result.confidence,
      probabilityScores: result.probability_scores,
      modalityScores: result.modality_scores,
      attentionWeights: result.attention_weights
    });

    await updateAnalytics("audio", result.sentiment, result.confidence);
    await Log.create({
      level: "info",
      action: "PREDICT_AUDIO",
      message: `Analyzed audio (${req.file.originalname}) with ${result.sentiment} sentiment`,
      meta: { historyId: history._id, fileId: fileRecord._id }
    });

    res.status(200).json({
      success: true,
      prediction: {
        id: history._id,
        sentiment: result.sentiment,
        confidence: result.confidence,
        probabilityScores: result.probability_scores,
        modalityScores: result.modality_scores,
        attentionWeights: result.attention_weights,
        createdAt: history.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

export const predictMultimodal = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const files = (req.files as { [fieldname: string]: Express.Multer.File[] }) || {};
    const text = req.body.text;
    const imageFile = files["image"] ? files["image"][0] : undefined;
    const audioFile = files["audio"] ? files["audio"][0] : undefined;

    if (!text && !imageFile && !audioFile) {
      res.status(400).json({ success: false, message: "At least one input (text, image, or audio) must be provided." });
      return;
    }

    let imagePath: string | undefined;
    if (imageFile) {
      imagePath = imageFile.path;
      await UploadedFile.create({
        userId: req.user?.id || undefined,
        filename: imageFile.filename,
        originalName: imageFile.originalname,
        mimetype: imageFile.mimetype,
        size: imageFile.size,
        path: imageFile.path,
        modality: "image"
      });
    }

    let audioPath: string | undefined;
    if (audioFile) {
      audioPath = audioFile.path;
      await UploadedFile.create({
        userId: req.user?.id || undefined,
        filename: audioFile.filename,
        originalName: audioFile.originalname,
        mimetype: audioFile.mimetype,
        size: audioFile.size,
        path: audioFile.path,
        modality: "audio"
      });
    }

    const result: PredictionResult = await MLService.predictMultimodal({
      text,
      imagePath,
      audioPath
    });

    const history = await PredictionHistory.create({
      userId: req.user?.id || undefined,
      modality: "multimodal",
      inputs: { text, imagePath, audioPath },
      sentiment: result.sentiment,
      confidence: result.confidence,
      probabilityScores: result.probability_scores,
      modalityScores: result.modality_scores,
      attentionWeights: result.attention_weights
    });

    await updateAnalytics("multimodal", result.sentiment, result.confidence);
    await Log.create({
      level: "info",
      action: "PREDICT_MULTIMODAL",
      message: `Analyzed multimodal inputs with ${result.sentiment} sentiment (${(result.confidence * 100).toFixed(1)}%)`,
      meta: { historyId: history._id }
    });

    res.status(200).json({
      success: true,
      prediction: {
        id: history._id,
        sentiment: result.sentiment,
        confidence: result.confidence,
        probabilityScores: result.probability_scores,
        modalityScores: result.modality_scores,
        attentionWeights: result.attention_weights,
        createdAt: history.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getHistory = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const filter: any = {};
    if (req.user?.id) {
      filter.userId = req.user.id;
    }
    const history = await PredictionHistory.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit);

    res.status(200).json({
      success: true,
      count: history.length,
      history
    });
  } catch (error) {
    next(error);
  }
};

export const deleteHistoryItem = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const filter: any = { _id: id };
    if (req.user && req.user.role !== "admin") {
      filter.userId = req.user.id;
    }
    const deleted = await PredictionHistory.findOneAndDelete(filter);
    if (!deleted) {
      res.status(404).json({ success: false, message: "Prediction record not found or not authorized." });
      return;
    }
    res.status(200).json({ success: true, message: "Prediction record deleted successfully." });
  } catch (error) {
    next(error);
  }
};
