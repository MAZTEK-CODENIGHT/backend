import { ExplanationService } from "../services/index.js";

/**
 * ExplanationController - Fatura açıklama için özel controller
 * SOLID Principle: Single Responsibility - Sadece fatura açıklama işlemlerinden sorumlu
 */
class ExplanationController {
  /**
   * Fatura açıklaması endpoint'i
   * POST /api/explain
   * Body: { bill_id }
   * Response: { summary: {total, taxes, savings_hint}, breakdown: [{category, total, lines: [...]}] }
   */
  async explainBill(req, res, next) {
    try {
      const { bill_id } = req.body;

      // Validasyon
      if (!bill_id) {
        return res.status(400).json({
          success: false,
          error: {
            code: "MISSING_BILL_ID",
            message: "bill_id parametresi gereklidir",
          },
        });
      }

      if (typeof bill_id !== "string" || bill_id.trim() === "") {
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_BILL_ID",
            message:
              "bill_id string formatında ve boş olmayan bir değer olmalıdır",
          },
        });
      }

      // Fatura açıklama servisini çağır
      const explanation = await ExplanationService.explainBill(bill_id.trim());

      // PRD'deki response formatına göre düzenle
      const response = {
        summary: {
          total: explanation.summary.total,
          taxes: explanation.summary.taxes,
          savings_hint: explanation.summary.savings_hint,
          natural_language: explanation.summary.natural_language,
          period: explanation.summary.period,
          currency: explanation.summary.currency,
        },
        breakdown: explanation.breakdown.map((category) => ({
          category: category.category,
          category_name: category.category_name,
          total: category.total,
          percentage: category.percentage,
          lines: category.lines.map((line) => {
            if (typeof line === "string") {
              return line;
            } else if (line.enhanced_description) {
              return line.enhanced_description;
            } else {
              return line.original_description || "Açıklama bulunamadı";
            }
          }),
          item_count: category.item_count,
          impact_level: category.impact_level,
        })),
      };

      res.status(200).json(response);
    } catch (error) {
      if (error.message.includes("bulunamadı")) {
        return res.status(404).json({
          success: false,
          error: {
            code: "BILL_NOT_FOUND",
            message: error.message,
            details: { bill_id: req.body.bill_id },
          },
        });
      }

      if (error.message.includes("Geçersiz")) {
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_BILL_ID",
            message: error.message,
            details: { bill_id: req.body.bill_id },
          },
        });
      }

      // Diğer hatalar için global error handler'a yönlendir
      next(error);
    }
  }

  /**
   * Kullanım açıklama endpoint'i
   * POST /api/explain/usage/:category
   * Body: { bill_id, period?, language? }
   */
  async explainUsage(req, res, next) {
    try {
      const { category } = req.params;
      const { bill_id, period, language = "tr" } = req.body;

      // Validasyon
      if (!bill_id) {
        return res.status(400).json({
          success: false,
          error: {
            code: "MISSING_BILL_ID",
            message: "bill_id parametresi gereklidir",
          },
        });
      }

      if (!category) {
        return res.status(400).json({
          success: false,
          error: {
            code: "MISSING_CATEGORY",
            message: "category parametresi gereklidir",
          },
        });
      }

      // Kategori açıklama servisini çağır
      const usageExplanation = await ExplanationService.explainUsageCategory(
        bill_id,
        category,
        { period, language }
      );

      res.status(200).json(usageExplanation);
    } catch (error) {
      if (error.message.includes("bulunamadı")) {
        return res.status(404).json({
          success: false,
          error: {
            code: "DATA_NOT_FOUND",
            message: error.message,
            details: {
              bill_id: req.body.bill_id,
              category: req.params.category,
            },
          },
        });
      }

      next(error);
    }
  }

  /**
   * Maliyet açıklama endpoint'i
   * POST /api/explain/costs
   * Body: { bill_id, focus_area?, language? }
   */
  async explainCosts(req, res, next) {
    try {
      const { bill_id, focus_area, language = "tr" } = req.body;

      // Validasyon
      if (!bill_id) {
        return res.status(400).json({
          success: false,
          error: {
            code: "MISSING_BILL_ID",
            message: "bill_id parametresi gereklidir",
          },
        });
      }

      // Maliyet açıklama servisini çağır
      const costExplanation = await ExplanationService.explainCosts(bill_id, {
        focus_area,
        language,
      });

      res.status(200).json(costExplanation);
    } catch (error) {
      if (error.message.includes("bulunamadı")) {
        return res.status(404).json({
          success: false,
          error: {
            code: "DATA_NOT_FOUND",
            message: error.message,
            details: { bill_id: req.body.bill_id },
          },
        });
      }

      next(error);
    }
  }
}

export default new ExplanationController();
