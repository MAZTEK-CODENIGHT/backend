import express from "express";
import cors from "cors";
import {
  notFoundErr,
  globalErrHandler,
} from "../middlewares/globalErrHandler.js";
import apiRoutes from "../routes/index.js";

//app
const app = express();

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cors());

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  next();
});

// Root route
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "🚀 Turkcell Fatura Asistanı API",
    description:
      "Şeffaf Fatura Açıklayıcı, Anomali Avcısı ve What-If Simülatörü",
    version: "1.0.0",
    endpoints: {
      api_info: "/api/info",
      health_check: "/api/health",
      bills: "/api/bills",
      users: "/api/users",
      catalog: "/api/catalog",
      checkout: "/api/checkout",
    },
    documentation: "API endpoints are available under /api/ prefix",
    hackathon: "Codenight Case - 10 saatlik geliştirme süresi",
  });
});

// API Routes - SOLID Principle Implementation
app.use("/api", apiRoutes);

// Error Handler
app.use(notFoundErr);
app.use(globalErrHandler);

export default app;
