import { BillService } from "../services/index.js";

/**
 * BillController - Fatura işlemleri için controller (Interface Segregation Principle)
 * Sadece fatura ile ilgili API endpoint'lerden sorumludur
 */
class BillController {
  /**
   * Kullanıcının faturasını getirir
   * GET /api/bills/:userId
   */
  async getBill(req, res, next) {
    try {
      const { userId } = req.params;
      const { period, include_items = "true" } = req.query;

      // Validasyon
      if (!userId || isNaN(userId)) {
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_USER_ID",
            message: "Geçerli bir kullanıcı ID gereklidir",
          },
        });
      }

      // Period kontrolü - eğer belirtilmemişse mevcut ayı kullan
      const targetPeriod = period || this.getCurrentPeriod();

      const billData = await BillService.getBillByUserAndPeriod(
        parseInt(userId),
        targetPeriod
      );

      // Include items parametresine göre response'u ayarla
      if (include_items === "false") {
        delete billData.items;
      }

      res.status(200).json({
        success: true,
        data: billData,
      });
    } catch (error) {
      if (error.message.includes("bulunamadı")) {
        return res.status(404).json({
          success: false,
          error: {
            code: "BILL_NOT_FOUND",
            message: error.message,
            details: { user_id: req.params.userId, period: req.query.period },
          },
        });
      }

      next(error);
    }
  }

  /**
   * Kullanıcının fatura geçmişini getirir
   * GET /api/bills/:userId/history
   */
  async getBillHistory(req, res, next) {
    try {
      const { userId } = req.params;
      const { months = 6 } = req.query;

      // Validasyon
      if (!userId || isNaN(userId)) {
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_USER_ID",
            message: "Geçerli bir kullanıcı ID gereklidir",
          },
        });
      }

      const monthsNum = parseInt(months);
      if (monthsNum < 1 || monthsNum > 12) {
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_MONTHS",
            message: "Ay sayısı 1-12 arasında olmalıdır",
          },
        });
      }

      const history = await BillService.getBillHistory(
        parseInt(userId),
        monthsNum
      );

      res.status(200).json({
        success: true,
        data: history,
        metadata: {
          user_id: parseInt(userId),
          months_requested: monthsNum,
          bills_found: history.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Bill ID ile fatura getirir
   * GET /api/bills/details/:billId
   */
  async getBillDetails(req, res, next) {
    try {
      const { billId } = req.params;

      if (!billId) {
        return res.status(400).json({
          success: false,
          error: {
            code: "MISSING_BILL_ID",
            message: "Bill ID gereklidir",
          },
        });
      }

      const bill = await BillService.getBillById(billId);

      if (!bill) {
        return res.status(404).json({
          success: false,
          error: {
            code: "BILL_NOT_FOUND",
            message: "Belirtilen ID ile fatura bulunamadı",
            details: { bill_id: billId },
          },
        });
      }

      // Kategorik dağılım ekle
      const breakdown = BillService.getCategoryBreakdown(bill);
      const stats = BillService.calculateUsageStats(bill);

      res.status(200).json({
        success: true,
        data: {
          bill: {
            bill_id: bill.bill_id,
            user_id: bill.user_id,
            period_start: bill.period_start,
            period_end: bill.period_end,
            issue_date: bill.issue_date,
            total_amount: bill.total_amount,
            subtotal: bill.subtotal,
            taxes: bill.taxes,
            currency: bill.currency,
          },
          items: bill.items,
          summary: {
            subtotal: bill.subtotal,
            taxes: bill.taxes,
            total: bill.total_amount,
            item_count: bill.items.length,
          },
          breakdown,
          usage_stats: stats,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Kullanıcının mevcut dönemlerini getirir
   * GET /api/bills/:userId/available-periods
   */
  async getAvailablePeriods(req, res, next) {
    try {
      const { userId } = req.params;

      // Validasyon
      if (!userId || isNaN(userId)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_USER_ID',
            message: 'Geçerli bir kullanıcı ID gereklidir',
          },
        });
      }

      const availablePeriods = await BillService.getAvailablePeriods(
        parseInt(userId),
      );

      res.status(200).json({
        success: true,
        data: {
          user_id: parseInt(userId),
          available_periods: availablePeriods,
          total_periods: availablePeriods.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Yardımcı metodlar

  /**
   * Mevcut dönemi döndürür (YYYY-MM format)
   */
  getCurrentPeriod() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }
}

export default new BillController();
