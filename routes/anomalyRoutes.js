import express from "express";
import AnomalyController from "../controller/AnomalyController.js";

const router = express.Router();

/**
 * Anomaly Detection Routes
 * API endpoint: /api/anomalies
 */

// Ana anomali tespit endpoint'i
router.post("/", AnomalyController.detectAnomalies);

// Detaylı anomali analizi
router.post("/detailed", AnomalyController.detailedAnalysis);

// Anomali geçmişi
router.get("/history/:user_id", AnomalyController.getAnomalyHistory);

export default router;
