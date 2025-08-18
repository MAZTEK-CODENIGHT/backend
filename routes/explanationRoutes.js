import express from "express";
import ExplanationController from "../controller/ExplanationController.js";

const router = express.Router();

/**
 * Explanation Routes
 * API endpoint: /api/explain
 */

// Fatura açıklama endpoint'i
router.post("/", ExplanationController.explainBill);

// Kullanım açıklama endpoint'i
router.post("/usage/:category", ExplanationController.explainUsage);

// Genel maliyet açıklama endpoint'i
router.post("/costs", ExplanationController.explainCosts);

export default router;
