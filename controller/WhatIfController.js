import { WhatIfService } from "../services/index.js";

/**
 * WhatIfController - What-if simülasyonları için özel controller
 * SOLID Principle: Single Responsibility - Sadece what-if simülasyon işlemlerinden sorumlu
 */
class WhatIfController {
  /**
   * What-if simülasyonu endpoint'i
   * POST /api/whatif
   * Body: { user_id, period, scenario: { plan_id?, addons?: [], disable_vas?: true, block_premium_sms?: true } }
   * Response: { new_total, saving, details }
   */
  async calculateWhatIf(req, res, next) {
    try {
      const { user_id, period, scenario } = req.body;

      // Validasyon
      if (!user_id || !period || !scenario) {
        return res.status(400).json({
          success: false,
          error: {
            code: "MISSING_PARAMETERS",
            message: "user_id, period ve scenario parametreleri gereklidir",
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

      // Senaryo validasyonu
      const scenarioValidation = this.validateScenario(scenario);
      if (!scenarioValidation.valid) {
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_SCENARIO",
            message: scenarioValidation.message,
            details: { scenario },
          },
        });
      }

      // What-if servisini çağır
      const result = await WhatIfService.calculateWhatIf(
        user_id,
        period,
        scenario
      );

      // PRD'deki response formatına göre düzenle
      const response = {
        current_total: result.current_total,
        new_total: result.new_total,
        saving: result.saving,
        saving_percent: result.saving_percent,
        details: result.details,
        scenario_summary: result.scenario_summary,
        effective_date: result.effective_date,
        recommendations: result.recommendations || [],
        breakdown: result.breakdown || {},
        risk_factors: result.risk_factors || [],
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
        error.message.includes("uyumlu")
      ) {
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_SCENARIO",
            message: error.message,
            details: {
              scenario: req.body.scenario,
            },
          },
        });
      }

      // Diğer hatalar için global error handler'a yönlendir
      next(error);
    }
  }

  /**
   * Senaryo karşılaştırması endpoint'i
   * POST /api/whatif/compare
   * Body: { user_id, period, scenarios: [scenario1, scenario2, ...] }
   */
  async compareScenarios(req, res, next) {
    try {
      const { user_id, period, scenarios } = req.body;

      // Validasyon
      if (!user_id || !period || !scenarios || !Array.isArray(scenarios)) {
        return res.status(400).json({
          success: false,
          error: {
            code: "MISSING_PARAMETERS",
            message:
              "user_id, period ve scenarios (array) parametreleri gereklidir",
          },
        });
      }

      if (scenarios.length === 0 || scenarios.length > 5) {
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_SCENARIOS_COUNT",
            message: "Senaryo sayısı 1-5 arasında olmalıdır",
          },
        });
      }

      // Her senaryoyu validate et
      for (let i = 0; i < scenarios.length; i++) {
        const validation = this.validateScenario(scenarios[i]);
        if (!validation.valid) {
          return res.status(400).json({
            success: false,
            error: {
              code: "INVALID_SCENARIO",
              message: `Senaryo ${i + 1}: ${validation.message}`,
              details: { scenario_index: i, scenario: scenarios[i] },
            },
          });
        }
      }

      // Karşılaştırma servisini çağır
      const comparison = await WhatIfService.compareScenarios(
        user_id,
        period,
        scenarios
      );

      res.status(200).json(comparison);
    } catch (error) {
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

  /**
   * Senaryo validasyonu yapar
   * @param {Object} scenario - Validasyon yapılacak senaryo
   * @returns {Object} Validasyon sonucu
   */
  validateScenario(scenario) {
    if (!scenario || typeof scenario !== "object") {
      return { valid: false, message: "Senaryo obje formatında olmalıdır" };
    }

    // En az bir parametre olmalı
    const validParams = [
      "plan_id",
      "addons",
      "disable_vas",
      "block_premium_sms",
      "enable_roaming_block",
    ];
    const hasValidParam = validParams.some((param) =>
      scenario.hasOwnProperty(param)
    );

    if (!hasValidParam) {
      return {
        valid: false,
        message: `Senaryo en az şu parametrelerden birini içermelidir: ${validParams.join(
          ", "
        )}`,
      };
    }

    // Plan ID kontrolü
    if (scenario.hasOwnProperty("plan_id")) {
      if (!Number.isInteger(scenario.plan_id) || scenario.plan_id <= 0) {
        return {
          valid: false,
          message: "plan_id pozitif bir tam sayı olmalıdır",
        };
      }
    }

    // Addons kontrolü
    if (scenario.hasOwnProperty("addons")) {
      if (!Array.isArray(scenario.addons)) {
        return { valid: false, message: "addons array formatında olmalıdır" };
      }

      if (scenario.addons.length > 5) {
        return {
          valid: false,
          message: "addons array maksimum 5 elemanlı olmalıdır",
        };
      }

      // Her addon ID'si kontrol et
      for (const addonId of scenario.addons) {
        if (!Number.isInteger(addonId) || addonId <= 0) {
          return {
            valid: false,
            message:
              "addons array'inde tüm elemanlar pozitif tam sayı olmalıdır",
          };
        }
      }
    }

    // Boolean parametreler kontrolü
    const booleanParams = [
      "disable_vas",
      "block_premium_sms",
      "enable_roaming_block",
    ];
    for (const param of booleanParams) {
      if (
        scenario.hasOwnProperty(param) &&
        typeof scenario[param] !== "boolean"
      ) {
        return { valid: false, message: `${param} boolean değer olmalıdır` };
      }
    }

    return { valid: true };
  }
}

export default new WhatIfController();
