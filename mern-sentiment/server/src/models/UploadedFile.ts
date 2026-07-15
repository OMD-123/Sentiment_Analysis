import mongoose, { Schema, Document } from "mongoose";
import { createModelProxy } from "../config/modelProxy";

export interface IUploadedFile extends Document {
  userId?: mongoose.Types.ObjectId;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  path: string;
  modality: "image" | "audio";
  createdAt: Date;
}

const UploadedFileSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: false },
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  mimetype: { type: String, required: true },
  size: { type: Number, required: true },
  path: { type: String, required: true },
  modality: { type: String, enum: ["image", "audio"], required: true },
  createdAt: { type: Date, default: Date.now }
});

const UploadedFileModel = mongoose.model<IUploadedFile>("UploadedFile", UploadedFileSchema);
export default createModelProxy<IUploadedFile>("UploadedFile", UploadedFileModel);
