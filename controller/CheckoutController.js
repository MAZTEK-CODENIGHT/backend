/**
 * CheckoutController - Mock sipariş işlemleri için controller (Interface Segregation Principle)
 * Sadece sipariş/checkout ile ilgili API endpoint'lerden sorumludur
 */
class CheckoutController {
  /**
   * Mock checkout işlemi
   * POST /api/checkout
   */
  async processCheckout(req, res, next) {
    try {
      const { user_id, actions } = req.body;

      // Validasyon
      if (!user_id || !actions || !Array.isArray(actions)) {
        return res.status(400).json({
          success: false,
          error: {
            code: "MISSING_PARAMETERS",
            message: "user_id ve actions (array) parametreleri gereklidir",
          },
        });
      }

      if (actions.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: "EMPTY_ACTIONS",
            message: "En az bir aksiyon gereklidir",
          },
        });
      }

      // Her aksiyonu validate et
      const validationResult = this.validateActions(actions);
      if (!validationResult.valid) {
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_ACTIONS",
            message: validationResult.message,
          },
        });
      }

      // Mock sipariş ID oluştur
      const orderId = this.generateOrderId();

      // Her aksiyonu işle (mock)
      const processedActions = actions.map((action) =>
        this.processAction(action)
      );

      // Toplam tasarrufu hesapla (mock)
      const totalSaving = this.calculateMockSaving(actions);

      // Mock başarılı response
      const checkoutResult = {
        order_id: orderId,
        status: "completed",
        user_id: user_id,
        total_saving: totalSaving,
        effective_date: this.calculateEffectiveDate(),
        processing_time: new Date().toISOString(),
        actions_applied: processedActions,
        next_bill_estimate: this.estimateNextBill(actions, totalSaving),
        confirmation: {
          email_sent: true,
          sms_sent: true,
          confirmation_code: this.generateConfirmationCode(),
        },
        support_info: {
          customer_service: "*532",
          online_support: "turkcell.com.tr/destek",
          cancellation_period: "14 gün içinde iptal edebilirsiniz",
        },
      };

      res.status(201).json({
        success: true,
        data: checkoutResult,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Sipariş durumunu sorgular
   * GET /api/checkout/:orderId
   */
  async getOrderStatus(req, res, next) {
    try {
      const { orderId } = req.params;

      if (!orderId) {
        return res.status(400).json({
          success: false,
          error: {
            code: "MISSING_ORDER_ID",
            message: "Sipariş ID gereklidir",
          },
        });
      }

      // Mock sipariş durumu
      const orderStatus = this.getMockOrderStatus(orderId);

      if (!orderStatus) {
        return res.status(404).json({
          success: false,
          error: {
            code: "ORDER_NOT_FOUND",
            message: "Sipariş bulunamadı",
            details: { order_id: orderId },
          },
        });
      }

      res.status(200).json({
        success: true,
        data: orderStatus,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Sipariş iptali (mock)
   * DELETE /api/checkout/:orderId
   */
  async cancelOrder(req, res, next) {
    try {
      const { orderId } = req.params;
      const { reason } = req.body;

      if (!orderId) {
        return res.status(400).json({
          success: false,
          error: {
            code: "MISSING_ORDER_ID",
            message: "Sipariş ID gereklidir",
          },
        });
      }

      // Mock iptal işlemi
      const cancellationResult = {
        order_id: orderId,
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason || "Kullanıcı talebi",
        refund_info: {
          eligible_for_refund: true,
          refund_amount: 0, // Mock değer
          refund_method: "Hesap kredisi",
          refund_processing_time: "3-5 iş günü",
        },
        next_steps: [
          "İptal işlemi onaylandı",
          "Mevcut hizmetleriniz devam edecek",
          "Değişiklikler bir sonraki fatura döneminde geçerli olacak",
        ],
      };

      res.status(200).json({
        success: true,
        data: cancellationResult,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Kullanıcının sipariş geçmişi
   * GET /api/checkout/history/:userId
   */
  async getOrderHistory(req, res, next) {
    try {
      const { userId } = req.params;
      const { limit = 10, status } = req.query;

      if (!userId || isNaN(userId)) {
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_USER_ID",
            message: "Geçerli bir kullanıcı ID gereklidir",
          },
        });
      }

      // Mock sipariş geçmişi
      const orderHistory = this.getMockOrderHistory(
        parseInt(userId),
        parseInt(limit),
        status
      );

      res.status(200).json({
        success: true,
        data: {
          user_id: parseInt(userId),
          orders: orderHistory,
          total_orders: orderHistory.length,
          filters_applied: {
            limit: parseInt(limit),
            status: status || "all",
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Fiyat tahmini
   * POST /api/checkout/estimate
   */
  async estimatePrice(req, res, next) {
    try {
      const { user_id, actions } = req.body;

      if (!user_id || !actions || !Array.isArray(actions)) {
        return res.status(400).json({
          success: false,
          error: {
            code: "MISSING_PARAMETERS",
            message: "user_id ve actions parametreleri gereklidir",
          },
        });
      }

      // Mock fiyat tahmini
      const estimate = this.calculatePriceEstimate(user_id, actions);

      res.status(200).json({
        success: true,
        data: estimate,
      });
    } catch (error) {
      next(error);
    }
  }

  // Yardımcı metodlar

  /**
   * Aksiyonları validate eder
   */
  validateActions(actions) {
    const validActionTypes = [
      "change_plan",
      "add_addon",
      "cancel_vas",
      "block_premium_sms",
      "enable_roaming_block",
    ];

    for (const action of actions) {
      if (!action.type || !validActionTypes.includes(action.type)) {
        return {
          valid: false,
          message: `Geçersiz aksiyon tipi: ${
            action.type
          }. Geçerli tipler: ${validActionTypes.join(", ")}`,
        };
      }

      if (!action.payload || typeof action.payload !== "object") {
        return {
          valid: false,
          message: "Her aksiyon için payload objesi gereklidir",
        };
      }

      // Tip özelinde validasyon
      switch (action.type) {
        case "change_plan":
          if (
            !action.payload.plan_id ||
            typeof action.payload.plan_id !== "number"
          ) {
            return {
              valid: false,
              message: "change_plan için plan_id gereklidir",
            };
          }
          break;
        case "add_addon":
          if (
            !action.payload.addon_id ||
            typeof action.payload.addon_id !== "number"
          ) {
            return {
              valid: false,
              message: "add_addon için addon_id gereklidir",
            };
          }
          break;
        case "cancel_vas":
          if (!action.payload.vas_id) {
            return {
              valid: false,
              message: "cancel_vas için vas_id gereklidir",
            };
          }
          break;
      }
    }

    return { valid: true };
  }

  /**
   * Tek bir aksiyonu işler (mock)
   */
  processAction(action) {
    const actionMessages = {
      change_plan: `Plan değiştirildi (Plan ID: ${action.payload.plan_id})`,
      add_addon: `Ek paket eklendi (Addon ID: ${action.payload.addon_id})`,
      cancel_vas: `VAS hizmeti iptal edildi (VAS ID: ${action.payload.vas_id})`,
      block_premium_sms: "Premium SMS bloklaması aktifleştirildi",
      enable_roaming_block: "Roaming bloklaması aktifleştirildi",
    };

    return {
      type: action.type,
      status: "success",
      message: actionMessages[action.type] || "İşlem tamamlandı",
      payload: action.payload,
      processed_at: new Date().toISOString(),
    };
  }

  /**
   * Mock sipariş ID üretir
   */
  generateOrderId() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");
    return `MOCK-FT-${timestamp}-${random}`;
  }

  /**
   * Mock onay kodu üretir
   */
  generateConfirmationCode() {
    return Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, "0");
  }

  /**
   * Etkili tarihi hesaplar
   */
  calculateEffectiveDate() {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(1);
    return nextMonth.toISOString().split("T")[0];
  }

  /**
   * Mock tasarruf hesaplar
   */
  calculateMockSaving(actions) {
    let saving = 0;

    actions.forEach((action) => {
      switch (action.type) {
        case "cancel_vas":
          saving += Math.random() * 20 + 5; // 5-25 TL arası
          break;
        case "block_premium_sms":
          saving += Math.random() * 50 + 10; // 10-60 TL arası
          break;
        case "change_plan":
          saving += Math.random() * 100 - 50; // -50 ile +50 TL arası
          break;
        case "add_addon":
          saving -= Math.random() * 30 + 10; // Ek maliyet
          break;
      }
    });

    return Math.max(0, parseFloat(saving.toFixed(2)));
  }

  /**
   * Sonraki fatura tahminini hesaplar
   */
  estimateNextBill(actions, totalSaving) {
    // Mock hesaplama - gerçek uygulamada kompleks hesaplamalar olacak
    const baseBill = 150; // Mock temel fatura
    return Math.max(50, baseBill - totalSaving);
  }

  /**
   * Mock sipariş durumu getirir
   */
  getMockOrderStatus(orderId) {
    // Gerçek uygulamada veritabanından gelecek
    if (!orderId.startsWith("MOCK-FT-")) {
      return null;
    }

    return {
      order_id: orderId,
      status: "completed",
      created_at: new Date(Date.now() - Math.random() * 86400000).toISOString(), // Son 24 saat içinde
      updated_at: new Date().toISOString(),
      effective_date: this.calculateEffectiveDate(),
      steps: [
        {
          step: "Sipariş Alındı",
          completed: true,
          timestamp: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          step: "İşleme Alındı",
          completed: true,
          timestamp: new Date(Date.now() - 1800000).toISOString(),
        },
        {
          step: "Onaylandı",
          completed: true,
          timestamp: new Date(Date.now() - 900000).toISOString(),
        },
        {
          step: "Tamamlandı",
          completed: true,
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  /**
   * Mock sipariş geçmişi getirir
   */
  getMockOrderHistory(userId, limit, status) {
    const statuses = ["completed", "pending", "cancelled"];
    const orders = [];

    for (let i = 0; i < Math.min(limit, 5); i++) {
      const orderStatus =
        status || statuses[Math.floor(Math.random() * statuses.length)];

      orders.push({
        order_id: `MOCK-FT-${Date.now() - i * 86400000}-${String(i).padStart(
          3,
          "0"
        )}`,
        status: orderStatus,
        created_at: new Date(
          Date.now() - i * 86400000 - Math.random() * 86400000
        ).toISOString(),
        total_saving: Math.random() * 100,
        actions_count: Math.floor(Math.random() * 3) + 1,
        effective_date: this.calculateEffectiveDate(),
      });
    }

    return status ? orders.filter((order) => order.status === status) : orders;
  }

  /**
   * Fiyat tahmini hesaplar (mock)
   */
  calculatePriceEstimate(userId, actions) {
    const estimates = actions.map((action) => {
      let cost = 0;
      let saving = 0;
      let description = "";

      switch (action.type) {
        case "change_plan":
          cost = Math.random() * 100 + 50;
          description = "Plan değişikliği ücreti";
          break;
        case "add_addon":
          cost = Math.random() * 50 + 15;
          description = "Ek paket ücreti";
          break;
        case "cancel_vas":
          saving = Math.random() * 20 + 5;
          description = "VAS iptal tasarrufu";
          break;
        case "block_premium_sms":
          saving = Math.random() * 60 + 10;
          description = "Premium SMS bloke tasarrufu";
          break;
      }

      return {
        action_type: action.type,
        cost: parseFloat(cost.toFixed(2)),
        saving: parseFloat(saving.toFixed(2)),
        net_effect: parseFloat((saving - cost).toFixed(2)),
        description,
      };
    });

    const totalCost = estimates.reduce((sum, e) => sum + e.cost, 0);
    const totalSaving = estimates.reduce((sum, e) => sum + e.saving, 0);

    return {
      user_id: userId,
      estimates,
      summary: {
        total_cost: parseFloat(totalCost.toFixed(2)),
        total_saving: parseFloat(totalSaving.toFixed(2)),
        net_saving: parseFloat((totalSaving - totalCost).toFixed(2)),
        estimated_next_bill: Math.max(50, 150 - (totalSaving - totalCost)),
      },
      validity: {
        valid_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 saat
        terms:
          "Fiyatlar değişebilir, kesin fiyat checkout sırasında belirlenir",
      },
    };
  }
}

export default new CheckoutController();
