// Services Index - SOLID Principle: Dependency Inversion
// Tüm servisleri tek noktadan export eder

import BillService from "./BillService.js";
import AnomalyDetectionService from "./AnomalyDetectionService.js";
import ExplanationService from "./ExplanationService.js";
import WhatIfService from "./WhatIfService.js";
import CatalogService from "./CatalogService.js";

// Service Layer Export
export {
  BillService,
  AnomalyDetectionService,
  ExplanationService,
  WhatIfService,
  CatalogService,
};

// Default export for convenience
export default {
  BillService,
  AnomalyDetectionService,
  ExplanationService,
  WhatIfService,
  CatalogService,
};
