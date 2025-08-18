import express from "express";
import { UserController } from "../controller/index.js";

const router = express.Router();

/**
 * User Routes - Kullanıcı ile ilgili tüm endpoint'ler
 * SOLID Principle: Interface Segregation - Her route kendi sorumluluğundaki işlemlerden sorumlu
 */

// Tüm kullanıcıları listele
// GET /api/users?type=postpaid&limit=50
router.get("/", UserController.getAllUsers);

// Kullanıcı istatistikleri
// GET /api/users/stats
router.get("/stats", UserController.getUserStats);

// MSISDN ile kullanıcı getir
// GET /api/users/by-msisdn/:msisdn
router.get("/by-msisdn/:msisdn", UserController.getUserByMsisdn);

// User ID ile kullanıcı detaylarını getir
// GET /api/users/:userId
router.get("/:userId", UserController.getUserById);

// Kullanıcı profil özeti
// GET /api/users/:userId/profile
router.get("/:userId/profile", UserController.getUserProfile);

export default router;
