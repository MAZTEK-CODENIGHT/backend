import express from "express";
import { CheckoutController } from "../controller/index.js";

const router = express.Router();

/**
 * Checkout Routes - Sipariş/Checkout ile ilgili tüm endpoint'ler
 * SOLID Principle: Interface Segregation - Her route kendi sorumluluğundaki işlemlerden sorumlu
 */

// Fiyat tahmini
// POST /api/checkout/estimate
router.post("/estimate", (req, res, next) =>
  CheckoutController.estimatePrice(req, res, next)
);

// Kullanıcının sipariş geçmişi
// GET /api/checkout/history/:userId?limit=10&status=completed
router.get("/history/:userId", (req, res, next) =>
  CheckoutController.getOrderHistory(req, res, next)
);

// Mock checkout işlemi
// POST /api/checkout
router.post("/", (req, res, next) =>
  CheckoutController.processCheckout(req, res, next)
);

// Sipariş durumu sorgulama
// GET /api/checkout/:orderId
router.get("/:orderId", (req, res, next) =>
  CheckoutController.getOrderStatus(req, res, next)
);

// Sipariş iptali
// DELETE /api/checkout/:orderId
router.delete("/:orderId", (req, res, next) =>
  CheckoutController.cancelOrder(req, res, next)
);

export default router;
