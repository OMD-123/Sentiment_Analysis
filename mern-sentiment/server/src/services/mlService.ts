import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import path from "path";

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

export interface PredictionResult {
  sentiment: "Positive" | "Negative" | "Neutral";
  confidence: number;
  probability_scores: {
    Negative: number;
    Neutral: number;
    Positive: number;
  };
  modality_scores?: Record<string, any>;
  attention_weights?: Record<string, number>;
}

export class MLService {
  public static async predictText(text: string): Promise<PredictionResult> {
    const response = await axios.post(`${ML_SERVICE_URL}/predict/text`, { text });
    return response.data;
  }

  public static async predictImage(filePath: string): Promise<PredictionResult> {
    const form = new FormData();
    form.append("file", fs.createReadStream(filePath), path.basename(filePath));
    const response = await axios.post(`${ML_SERVICE_URL}/predict/image`, form, {
      headers: form.getHeaders()
    });
    return response.data;
  }

  public static async predictAudio(filePath: string): Promise<PredictionResult> {
    const form = new FormData();
    form.append("file", fs.createReadStream(filePath), path.basename(filePath));
    const response = await axios.post(`${ML_SERVICE_URL}/predict/audio`, form, {
      headers: form.getHeaders()
    });
    return response.data;
  }

  public static async predictMultimodal(options: {
    text?: string;
    imagePath?: string;
    audioPath?: string;
  }): Promise<PredictionResult> {
    const form = new FormData();
    if (options.text) {
      form.append("text", options.text);
    }
    if (options.imagePath && fs.existsSync(options.imagePath)) {
      form.append("image", fs.createReadStream(options.imagePath), path.basename(options.imagePath));
    }
    if (options.audioPath && fs.existsSync(options.audioPath)) {
      form.append("audio", fs.createReadStream(options.audioPath), path.basename(options.audioPath));
    }
    const response = await axios.post(`${ML_SERVICE_URL}/predict/multimodal`, form, {
      headers: form.getHeaders()
    });
    return response.data;
  }

  public static async getModelInfo(): Promise<any> {
    const response = await axios.get(`${ML_SERVICE_URL}/model/info`);
    return response.data;
  }
}
