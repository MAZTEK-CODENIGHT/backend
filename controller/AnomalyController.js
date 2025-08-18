import { AnomalyDetectionService } from "../services/index.js";

/**
 * AnomalyController - Anomali tespiti için özel controller
 * SOLID Principle: Single Responsibility - Sadece anomali tespit işlemlerinden sorumlu
 */
class AnomalyController {
  /**
   * Anomali tespiti endpoint'i
   * POST /api/anomalies
   * Body: { user_id, period, threshold? }
   * Response: { anomalies: [{category, delta, reason, suggested_action}] }
   */
  async detectAnomalies(req, res, next) {
    try {
      const { user_id, period, threshold = 0.8 } = req.body;

      // Validasyon
      if (!user_id || !period) {
        return res.status(400).json({
          success: false,
          error: {
            code: "MISSING_PARAMETERS",
            message: "user_id ve period parametreleri gereklidir",
          },
        });
      }

      // User ID validasyonu
      if (!Number.isInteger(user_id) || user_id <= 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_USER_ID",
            message: "user_id pozitif bir tam sayı olmalıdır",
          },
        });
      }

      // Period format kontrolü (YYYY-MM)
      if (!this.validatePeriodFormat(period)) {
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_PERIOD",
            message: "period formatı YYYY-MM olmalıdır (örn: 2025-07)",
          },
        });
      }

      // Threshold validasyonu
      if (typeof threshold !== "number" || threshold < 0 || threshold > 5) {
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_THRESHOLD",
            message: "threshold 0-5 arasında bir sayı olmalıdır",
          },
        });
      }

      // Anomali tespit servisini çağır
      const anomalyResult = await AnomalyDetectionService.detectAnomalies(
        user_id,
        period,
        threshold
      );

      // PRD'deki response formatına göre düzenle
      const response = {
        anomalies: anomalyResult.anomalies.map((anomaly) => ({
          category: anomaly.category,
          delta: anomaly.delta,
          reason: anomaly.reason,
          suggested_action: anomaly.suggested_action,
          current_amount: anomaly.current_amount,
          historical_average: anomaly.historical_average,
          severity: anomaly.severity,
          first_occurrence: anomaly.first_occurrence,
          type: anomaly.type,
        })),
        total_anomalies: anomalyResult.total_anomalies,
        risk_score: anomalyResult.risk_score,
        analysis_period: anomalyResult.analysis_period,
        comparison_months: anomalyResult.comparison_months,
        threshold_used: anomalyResult.threshold_used,
      };

      res.status(200).json(response);
    } catch (error) {
      if (error.message.includes("bulunamadı")) {
        return res.status(404).json({
          success: false,
          error: {
            code: "DATA_NOT_FOUND",
            message: error.message,
            details: {
              user_id: req.body.user_id,
              period: req.body.period,
            },
          },
        });
      }

      if (
        error.message.includes("Geçersiz") ||
        error.message.includes("yeterli")
      ) {
        return res.status(400).json({
          success: false,
          error: {
            code: "INSUFFICIENT_DATA",
            message: error.message,
            details: {
              user_id: req.body.user_id,
              period: req.body.period,
            },
          },
        });
      }

      // Diğer hatalar için global error handler'a yönlendir
      next(error);
    }
  }

  /**
   * Detaylı anomali analizi endpoint'i
   * POST /api/anomalies/detailed
   * Body: { user_id, period, include_explanations?, include_recommendations? }
   */
  async detailedAnalysis(req, res, next) {
    try {
      const {
        user_id,
        period,
        include_explanations = true,
        include_recommendations = true,
      } = req.body;

      // Validasyon
      if (!user_id || !period) {
        return res.status(400).json({
          success: false,
          error: {
            code: "MISSING_PARAMETERS",
            message: "user_id ve period parametreleri gereklidir",
          },
        });
      }

      // User ID validasyonu
      if (!Number.isInteger(user_id) || user_id <= 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_USER_ID",
            message: "user_id pozitif bir tam sayı olmalıdır",
          },
        });
      }

      // Period format kontrolü
      if (!this.validatePeriodFormat(period)) {
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_PERIOD",
            message: "period formatı YYYY-MM olmalıdır (örn: 2025-07)",
          },
        });
      }

      // Detaylı analiz servisini çağır
      const detailedResult = await AnomalyDetectionService.getDetailedAnalysis(
        user_id,
        period,
        { include_explanations, include_recommendations }
      );

      res.status(200).json(detailedResult);
    } catch (error) {
      if (error.message.includes("bulunamadı")) {
        return res.status(404).json({
          success: false,
          error: {
            code: "DATA_NOT_FOUND",
            message: error.message,
            details: {
              user_id: req.body.user_id,
              period: req.body.period,
            },
          },
        });
      }

      next(error);
    }
  }

  /**
   * Anomali geçmişi endpoint'i
   * GET /api/anomalies/history/:user_id?months=6
   */
  async getAnomalyHistory(req, res, next) {
    try {
      const { user_id } = req.params;
      const { months = 6 } = req.query;

      // Validasyon
      if (!user_id || isNaN(user_id)) {
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_USER_ID",
            message: "Geçerli bir kullanıcı ID gereklidir",
          },
        });
      }

      const monthsNum = parseInt(months);
      if (monthsNum < 1 || monthsNum > 24) {
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_MONTHS",
            message: "Ay sayısı 1-24 arasında olmalıdır",
          },
        });
      }

      // Anomali geçmişi servisini çağır
      const history = await AnomalyDetectionService.getAnomalyHistory(
        parseInt(user_id),
        monthsNum
      );

      res.status(200).json({
        success: true,
        data: history,
        metadata: {
          user_id: parseInt(user_id),
          months_requested: monthsNum,
          total_periods: history.length,
        },
      });
    } catch (error) {
      if (error.message.includes("bulunamadı")) {
        return res.status(404).json({
          success: false,
          error: {
            code: "USER_NOT_FOUND",
            message: error.message,
            details: { user_id: req.params.user_id },
          },
        });
      }

      next(error);
    }
  }

  /**
   * Period formatını doğrular (YYYY-MM)
   * @param {string} period - Kontrol edilecek period
   * @returns {boolean} Geçerli ise true
   */
  validatePeriodFormat(period) {
    if (typeof period !== "string") return false;

    const periodRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
    if (!periodRegex.test(period)) return false;

    // Tarih geçerliliğini kontrol et
    const [year, month] = period.split("-").map(Number);
    const date = new Date(year, month - 1, 1);

    // Gelecek tarih kontrolü
    const now = new Date();
    if (date > now) return false;

    // Çok eski tarih kontrolü (son 2 yıl)
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    if (date < twoYearsAgo) return false;

    return true;
  }
}

export default new AnomalyController();
