import express from "express";
import { CatalogController } from "../controller/index.js";

const router = express.Router();

/**
 * Catalog Routes - Katalog ile ilgili tüm endpoint'ler
 * SOLID Principle: Interface Segregation - Her route kendi sorumluluğundaki işlemlerden sorumlu
 */

// Tüm katalog verilerini getir
// GET /api/catalog?type=postpaid
router.get("/", (req, res, next) => CatalogController.getAllCatalog(req, res, next));

// Katalog istatistikleri
// GET /api/catalog/stats
router.get("/stats", (req, res, next) => CatalogController.getCatalogStats(req, res, next));

// Plan listesi
// GET /api/catalog/plans?type=postpaid&min_price=50&max_price=200&min_gb=10&sort=price_asc
router.get("/plans", (req, res, next) => CatalogController.getPlans(req, res, next));

// Belirli plan detayı
// GET /api/catalog/plans/:planId
router.get("/plans/:planId", (req, res, next) => CatalogController.getPlanDetails(req, res, next));

// Ek paket listesi
// GET /api/catalog/addons?plan_id=2&type=data&max_price=50&sort=price_asc
router.get("/addons", (req, res, next) => CatalogController.getAddons(req, res, next));

// VAS hizmetleri
// GET /api/catalog/vas?category=entertainment&max_price=20&min_rating=3
router.get("/vas", (req, res, next) => CatalogController.getVAS(req, res, next));

// Premium SMS katalog
// GET /api/catalog/premium-sms?category=game&max_price=5&risk_level=low
router.get("/premium-sms", (req, res, next) => CatalogController.getPremiumSMS(req, res, next));

// Kullanıcıya özel öneriler
// POST /api/catalog/recommendations
router.post("/recommendations", (req, res, next) => CatalogController.getRecommendations(req, res, next));

export default router;
