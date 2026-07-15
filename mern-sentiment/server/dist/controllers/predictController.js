"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteHistoryItem = exports.getHistory = exports.predictMultimodal = exports.predictAudio = exports.predictImage = exports.predictText = void 0;
const PredictionHistory_1 = __importDefault(require("../models/PredictionHistory"));
const UploadedFile_1 = __importDefault(require("../models/UploadedFile"));
const Log_1 = __importDefault(require("../models/Log"));
const Analytics_1 = __importDefault(require("../models/Analytics"));
const mlService_1 = require("../services/mlService");
const updateAnalytics = async (modality, sentiment, confidence) => {
    const today = new Date().toISOString().split("T")[0];
    let analytics = await Analytics_1.default.findOne({ date: today });
    if (!analytics) {
        analytics = await Analytics_1.default.create({
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
    if (sentiment === "Positive")
        analytics.positiveCount += 1;
    else if (sentiment === "Negative")
        analytics.negativeCount += 1;
    else if (sentiment === "Neutral")
        analytics.neutralCount += 1;
    if (modality === "text")
        analytics.modalityCounts.text += 1;
    else if (modality === "image")
        analytics.modalityCounts.image += 1;
    else if (modality === "audio")
        analytics.modalityCounts.audio += 1;
    else if (modality === "multimodal")
        analytics.modalityCounts.multimodal += 1;
    await analytics.save();
};
const predictText = async (req, res, next) => {
    try {
        const { text } = req.body;
        if (!text || !text.trim()) {
            res.status(400).json({ success: false, message: "Text input required." });
            return;
        }
        const result = await mlService_1.MLService.predictText(text);
        const history = await PredictionHistory_1.default.create({
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
        await Log_1.default.create({
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
    }
    catch (error) {
        next(error);
    }
};
exports.predictText = predictText;
const predictImage = async (req, res, next) => {
    try {
        if (!req.file) {
            res.status(400).json({ success: false, message: "Image file required." });
            return;
        }
        const fileRecord = await UploadedFile_1.default.create({
            userId: req.user?.id || undefined,
            filename: req.file.filename,
            originalName: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            path: req.file.path,
            modality: "image"
        });
        const result = await mlService_1.MLService.predictImage(req.file.path);
        const history = await PredictionHistory_1.default.create({
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
        await Log_1.default.create({
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
    }
    catch (error) {
        next(error);
    }
};
exports.predictImage = predictImage;
const predictAudio = async (req, res, next) => {
    try {
        if (!req.file) {
            res.status(400).json({ success: false, message: "Audio file required." });
            return;
        }
        const fileRecord = await UploadedFile_1.default.create({
            userId: req.user?.id || undefined,
            filename: req.file.filename,
            originalName: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            path: req.file.path,
            modality: "audio"
        });
        const result = await mlService_1.MLService.predictAudio(req.file.path);
        const history = await PredictionHistory_1.default.create({
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
        await Log_1.default.create({
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
    }
    catch (error) {
        next(error);
    }
};
exports.predictAudio = predictAudio;
const predictMultimodal = async (req, res, next) => {
    try {
        const files = req.files || {};
        const text = req.body.text;
        const imageFile = files["image"] ? files["image"][0] : undefined;
        const audioFile = files["audio"] ? files["audio"][0] : undefined;
        if (!text && !imageFile && !audioFile) {
            res.status(400).json({ success: false, message: "At least one input (text, image, or audio) must be provided." });
            return;
        }
        let imagePath;
        if (imageFile) {
            imagePath = imageFile.path;
            await UploadedFile_1.default.create({
                userId: req.user?.id || undefined,
                filename: imageFile.filename,
                originalName: imageFile.originalname,
                mimetype: imageFile.mimetype,
                size: imageFile.size,
                path: imageFile.path,
                modality: "image"
            });
        }
        let audioPath;
        if (audioFile) {
            audioPath = audioFile.path;
            await UploadedFile_1.default.create({
                userId: req.user?.id || undefined,
                filename: audioFile.filename,
                originalName: audioFile.originalname,
                mimetype: audioFile.mimetype,
                size: audioFile.size,
                path: audioFile.path,
                modality: "audio"
            });
        }
        const result = await mlService_1.MLService.predictMultimodal({
            text,
            imagePath,
            audioPath
        });
        const history = await PredictionHistory_1.default.create({
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
        await Log_1.default.create({
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
    }
    catch (error) {
        next(error);
    }
};
exports.predictMultimodal = predictMultimodal;
const getHistory = async (req, res, next) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const filter = {};
        if (req.user?.id) {
            filter.userId = req.user.id;
        }
        const history = await PredictionHistory_1.default.find(filter)
            .sort({ createdAt: -1 })
            .limit(limit);
        res.status(200).json({
            success: true,
            count: history.length,
            history
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getHistory = getHistory;
const deleteHistoryItem = async (req, res, next) => {
    try {
        const { id } = req.params;
        const filter = { _id: id };
        if (req.user && req.user.role !== "admin") {
            filter.userId = req.user.id;
        }
        const deleted = await PredictionHistory_1.default.findOneAndDelete(filter);
        if (!deleted) {
            res.status(404).json({ success: false, message: "Prediction record not found or not authorized." });
            return;
        }
        res.status(200).json({ success: true, message: "Prediction record deleted successfully." });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteHistoryItem = deleteHistoryItem;
