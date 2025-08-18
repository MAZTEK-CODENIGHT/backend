import express from "express";
import { UserController } from "../controller/index.js";

const router = express.Router();

/**
 * User Routes - Kullanıcı ile ilgili tüm endpoint'ler
 * SOLID Principle: Interface Segregation - Her route kendi sorumluluğundaki işlemlerden sorumlu
 */

// Tüm kullanıcıları listele
// GET /api/users?type=postpaid&limit=50
router.get("/", (req, res, next) => UserController.getAllUsers(req, res, next));

// Kullanıcı istatistikleri
// GET /api/users/stats
router.get("/stats", (req, res, next) =>
  UserController.getUserStats(req, res, next)
);

// MSISDN ile kullanıcı getir
// GET /api/users/by-msisdn/:msisdn
router.get("/by-msisdn/:msisdn", (req, res, next) =>
  UserController.getUserByMsisdn(req, res, next)
);

// User ID ile kullanıcı detaylarını getir
// GET /api/users/:userId
router.get("/:userId", (req, res, next) =>
  UserController.getUserById(req, res, next)
);

// Kullanıcı profil özeti
// GET /api/users/:userId/profile
router.get("/:userId/profile", (req, res, next) =>
  UserController.getUserProfile(req, res, next)
);

export default router;
