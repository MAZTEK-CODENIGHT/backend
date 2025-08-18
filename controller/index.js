// Controllers Index - SOLID Principle: Interface Segregation
// Her controller kendi sorumluluğundaki endpoint'lerden sorumludur

import BillController from "./BillController.js";
import UserController from "./UserController.js";
import CatalogController from "./CatalogController.js";
import CheckoutController from "./CheckoutController.js";
import ExplanationController from "./ExplanationController.js";
import AnomalyController from "./AnomalyController.js";
import WhatIfController from "./WhatIfController.js";

// Controller Layer Export
export {
  BillController,
  UserController,
  CatalogController,
  CheckoutController,
  ExplanationController,
  AnomalyController,
  WhatIfController,
};

// Default export for convenience
export default {
  BillController,
  UserController,
  CatalogController,
  CheckoutController,
  ExplanationController,
  AnomalyController,
  WhatIfController,
};
