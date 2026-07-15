import { Router } from "express";
import { getSummary } from "../controllers/analyticsController";

const router = Router();

router.get("/summary", getSummary);

export default router;
