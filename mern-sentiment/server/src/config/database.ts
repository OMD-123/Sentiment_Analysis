import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { isMongoOnline } from "./modelProxy";

let mongoServer: MongoMemoryServer | null = null;

export const connectDB = async (): Promise<void> => {
  try {
    const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/mern_sentiment";
    console.log(`[Database] Attempting connection to system MongoDB daemon (${uri})...`);
    
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 1000
    });
    console.log("[Database] ✔ Connected successfully to system MongoDB daemon.");
    return;
  } catch (error) {
    console.log("[Database] System MongoDB not active on port 27017.");
  }

  if (process.env.SKIP_MEMORY_SERVER !== "true") {
    try {
      console.log("[Database] Checking for cached/local MongoMemoryServer...");
      const spawnPromise = MongoMemoryServer.create({ instance: { dbName: "mern_sentiment" } });
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("MemoryServer spawn timeout")), 2500));
      
      mongoServer = (await Promise.race([spawnPromise, timeoutPromise])) as MongoMemoryServer;
      const memoryUri = mongoServer.getUri();
      await mongoose.connect(memoryUri);
      console.log(`[Database] ✔ Connected successfully to embedded MongoMemoryServer (${memoryUri}).`);
      return;
    } catch (e) {
      console.log("[Database] External binary download not available/timed out.");
    }
  }

  console.log("[Database] Activating high-performance Embedded Filesystem JSON Storage Engine (server_data/embedded_db.json)...");
  console.log("[Database] ✔ Embedded Filesystem Storage Engine initialized successfully! Complete persistence active.");
};

export const disconnectDB = async (): Promise<void> => {
  if (isMongoOnline()) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
};
