import express, { Application, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { connectDB } from "./config/database";
import authRoutes from "./routes/authRoutes";
import predictRoutes from "./routes/predictRoutes";
import analyticsRoutes from "./routes/analyticsRoutes";
import { errorHandler } from "./middleware/errorHandler";
import PredictionHistory from "./models/PredictionHistory";
import Analytics from "./models/Analytics";
import Log from "./models/Log";

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.use("/uploads", express.static(path.join(__dirname, "../../../uploads")));
app.use("/reports", express.static(path.join(__dirname, "../../../models/reports")));

app.use("/api/auth", authRoutes);
app.use("/api/predict", predictRoutes);
app.use("/api/analytics", analyticsRoutes);

app.get("/api/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "MERN Multimodal Sentiment Backend"
  });
});

// Serve React Client build files
const clientDistPath = path.join(__dirname, "../../client/dist");
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get("*", (req: Request, res: Response, next: any) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads") || req.path.startsWith("/reports")) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, "index.html"));
  });
}

app.use(errorHandler);

const seedInitialData = async () => {
  try {
    const count = await PredictionHistory.countDocuments();
    if (count === 0) {
      console.log("[Seeder] Seeding initial baseline prediction history for rich dashboard charts...");
      const samplePredictions = [
        {
          modality: "multimodal",
          inputs: { text: "Super excited for our new multimodal architecture release!" },
          sentiment: "Positive",
          confidence: 0.985,
          probabilityScores: { Negative: 0.005, Neutral: 0.010, Positive: 0.985 },
          modalityScores: {
            text: { sentiment: "Positive", confidence: 0.99, probability_scores: { Negative: 0.003, Neutral: 0.007, Positive: 0.99 } }
          },
          attentionWeights: { text: 0.45, image: 0.30, audio: 0.25 }
        },
        {
          modality: "text",
          inputs: { text: "The app crashed again right before the deadline. Totally unacceptable." },
          sentiment: "Negative",
          confidence: 0.962,
          probabilityScores: { Negative: 0.962, Neutral: 0.025, Positive: 0.013 }
        },
        {
          modality: "image",
          inputs: { imagePath: "sample_sunshine.jpg" },
          sentiment: "Positive",
          confidence: 0.941,
          probabilityScores: { Negative: 0.020, Neutral: 0.039, Positive: 0.941 }
        },
        {
          modality: "audio",
          inputs: { audioPath: "sample_speech.wav" },
          sentiment: "Neutral",
          confidence: 0.892,
          probabilityScores: { Negative: 0.060, Neutral: 0.892, Positive: 0.048 }
        },
        {
          modality: "multimodal",
          inputs: { text: "Meeting scheduled for 10 AM tomorrow in Conference Room B." },
          sentiment: "Neutral",
          confidence: 0.978,
          probabilityScores: { Negative: 0.010, Neutral: 0.978, Positive: 0.012 },
          attentionWeights: { text: 0.60, image: 0.20, audio: 0.20 }
        },
        {
          modality: "text",
          inputs: { text: "I absolutely love the clean UI and super fast response times!" },
          sentiment: "Positive",
          confidence: 0.991,
          probabilityScores: { Negative: 0.004, Neutral: 0.005, Positive: 0.991 }
        }
      ];

      for (const p of samplePredictions) {
        await PredictionHistory.create(p as any);
      }

      const today = new Date().toISOString().split("T")[0];
      await Analytics.create({
        date: today,
        totalPredictions: 6,
        positiveCount: 3,
        negativeCount: 1,
        neutralCount: 2,
        modalityCounts: { text: 2, image: 1, audio: 1, multimodal: 2 },
        avgConfidence: 0.958
      });

      await Log.create({
        level: "info",
        action: "SYSTEM_STARTUP",
        message: "Seeded initial demonstration history and analytics."
      });
      console.log("[Seeder] ✔ Initial baseline data seeded successfully!");
    }
  } catch (error) {
    console.error("[Seeder] Error checking/seeding initial data:", error);
  }
};

const startServer = async () => {
  await connectDB();
  await seedInitialData();
  app.listen(PORT, () => {
    console.log(`===========================================================`);
    console.log(`✔ Express TypeScript Backend Running on port ${PORT}`);
    console.log(`✔ API Health Check: http://localhost:${PORT}/api/health`);
    console.log(`✔ Full MERN App Dashboard: http://localhost:${PORT}`);
    console.log(`===========================================================`);
  });
};

if (require.main === module) {
  startServer();
}

export default app;
