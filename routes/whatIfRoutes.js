import express from "express";
import WhatIfController from "../controller/WhatIfController.js";

const router = express.Router();

/**
 * What-If Scenario Routes
 * API endpoint: /api/whatif
 */

// Ana what-if simülasyon endpoint'i
router.post("/", WhatIfController.calculateWhatIf);

// Senaryo karşılaştırması
router.post("/compare", WhatIfController.compareScenarios);

export default router;
