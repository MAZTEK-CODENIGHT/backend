import express from "express";
import { CheckoutController } from "../controller/index.js";

const router = express.Router();

/**
 * Checkout Routes - Sipariş/Checkout ile ilgili tüm endpoint'ler
 * SOLID Principle: Interface Segregation - Her route kendi sorumluluğundaki işlemlerden sorumlu
 */

// Fiyat tahmini
// POST /api/checkout/estimate
router.post("/estimate", CheckoutController.estimatePrice);

// Kullanıcının sipariş geçmişi
// GET /api/checkout/history/:userId?limit=10&status=completed
router.get("/history/:userId", CheckoutController.getOrderHistory);

// Mock checkout işlemi
// POST /api/checkout
router.post("/", CheckoutController.processCheckout);

// Sipariş durumu sorgulama
// GET /api/checkout/:orderId
router.get("/:orderId", CheckoutController.getOrderStatus);

// Sipariş iptali
// DELETE /api/checkout/:orderId
router.delete("/:orderId", CheckoutController.cancelOrder);

export default router;
