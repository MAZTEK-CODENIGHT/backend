import {
  Plan,
  AddOnPack,
  VASCatalog,
  PremiumSMSCatalog,
  User,
} from "../model/index.js";

/**
 * CatalogService - Katalog işlemleri için sorumlu servis (Single Responsibility Principle)
 * Sadece plan, ek paket ve katalog verilerinden sorumludur
 */
class CatalogService {
  /**
   * Tüm katalog verilerini getirir
   * @returns {Promise<Object>} Katalog verileri
   */
  async getAllCatalogData() {
    try {
      const [plans, addons, vas, premiumSMS] = await Promise.all([
        this.getActivePlans(),
        this.getActiveAddons(),
        this.getActiveVAS(),
        this.getActivePremiumSMS(),
      ]);

      return {
        plans,
        addons,
        vas,
        premium_sms: premiumSMS,
        metadata: {
          total_plans: plans.length,
          total_addons: addons.length,
          total_vas: vas.length,
          total_premium_sms: premiumSMS.length,
          last_updated: new Date().toISOString(),
        },
      };
    } catch (error) {
      throw new Error(`Katalog verisi getirme hatası: ${error.message}`);
    }
  }

  /**
   * Aktif planları getirir
   * @param {string} type - Plan tipi (postpaid/prepaid)
   * @returns {Promise<Array>} Plan listesi
   */
  async getActivePlans(type = null) {
    try {
      const query = { is_active: true };
      if (type) {
        query.type = type;
      }

      const plans = await Plan.find(query).sort({ monthly_price: 1 });

      return plans.map((plan) => ({
        plan_id: plan.plan_id,
        plan_name: plan.plan_name,
        type: plan.type,
        quota_gb: plan.quota_gb,
        quota_min: plan.quota_min,
        quota_sms: plan.quota_sms,
        monthly_price: plan.monthly_price,
        overage_gb: plan.overage_gb,
        overage_min: plan.overage_min,
        overage_sms: plan.overage_sms,
        popular: this.isPlanPopular(plan),
        value_score: this.calculatePlanValue(plan),
        best_for: this.getPlanRecommendation(plan),
      }));
    } catch (error) {
      throw new Error(`Plan listesi getirme hatası: ${error.message}`);
    }
  }

  /**
   * Belirli bir planı getirir
   * @param {number} planId - Plan ID
   * @returns {Promise<Object|null>} Plan bilgileri
   */
  async getPlanById(planId) {
    try {
      const plan = await Plan.findByPlanId(planId);
      if (!plan) {
        return null;
      }

      // Plan detaylarını zenginleştir
      const compatibleAddons = await this.getCompatibleAddons(planId);
      const planAnalysis = this.analyzePlan(plan);

      return {
        ...plan.toObject(),
        compatible_addons: compatibleAddons,
        analysis: planAnalysis,
        value_score: this.calculatePlanValue(plan),
        user_count: await this.getPlanUserCount(planId),
      };
    } catch (error) {
      throw new Error(`Plan detayı getirme hatası: ${error.message}`);
    }
  }

  /**
   * Aktif ek paketleri getirir
   * @param {number} planId - Plan ID (uyumluluk kontrolü için)
   * @returns {Promise<Array>} Ek paket listesi
   */
  async getActiveAddons(planId = null) {
    try {
      const query = { is_active: true };
      const addons = await AddOnPack.find(query).sort({ price: 1 });

      return addons
        .filter((addon) => {
          // Eğer planId belirtilmişse uyumluluk kontrolü yap
          if (planId) {
            return addon.compatible_plans.includes(planId);
          }
          return true;
        })
        .map((addon) => ({
          addon_id: addon.addon_id,
          name: addon.name,
          type: addon.type,
          extra_gb: addon.extra_gb,
          extra_min: addon.extra_min,
          extra_sms: addon.extra_sms,
          price: addon.price,
          compatible_plans: addon.compatible_plans,
          value_per_gb: this.calculateAddonValue(addon),
          best_for: this.getAddonRecommendation(addon),
          popularity: this.calculateAddonPopularity(addon),
        }));
    } catch (error) {
      throw new Error(`Ek paket listesi getirme hatası: ${error.message}`);
    }
  }

  /**
   * Belirli plan ile uyumlu ek paketleri getirir
   * @param {number} planId - Plan ID
   * @returns {Promise<Array>} Uyumlu ek paketler
   */
  async getCompatibleAddons(planId) {
    try {
      const addons = await AddOnPack.find({
        is_active: true,
        compatible_plans: planId,
      }).sort({ price: 1 });

      return addons.map((addon) => ({
        addon_id: addon.addon_id,
        name: addon.name,
        type: addon.type,
        extra_gb: addon.extra_gb,
        extra_min: addon.extra_min,
        extra_sms: addon.extra_sms,
        price: addon.price,
        recommendation_score: this.calculateAddonRecommendationScore(
          addon,
          planId
        ),
      }));
    } catch (error) {
      throw new Error(`Uyumlu ek paket getirme hatası: ${error.message}`);
    }
  }

  /**
   * Aktif VAS hizmetlerini getirir
   * @param {string} category - VAS kategorisi
   * @returns {Promise<Array>} VAS listesi
   */
  async getActiveVAS(category = null) {
    try {
      const query = { is_active: true };
      if (category) {
        query.category = category;
      }

      const vasServices = await VASCatalog.find(query).sort({ monthly_fee: 1 });

      return vasServices.map((vas) => ({
        vas_id: vas.vas_id,
        name: vas.name,
        monthly_fee: vas.monthly_fee,
        provider: vas.provider,
        category: vas.category,
        popularity: this.calculateVASPopularity(vas),
        user_rating: this.getVASRating(vas),
        cancellation_rate: this.getVASCancellationRate(vas),
      }));
    } catch (error) {
      throw new Error(`VAS listesi getirme hatası: ${error.message}`);
    }
  }

  /**
   * Premium SMS katalogunu getirir
   * @returns {Promise<Array>} Premium SMS listesi
   */
  async getActivePremiumSMS() {
    try {
      const premiumSMS = await PremiumSMSCatalog.find({ is_active: true }).sort(
        { unit_price: 1 }
      );

      return premiumSMS.map((sms) => ({
        shortcode: sms.shortcode,
        provider: sms.provider,
        unit_price: sms.unit_price,
        service_name: sms.service_name,
        category: sms.category,
        risk_level: this.assessPremiumSMSRisk(sms),
        complaint_rate: this.getPremiumSMSComplaintRate(sms),
      }));
    } catch (error) {
      throw new Error(`Premium SMS listesi getirme hatası: ${error.message}`);
    }
  }

  /**
   * Kullanıcıya özel plan önerileri getirir
   * @param {number} userId - Kullanıcı ID
   * @param {Object} usagePattern - Kullanım deseni
   * @returns {Promise<Array>} Plan önerileri
   */
  async getPlanRecommendations(userId, usagePattern) {
    try {
      const user = await User.findByUserId(userId);
      if (!user) {
        throw new Error("Kullanıcı bulunamadı");
      }

      const currentPlan = await Plan.findByPlanId(user.current_plan_id);
      const allPlans = await this.getActivePlans(user.type);

      // Her plan için skor hesapla
      const scoredPlans = allPlans.map((plan) => {
        const score = this.calculatePlanRecommendationScore(
          plan,
          usagePattern,
          currentPlan
        );
        return {
          ...plan,
          recommendation_score: score.total,
          score_breakdown: score.breakdown,
          estimated_saving: this.estimatePlanSaving(
            plan,
            currentPlan,
            usagePattern
          ),
          switch_reason: this.getPlanSwitchReason(
            plan,
            currentPlan,
            usagePattern
          ),
        };
      });

      // Skora göre sırala ve en iyi 5'ini döndür
      return scoredPlans
        .sort((a, b) => b.recommendation_score - a.recommendation_score)
        .slice(0, 5);
    } catch (error) {
      throw new Error(`Plan önerisi getirme hatası: ${error.message}`);
    }
  }

  /**
   * Kullanıcıya özel ek paket önerileri getirir
   * @param {number} userId - Kullanıcı ID
   * @param {Object} usagePattern - Kullanım deseni
   * @returns {Promise<Array>} Ek paket önerileri
   */
  async getAddonRecommendations(userId, usagePattern) {
    try {
      const user = await User.findByUserId(userId);
      if (!user) {
        throw new Error("Kullanıcı bulunamadı");
      }

      const compatibleAddons = await this.getCompatibleAddons(
        user.current_plan_id
      );

      // Kullanım desenine göre ek paketleri skorla
      const scoredAddons = compatibleAddons.map((addon) => {
        const score = this.calculateAddonRecommendationScore(
          addon,
          user.current_plan_id,
          usagePattern
        );
        return {
          ...addon,
          recommendation_score: score,
          potential_saving: this.estimateAddonSaving(addon, usagePattern),
          usage_fit: this.calculateAddonUsageFit(addon, usagePattern),
        };
      });

      return scoredAddons
        .filter((addon) => addon.recommendation_score > 0.3) // Minimum skor eşiği
        .sort((a, b) => b.recommendation_score - a.recommendation_score)
        .slice(0, 3);
    } catch (error) {
      throw new Error(`Ek paket önerisi getirme hatası: ${error.message}`);
    }
  }

  // Yardımcı metodlar

  /**
   * Planın popüler olup olmadığını kontrol eder
   * @param {Object} plan - Plan objesi
   * @returns {boolean} Popüler ise true
   */
  isPlanPopular(plan) {
    // Basit popülerlik hesaplaması - gerçek uygulamada kullanıcı sayısına bakılabilir
    return plan.quota_gb >= 20 && plan.monthly_price <= 150;
  }

  /**
   * Plan değer skorunu hesaplar
   * @param {Object} plan - Plan objesi
   * @returns {number} Değer skoru (0-100)
   */
  calculatePlanValue(plan) {
    // GB başına maliyet
    const gbCost = plan.monthly_price / plan.quota_gb;
    const minCost = plan.monthly_price / plan.quota_min;

    // Değer skoru (düşük maliyet = yüksek değer)
    const valueScore = Math.max(0, 100 - gbCost * 5 - minCost * 0.1);
    return Math.round(valueScore);
  }

  /**
   * Plan önerisini belirler
   * @param {Object} plan - Plan objesi
   * @returns {string} Plan önerisi
   */
  getPlanRecommendation(plan) {
    if (plan.quota_gb >= 50) return "Yoğun internet kullanıcıları için";
    if (plan.quota_gb >= 20) return "Orta seviye kullanıcılar için";
    if (plan.quota_gb >= 10) return "Hafif kullanıcılar için";
    return "Temel ihtiyaçlar için";
  }

  /**
   * Planı analiz eder
   * @param {Object} plan - Plan objesi
   * @returns {Object} Plan analizi
   */
  analyzePlan(plan) {
    return {
      gb_per_tl: (plan.quota_gb / plan.monthly_price).toFixed(2),
      min_per_tl: (plan.quota_min / plan.monthly_price).toFixed(1),
      overage_risk: plan.overage_gb > 10 ? "high" : "low",
      cost_effectiveness:
        this.calculatePlanValue(plan) > 70 ? "high" : "medium",
    };
  }

  /**
   * Plan kullanıcı sayısını getirir (simülasyon)
   * @param {number} planId - Plan ID
   * @returns {Promise<number>} Kullanıcı sayısı
   */
  async getPlanUserCount(planId) {
    try {
      const count = await User.countDocuments({ current_plan_id: planId });
      return count;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Ek paket değerini hesaplar
   * @param {Object} addon - Ek paket objesi
   * @returns {number} GB başına değer
   */
  calculateAddonValue(addon) {
    if (addon.extra_gb > 0) {
      return (addon.price / addon.extra_gb).toFixed(2);
    }
    return 0;
  }

  /**
   * Ek paket önerisini belirler
   * @param {Object} addon - Ek paket objesi
   * @returns {string} Ek paket önerisi
   */
  getAddonRecommendation(addon) {
    if (addon.type === "data") return "Veri aşımını önlemek için";
    if (addon.type === "voice") return "Ekstra konuşma ihtiyacı için";
    if (addon.type === "sms") return "SMS kullanımı için";
    if (addon.type === "combo") return "Karma kullanım için ideal";
    return "Genel kullanım için";
  }

  /**
   * Ek paket popülerliğini hesaplar (simülasyon)
   * @param {Object} addon - Ek paket objesi
   * @returns {string} Popülerlik seviyesi
   */
  calculateAddonPopularity(addon) {
    // Basit popülerlik hesaplaması
    if (addon.price < 30 && addon.extra_gb > 0) return "high";
    if (addon.type === "combo") return "medium";
    return "low";
  }

  /**
   * VAS popülerliğini hesaplar (simülasyon)
   * @param {Object} vas - VAS objesi
   * @returns {string} Popülerlik seviyesi
   */
  calculateVASPopularity(vas) {
    if (vas.monthly_fee < 15) return "high";
    if (vas.monthly_fee < 25) return "medium";
    return "low";
  }

  /**
   * VAS değerlendirmesini getirir (simülasyon)
   * @param {Object} vas - VAS objesi
   * @returns {number} Değerlendirme (1-5)
   */
  getVASRating(vas) {
    // Simülasyon - gerçek uygulamada kullanıcı değerlendirmelerinden gelir
    if (vas.category === "entertainment") return 4.2;
    if (vas.category === "communication") return 3.8;
    return 3.5;
  }

  /**
   * VAS iptal oranını getirir (simülasyon)
   * @param {Object} vas - VAS objesi
   * @returns {string} İptal oranı
   */
  getVASCancellationRate(vas) {
    if (vas.monthly_fee > 20) return "high";
    if (vas.monthly_fee > 10) return "medium";
    return "low";
  }

  /**
   * Premium SMS risk seviyesini değerlendirir
   * @param {Object} sms - Premium SMS objesi
   * @returns {string} Risk seviyesi
   */
  assessPremiumSMSRisk(sms) {
    if (sms.unit_price > 5) return "high";
    if (sms.unit_price > 2) return "medium";
    return "low";
  }

  /**
   * Premium SMS şikayet oranını getirir (simülasyon)
   * @param {Object} sms - Premium SMS objesi
   * @returns {string} Şikayet oranı
   */
  getPremiumSMSComplaintRate(sms) {
    if (sms.category === "game") return "high";
    if (sms.category === "lifestyle") return "medium";
    return "low";
  }

  // Plan ve ek paket öneri hesaplama metodları

  /**
   * Plan öneri skorunu hesaplar
   * @param {Object} plan - Plan objesi
   * @param {Object} usagePattern - Kullanım deseni
   * @param {Object} currentPlan - Mevcut plan
   * @returns {Object} Skor detayları
   */
  calculatePlanRecommendationScore(plan, usagePattern, currentPlan) {
    let score = 0;
    const breakdown = {};

    // Kota uyumu (40 puan)
    const quotaFit = this.calculateQuotaFit(plan, usagePattern);
    score += quotaFit * 0.4;
    breakdown.quota_fit = quotaFit;

    // Maliyet verimliliği (30 puan)
    const costEfficiency = this.calculateCostEfficiency(plan, usagePattern);
    score += costEfficiency * 0.3;
    breakdown.cost_efficiency = costEfficiency;

    // Aşım riski (20 puan)
    const overageRisk = this.calculateOverageRisk(plan, usagePattern);
    score += (100 - overageRisk) * 0.2;
    breakdown.overage_risk = overageRisk;

    // Plan kararlılığı (10 puan)
    const stability = this.calculatePlanStability(plan);
    score += stability * 0.1;
    breakdown.stability = stability;

    return {
      total: Math.round(score),
      breakdown,
    };
  }

  /**
   * Kota uyumunu hesaplar
   * @param {Object} plan - Plan objesi
   * @param {Object} usagePattern - Kullanım deseni
   * @returns {number} Uyum skoru (0-100)
   */
  calculateQuotaFit(plan, usagePattern) {
    const gbFit = Math.min(
      100,
      (plan.quota_gb / (usagePattern.avg_gb || 10)) * 100
    );
    const minFit = Math.min(
      100,
      (plan.quota_min / (usagePattern.avg_minutes || 500)) * 100
    );

    return (gbFit + minFit) / 2;
  }

  /**
   * Maliyet verimliliğini hesaplar
   * @param {Object} plan - Plan objesi
   * @param {Object} usagePattern - Kullanım deseni
   * @returns {number} Verimlilik skoru (0-100)
   */
  calculateCostEfficiency(plan, usagePattern) {
    const gbValue = plan.quota_gb / plan.monthly_price;
    const minValue = plan.quota_min / plan.monthly_price;

    // Değer skoru hesaplama
    return Math.min(100, gbValue * 50 + minValue * 5);
  }

  /**
   * Aşım riskini hesaplar
   * @param {Object} plan - Plan objesi
   * @param {Object} usagePattern - Kullanım deseni
   * @returns {number} Risk skoru (0-100)
   */
  calculateOverageRisk(plan, usagePattern) {
    const avgGB = usagePattern.avg_gb || 10;
    const avgMin = usagePattern.avg_minutes || 500;

    let risk = 0;

    if (avgGB > plan.quota_gb) {
      risk += ((avgGB - plan.quota_gb) / plan.quota_gb) * 50;
    }

    if (avgMin > plan.quota_min) {
      risk += ((avgMin - plan.quota_min) / plan.quota_min) * 30;
    }

    return Math.min(100, risk);
  }

  /**
   * Plan kararlılığını hesaplar
   * @param {Object} plan - Plan objesi
   * @returns {number} Kararlılık skoru (0-100)
   */
  calculatePlanStability(plan) {
    // Basit kararlılık hesaplaması
    let stability = 70; // Temel puan

    if (plan.quota_gb >= 20) stability += 10;
    if (plan.monthly_price < 200) stability += 10;
    if (plan.overage_gb < 10) stability += 10;

    return Math.min(100, stability);
  }

  /**
   * Plan değişikliği tasarrufunu tahmin eder
   * @param {Object} newPlan - Yeni plan
   * @param {Object} currentPlan - Mevcut plan
   * @param {Object} usagePattern - Kullanım deseni
   * @returns {number} Tahmini tasarruf
   */
  estimatePlanSaving(newPlan, currentPlan, usagePattern) {
    // Basitleştirilmiş tasarruf hesaplaması
    const currentCost = currentPlan.monthly_price;
    const newCost = newPlan.monthly_price;

    return currentCost - newCost;
  }

  /**
   * Plan değişikliği sebebini belirler
   * @param {Object} newPlan - Yeni plan
   * @param {Object} currentPlan - Mevcut plan
   * @param {Object} usagePattern - Kullanım deseni
   * @returns {string} Değişiklik sebebi
   */
  getPlanSwitchReason(newPlan, currentPlan, usagePattern) {
    if (newPlan.monthly_price < currentPlan.monthly_price) {
      return "Daha uygun fiyat";
    }
    if (newPlan.quota_gb > currentPlan.quota_gb) {
      return "Daha fazla veri kotası";
    }
    if (newPlan.quota_min > currentPlan.quota_min) {
      return "Daha fazla konuşma kotası";
    }
    return "Daha iyi değer teklifi";
  }

  /**
   * Ek paket tasarrufunu tahmin eder
   * @param {Object} addon - Ek paket
   * @param {Object} usagePattern - Kullanım deseni
   * @returns {number} Tahmini tasarruf
   */
  estimateAddonSaving(addon, usagePattern) {
    // Basit tasarruf hesaplaması
    if (addon.extra_gb > 0 && usagePattern.overage_gb > 0) {
      const savedOverageCost =
        Math.min(addon.extra_gb, usagePattern.overage_gb) * 8.5;
      return savedOverageCost - addon.price;
    }
    return 0;
  }

  /**
   * Ek paket kullanım uyumunu hesaplar
   * @param {Object} addon - Ek paket
   * @param {Object} usagePattern - Kullanım deseni
   * @returns {string} Uyum seviyesi
   */
  calculateAddonUsageFit(addon, usagePattern) {
    if (addon.type === "data" && usagePattern.overage_gb > 0) return "high";
    if (addon.type === "voice" && usagePattern.overage_minutes > 0)
      return "high";
    if (addon.type === "combo") return "medium";
    return "low";
  }
}

export default new CatalogService();
