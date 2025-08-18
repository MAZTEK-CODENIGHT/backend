import express from "express";
import { BillController } from "../controller/index.js";

const router = express.Router();

/**
 * Bill Routes - Fatura ile ilgili tüm endpoint'ler
 * SOLID Principle: Interface Segregation - Her route kendi sorumluluğundaki işlemlerden sorumlu
 */

// Kullanıcının faturasını getir
// GET /api/bills/:userId?period=YYYY-MM&include_items=true
router.get("/:userId", (req, res, next) => BillController.getBill(req, res, next));

// Kullanıcının fatura geçmişini getir
// GET /api/bills/:userId/history?months=6
router.get("/:userId/history", (req, res, next) => BillController.getBillHistory(req, res, next));

// Bill ID ile fatura detayını getir
// GET /api/bills/details/:billId
router.get("/details/:billId", (req, res, next) => BillController.getBillDetails(req, res, next));

export default router;
