import axios from "axios";

const API_BASE = "/api";

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json"
  }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("sentiment_token");
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface PredictionHistoryItem {
  _id?: string;
  id?: string;
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
  createdAt: string;
}

export const getAnalyticsSummary = async () => {
  const response = await api.get("/analytics/summary");
  return response.data.summary;
};

export const predictText = async (text: string) => {
  const response = await api.post("/predict/text", { text });
  return response.data.prediction;
};

export const predictImage = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post("/predict/image", formData, {
    headers: { "Content-Type": "multipart/form-data" }
  });
  return response.data.prediction;
};

export const predictAudio = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post("/predict/audio", formData, {
    headers: { "Content-Type": "multipart/form-data" }
  });
  return response.data.prediction;
};

export const predictMultimodal = async (options: { text?: string; image?: File; audio?: File }) => {
  const formData = new FormData();
  if (options.text) formData.append("text", options.text);
  if (options.image) formData.append("image", options.image);
  if (options.audio) formData.append("audio", options.audio);

  const response = await api.post("/predict/multimodal", formData, {
    headers: { "Content-Type": "multipart/form-data" }
  });
  return response.data.prediction;
};

export const getPredictionHistory = async (limit: number = 50) => {
  const response = await api.get(`/predict/history?limit=${limit}`);
  return response.data.history;
};

export const deletePredictionHistory = async (id: string) => {
  const response = await api.delete(`/predict/history/${id}`);
  return response.data;
};
