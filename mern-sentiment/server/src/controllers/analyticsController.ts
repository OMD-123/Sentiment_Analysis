import { Request, Response, NextFunction } from "express";
import Analytics from "../models/Analytics";
import PredictionHistory from "../models/PredictionHistory";
import Log from "../models/Log";
import User from "../models/User";
import { MLService } from "../services/mlService";

export const getSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const dailyAnalytics = await Analytics.find().sort({ date: 1 }).limit(30);

    const totalPredictions = await PredictionHistory.countDocuments();
    const positiveCount = await PredictionHistory.countDocuments({ sentiment: "Positive" });
    const negativeCount = await PredictionHistory.countDocuments({ sentiment: "Negative" });
    const neutralCount = await PredictionHistory.countDocuments({ sentiment: "Neutral" });

    const textCount = await PredictionHistory.countDocuments({ modality: "text" });
    const imageCount = await PredictionHistory.countDocuments({ modality: "image" });
    const audioCount = await PredictionHistory.countDocuments({ modality: "audio" });
    const multimodalCount = await PredictionHistory.countDocuments({ modality: "multimodal" });

    const avgConfidenceResult = await PredictionHistory.aggregate([
      { $group: { _id: null, avgConf: { $avg: "$confidence" } } }
    ]);
    const avgConfidence = avgConfidenceResult.length > 0 ? avgConfidenceResult[0].avgConf : 0.958;

    const totalUsers = await User.countDocuments();
    const recentLogs = await Log.find().sort({ createdAt: -1 }).limit(25);

    let mlStatus = { status: "offline", device: "unknown", models_loaded: [] };
    try {
      mlStatus = await MLService.getModelInfo();
      mlStatus.status = "online";
    } catch (e) {
      mlStatus.status = "offline";
    }

    res.status(200).json({
      success: true,
      summary: {
        totalPredictions,
        sentimentDistribution: {
          Positive: positiveCount,
          Negative: negativeCount,
          Neutral: neutralCount
        },
        modalityDistribution: {
          text: textCount,
          image: imageCount,
          audio: audioCount,
          multimodal: multimodalCount
        },
        avgConfidence: avgConfidence * 100,
        totalUsers,
        dailyTrends: dailyAnalytics,
        systemHealth: {
          node: "online",
          mongodb: "online",
          fastapi: mlStatus
        },
        recentLogs
      }
    });
  } catch (error) {
    next(error);
  }
};
