import express from "express";
import WhatIfController from "../controller/WhatIfController.js";

const router = express.Router();

/**
 * What-If Scenario Routes
 * API endpoint: /api/whatif
 */

// Ana what-if simülasyon endpoint'i
router.post("/", (req, res, next) =>
  WhatIfController.calculateWhatIf(req, res, next)
);

// Senaryo karşılaştırması
router.post("/compare", (req, res, next) =>
  WhatIfController.compareScenarios(req, res, next)
);

export default router;
