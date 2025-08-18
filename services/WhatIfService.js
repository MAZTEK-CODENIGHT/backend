import {
  Bill,
  User,
  Plan,
  AddOnPack,
  VASCatalog,
  PremiumSMSCatalog,
} from "../model/index.js";
import BillService from "./BillService.js";

/**
 * WhatIfService - What-if senaryoları için sorumlu servis (Single Responsibility Principle)
 * Sadece senaryo simülasyonu ve maliyet hesaplamalarından sorumludur
 */
class WhatIfService {
  constructor() {
    this.taxRate = 0.2; // %20 KDV
  }

  /**
   * What-if senaryosu simülasyonu yapar
   * @param {number} userId - Kullanıcı ID
   * @param {string} period - Dönem (YYYY-MM)
   * @param {Object} scenario - Senaryo parametreleri
   * @returns {Promise<Object>} Senaryo simülasyon sonuçları
   */
  async calculateWhatIf(userId, period, scenario) {
    try {
      // Mevcut faturayı ve kullanıcı bilgilerini al
      const currentBill = await Bill.findByUserAndPeriod(userId, period);
      if (!currentBill) {
        throw new Error("Mevcut dönem faturası bulunamadı");
      }

      const user = await User.findByUserId(userId);
      if (!user) {
        throw new Error("Kullanıcı bulunamadı");
      }

      const currentPlan = await Plan.findByPlanId(user.current_plan_id);
      if (!currentPlan) {
        throw new Error("Mevcut plan bulunamadı");
      }

      // Mevcut fatura analizi
      const currentAnalysis = this.analyzeBill(currentBill);

      // Senaryo hesaplaması
      const scenarioResult = await this.calculateScenario(
        currentBill,
        currentPlan,
        user,
        scenario,
        currentAnalysis
      );

      // Tasarruf hesaplama
      const saving = currentBill.total_amount - scenarioResult.new_total;
      const savingPercent = (saving / currentBill.total_amount) * 100;

      return {
        current_total: currentBill.total_amount,
        new_total: scenarioResult.new_total,
        saving: parseFloat(saving.toFixed(2)),
        saving_percent: parseFloat(savingPercent.toFixed(1)),
        details: scenarioResult.details,
        breakdown: scenarioResult.breakdown,
        recommendations: scenarioResult.recommendations,
        scenario_summary: this.generateScenarioSummary(scenario),
        effective_date: this.calculateEffectiveDate(),
        risk_factors: scenarioResult.risk_factors,
      };
    } catch (error) {
      throw new Error(`What-if hesaplama hatası: ${error.message}`);
    }
  }

  /**
   * Birden fazla senaryoyu karşılaştırır
   * @param {number} userId - Kullanıcı ID
   * @param {string} period - Dönem
   * @param {Array} scenarios - Senaryo listesi
   * @returns {Promise<Object>} Karşılaştırma sonuçları
   */
  async compareScenarios(userId, period, scenarios) {
    try {
      const currentBill = await Bill.findByUserAndPeriod(userId, period);
      if (!currentBill) {
        throw new Error("Mevcut dönem faturası bulunamadı");
      }

      const results = await Promise.all(
        scenarios.map(async (scenario, index) => {
          try {
            const result = await this.calculateWhatIf(userId, period, scenario);
            return {
              id: index + 1,
              name: this.generateScenarioName(scenario),
              total: result.new_total,
              saving: result.saving,
              saving_percent: result.saving_percent,
              details: result.details.slice(0, 3), // İlk 3 detay
              rank: 0, // Sonra sıralanacak
              scenario_type: this.getScenarioType(scenario),
              feasibility: this.assessFeasibility(scenario),
              risk_level: this.assessRiskLevel(scenario),
            };
          } catch (error) {
            return {
              id: index + 1,
              name: `Senaryo ${index + 1}`,
              error: error.message,
              total: currentBill.total_amount,
              saving: 0,
              rank: 999,
            };
          }
        })
      );

      // Tasarrufa göre sırala
      const validResults = results.filter((r) => !r.error);
      validResults.sort((a, b) => b.saving - a.saving);
      validResults.forEach((result, index) => {
        result.rank = index + 1;
      });

      return {
        current_total: currentBill.total_amount,
        scenarios: results,
        best_scenario: validResults.length > 0 ? validResults[0] : null,
        comparison_summary: this.generateComparisonSummary(validResults),
        analysis_date: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(`Senaryo karşılaştırma hatası: ${error.message}`);
    }
  }

  /**
   * Tek bir senaryoyu hesaplar
   * @param {Object} currentBill - Mevcut fatura
   * @param {Object} currentPlan - Mevcut plan
   * @param {Object} user - Kullanıcı bilgileri
   * @param {Object} scenario - Senaryo parametreleri
   * @param {Object} currentAnalysis - Mevcut fatura analizi
   * @returns {Promise<Object>} Senaryo hesaplama sonucu
   */
  async calculateScenario(
    currentBill,
    currentPlan,
    user,
    scenario,
    currentAnalysis
  ) {
    let newTotal = 0;
    const details = [];
    const breakdown = {};
    const recommendations = [];
    const riskFactors = [];

    // 1. Plan değişikliği
    let effectivePlan = currentPlan;
    if (scenario.plan_id && scenario.plan_id !== currentPlan.plan_id) {
      const newPlan = await Plan.findByPlanId(scenario.plan_id);
      if (!newPlan) {
        throw new Error("Yeni plan bulunamadı");
      }
      effectivePlan = newPlan;
      newTotal += newPlan.monthly_price;
      details.push(
        `Plan değişikliği: ${newPlan.plan_name} → ${newPlan.monthly_price} TL`
      );
      breakdown.plan = newPlan.monthly_price;
    } else {
      newTotal += currentPlan.monthly_price;
      breakdown.plan = currentPlan.monthly_price;
    }

    // 2. Ek paketler
    let totalAddonGB = 0;
    let totalAddonMin = 0;
    let totalAddonSMS = 0;
    let addonCost = 0;

    if (scenario.addons && scenario.addons.length > 0) {
      for (const addonId of scenario.addons) {
        const addon = await AddOnPack.findOne({
          addon_id: addonId,
          is_active: true,
        });
        if (addon) {
          // Plan uyumluluğunu kontrol et
          if (!addon.compatible_plans.includes(effectivePlan.plan_id)) {
            riskFactors.push(`${addon.name} bu planla uyumlu olmayabilir`);
          }

          totalAddonGB += addon.extra_gb;
          totalAddonMin += addon.extra_min;
          totalAddonSMS += addon.extra_sms;
          addonCost += addon.price;
          details.push(`Ek paket: ${addon.name} → +${addon.price} TL`);
        }
      }
      newTotal += addonCost;
      breakdown.addons = addonCost;
    }

    // 3. Etkili kotaları hesapla
    const effectiveQuotaGB = effectivePlan.quota_gb + totalAddonGB;
    const effectiveQuotaMin = effectivePlan.quota_min + totalAddonMin;
    const effectiveQuotaSMS = effectivePlan.quota_sms + totalAddonSMS;

    // 4. Aşım ücretlerini hesapla
    const usageCalculation = this.calculateUsageCharges(
      currentAnalysis.usage,
      effectivePlan,
      effectiveQuotaGB,
      effectiveQuotaMin,
      effectiveQuotaSMS
    );

    newTotal += usageCalculation.total;
    if (usageCalculation.data_overage > 0) {
      details.push(
        `Veri aşımı: ${usageCalculation.data_overage_gb}GB × ${effectivePlan.overage_gb} TL = ${usageCalculation.data_overage} TL`
      );
      breakdown.data_overage = usageCalculation.data_overage;
    }
    if (usageCalculation.voice_overage > 0) {
      details.push(
        `Dakika aşımı: ${usageCalculation.voice_overage_min}dk × ${effectivePlan.overage_min} TL = ${usageCalculation.voice_overage} TL`
      );
      breakdown.voice_overage = usageCalculation.voice_overage;
    }

    // 5. VAS işlemleri
    let vasCost = 0;
    if (scenario.disable_vas) {
      const currentVASCost = this.calculateCategoryTotal(currentBill, "vas");
      details.push(`VAS iptali → -${currentVASCost.toFixed(2)} TL tasarruf`);
      recommendations.push(
        "VAS iptal işlemi müşteri hizmetlerinden yapılmalıdır"
      );
    } else {
      vasCost = this.calculateCategoryTotal(currentBill, "vas");
      newTotal += vasCost;
      breakdown.vas = vasCost;
    }

    // 6. Premium SMS bloklaması
    let premiumSMSCost = 0;
    if (scenario.block_premium_sms) {
      const currentPremiumSMSCost = this.calculateCategoryTotal(
        currentBill,
        "premium_sms"
      );
      details.push(
        `Premium SMS bloke → -${currentPremiumSMSCost.toFixed(2)} TL tasarruf`
      );
      recommendations.push(
        "Premium SMS bloklaması ücretsiz olarak aktifleştirilebilir"
      );
    } else {
      premiumSMSCost = this.calculateCategoryTotal(currentBill, "premium_sms");
      newTotal += premiumSMSCost;
      breakdown.premium_sms = premiumSMSCost;
    }

    // 7. Roaming bloklaması
    if (scenario.enable_roaming_block) {
      const currentRoamingCost = this.calculateCategoryTotal(
        currentBill,
        "roaming"
      );
      if (currentRoamingCost > 0) {
        details.push(
          `Roaming bloke → -${currentRoamingCost.toFixed(2)} TL tasarruf`
        );
        recommendations.push(
          "Roaming bloklaması seyahat öncesi kaldırılabilir"
        );
      }
    } else {
      const roamingCost = this.calculateCategoryTotal(currentBill, "roaming");
      newTotal += roamingCost;
      breakdown.roaming = roamingCost;
    }

    // 8. Tek seferlik ücretler ve indirimler
    const oneOffCost = this.calculateCategoryTotal(currentBill, "one_off");
    const discountAmount = this.calculateCategoryTotal(currentBill, "discount");
    newTotal += oneOffCost - discountAmount;
    if (oneOffCost > 0) breakdown.one_off = oneOffCost;
    if (discountAmount > 0) breakdown.discount = -discountAmount;

    // 9. Vergiler
    const taxes = newTotal * this.taxRate;
    newTotal += taxes;
    details.push(
      `Vergiler (%${this.taxRate * 100} KDV) → +${taxes.toFixed(2)} TL`
    );
    breakdown.taxes = taxes;

    // 10. Öneriler oluştur
    this.generateRecommendations(scenario, usageCalculation, recommendations);

    return {
      new_total: parseFloat(newTotal.toFixed(2)),
      details,
      breakdown,
      recommendations,
      risk_factors: riskFactors,
      usage_analysis: usageCalculation,
    };
  }

  /**
   * Mevcut faturayı analiz eder
   * @param {Object} bill - Fatura objesi
   * @returns {Object} Fatura analizi
   */
  analyzeBill(bill) {
    const analysis = {
      usage: {
        total_gb: 0,
        total_minutes: 0,
        total_sms: 0,
      },
      categories: {},
    };

    // Kullanım verilerini çıkar
    bill.items.forEach((item) => {
      switch (item.category) {
        case "data":
          if (item.subtype === "data_overage") {
            analysis.usage.total_gb += item.quantity;
          }
          break;
        case "voice":
          if (item.subtype === "voice_overage") {
            analysis.usage.total_minutes += item.quantity;
          }
          break;
        case "sms":
          if (item.subtype === "sms_overage") {
            analysis.usage.total_sms += item.quantity;
          }
          break;
      }

      // Kategori toplamları
      if (!analysis.categories[item.category]) {
        analysis.categories[item.category] = 0;
      }
      analysis.categories[item.category] += item.amount;
    });

    return analysis;
  }

  /**
   * Kullanım ücretlerini hesaplar
   * @param {Object} usage - Kullanım bilgileri
   * @param {Object} plan - Plan bilgileri
   * @param {number} effectiveGB - Etkili GB kotası
   * @param {number} effectiveMin - Etkili dakika kotası
   * @param {number} effectiveSMS - Etkili SMS kotası
   * @returns {Object} Kullanım ücret hesaplaması
   */
  calculateUsageCharges(usage, plan, effectiveGB, effectiveMin, effectiveSMS) {
    // Not: Gerçek kullanım + mevcut aşım = toplam kullanım varsayımı
    const totalGB = effectiveGB + usage.total_gb; // Plan kotası + aşım = toplam kullanım
    const totalMinutes = effectiveMin + usage.total_minutes;
    const totalSMS = effectiveSMS + usage.total_sms;

    const dataOverageGB = Math.max(0, totalGB - effectiveGB);
    const voiceOverageMin = Math.max(0, totalMinutes - effectiveMin);
    const smsOverageSMS = Math.max(0, totalSMS - effectiveSMS);

    const dataOverageCost = dataOverageGB * plan.overage_gb;
    const voiceOverageCost = voiceOverageMin * plan.overage_min;
    const smsOverageCost = smsOverageSMS * plan.overage_sms;

    return {
      data_overage: dataOverageCost,
      voice_overage: voiceOverageCost,
      sms_overage: smsOverageCost,
      total: dataOverageCost + voiceOverageCost + smsOverageCost,
      data_overage_gb: dataOverageGB,
      voice_overage_min: voiceOverageMin,
      sms_overage_sms: smsOverageSMS,
      effective_quotas: {
        gb: effectiveGB,
        minutes: effectiveMin,
        sms: effectiveSMS,
      },
    };
  }

  /**
   * Kategori toplamını hesaplar
   * @param {Object} bill - Fatura objesi
   * @param {string} category - Kategori adı
   * @returns {number} Kategori toplamı
   */
  calculateCategoryTotal(bill, category) {
    return bill.items
      .filter((item) => item.category === category)
      .reduce((sum, item) => sum + item.amount, 0);
  }

  /**
   * Senaryo önerileri oluşturur
   * @param {Object} scenario - Senaryo parametreleri
   * @param {Object} usageCalculation - Kullanım hesaplaması
   * @param {Array} recommendations - Mevcut öneriler
   */
  generateRecommendations(scenario, usageCalculation, recommendations) {
    // Aşım elimine edildi mi?
    if (
      usageCalculation.data_overage === 0 &&
      usageCalculation.voice_overage === 0
    ) {
      recommendations.push("✓ Tüm aşım ücretleri elimine edildi");
    }

    // Plan değişikliği önerisi
    if (scenario.plan_id) {
      recommendations.push(
        "Plan değişikliği bir sonraki fatura döneminde geçerli olur"
      );
    }

    // Ek paket önerisi
    if (scenario.addons && scenario.addons.length > 0) {
      recommendations.push("Ek paketler anında aktifleştirilebilir");
    }

    // Risk faktörleri
    if (usageCalculation.data_overage > 0) {
      recommendations.push(
        "⚠️ Hala veri aşımı mevcut - daha yüksek kotası olan plan düşünün"
      );
    }
  }

  /**
   * Senaryo adı oluşturur
   * @param {Object} scenario - Senaryo parametreleri
   * @returns {string} Senaryo adı
   */
  generateScenarioName(scenario) {
    const parts = [];

    if (scenario.plan_id) {
      parts.push("Plan Değişikliği");
    }

    if (scenario.addons && scenario.addons.length > 0) {
      parts.push(`${scenario.addons.length} Ek Paket`);
    }

    if (scenario.disable_vas) {
      parts.push("VAS İptal");
    }

    if (scenario.block_premium_sms) {
      parts.push("Premium SMS Bloke");
    }

    if (scenario.enable_roaming_block) {
      parts.push("Roaming Bloke");
    }

    return parts.length > 0 ? parts.join(" + ") : "Özel Senaryo";
  }

  /**
   * Senaryo özeti oluşturur
   * @param {Object} scenario - Senaryo parametreleri
   * @returns {string} Senaryo özeti
   */
  generateScenarioSummary(scenario) {
    const actions = [];

    if (scenario.plan_id) {
      actions.push("plan değişikliği");
    }

    if (scenario.addons) {
      actions.push(`${scenario.addons.length} ek paket ekleme`);
    }

    if (scenario.disable_vas) {
      actions.push("VAS hizmetleri iptali");
    }

    if (scenario.block_premium_sms) {
      actions.push("Premium SMS bloklaması");
    }

    return `Bu senaryo ${actions.join(", ")} içeriyor.`;
  }

  /**
   * Karşılaştırma özeti oluşturur
   * @param {Array} results - Senaryo sonuçları
   * @returns {string} Karşılaştırma özeti
   */
  generateComparisonSummary(results) {
    if (results.length === 0) {
      return "Hiçbir senaryo başarıyla hesaplanamadı";
    }

    const bestSaving = results[0].saving;
    const worstSaving = results[results.length - 1].saving;

    return (
      `En iyi senaryo ${bestSaving.toFixed(2)} TL tasarruf sağlıyor. ` +
      `Senaryolar arasında ${(bestSaving - worstSaving).toFixed(
        2
      )} TL fark var.`
    );
  }

  /**
   * Senaryo tipini belirler
   * @param {Object} scenario - Senaryo parametreleri
   * @returns {string} Senaryo tipi
   */
  getScenarioType(scenario) {
    if (scenario.plan_id && scenario.addons) return "comprehensive";
    if (scenario.plan_id) return "plan_change";
    if (scenario.addons) return "addon_only";
    if (scenario.disable_vas || scenario.block_premium_sms)
      return "cost_reduction";
    return "optimization";
  }

  /**
   * Senaryo uygulanabilirliğini değerlendirir
   * @param {Object} scenario - Senaryo parametreleri
   * @returns {string} Uygulanabilirlik durumu
   */
  assessFeasibility(scenario) {
    const issues = [];

    if (scenario.plan_id) {
      issues.push("Plan değişikliği için 1 ay bekleme süresi olabilir");
    }

    if (scenario.addons && scenario.addons.length > 3) {
      issues.push("Çok fazla ek paket performans sorunlarına neden olabilir");
    }

    return issues.length > 0 ? "conditional" : "high";
  }

  /**
   * Risk seviyesini değerlendirir
   * @param {Object} scenario - Senaryo parametreleri
   * @returns {string} Risk seviyesi
   */
  assessRiskLevel(scenario) {
    let riskScore = 0;

    if (scenario.plan_id) riskScore += 1; // Plan değişikliği riski
    if (scenario.disable_vas) riskScore += 0.5; // VAS iptal riski
    if (scenario.enable_roaming_block) riskScore += 2; // Roaming bloke riski

    if (riskScore >= 2.5) return "high";
    if (riskScore >= 1.5) return "medium";
    return "low";
  }

  /**
   * Etkili tarihi hesaplar
   * @returns {string} Etkili tarih
   */
  calculateEffectiveDate() {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(1);
    return nextMonth.toISOString().split("T")[0];
  }
}

export default new WhatIfService();
