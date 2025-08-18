import express from "express";
import AnomalyController from "../controller/AnomalyController.js";

const router = express.Router();

/**
 * Anomaly Detection Routes
 * API endpoint: /api/anomalies
 */

// Ana anomali tespit endpoint'i
router.post("/", (req, res, next) =>
  AnomalyController.detectAnomalies(req, res, next)
);

// Detaylı anomali analizi
router.post("/detailed", (req, res, next) =>
  AnomalyController.detailedAnalysis(req, res, next)
);

// Anomali geçmişi
router.get("/history/:user_id", (req, res, next) =>
  AnomalyController.getAnomalyHistory(req, res, next)
);

export default router;
