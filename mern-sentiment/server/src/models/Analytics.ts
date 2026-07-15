import mongoose, { Schema, Document } from "mongoose";
import { createModelProxy } from "../config/modelProxy";

export interface IAnalytics extends Document {
  date: string;
  totalPredictions: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  modalityCounts: {
    text: number;
    image: number;
    audio: number;
    multimodal: number;
  };
  avgConfidence: number;
  updatedAt: Date;
}

const AnalyticsSchema: Schema = new Schema({
  date: { type: String, required: true, unique: true },
  totalPredictions: { type: Number, default: 0 },
  positiveCount: { type: Number, default: 0 },
  negativeCount: { type: Number, default: 0 },
  neutralCount: { type: Number, default: 0 },
  modalityCounts: {
    text: { type: Number, default: 0 },
    image: { type: Number, default: 0 },
    audio: { type: Number, default: 0 },
    multimodal: { type: Number, default: 0 }
  },
  avgConfidence: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now }
});

const AnalyticsModel = mongoose.model<IAnalytics>("Analytics", AnalyticsSchema);
export default createModelProxy<IAnalytics>("Analytics", AnalyticsModel);
