import express from "express";
import { CatalogController } from "../controller/index.js";

const router = express.Router();

/**
 * Catalog Routes - Katalog ile ilgili tüm endpoint'ler
 * SOLID Principle: Interface Segregation - Her route kendi sorumluluğundaki işlemlerden sorumlu
 */

// Tüm katalog verilerini getir
// GET /api/catalog?type=postpaid
router.get("/", CatalogController.getAllCatalog);

// Katalog istatistikleri
// GET /api/catalog/stats
router.get("/stats", CatalogController.getCatalogStats);

// Plan listesi
// GET /api/catalog/plans?type=postpaid&min_price=50&max_price=200&min_gb=10&sort=price_asc
router.get("/plans", CatalogController.getPlans);

// Belirli plan detayı
// GET /api/catalog/plans/:planId
router.get("/plans/:planId", CatalogController.getPlanDetails);

// Ek paket listesi
// GET /api/catalog/addons?plan_id=2&type=data&max_price=50&sort=price_asc
router.get("/addons", CatalogController.getAddons);

// VAS hizmetleri
// GET /api/catalog/vas?category=entertainment&max_price=20&min_rating=3
router.get("/vas", CatalogController.getVAS);

// Premium SMS katalog
// GET /api/catalog/premium-sms?category=game&max_price=5&risk_level=low
router.get("/premium-sms", CatalogController.getPremiumSMS);

// Kullanıcıya özel öneriler
// POST /api/catalog/recommendations
router.post("/recommendations", CatalogController.getRecommendations);

export default router;
