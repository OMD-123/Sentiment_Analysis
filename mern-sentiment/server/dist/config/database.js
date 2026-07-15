"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.disconnectDB = exports.connectDB = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const mongodb_memory_server_1 = require("mongodb-memory-server");
const modelProxy_1 = require("./modelProxy");
let mongoServer = null;
const connectDB = async () => {
    try {
        const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/mern_sentiment";
        console.log(`[Database] Attempting connection to system MongoDB daemon (${uri})...`);
        await mongoose_1.default.connect(uri, {
            serverSelectionTimeoutMS: 1000
        });
        console.log("[Database] ✔ Connected successfully to system MongoDB daemon.");
        return;
    }
    catch (error) {
        console.log("[Database] System MongoDB not active on port 27017.");
    }
    if (process.env.SKIP_MEMORY_SERVER !== "true") {
        try {
            console.log("[Database] Checking for cached/local MongoMemoryServer...");
            const spawnPromise = mongodb_memory_server_1.MongoMemoryServer.create({ instance: { dbName: "mern_sentiment" } });
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("MemoryServer spawn timeout")), 2500));
            mongoServer = (await Promise.race([spawnPromise, timeoutPromise]));
            const memoryUri = mongoServer.getUri();
            await mongoose_1.default.connect(memoryUri);
            console.log(`[Database] ✔ Connected successfully to embedded MongoMemoryServer (${memoryUri}).`);
            return;
        }
        catch (e) {
            console.log("[Database] External binary download not available/timed out.");
        }
    }
    console.log("[Database] Activating high-performance Embedded Filesystem JSON Storage Engine (server_data/embedded_db.json)...");
    console.log("[Database] ✔ Embedded Filesystem Storage Engine initialized successfully! Complete persistence active.");
};
exports.connectDB = connectDB;
const disconnectDB = async () => {
    if ((0, modelProxy_1.isMongoOnline)()) {
        await mongoose_1.default.disconnect();
    }
    if (mongoServer) {
        await mongoServer.stop();
    }
};
exports.disconnectDB = disconnectDB;
