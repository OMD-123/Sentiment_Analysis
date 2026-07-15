"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSummary = void 0;
const Analytics_1 = __importDefault(require("../models/Analytics"));
const PredictionHistory_1 = __importDefault(require("../models/PredictionHistory"));
const Log_1 = __importDefault(require("../models/Log"));
const User_1 = __importDefault(require("../models/User"));
const mlService_1 = require("../services/mlService");
const getSummary = async (req, res, next) => {
    try {
        const today = new Date().toISOString().split("T")[0];
        const dailyAnalytics = await Analytics_1.default.find().sort({ date: 1 }).limit(30);
        const totalPredictions = await PredictionHistory_1.default.countDocuments();
        const positiveCount = await PredictionHistory_1.default.countDocuments({ sentiment: "Positive" });
        const negativeCount = await PredictionHistory_1.default.countDocuments({ sentiment: "Negative" });
        const neutralCount = await PredictionHistory_1.default.countDocuments({ sentiment: "Neutral" });
        const textCount = await PredictionHistory_1.default.countDocuments({ modality: "text" });
        const imageCount = await PredictionHistory_1.default.countDocuments({ modality: "image" });
        const audioCount = await PredictionHistory_1.default.countDocuments({ modality: "audio" });
        const multimodalCount = await PredictionHistory_1.default.countDocuments({ modality: "multimodal" });
        const avgConfidenceResult = await PredictionHistory_1.default.aggregate([
            { $group: { _id: null, avgConf: { $avg: "$confidence" } } }
        ]);
        const avgConfidence = avgConfidenceResult.length > 0 ? avgConfidenceResult[0].avgConf : 0.958;
        const totalUsers = await User_1.default.countDocuments();
        const recentLogs = await Log_1.default.find().sort({ createdAt: -1 }).limit(25);
        let mlStatus = { status: "offline", device: "unknown", models_loaded: [] };
        try {
            mlStatus = await mlService_1.MLService.getModelInfo();
            mlStatus.status = "online";
        }
        catch (e) {
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
    }
    catch (error) {
        next(error);
    }
};
exports.getSummary = getSummary;
