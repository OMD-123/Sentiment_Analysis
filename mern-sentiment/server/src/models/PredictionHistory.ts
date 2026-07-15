import mongoose, { Schema, Document } from "mongoose";
import { createModelProxy } from "../config/modelProxy";

export interface IPredictionHistory extends Document {
  userId?: mongoose.Types.ObjectId;
  modality: "text" | "image" | "audio" | "multimodal";
  inputs: {
    text?: string;
    imagePath?: string;
    audioPath?: string;
  };
  sentiment: "Positive" | "Negative" | "Neutral";
  confidence: number;
  probabilityScores: {
    Negative: number;
    Neutral: number;
    Positive: number;
  };
  modalityScores?: Record<string, any>;
  attentionWeights?: Record<string, number>;
  createdAt: Date;
}

const PredictionHistorySchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: false },
  modality: { type: String, enum: ["text", "image", "audio", "multimodal"], required: true },
  inputs: {
    text: { type: String },
    imagePath: { type: String },
    audioPath: { type: String }
  },
  sentiment: { type: String, enum: ["Positive", "Negative", "Neutral"], required: true },
  confidence: { type: Number, required: true },
  probabilityScores: {
    Negative: { type: Number, required: true },
    Neutral: { type: Number, required: true },
    Positive: { type: Number, required: true }
  },
  modalityScores: { type: Schema.Types.Mixed },
  attentionWeights: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now }
});

const PredictionHistoryModel = mongoose.model<IPredictionHistory>("PredictionHistory", PredictionHistorySchema);
export default createModelProxy<IPredictionHistory>("PredictionHistory", PredictionHistoryModel);
