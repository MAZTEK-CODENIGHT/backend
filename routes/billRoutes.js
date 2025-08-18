import express from "express";
import { BillController } from "../controller/index.js";

const router = express.Router();

/**
 * Bill Routes - Fatura ile ilgili tüm endpoint'ler
 * SOLID Principle: Interface Segregation - Her route kendi sorumluluğundaki işlemlerden sorumlu
 */

// Kullanıcının faturasını getir
// GET /api/bills/:userId?period=YYYY-MM&include_items=true
router.get("/:userId", BillController.getBill);

// Kullanıcının fatura geçmişini getir
// GET /api/bills/:userId/history?months=6
router.get("/:userId/history", BillController.getBillHistory);

// Bill ID ile fatura detayını getir
// GET /api/bills/details/:billId
router.get("/details/:billId", BillController.getBillDetails);

export default router;
