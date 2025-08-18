import express from "express";
import ExplanationController from "../controller/ExplanationController.js";

const router = express.Router();

/**
 * Explanation Routes
 * API endpoint: /api/explain
 */

// Fatura açıklama endpoint'i
router.post("/", (req, res, next) => ExplanationController.explainBill(req, res, next));

// Kullanım açıklama endpoint'i
router.post("/usage/:category", (req, res, next) => ExplanationController.explainUsage(req, res, next));

// Genel maliyet açıklama endpoint'i
router.post("/costs", (req, res, next) => ExplanationController.explainCosts(req, res, next));

export default router;
