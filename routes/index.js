import express from "express";
import billRoutes from "./billRoutes.js";
import userRoutes from "./userRoutes.js";
import catalogRoutes from "./catalogRoutes.js";
import checkoutRoutes from "./checkoutRoutes.js";
import explanationRoutes from "./explanationRoutes.js";
import anomalyRoutes from "./anomalyRoutes.js";
import whatIfRoutes from "./whatIfRoutes.js";

const router = express.Router();

/**
 * Main API Routes - SOLID Principle: Single Responsibility & Interface Segregation
 * Her route kendi domain'i için sorumludur
 */

// API sağlık kontrolü
router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Fatura Asistanı API is running",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
  });
});

// API bilgileri
router.get("/info", (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      name: "Turkcell Fatura Asistanı API",
      version: "1.0.0",
      description:
        "Şeffaf Fatura Açıklayıcı, Anomali Avcısı ve What-If Simülatörü",
      endpoints: {
        bills: "/api/bills",
        users: "/api/users",
        catalog: "/api/catalog",
        checkout: "/api/checkout",
        explain: "/api/explain",
        anomalies: "/api/anomalies",
        whatif: "/api/whatif",
      },
      features: [
        "Fatura açıklama ve analiz",
        "Anomali tespiti",
        "What-if senaryoları",
        "Plan ve ek paket önerileri",
        "Mock checkout işlemleri",
      ],
      contact: {
        hackathon: "Codenight Case",
        duration: "10 saatlik geliştirme",
        platform: "Node.js + Express + MongoDB",
      },
    },
  });
});

// Route mounting - her domain kendi route'unda
router.use("/bills", billRoutes); // Fatura işlemleri
router.use("/users", userRoutes); // Kullanıcı işlemleri
router.use("/catalog", catalogRoutes); // Katalog işlemleri
router.use("/checkout", checkoutRoutes); // Sipariş işlemleri

// Specialized API endpoints - ayrı route'larda
router.use("/explain", explanationRoutes); // Fatura açıklama
router.use("/anomalies", anomalyRoutes); // Anomali tespiti
router.use("/whatif", whatIfRoutes); // What-if simülasyonları

export default router;
