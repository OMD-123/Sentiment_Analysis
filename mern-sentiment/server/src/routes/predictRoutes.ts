import { Router } from "express";
import {
  predictText,
  predictImage,
  predictAudio,
  predictMultimodal,
  getHistory,
  deleteHistoryItem
} from "../controllers/predictController";
import { upload } from "../middleware/upload";
import { optionalAuth, verifyToken } from "../middleware/auth";

const router = Router();

router.post("/text", optionalAuth, predictText);
router.post("/image", optionalAuth, upload.single("file"), predictImage);
router.post("/audio", optionalAuth, upload.single("file"), predictAudio);
router.post("/multimodal", optionalAuth, upload.fields([{ name: "image", maxCount: 1 }, { name: "audio", maxCount: 1 }]), predictMultimodal);

router.get("/history", optionalAuth, getHistory);
router.delete("/history/:id", verifyToken, deleteHistoryItem);

export default router;
