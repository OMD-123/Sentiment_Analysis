"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const database_1 = require("./config/database");
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const predictRoutes_1 = __importDefault(require("./routes/predictRoutes"));
const analyticsRoutes_1 = __importDefault(require("./routes/analyticsRoutes"));
const errorHandler_1 = require("./middleware/errorHandler");
const PredictionHistory_1 = __importDefault(require("./models/PredictionHistory"));
const Analytics_1 = __importDefault(require("./models/Analytics"));
const Log_1 = __importDefault(require("./models/Log"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
app.use((0, cors_1.default)({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express_1.default.json({ limit: "50mb" }));
app.use(express_1.default.urlencoded({ extended: true, limit: "50mb" }));
app.use("/uploads", express_1.default.static(path_1.default.join(__dirname, "../../../uploads")));
app.use("/reports", express_1.default.static(path_1.default.join(__dirname, "../../../models/reports")));
app.use("/api/auth", authRoutes_1.default);
app.use("/api/predict", predictRoutes_1.default);
app.use("/api/analytics", analyticsRoutes_1.default);
app.get("/api/health", (req, res) => {
    res.status(200).json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        service: "MERN Multimodal Sentiment Backend"
    });
});
// Serve React Client build files
const clientDistPath = path_1.default.join(__dirname, "../../client/dist");
if (fs_1.default.existsSync(clientDistPath)) {
    app.use(express_1.default.static(clientDistPath));
    app.get("*", (req, res, next) => {
        if (req.path.startsWith("/api") || req.path.startsWith("/uploads") || req.path.startsWith("/reports")) {
            return next();
        }
        res.sendFile(path_1.default.join(clientDistPath, "index.html"));
    });
}
app.use(errorHandler_1.errorHandler);
const seedInitialData = async () => {
    try {
        const count = await PredictionHistory_1.default.countDocuments();
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
                await PredictionHistory_1.default.create(p);
            }
            const today = new Date().toISOString().split("T")[0];
            await Analytics_1.default.create({
                date: today,
                totalPredictions: 6,
                positiveCount: 3,
                negativeCount: 1,
                neutralCount: 2,
                modalityCounts: { text: 2, image: 1, audio: 1, multimodal: 2 },
                avgConfidence: 0.958
            });
            await Log_1.default.create({
                level: "info",
                action: "SYSTEM_STARTUP",
                message: "Seeded initial demonstration history and analytics."
            });
            console.log("[Seeder] ✔ Initial baseline data seeded successfully!");
        }
    }
    catch (error) {
        console.error("[Seeder] Error checking/seeding initial data:", error);
    }
};
const startServer = async () => {
    await (0, database_1.connectDB)();
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
exports.default = app;
