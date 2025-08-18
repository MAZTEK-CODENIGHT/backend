import { CatalogService } from "../services/index.js";

/**
 * CatalogController - Katalog işlemleri için controller (Interface Segregation Principle)
 * Sadece katalog (plan, addon, vas) ile ilgili API endpoint'lerden sorumludur
 */
class CatalogController {
  /**
   * Tüm katalog verilerini getirir
   * GET /api/catalog
   */
  async getAllCatalog(req, res, next) {
    try {
      const { type } = req.query;

      const catalogData = await CatalogService.getAllCatalogData();

      // Type filtrelemesi
      if (type && ["postpaid", "prepaid"].includes(type)) {
        catalogData.plans = catalogData.plans.filter(
          (plan) => plan.type === type
        );
      }

      res.status(200).json({
        success: true,
        data: catalogData,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Aktif planları getirir
   * GET /api/catalog/plans
   */
  async getPlans(req, res, next) {
    try {
      const { type, min_price, max_price, min_gb, sort } = req.query;

      let plans = await CatalogService.getActivePlans(type);

      // Fiyat filtrelemesi
      if (min_price) {
        plans = plans.filter(
          (plan) => plan.monthly_price >= parseFloat(min_price)
        );
      }
      if (max_price) {
        plans = plans.filter(
          (plan) => plan.monthly_price <= parseFloat(max_price)
        );
      }

      // GB kotası filtrelemesi
      if (min_gb) {
        plans = plans.filter((plan) => plan.quota_gb >= parseInt(min_gb));
      }

      // Sıralama
      if (sort) {
        switch (sort) {
          case "price_asc":
            plans.sort((a, b) => a.monthly_price - b.monthly_price);
            break;
          case "price_desc":
            plans.sort((a, b) => b.monthly_price - a.monthly_price);
            break;
          case "data_asc":
            plans.sort((a, b) => a.quota_gb - b.quota_gb);
            break;
          case "data_desc":
            plans.sort((a, b) => b.quota_gb - a.quota_gb);
            break;
          case "value":
            plans.sort((a, b) => b.value_score - a.value_score);
            break;
        }
      }

      res.status(200).json({
        success: true,
        data: plans,
        metadata: {
          total_plans: plans.length,
          filters_applied: {
            type: type || "all",
            price_range:
              min_price || max_price
                ? `${min_price || 0}-${max_price || "∞"}`
                : "none",
            min_gb: min_gb || "none",
            sort: sort || "default",
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Belirli plan detayını getirir
   * GET /api/catalog/plans/:planId
   */
  async getPlanDetails(req, res, next) {
    try {
      const { planId } = req.params;

      if (!planId || isNaN(planId)) {
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_PLAN_ID",
            message: "Geçerli bir plan ID gereklidir",
          },
        });
      }

      const plan = await CatalogService.getPlanById(parseInt(planId));

      if (!plan) {
        return res.status(404).json({
          success: false,
          error: {
            code: "PLAN_NOT_FOUND",
            message: "Plan bulunamadı",
            details: { plan_id: planId },
          },
        });
      }

      res.status(200).json({
        success: true,
        data: plan,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Aktif ek paketleri getirir
   * GET /api/catalog/addons
   */
  async getAddons(req, res, next) {
    try {
      const { plan_id, type, max_price, sort } = req.query;

      let addons = await CatalogService.getActiveAddons(
        plan_id ? parseInt(plan_id) : null
      );

      // Type filtrelemesi
      if (type && ["data", "voice", "sms", "combo"].includes(type)) {
        addons = addons.filter((addon) => addon.type === type);
      }

      // Fiyat filtrelemesi
      if (max_price) {
        addons = addons.filter((addon) => addon.price <= parseFloat(max_price));
      }

      // Sıralama
      if (sort) {
        switch (sort) {
          case "price_asc":
            addons.sort((a, b) => a.price - b.price);
            break;
          case "price_desc":
            addons.sort((a, b) => b.price - a.price);
            break;
          case "value":
            addons.sort(
              (a, b) => (a.value_per_gb || 0) - (b.value_per_gb || 0)
            );
            break;
          case "popularity":
            addons.sort((a, b) => {
              const aScore =
                a.popularity === "high" ? 3 : a.popularity === "medium" ? 2 : 1;
              const bScore =
                b.popularity === "high" ? 3 : b.popularity === "medium" ? 2 : 1;
              return bScore - aScore;
            });
            break;
        }
      }

      res.status(200).json({
        success: true,
        data: addons,
        metadata: {
          total_addons: addons.length,
          compatible_with_plan: plan_id || "all",
          filters_applied: {
            type: type || "all",
            max_price: max_price || "none",
            sort: sort || "default",
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * VAS hizmetlerini getirir
   * GET /api/catalog/vas
   */
  async getVAS(req, res, next) {
    try {
      const { category, max_price, min_rating } = req.query;

      let vasServices = await CatalogService.getActiveVAS(category);

      // Fiyat filtrelemesi
      if (max_price) {
        vasServices = vasServices.filter(
          (vas) => vas.monthly_fee <= parseFloat(max_price)
        );
      }

      // Rating filtrelemesi
      if (min_rating) {
        vasServices = vasServices.filter(
          (vas) => vas.user_rating >= parseFloat(min_rating)
        );
      }

      // Kategoriye göre grupla
      const groupedVAS = vasServices.reduce((groups, vas) => {
        const category = vas.category;
        if (!groups[category]) {
          groups[category] = [];
        }
        groups[category].push(vas);
        return groups;
      }, {});

      res.status(200).json({
        success: true,
        data: {
          services: vasServices,
          grouped_by_category: groupedVAS,
          categories: Object.keys(groupedVAS),
        },
        metadata: {
          total_services: vasServices.length,
          categories_count: Object.keys(groupedVAS).length,
          filters_applied: {
            category: category || "all",
            max_price: max_price || "none",
            min_rating: min_rating || "none",
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Premium SMS katalogunu getirir
   * GET /api/catalog/premium-sms
   */
  async getPremiumSMS(req, res, next) {
    try {
      const { category, max_price, risk_level } = req.query;

      let premiumSMS = await CatalogService.getActivePremiumSMS();

      // Kategori filtrelemesi
      if (category) {
        premiumSMS = premiumSMS.filter((sms) => sms.category === category);
      }

      // Fiyat filtrelemesi
      if (max_price) {
        premiumSMS = premiumSMS.filter(
          (sms) => sms.unit_price <= parseFloat(max_price)
        );
      }

      // Risk seviyesi filtrelemesi
      if (risk_level && ["low", "medium", "high"].includes(risk_level)) {
        premiumSMS = premiumSMS.filter((sms) => sms.risk_level === risk_level);
      }

      // Risk seviyesine göre grupla
      const groupedByRisk = premiumSMS.reduce((groups, sms) => {
        const risk = sms.risk_level;
        if (!groups[risk]) {
          groups[risk] = [];
        }
        groups[risk].push(sms);
        return groups;
      }, {});

      res.status(200).json({
        success: true,
        data: {
          services: premiumSMS,
          grouped_by_risk: groupedByRisk,
          risk_distribution: {
            high: groupedByRisk.high?.length || 0,
            medium: groupedByRisk.medium?.length || 0,
            low: groupedByRisk.low?.length || 0,
          },
        },
        metadata: {
          total_services: premiumSMS.length,
          filters_applied: {
            category: category || "all",
            max_price: max_price || "none",
            risk_level: risk_level || "all",
          },
          warning:
            "Premium SMS servisleri ek ücrete tabidir ve dikkatli kullanılmalıdır",
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Kullanıcıya özel öneriler
   * POST /api/catalog/recommendations
   */
  async getRecommendations(req, res, next) {
    try {
      const { user_id, usage_pattern, recommendation_type = "all" } = req.body;

      if (!user_id) {
        return res.status(400).json({
          success: false,
          error: {
            code: "MISSING_USER_ID",
            message: "user_id parametresi gereklidir",
          },
        });
      }

      const recommendations = {};

      // Plan önerileri
      if (recommendation_type === "all" || recommendation_type === "plans") {
        try {
          recommendations.plans = await CatalogService.getPlanRecommendations(
            user_id,
            usage_pattern || {}
          );
        } catch (error) {
          recommendations.plans = [];
          console.warn("Plan önerileri alınamadı:", error.message);
        }
      }

      // Ek paket önerileri
      if (recommendation_type === "all" || recommendation_type === "addons") {
        try {
          recommendations.addons = await CatalogService.getAddonRecommendations(
            user_id,
            usage_pattern || {}
          );
        } catch (error) {
          recommendations.addons = [];
          console.warn("Ek paket önerileri alınamadı:", error.message);
        }
      }

      res.status(200).json({
        success: true,
        data: {
          user_id,
          recommendations,
          usage_pattern: usage_pattern || {},
          recommendation_type,
          generated_at: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Katalog istatistikleri
   * GET /api/catalog/stats
   */
  async getCatalogStats(req, res, next) {
    try {
      const catalogData = await CatalogService.getAllCatalogData();

      // Plan istatistikleri
      const planStats = {
        total: catalogData.plans.length,
        by_type: catalogData.plans.reduce((acc, plan) => {
          acc[plan.type] = (acc[plan.type] || 0) + 1;
          return acc;
        }, {}),
        price_range: {
          min: Math.min(...catalogData.plans.map((p) => p.monthly_price)),
          max: Math.max(...catalogData.plans.map((p) => p.monthly_price)),
          average: (
            catalogData.plans.reduce((sum, p) => sum + p.monthly_price, 0) /
            catalogData.plans.length
          ).toFixed(2),
        },
        data_range: {
          min: Math.min(...catalogData.plans.map((p) => p.quota_gb)),
          max: Math.max(...catalogData.plans.map((p) => p.quota_gb)),
          average: (
            catalogData.plans.reduce((sum, p) => sum + p.quota_gb, 0) /
            catalogData.plans.length
          ).toFixed(1),
        },
      };

      // Ek paket istatistikleri
      const addonStats = {
        total: catalogData.addons.length,
        by_type: catalogData.addons.reduce((acc, addon) => {
          acc[addon.type] = (acc[addon.type] || 0) + 1;
          return acc;
        }, {}),
        price_range: {
          min: Math.min(...catalogData.addons.map((a) => a.price)),
          max: Math.max(...catalogData.addons.map((a) => a.price)),
          average: (
            catalogData.addons.reduce((sum, a) => sum + a.price, 0) /
            catalogData.addons.length
          ).toFixed(2),
        },
      };

      // VAS istatistikleri
      const vasStats = {
        total: catalogData.vas.length,
        by_category: catalogData.vas.reduce((acc, vas) => {
          acc[vas.category] = (acc[vas.category] || 0) + 1;
          return acc;
        }, {}),
        fee_range: {
          min: Math.min(...catalogData.vas.map((v) => v.monthly_fee)),
          max: Math.max(...catalogData.vas.map((v) => v.monthly_fee)),
          average: (
            catalogData.vas.reduce((sum, v) => sum + v.monthly_fee, 0) /
            catalogData.vas.length
          ).toFixed(2),
        },
      };

      res.status(200).json({
        success: true,
        data: {
          plans: planStats,
          addons: addonStats,
          vas: vasStats,
          premium_sms: {
            total: catalogData.premium_sms.length,
            categories: [
              ...new Set(catalogData.premium_sms.map((s) => s.category)),
            ],
          },
          last_updated: catalogData.metadata.last_updated,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new CatalogController();
