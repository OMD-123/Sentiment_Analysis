import mongoose, { Schema, Document } from "mongoose";
import { createModelProxy } from "../config/modelProxy";

export interface ILog extends Document {
  level: "info" | "warn" | "error";
  action: string;
  message: string;
  meta?: any;
  createdAt: Date;
}

const LogSchema: Schema = new Schema({
  level: { type: String, enum: ["info", "warn", "error"], default: "info" },
  action: { type: String, required: true },
  message: { type: String, required: true },
  meta: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now }
});

const LogModel = mongoose.model<ILog>("Log", LogSchema);
export default createModelProxy<ILog>("Log", LogModel);
